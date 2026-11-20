// Tests for the specialist module. Plain JavaScript, so they run in a browser
// (tests/run.html) today, and under Vitest or `node --test` later: swap the tiny
// `test`/`assert` helpers below for the runner's.
//
// Most tests use a small hand-made fixture in the team's JSON format, so the expected
// winners are obvious. The last tests load the real team database export.

import {
  SERVICE_CATEGORIES, MAASTRICHT_AREAS, createJsonDirectory, buildShortlist, rankShortlist,
  toMatchingInput, makeSpecialistSelection, buildContactHandoff, weightedRating, normalizeRecord,
  RECOMMENDATION_KINDS, DEFAULT_DATA_URL,
} from "../src/index.js";

export const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// Fixed clock: noon in Maastricht on 20 Nov 2026 (the dataset's generation date).
const NOW = new Date("2026-11-20T12:00:00+01:00");
const now = () => new Date(NOW);

// Builds one record in the team's JSON export format.
function rec(id, { origin = "demo_sample", area = "Centrum", prices, score = null, count = 0, simulated = true, next, pos = [50.852, 5.691] }) {
  return {
    id, name: `${id} Heating`, city: "Maastricht", area, address: null, postcode: null,
    position: { latitude: pos[0], longitude: pos[1], precision: "synthetic_area_centroid" },
    services: Object.keys(prices),
    priceRanges: Object.entries(prices).map(([k, [lo, hi]]) => ({ problem_type: k, minimum_eur: lo, maximum_eur: hi, currency: "EUR", price_basis: "demo_estimate", includes_vat: true, includes_parts: false })),
    reviews: { score, scale: 5, count, source: score == null ? null : simulated ? "Synthetic demo reviews" : "Brinqs", sourceUrl: null, simulated },
    nextAvailableAt: next, availabilitySimulated: true, recordOrigin: origin, sourceUrl: origin === "public_listing" ? "https://example.com/listing" : null,
  };
}

const FIXTURE = {
  dataset: "test fixture",
  records: [
    // boiler: Cheap is cheapest, Trusted best reviewed, Fast soonest, Newbie 5.0 from 3, Unrated no score
    rec("Cheap", { prices: { boiler: [70, 140], radiator: [60, 100] }, score: 3.6, count: 8, next: "2026-11-23T09:00:00+01:00" }),
    rec("Trusted", { prices: { boiler: [100, 200], radiator: [90, 150] }, score: 4.8, count: 200, next: "2026-12-03T09:00:00+01:00" }),
    rec("Fast", { prices: { boiler: [120, 220], radiator: [80, 130] }, score: 4.0, count: 50, next: "2026-11-21T09:00:00+01:00", area: "Wyck", pos: [50.85, 5.703] }),
    rec("Newbie", { prices: { boiler: [110, 190] }, score: 5.0, count: 3, next: "2026-12-07T09:00:00+01:00" }),
    rec("Unrated", { origin: "public_listing", prices: { boiler: [90, 180], thermostat: [60, 120] }, next: "2026-12-01T09:00:00+01:00" }),
    rec("PumpOnly", { prices: { heat_pump: [150, 280] }, score: 4.5, count: 40, next: "2026-11-30T09:00:00+01:00" }),
    rec("Unrated2", { prices: { thermostat: [70, 130] }, next: "2026-11-24T09:00:00+01:00" }),
    rec("Past", { prices: { hot_water: [80, 160] }, score: 4.9, count: 90, next: "2026-11-19T09:00:00+01:00" }),
  ],
};
const dir = (data = FIXTURE) => createJsonDirectory({ data, now });
const request = (category, urgency = "routine", area = "Centrum") => ({
  id: "req_test", home: { city: "Maastricht", area }, issue: { category, urgency, description: "No heat" }, access: { notes: "Ring bell" },
});

test("normalizeRecord converts the team JSON format", () => {
  const s = normalizeRecord(FIXTURE.records[4]);
  eq(s.priceEstimates.boiler.low, 90, "price low");
  eq(s.currency, "EUR", "currency");
  eq(s.rating, null, "no score becomes null rating");
  eq(s.isFictional, false, "public listing is not fictional");
  eq(s.isSample, true, "still demo data");
  eq(s.availability.length, 1, "one slot");
  eq(new Date(s.availability[0].end) - new Date(s.availability[0].start), 2 * 3600e3, "2-hour slot");
});

