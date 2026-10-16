import express, { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();
router.use(authenticate);
const materialCategories = ['Plastics', 'Metals', 'Paper & Pulp', 'Textiles', 'Glass', 'Organics', 'Construction', 'Electronics'];
const inputSchema = Joi.object({
  material_category: Joi.string().trim().valid(...materialCategories).required(),
  material_name: Joi.string().trim().allow('', null),
  minimum_quantity: Joi.number().positive().required(),
  unit: Joi.string().trim().max(50).required(),
  city: Joi.string().trim().allow('', null), country: Joi.string().trim().allow('', null),
  latitude: Joi.number().min(-90).max(90).allow(null), longitude: Joi.number().min(-180).max(180).allow(null),
  max_distance_km: Joi.number().positive().allow(null), processing_cost: Joi.number().min(0).default(0),
  properties: Joi.array().items(Joi.object({ name: Joi.string().trim().required(), minimum: Joi.number().allow(null), maximum: Joi.number().allow(null), unit: Joi.string().allow('').default('') }).or('minimum', 'maximum')).default([]),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await pool.query('SELECT * FROM buyer_requirements WHERE buyer_id=$1 AND is_active=TRUE ORDER BY created_at DESC', [req.user.id]);
    const result = await Promise.all(rows.rows.map(async (requirement) => {
      const properties = await pool.query('SELECT property_name AS name, minimum_value AS minimum, maximum_value AS maximum, unit FROM buyer_requirement_properties WHERE requirement_id=$1 ORDER BY property_id', [requirement.requirement_id]);
      return { ...requirement, properties: properties.rows };
    }));
    res.json(result);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load requirements. Apply the MVP database migration first.' }); }
});

router.post('/', async (req: Request, res: Response) => {
  const { value, error } = inputSchema.validate(req.body, { abortEarly: true, convert: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const inserted = await db.query(
      `INSERT INTO buyer_requirements(buyer_id,material_category,material_name,minimum_quantity,unit,city,country,latitude,longitude,max_distance_km,processing_cost)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING requirement_id`,
      [req.user.id, value.material_category, value.material_name || null, value.minimum_quantity, value.unit, value.city || null, value.country || null, value.latitude ?? null, value.longitude ?? null, value.max_distance_km ?? null, value.processing_cost]
    );
    for (const property of value.properties) {
      const low = property.minimum ?? null; const high = property.maximum ?? null;
      if (low !== null && high !== null && low > high) throw new Error(`Minimum ${property.name} cannot exceed maximum.`);
      await db.query('INSERT INTO buyer_requirement_properties(requirement_id,property_name,minimum_value,maximum_value,unit) VALUES($1,$2,$3,$4,$5)', [inserted.rows[0].requirement_id, property.name, low, high, property.unit || null]);
    }
    await db.query('COMMIT');
    res.status(201).json({ id: inserted.rows[0].requirement_id, message: 'Buyer requirement saved.' });
  } catch (error: any) {
    await db.query('ROLLBACK'); console.error(error);
    res.status(error.message?.startsWith('Minimum ') ? 400 : 500).json({ message: error.message?.startsWith('Minimum ') ? error.message : 'Unable to save requirement.' });
  } finally { db.release(); }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { value, error } = inputSchema.validate(req.body, { abortEarly: true, convert: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const invalidRange = value.properties.find((property: any) => property.minimum != null && property.maximum != null && property.minimum > property.maximum);
  if (invalidRange) return res.status(400).json({ message: `Minimum ${invalidRange.name} cannot exceed maximum.` });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const updated = await db.query(
      `UPDATE buyer_requirements SET material_category=$1,material_name=$2,minimum_quantity=$3,unit=$4,
       city=$5,country=$6,latitude=$7,longitude=$8,max_distance_km=$9,processing_cost=$10,updated_at=CURRENT_TIMESTAMP
       WHERE requirement_id=$11 AND buyer_id=$12 AND is_active=TRUE RETURNING requirement_id`,
      [value.material_category, value.material_name || null, value.minimum_quantity, value.unit, value.city || null,
        value.country || null, value.latitude ?? null, value.longitude ?? null, value.max_distance_km ?? null,
        value.processing_cost, req.params.id, req.user.id]
    );
    if (!updated.rowCount) {
      await db.query('ROLLBACK');
      return res.status(404).json({ message: 'Active requirement not found or you are not allowed to edit it.' });
    }
    await db.query('DELETE FROM buyer_requirement_properties WHERE requirement_id=$1', [req.params.id]);
    for (const property of value.properties) {
      await db.query(
        'INSERT INTO buyer_requirement_properties(requirement_id,property_name,minimum_value,maximum_value,unit) VALUES($1,$2,$3,$4,$5)',
        [req.params.id, property.name, property.minimum ?? null, property.maximum ?? null, property.unit || null]
      );
    }
    await db.query('COMMIT');
    return res.json({ id: Number(req.params.id), message: 'Buyer requirement updated.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Unable to update requirement.' });
  } finally { db.release(); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('UPDATE buyer_requirements SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE requirement_id=$1 AND buyer_id=$2 RETURNING requirement_id', [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Requirement not found.' });
    res.json({ message: 'Requirement closed.' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to close requirement.' }); }
});

export default router;
