import express, { Request, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { calculateDistanceKm, distanceIsAllowed, normalizeMaterialName, quantityIsSufficient, qualityPropertiesMatch } from '../utils/matching';

const router = express.Router();
const asKg = (quantity: number, unit: string) => {
  const factor = { kg: 1, kilogram: 1, kilograms: 1, ton: 1000, tonne: 1000, tonnes: 1000, t: 1000, lb: 0.45359237, lbs: 0.45359237 }[unit.trim().toLowerCase()];
  return factor ? quantity * factor : null;
};
const numberSetting = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const optionalFactor = (name: string): number | null => {
  const parsed = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

router.get('/:listingId', authenticate, async (req: Request, res: Response) => {
  try {
    const listingResult = await pool.query(
      `SELECT l.*, m.material_name, c.category_name, u.company_name
       FROM material_listings l JOIN materials m ON m.material_id=l.material_id
       LEFT JOIN material_categories c ON c.category_id=m.category_id JOIN users u ON u.user_id=l.seller_id
       WHERE l.listing_id=$1 AND l.is_active=TRUE
         AND (l.available_until IS NULL OR l.available_until >= CURRENT_DATE)`, [req.params.listingId]
    );
    if (!listingResult.rowCount) return res.status(404).json({ message: 'Active listing not found.' });
    const listing = listingResult.rows[0];
    if (Number(listing.seller_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the listing owner can view compatible buyer requirements.' });
    }
    const candidates = await pool.query(
      `SELECT r.*, u.company_name AS buyer_name FROM buyer_requirements r
       JOIN users u ON u.user_id=r.buyer_id
       WHERE r.is_active=TRUE AND r.buyer_id<>$1
         AND lower(trim(r.material_category))=lower(trim($2))
       ORDER BY r.requirement_id`, [listing.seller_id, listing.category_name]
    );
    const materialCandidates = candidates.rows.filter((buyer) =>
      buyer.material_name == null || normalizeMaterialName(buyer.material_name) === normalizeMaterialName(listing.material_name)
    );
    const listingProperties = await pool.query('SELECT property_name,property_value,unit FROM listing_properties WHERE listing_id=$1', [listing.listing_id]);
    const matches = [];
    const transportRate = numberSetting('TRANSPORT_COST_PER_TONNE_KM', 0.12);
    const transportEmission = optionalFactor('TRANSPORT_EMISSIONS_KG_PER_TONNE_KM');
    const avoidedDisposalEmission = optionalFactor('AVOIDED_DISPOSAL_CO2_KG_PER_KG');
    const avoidedDisposalCost = numberSetting('AVOIDED_DISPOSAL_COST_PER_KG', 0.03);
    for (const buyer of materialCandidates) {
      const requiredProperties = await pool.query('SELECT * FROM buyer_requirement_properties WHERE requirement_id=$1', [buyer.requirement_id]);
      if (!qualityPropertiesMatch(listingProperties.rows, requiredProperties.rows)) continue;

      const supplyKg = asKg(Number(listing.quantity), listing.unit);
      const demandKg = asKg(Number(buyer.minimum_quantity), buyer.unit);
      const quantitySufficient = quantityIsSufficient(Number(listing.quantity), listing.unit, Number(buyer.minimum_quantity), buyer.unit);
      if (!quantitySufficient) continue;
      const requestedQuantity = quantitySufficient ? Number(buyer.minimum_quantity) : Number(listing.quantity);
      const tradedKg = supplyKg !== null && demandKg !== null ? Math.min(supplyKg, demandKg) : null;
      let km: number | null = null;
      if (listing.origin_latitude != null && listing.origin_longitude != null && buyer.latitude != null && buyer.longitude != null) {
        km = calculateDistanceKm(Number(listing.origin_latitude), Number(listing.origin_longitude), Number(buyer.latitude), Number(buyer.longitude));
      }
      const distanceAllowed = distanceIsAllowed(km, buyer.max_distance_km);
      if (!distanceAllowed) continue;
      const rateUsable = tradedKg !== null;
      const transportCost = km !== null && rateUsable ? (tradedKg! / 1000) * km * transportRate : null;
      const listingUnitKg = asKg(1, listing.unit);
      const tradedInListingUnits = tradedKg !== null && listingUnitKg !== null
        ? tradedKg / listingUnitKg
        : Math.min(Number(listing.quantity), Number(buyer.minimum_quantity));
      const revenue = Number(listing.price_per_unit) * tradedInListingUnits;
      const disposalSaving = tradedKg !== null ? tradedKg * avoidedDisposalCost : null;
      const netBenefit = transportCost !== null && disposalSaving !== null
        ? revenue + disposalSaving - transportCost - Number(buyer.processing_cost)
        : null;
      const co2Saved = km !== null && tradedKg !== null && transportEmission !== null && avoidedDisposalEmission !== null
        ? Math.max(0, tradedKg * avoidedDisposalEmission - (tradedKg / 1000) * km * transportEmission)
        : null;
      const assumptions = [
        'Straight-line distance from the two stored coordinates; actual road distance may be higher.',
        `Transport rate: ${transportRate} per tonne-km (configurable).`,
        `Avoided disposal cost: ${avoidedDisposalCost} per kg (configurable).`,
        transportEmission === null || avoidedDisposalEmission === null
          ? 'CO2e estimate is unavailable until documented avoided-disposal and transport emission factors are configured.'
          : `Avoided disposal factor: ${avoidedDisposalEmission} kg CO2e per kg; transport factor: ${transportEmission} kg CO2e per tonne-km (configured).`,
        'All economic and environmental values are estimates, not verified real-world savings.'
      ];
      matches.push({
        requirement_id: buyer.requirement_id, buyer_id: buyer.buyer_id, buyer_name: buyer.buyer_name,
        category: buyer.material_category, material_name: buyer.material_name || listing.material_name,
        required_quantity: Number(buyer.minimum_quantity), required_unit: buyer.unit,
        available_quantity: Number(listing.quantity), available_unit: listing.unit,
        requested_quantity: requestedQuantity, quantity_sufficient: quantitySufficient,
        exchange_quantity: tradedInListingUnits, exchange_unit: listing.unit,
        distance_km: km === null ? null : Math.round(km * 100) / 100,
        distance_allowed: distanceAllowed, is_feasible: quantitySufficient && distanceAllowed,
        transport_cost: transportCost === null ? null : Math.round(transportCost * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        processing_cost: Number(buyer.processing_cost), avoided_disposal_cost: disposalSaving === null ? null : Math.round(disposalSaving * 100) / 100,
        net_benefit: netBenefit === null ? null : Math.round(netBenefit * 100) / 100,
        waste_diverted_kg: tradedKg === null ? null : Math.round(tradedKg * 100) / 100,
        co2_saved_kg: co2Saved === null ? null : Math.round(co2Saved * 100) / 100,
        assumptions,
      });
    }
    matches.sort((a: any, b: any) => {
      if (a.distance_km === null && b.distance_km !== null) return 1;
      if (a.distance_km !== null && b.distance_km === null) return -1;
      return (a.distance_km ?? 0) - (b.distance_km ?? 0) || a.requirement_id - b.requirement_id;
    });
    res.json({ listing_id: Number(listing.listing_id), matches });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to calculate matches. Apply the MVP database migration first.' }); }
});

export default router;
