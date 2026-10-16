import express, { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { calculateDistanceKm } from '../utils/matching';

const router = express.Router();
router.use(authenticate);
const massUnits: Record<string, number> = { kg: 1, kilogram: 1, kilograms: 1, ton: 1000, tonne: 1000, tonnes: 1000, t: 1000, lb: 0.45359237, lbs: 0.45359237 };
const configuredNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};
const configuredFactor = (name: string): number | null => {
  const value = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
};
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*, l.title AS listing_title, l.unit AS listing_unit, m.material_name,
       buyer.company_name AS buyer_name, seller.company_name AS seller_name
       FROM transactions t LEFT JOIN material_listings l ON l.listing_id=t.listing_id
       LEFT JOIN materials m ON m.material_id=l.material_id
       LEFT JOIN users buyer ON buyer.user_id=t.buyer_id LEFT JOIN users seller ON seller.user_id=t.seller_id
       WHERE t.buyer_id=$1 OR t.seller_id=$1 ORDER BY t.created_at DESC`, [req.user.id]
    );
    res.json(result.rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load exchange requests.' }); }
});

router.post('/', async (req: Request, res: Response) => {
  const { value, error } = Joi.object({ listing_id: Joi.number().integer().positive().required(), quantity: Joi.number().positive().required() }).validate(req.body, { convert: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query(
      `SELECT l.*, m.material_name
       FROM material_listings l JOIN materials m ON m.material_id=l.material_id
       WHERE l.listing_id=$1 AND l.is_active=TRUE
         AND (l.available_until IS NULL OR l.available_until >= CURRENT_DATE)
         AND l.seller_id<>$2`, [value.listing_id, req.user.id]
    );
    if (!result.rowCount) { await db.query('ROLLBACK'); return res.status(404).json({ message: 'Active marketplace listing not found, or you cannot request your own listing.' }); }
    const listing = result.rows[0];
    const minimumOrder = Number(listing.minimum_order_quantity || 0);
    if (Number(value.quantity) < minimumOrder || Number(value.quantity) > Number(listing.quantity)) {
      await db.query('ROLLBACK'); return res.status(400).json({ message: `Requested quantity must be between ${minimumOrder || 'the listing minimum'} and ${listing.quantity} ${listing.unit}.` });
    }
    const unitPrice = Number(listing.price_per_unit || 0);
    const totalPrice = unitPrice * Number(value.quantity);
    const currency = listing.currency || 'USD';
    const kgPerUnit = massUnits[String(listing.unit).trim().toLowerCase()];
    const quantityKg = kgPerUnit ? Number(value.quantity) * kgPerUnit : null;
    const buyerLocation = await db.query(
      `SELECT latitude, longitude FROM buyer_requirements
       WHERE buyer_id=$1 AND is_active=TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY updated_at DESC, requirement_id DESC LIMIT 1`, [req.user.id]
    );
    let distanceKm: number | null = null;
    const destination = buyerLocation.rows[0];
    if (listing.origin_latitude != null && listing.origin_longitude != null && destination) {
      distanceKm = calculateDistanceKm(Number(listing.origin_latitude), Number(listing.origin_longitude), Number(destination.latitude), Number(destination.longitude));
    }
    const transportRate = configuredNumber('TRANSPORT_COST_PER_TONNE_KM', 0.12);
    const avoidedDisposalRate = configuredNumber('AVOIDED_DISPOSAL_COST_PER_KG', 0.03);
    const transportEmissionFactor = configuredFactor('TRANSPORT_EMISSIONS_KG_PER_TONNE_KM');
    const avoidedDisposalEmissionFactor = configuredFactor('AVOIDED_DISPOSAL_CO2_KG_PER_KG');
    const transportCost = distanceKm !== null && quantityKg !== null
      ? quantityKg / 1000 * distanceKm * transportRate
      : null;
    const co2SavedKg = distanceKm !== null && quantityKg !== null && transportEmissionFactor !== null && avoidedDisposalEmissionFactor !== null
      ? Math.max(0, quantityKg * avoidedDisposalEmissionFactor - quantityKg / 1000 * distanceKm * transportEmissionFactor)
      : null;
    const netBenefit = transportCost !== null && quantityKg !== null
      ? totalPrice + quantityKg * avoidedDisposalRate - transportCost
      : null;
    const notes = `Buyer requested this listing directly from the marketplace. The listing owner must review and accept it. ${co2SavedKg === null ? 'CO2e estimate unavailable: add listing and buyer coordinates and configure both emission factors.' : 'CO2e is a straight-line estimate using the buyer’s most recently updated active requirement coordinates.'}`;
    const assumptions = {
      distance_method: 'straight-line distance from listing origin to the buyer’s most recently updated active requirement coordinates',
      transport_cost_per_tonne_km: transportRate,
      transport_emissions_kg_per_tonne_km: transportEmissionFactor,
      avoided_disposal_co2_kg_per_kg: avoidedDisposalEmissionFactor,
      avoided_disposal_cost_per_kg: avoidedDisposalRate,
      estimate_only: true,
    };
    const created = await db.query(
      `INSERT INTO transactions(listing_id,buyer_id,seller_id,requested_by,quantity,unit_price,currency,total_price,status,notes,
       logistics_distance_km,transport_cost,net_benefit,waste_diverted_kg,co2_saved_kg,feasibility_assumptions)
       VALUES($1,$2,$3,$2,$4,$5,$6,$7,'pending',$8,$9,$10,$11,$12,$13,$14) RETURNING transaction_id`,
      [value.listing_id, req.user.id, listing.seller_id, Number(value.quantity), unitPrice, currency, totalPrice, notes,
        distanceKm, transportCost, netBenefit, quantityKg, co2SavedKg, JSON.stringify(assumptions)]
    );
    await db.query('COMMIT');
    res.status(201).json({ id: created.rows[0].transaction_id, message: 'Request sent. The listing owner can accept or decline it.' });
  } catch (error) {
    await db.query('ROLLBACK'); console.error(error); res.status(500).json({ message: 'Unable to submit exchange request. Check the server logs for the database error.' });
  } finally { db.release(); }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { value, error } = Joi.object({ status: Joi.string().valid('approved', 'cancelled').required() }).validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  try {
    const result = await pool.query(
  `UPDATE transactions SET status=$1::transaction_status, updated_at=CURRENT_TIMESTAMP
   WHERE transaction_id=$2 AND status='pending'
   AND (($1='approved' AND seller_id=$3 AND requested_by IS DISTINCT FROM $3)
     OR ($1='cancelled' AND (seller_id=$3 OR buyer_id=$3)))
   RETURNING transaction_id,status`,
  [value.status, req.params.id, req.user.id]
);
    if (!result.rowCount) return res.status(404).json({ message: 'Pending exchange not found or you are not allowed to update it.' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to update exchange status.' }); }
});

export default router;