test("directory filters by service and drops past slots", async () => {
  const d = dir();
  eq((await d.list({ service: "heat_pump" })).map((s) => s.id).join(), "PumpOnly", "heat pump");
  const past = await d.get("Past");
  eq(past.availability.length, 0, "slot before now is gone");
});

test("markSlotBooked removes that slot", async () => {
  const d = dir();
  const s = await d.get("Fast");
  await d.markSlotBooked("Fast", s.availability[0].start);
  eq((await d.get("Fast")).availability.length, 0, "booked");
});

test("directory returns copies, so callers cannot change the data", async () => {
  const d = dir();
  (await d.get("Cheap")).name = "changed";
  eq((await d.get("Cheap")).name, "Cheap Heating", "unchanged");
});

test("shortlist picks the right three for a boiler", async () => {
  const sl = await buildShortlist(dir(), request("boiler"), { now });
  eq(sl.choices.map((c) => c.kind).join(), RECOMMENDATION_KINDS.join(), "display order");
  eq(sl.choices[0].specialistId, "Cheap", "lowest price");
  eq(sl.choices[1].specialistId, "Trusted", "best reviews");
  eq(sl.choices[2].specialistId, "Fast", "soonest");
  eq(sl.consideredCount, 5, "five eligible");
  for (const c of sl.choices) assert(c.reason.length > 20, `${c.kind} has a reason`);
  assert(sl.choices[0].reason.includes("demo estimate"), "price reason says it's an estimate");
});

test("best reviews weights review count and explains the 5.0 it passed over", async () => {
  assert(weightedRating({ average: 4.8, count: 200 }) > weightedRating({ average: 5.0, count: 3 }), "weighting");
  const sl = await buildShortlist(dir(), request("boiler"), { now });
  assert(sl.choices[1].reason.includes("Newbie Heating"), "names the passed-over specialist");
  assert(sl.choices[1].reason.includes("demo reviews"), "says the reviews are demo reviews");
});

test("specialists without a review score are never 'best reviews'", async () => {
  const sl = await buildShortlist(dir(), request("thermostat"), { now });
  eq(sl.choices.some((c) => c.kind === "best_reviews"), false, "no best reviews choice");
  eq(sl.choices.length, 2, "still cheapest and soonest");
  assert(sl.notes.some((n) => n.includes("review score")), "explains why");
});

test("same specialist winning twice: different choices, with alsoBestFor", async () => {
  // radiator: Cheap (60–100, 23 Nov) vs Fast (80–130, 21 Nov) vs Trusted.
  const data = { records: FIXTURE.records.map((r) => (r.id === "Cheap" ? { ...r, nextAvailableAt: "2026-11-20T15:00:00+01:00" } : r)) };
  const sl = await buildShortlist(dir(data), request("radiator"), { now });
  eq(new Set(sl.choices.map((c) => c.specialistId)).size, 3, "distinct");
  eq(sl.choices[0].specialistId, "Cheap", "routine: cheapest gets its true winner");
  eq(sl.choices[0].alsoBestFor.join(), "soonest_availability", "flagged as also soonest");
  eq(sl.choices[2].specialistId, "Fast", "soonest falls back");
  assert(sl.choices[2].reason.includes("Cheap Heating"), "fallback reason names the true winner");

  const urgent = await buildShortlist(dir(data), request("radiator", "emergency"), { now });
  eq(urgent.choices[2].specialistId, "Cheap", "emergency: soonest gets its true winner");
  eq(urgent.choices[0].specialistId, "Fast", "cheapest falls back");

  const repeats = await buildShortlist(dir(data), request("radiator"), { now, distinct: false });
  eq(repeats.choices[0].specialistId, repeats.choices[2].specialistId, "distinct:false allows repeats");
});

test("fewer than three or none: fewer choices and a note", async () => {
  const one = await buildShortlist(dir(), request("heat_pump"), { now });
  eq(one.choices.length, 3 - 2, "one specialist fills one choice");
  assert(one.notes[0].includes("Only 1"), "explains");
  const none = await buildShortlist(dir(), request("hot_water"), { now });
  eq(none.choices.length, 0, "only specialist's slot is past");
  assert(none.notes[0].includes("needs attention"), "flags needs attention");
});

