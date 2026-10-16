-- Run once after schema.sql to add the first-version requirements and feasibility data.
CREATE TABLE IF NOT EXISTS buyer_requirements (
  requirement_id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  material_category VARCHAR(255) NOT NULL,
  material_name VARCHAR(255),
  minimum_quantity DECIMAL(12,2) NOT NULL CHECK (minimum_quantity > 0),
  unit VARCHAR(50) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  latitude DECIMAL(10,8) CHECK (latitude BETWEEN -90 AND 90),
  longitude DECIMAL(11,8) CHECK (longitude BETWEEN -180 AND 180),
  max_distance_km DECIMAL(10,2) CHECK (max_distance_km > 0),
  processing_cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (processing_cost >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyer_requirement_properties (
  property_id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES buyer_requirements(requirement_id) ON DELETE CASCADE,
  property_name VARCHAR(255) NOT NULL,
  minimum_value DECIMAL(18,6),
  maximum_value DECIMAL(18,6),
  unit VARCHAR(50),
  CHECK (minimum_value IS NOT NULL OR maximum_value IS NOT NULL)
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logistics_distance_km DECIMAL(10,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS requested_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transport_cost DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS net_benefit DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS waste_diverted_kg DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS co2_saved_kg DECIMAL(12,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS feasibility_assumptions JSONB;

CREATE INDEX IF NOT EXISTS idx_buyer_requirements_buyer_active ON buyer_requirements(buyer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_buyer_requirements_material ON buyer_requirements(lower(material_category), lower(material_name));
CREATE INDEX IF NOT EXISTS idx_listing_active ON material_listings(is_active, material_id);
