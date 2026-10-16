import express, { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();
const materialCategories = ['Plastics', 'Metals', 'Paper & Pulp', 'Textiles', 'Glass', 'Organics', 'Construction', 'Electronics'];
const listingInput = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().allow('', null).default(''),
  category: Joi.string().trim().valid(...materialCategories).required(),
  material_name: Joi.string().trim().required(),
  physical_form: Joi.string().valid('solid', 'liquid', 'gas', 'mixed').default('solid'),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().trim().max(50).required(),
  price_per_unit: Joi.number().min(0).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  origin_city: Joi.string().trim().allow('', null).default(''),
  origin_country: Joi.string().trim().allow('', null).default(''),
  origin_latitude: Joi.number().min(-90).max(90).allow(null),
  origin_longitude: Joi.number().min(-180).max(180).allow(null),
  available_from: Joi.date().iso().default(() => new Date()),
  available_until: Joi.date().iso().allow(null),
  quality_certification: Joi.string().allow('', null).default(''),
  properties: Joi.array().items(Joi.object({ name: Joi.string().trim().required(), value: Joi.string().trim().required(), unit: Joi.string().allow('').default('') })).default([]),
});

const listingSelect = `SELECT l.listing_id AS id, l.seller_id, l.title, l.description, l.quantity, l.unit, l.minimum_order_quantity,
  l.price_per_unit, l.currency, l.origin_city, l.origin_country, l.origin_latitude, l.origin_longitude,
  l.available_from, l.available_until, l.quality_certification, l.is_active,
  m.material_name, m.physical_form, c.category_name AS category, u.company_name AS seller_name
  FROM material_listings l JOIN materials m ON m.material_id=l.material_id
  LEFT JOIN material_categories c ON c.category_id=m.category_id JOIN users u ON u.user_id=l.seller_id`;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await pool.query(`${listingSelect} WHERE l.is_active=TRUE AND (l.available_until IS NULL OR l.available_until >= CURRENT_DATE) ORDER BY l.created_at DESC`);
    res.json(rows.rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load listings.' }); }
});

router.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await pool.query(`${listingSelect} WHERE l.seller_id=$1 ORDER BY l.created_at DESC`, [req.user.id]);
    res.json(rows.rows);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load your listings.' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rows = await pool.query(`${listingSelect} WHERE l.listing_id=$1 AND l.is_active=TRUE`, [req.params.id]);
    if (!rows.rowCount) return res.status(404).json({ message: 'Listing not found.' });
    const properties = await pool.query('SELECT property_name AS name, property_value AS value, unit FROM listing_properties WHERE listing_id=$1 ORDER BY property_id', [req.params.id]);
    res.json({ ...rows.rows[0], properties: properties.rows });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load listing.' }); }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const { value, error } = listingInput.validate(req.body, { abortEarly: true, convert: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    let category = await db.query('SELECT category_id FROM material_categories WHERE lower(category_name)=lower($1) LIMIT 1', [value.category]);
    if (!category.rowCount) category = await db.query('INSERT INTO material_categories(category_name) VALUES($1) RETURNING category_id', [value.category]);
    let material = await db.query('SELECT material_id FROM materials WHERE category_id=$1 AND lower(material_name)=lower($2) LIMIT 1', [category.rows[0].category_id, value.material_name]);
    if (!material.rowCount) material = await db.query('INSERT INTO materials(category_id, material_name, physical_form) VALUES($1,$2,$3) RETURNING material_id', [category.rows[0].category_id, value.material_name, value.physical_form]);
    const result = await db.query(
      `INSERT INTO material_listings (seller_id,material_id,title,description,quantity,unit,price_per_unit,currency,available_from,available_until,origin_city,origin_country,origin_latitude,origin_longitude,quality_certification,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE) RETURNING listing_id`,
      [req.user.id, material.rows[0].material_id, value.title, value.description, value.quantity, value.unit, value.price_per_unit, value.currency, value.available_from, value.available_until || null, value.origin_city || null, value.origin_country || null, value.origin_latitude ?? null, value.origin_longitude ?? null, value.quality_certification || null]
    );
    const listingId = result.rows[0].listing_id;
    for (const property of value.properties) await db.query('INSERT INTO listing_properties(listing_id,property_name,property_value,unit) VALUES($1,$2,$3,$4)', [listingId, property.name, property.value, property.unit || null]);
    await db.query('COMMIT');
    res.status(201).json({ id: listingId, message: 'Listing created.' });
  } catch (error) {
    await db.query('ROLLBACK'); console.error(error); res.status(500).json({ message: 'Unable to create listing.' });
  } finally { db.release(); }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const { value, error } = listingInput.validate(req.body, { abortEarly: true, convert: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const owned = await db.query('SELECT listing_id FROM material_listings WHERE listing_id=$1 AND seller_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!owned.rowCount) { await db.query('ROLLBACK'); return res.status(404).json({ message: 'Listing not found.' }); }
    let category = await db.query('SELECT category_id FROM material_categories WHERE lower(category_name)=lower($1) LIMIT 1', [value.category]);
    if (!category.rowCount) category = await db.query('INSERT INTO material_categories(category_name) VALUES($1) RETURNING category_id', [value.category]);
    let material = await db.query('SELECT material_id FROM materials WHERE category_id=$1 AND lower(material_name)=lower($2) LIMIT 1', [category.rows[0].category_id, value.material_name]);
    if (!material.rowCount) material = await db.query('INSERT INTO materials(category_id,material_name,physical_form) VALUES($1,$2,$3) RETURNING material_id', [category.rows[0].category_id, value.material_name, value.physical_form]);
    else await db.query('UPDATE materials SET physical_form=$1,updated_at=CURRENT_TIMESTAMP WHERE material_id=$2', [value.physical_form, material.rows[0].material_id]);
    await db.query(
      `UPDATE material_listings SET material_id=$1,title=$2,description=$3,quantity=$4,unit=$5,price_per_unit=$6,currency=$7,
       available_from=$8,available_until=$9,origin_city=$10,origin_country=$11,origin_latitude=$12,origin_longitude=$13,
       quality_certification=$14,updated_at=CURRENT_TIMESTAMP WHERE listing_id=$15`,
      [material.rows[0].material_id,value.title,value.description,value.quantity,value.unit,value.price_per_unit,value.currency,value.available_from,value.available_until||null,value.origin_city||null,value.origin_country||null,value.origin_latitude??null,value.origin_longitude??null,value.quality_certification||null,req.params.id]
    );
    await db.query('DELETE FROM listing_properties WHERE listing_id=$1', [req.params.id]);
    for (const property of value.properties) await db.query('INSERT INTO listing_properties(listing_id,property_name,property_value,unit) VALUES($1,$2,$3,$4)', [req.params.id,property.name,property.value,property.unit||null]);
    await db.query('COMMIT');
    res.json({ id:Number(req.params.id), message:'Listing updated.' });
  } catch (error) { await db.query('ROLLBACK'); console.error(error); res.status(500).json({ message:'Unable to update listing.' }); }
  finally { db.release(); }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('UPDATE material_listings SET is_active=FALSE, updated_at=CURRENT_TIMESTAMP WHERE listing_id=$1 AND seller_id=$2 RETURNING listing_id', [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Listing not found.' });
    res.json({ message: 'Listing closed.' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to close listing.' }); }
});

export default router;