test("snapshot shows distance from the tenant's area", async () => {
  const sl = await buildShortlist(dir(), request("boiler", "routine", "Wyck"), { now });
  eq(sl.choices[2].specialist.distanceKm, 0, "Fast is based in Wyck");
  assert(sl.choices[0].specialist.distanceKm > 0.5, "Cheap is in Centrum, further away");
});

test("rankShortlist works without a directory (pure)", () => {
  const sl = rankShortlist([], { requestId: "r", city: "Maastricht", area: null, service: "boiler", urgency: "routine" }, { now });
  eq(sl.choices.length, 0, "empty");
  eq(sl.generatedAt, NOW.toISOString(), "uses injected clock");
});

test("request adapter reads proposed fields and rejects bad input", () => {
  const input = toMatchingInput(request("boiler", "urgent"));
  eq(input.city, "Maastricht", "city");
  eq(input.accessNotes, "Ring bell", "access notes");
  const minimal = toMatchingInput({ id: "x", issue: { category: "boiler" } });
  eq(minimal.urgency, "routine", "default urgency");
  eq(minimal.city, "Maastricht", "default city");
  const throws = (r, part) => {
    try { toMatchingInput(r); } catch (e) { assert(e.message.includes(part), `message mentions ${part}`); return; }
    throw new Error(`expected error for ${part}`);
  };
  throws({}, "issue.category");
  throws({ id: "x", issue: { category: "lava" } }, "lava");
  throws({ id: "x", issue: { category: "boiler", urgency: "soon" } }, "soon");
});

test("selection must be one of the shortlisted choices", async () => {
  const req = request("boiler");
  req.specialistChoices = await buildShortlist(dir(), req, { now });
  const sel = makeSpecialistSelection(req, "Trusted", { now });
  eq(sel.chosenAs, "best_reviews", "kind");
  let threw = false;
  try { makeSpecialistSelection(req, "PumpOnly"); } catch { threw = true; }
  assert(threw, "rejects a specialist not on the shortlist");
});

test("handoff warns that real businesses must not be contacted", async () => {
  const d = dir();
  const req = request("thermostat");
  req.specialistChoices = await buildShortlist(d, req, { now });
  const h = await buildContactHandoff(d, req, "Unrated");
  eq(h.isFictional, false, "real business");
  eq(h.specialist.contact, null, "no contact details");
  assert(h.warnings.some((w) => w.includes("Do not contact")), "warns not to contact");
  eq(h.job.serviceLabel, SERVICE_CATEGORIES.thermostat, "service label");
  eq(h.proposedSlots.length, 1, "fresh slot");
});

// ---- Real team database ----

async function realData() {
  const res = await fetch(DEFAULT_DATA_URL);
  assert(res.ok, `load ${DEFAULT_DATA_URL}: HTTP ${res.status}`);
  return res.json();
}

test("real database: every record converts cleanly", async () => {
  const data = await realData();
  eq(data.records.length, 40, "40 records");
  for (const r of data.records) {
    const s = normalizeRecord(r);
    for (const k of s.services) {
      assert(k in SERVICE_CATEGORIES, `${s.id}: known service ${k}`);
      const p = s.priceEstimates[k];
      assert(p && p.low > 0 && p.high >= p.low, `${s.id}: price for ${k}`);
    }
    assert(s.availability.length === 1, `${s.id}: has a slot`);
  }
});

test("real database: every problem type gets three different choices", async () => {
  const d = createJsonDirectory({ data: await realData(), now });
  for (const service of Object.keys(SERVICE_CATEGORIES)) {
    for (const area of ["Centrum", "Heer", "Malberg"]) {
      const sl = await buildShortlist(d, request(service, "routine", area), { now });
      eq(sl.choices.length, 3, `${service} in ${area}: three choices`);
      eq(new Set(sl.choices.map((c) => c.specialistId)).size, 3, `${service}: distinct`);
      const best = sl.choices.find((c) => c.kind === "best_reviews");
      assert(best.specialist.rating, `${service}: best reviews has a score`);
      assert(area in MAASTRICHT_AREAS && best.specialist.distanceKm != null, `${service}: distance shown`);
    }
  }
});
