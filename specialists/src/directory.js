// The specialist directory: the one place this feature gets specialists from.
//
// It reads the team's shared Maastricht database export
// (specialist-directory/data/maastricht-specialists.json) and turns each record into
// the shape the shortlist code uses. Every directory has the same async interface
// (list / get / markSlotBooked), so a future Centrix-backed directory can replace
// this one without changing any caller.
//
// About the data: 10 records are real businesses from public listings and 30 are
// fictional demo records. Prices and availability are demo estimates for ALL of them,
// and nobody in this directory should be contacted from the demo.

import { CITY } from "./catalog.js";

// Resolved relative to this file, so it works from any page. Assumes the repo has
// specialists/ and specialist-directory/ side by side at the top level.
export const DEFAULT_DATA_URL = new URL("../../specialist-directory/data/maastricht-specialists.json", import.meta.url).href;
const SLOT_HOURS = 2;

/** Converts one record from the team's JSON export into a Specialist. */
export function normalizeRecord(r) {
  const priceEstimates = {};
  let currency = "EUR";
  for (const p of r.priceRanges ?? []) {
    priceEstimates[p.problem_type] = { low: p.minimum_eur, high: p.maximum_eur };
    currency = p.currency ?? currency;
  }
  const hasScore = r.reviews?.score != null && r.reviews.count > 0;
  const availability = [];
  if (r.nextAvailableAt) {
    const start = new Date(r.nextAvailableAt);
    availability.push({
      start: start.toISOString(),
      end: new Date(start.getTime() + SLOT_HOURS * 3600 * 1000).toISOString(),
    });
  }
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    area: r.area,
    address: r.address ?? null,
    postcode: r.postcode ?? null,
    position: r.position ? [r.position.latitude, r.position.longitude] : null,
    services: [...(r.services ?? [])],
    priceEstimates,
    currency,
    rating: hasScore
      ? { average: r.reviews.score, count: r.reviews.count, simulated: !!r.reviews.simulated, source: r.reviews.source ?? null }
      : null,
    availability,
    origin: r.recordOrigin, // "public_listing" (real business) or "demo_sample" (fictional)
    isFictional: r.recordOrigin !== "public_listing",
    isSample: true, // the whole directory is demo data: prices and availability are not live
    pricesSimulated: true,
    availabilitySimulated: r.availabilitySimulated !== false,
    sourceUrl: r.sourceUrl ?? null,
  };
}

/**
 * Creates a directory from the team's JSON export (already parsed).
 * @param {{ data: { records: any[] }, now?: () => Date }} options
 *   now: injectable clock (tests pass a fixed date).
 */
export function createJsonDirectory({ data, now = () => new Date() }) {
  if (!data || !Array.isArray(data.records)) throw new Error("Directory data must have a records array.");
  const records = data.records.map(normalizeRecord);
  const booked = new Set();
  const key = (id, start) => `${id}|${start}`;

  function current(s) {
    const t = now();
    const copy = structuredClone(s);
    copy.availability = copy.availability.filter((slot) => new Date(slot.start) > t && !booked.has(key(s.id, slot.start)));
    return copy;
  }

  return {
    source: "maastricht-sample",
    dataset: data.dataset ?? null,
    generatedAt: data.generatedAt ?? null,

    /** Specialists, optionally filtered by service key, city and/or the area they are based in. */
    async list({ service, city = CITY, area } = {}) {
      return records
        .filter((s) => !service || s.services.includes(service))
        .filter((s) => !city || s.city === city)
        .filter((s) => !area || s.area === area)
        .map(current);
    },

    /** One specialist by id, or null. */
    async get(id) {
      const s = records.find((r) => r.id === id);
      return s ? current(s) : null;
    },

    /** Removes a slot once Person 3's workflow has confirmed an appointment in it. */
    async markSlotBooked(id, start) {
      if (!records.some((r) => r.id === id)) throw new Error(`Unknown specialist: ${id}`);
      booked.add(key(id, new Date(start).toISOString()));
    },
  };
}

/** Browser helper: fetches the JSON export and returns a directory. */
export async function loadDirectory(url = DEFAULT_DATA_URL, options = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load specialist data from ${url} (HTTP ${res.status}).`);
  return createJsonDirectory({ data: await res.json(), ...options });
}
