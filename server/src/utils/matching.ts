type ListingProperty = { property_name: string; property_value: string | number; unit: string | null };
type RequirementProperty = { property_name: string; minimum_value: string | number | null; maximum_value: string | number | null; unit: string | null };

const kgFactors: Record<string, number> = {
  kg: 1, kilogram: 1, kilograms: 1,
  ton: 1000, tonne: 1000, tonnes: 1000, t: 1000,
  lb: 0.45359237, lbs: 0.45359237,
};

export const normalizeMaterialName = (value: string | null | undefined): string => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'aluminium' ? 'aluminum' : normalized;
};

export const qualityPropertiesMatch = (listing: ListingProperty[], required: RequirementProperty[]): boolean =>
  required.every((rule) => {
    const name = rule.property_name.trim().toLowerCase();
    const actual = listing.find((property) => property.property_name.trim().toLowerCase() === name);
    if (!actual) return false;
    if (rule.unit?.trim() && (!actual.unit?.trim() || rule.unit.trim().toLowerCase() !== actual.unit.trim().toLowerCase())) return false;
    const value = Number(actual.property_value);
    return Number.isFinite(value)
      && (rule.minimum_value == null || value >= Number(rule.minimum_value))
      && (rule.maximum_value == null || value <= Number(rule.maximum_value));
  });

export const quantityIsSufficient = (supply: number, supplyUnit: string, demand: number, demandUnit: string): boolean => {
  const supplyFactor = kgFactors[supplyUnit.trim().toLowerCase()];
  const demandFactor = kgFactors[demandUnit.trim().toLowerCase()];
  if (supplyFactor !== undefined && demandFactor !== undefined) return supply * supplyFactor >= demand * demandFactor;
  return supplyUnit.trim().toLowerCase() === demandUnit.trim().toLowerCase() && supply >= demand;
};

export const distanceIsAllowed = (distanceKm: number | null, maximumDistanceKm: number | string | null): boolean =>
  maximumDistanceKm == null || (distanceKm !== null && Number.isFinite(distanceKm) && distanceKm <= Number(maximumDistanceKm));

export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
