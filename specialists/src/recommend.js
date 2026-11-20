// Builds the three-choice shortlist: lowest price, best reviews, soonest availability.
// Each choice carries a plain-English reason the landlord can read.

import { SERVICE_CATEGORIES, MAASTRICHT_AREAS, distanceKm } from "./catalog.js";
import { toMatchingInput } from "./requestAdapter.js";

export const RECOMMENDATION_KINDS = ["lowest_price", "best_reviews", "soonest_availability"];

export const RECOMMENDATION_LABELS = {
  lowest_price: "Lowest price",
  best_reviews: "Best reviews",
  soonest_availability: "Soonest availability",
};

// Review weighting: a 5.0 from 3 reviews should not beat a 4.8 from 200.
// Each score is blended with PRIOR_COUNT imaginary reviews at PRIOR_MEAN.
export const PRIOR_COUNT = 10;
export const PRIOR_MEAN = 4.0;

export function weightedRating(rating) {
  if (!rating) return null;
  return (rating.average * rating.count + PRIOR_MEAN * PRIOR_COUNT) / (rating.count + PRIOR_COUNT);
}

const TIME_ZONE = "Europe/Amsterdam";
const estimate = (s, service) => s.priceEstimates[service];
const midPrice = (s, service) => (estimate(s, service).low + estimate(s, service).high) / 2;
const firstSlot = (s) => s.availability[0];

export function formatMoney(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatSlot(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

const priceRange = (s, service) =>
  `${formatMoney(estimate(s, service).low, s.currency)}–${formatMoney(estimate(s, service).high, s.currency)}`;

const reviewSource = (r) => (r.simulated ? "demo reviews" : `as reported by ${r.source ?? "a public listing"}`);

function comparators(service) {
  return {
    lowest_price: (a, b) => midPrice(a, service) - midPrice(b, service) || (weightedRating(b.rating) ?? 0) - (weightedRating(a.rating) ?? 0),
    best_reviews: (a, b) => weightedRating(b.rating) - weightedRating(a.rating) || b.rating.count - a.rating.count,
    soonest_availability: (a, b) =>
      firstSlot(a).start.localeCompare(firstSlot(b).start) || midPrice(a, service) - midPrice(b, service),
  };
}

function snapshot(s, service, area) {
  const home = area && MAASTRICHT_AREAS[area];
  return {
    id: s.id,
    name: s.name,
    origin: s.origin,
    isFictional: s.isFictional,
    isSample: s.isSample,
    area: s.area,
    address: s.address,
    postcode: s.postcode,
    distanceKm: home && s.position ? Math.round(distanceKm(home, s.position) * 10) / 10 : null,
    services: [...s.services],
    rating: s.rating ? { ...s.rating, weighted: Math.round(weightedRating(s.rating) * 100) / 100 } : null,
    priceEstimate: { ...estimate(s, service), currency: s.currency, simulated: s.pricesSimulated },
    nextAvailable: firstSlot(s),
    availableSlots: s.availability.slice(0, 3),
    availabilitySimulated: s.availabilitySimulated,
    sourceUrl: s.sourceUrl,
  };
}

function reasonFor(kind, pick, ranked, service, shownAs) {
  const trueWinner = ranked[0];
  const runnerUp = ranked.find((s) => s.id !== pick.id);
  const isWinner = pick.id === trueWinner.id;
  const winnerNote = isWinner ? "" : ` ${trueWinner.name} ranks higher here but is already shown as "${shownAs(trueWinner.id)}".`;

  if (kind === "lowest_price") {
    if (!isWinner) return `Cheapest remaining option: ${priceRange(pick, service)} (demo estimate).${winnerNote}`;
    let text = `Lowest estimate for this repair: ${priceRange(pick, service)} (demo estimate).`;
    if (runnerUp) {
      const diff = Math.round(midPrice(runnerUp, service) - midPrice(pick, service));
      text += diff >= 1
        ? ` About ${formatMoney(diff, pick.currency)} less than the next cheapest, ${runnerUp.name}.`
        : ` Same estimate as ${runnerUp.name}, but better reviews.`;
    }
    return text;
  }

  if (kind === "best_reviews") {
    const r = pick.rating;
    const stars = `${r.average.toFixed(1)}★ from ${r.count} reviews (${reviewSource(r)})`;
    if (!isWinner) return `Best-reviewed remaining option: ${stars}.${winnerNote}`;
    let text = `Best reviews once the number of reviews is taken into account: ${stars}.`;
    const passedOver = ranked.find((s) => s.rating.average > r.average);
    if (passedOver) {
      text += ` ${passedOver.name} has ${passedOver.rating.average.toFixed(1)}★ but only ${passedOver.rating.count} reviews, so it ranks lower.`;
    }
    return text;
  }

  // soonest_availability
  if (!isWinner) return `Earliest remaining visit: ${formatSlot(firstSlot(pick).start)} (demo availability).${winnerNote}`;
  let text = `Earliest visit available: ${formatSlot(firstSlot(pick).start)} (demo availability).`;
  if (runnerUp) text += ` Next earliest is ${runnerUp.name} on ${formatSlot(firstSlot(runnerUp).start)}.`;
  return text;
}

/**
 * Pure ranking step (no directory, no I/O). Takes specialists already loaded from a
 * directory and the matching input from toMatchingInput().
 * @param {{ distinct?: boolean, now?: () => Date, source?: string }} [options]
 *   distinct (default true): show three different specialists when at least three qualify.
 */
export function rankShortlist(specialists, input, { distinct = true, now = () => new Date(), source = "maastricht-sample" } = {}) {
  const { service, city, area, urgency, requestId } = input;
  const eligible = specialists.filter(
    (s) => s.services.includes(service) && (!city || s.city === city) && estimate(s, service) && s.availability.length > 0,
  );
  // Specialists without any review score can still be cheapest or soonest,
  // but are never put forward as "best reviews".
  const pools = {
    lowest_price: eligible,
    best_reviews: eligible.filter((s) => s.rating),
    soonest_availability: eligible,
  };

  // Urgent repairs fill "soonest" first, so it always gets the true fastest specialist.
  const fillOrder = urgency === "routine"
    ? ["lowest_price", "best_reviews", "soonest_availability"]
    : ["soonest_availability", "best_reviews", "lowest_price"];

  const cmp = comparators(service);
  const used = new Set();
  const picks = {};
  for (const kind of fillOrder) {
    const ranked = [...pools[kind]].sort(cmp[kind]);
    const pick = distinct ? ranked.find((s) => !used.has(s.id)) : ranked[0];
    if (!pick) continue;
    used.add(pick.id);
    picks[kind] = { pick, ranked };
  }

  const shownAs = (id) => {
    const kind = RECOMMENDATION_KINDS.find((k) => picks[k]?.pick.id === id);
    return kind ? RECOMMENDATION_LABELS[kind] : "another choice";
  };

  const choices = RECOMMENDATION_KINDS.filter((k) => picks[k]).map((kind) => {
    const { pick, ranked } = picks[kind];
    return {
      kind,
      label: RECOMMENDATION_LABELS[kind],
      specialistId: pick.id,
      specialist: snapshot(pick, service, area),
      reason: reasonFor(kind, pick, ranked, service, shownAs),
      alsoBestFor: RECOMMENDATION_KINDS.filter((k) => k !== kind && picks[k]?.ranked[0].id === pick.id),
    };
  });

  const notes = [];
  const where = `${SERVICE_CATEGORIES[service] ?? service} in ${city}`;
  if (eligible.length === 0) {
    notes.push(`No specialists with open slots cover "${where}". The request needs attention.`);
  } else if (eligible.length < 3) {
    notes.push(`Only ${eligible.length} specialist(s) with open slots cover "${where}", so fewer than three choices are shown.`);
  }
  if (eligible.length > 0 && pools.best_reviews.length === 0) {
    notes.push("None of the matching specialists has a review score yet, so there is no \"Best reviews\" choice.");
  }

  return {
    requestId,
    source,
    isSample: true,
    generatedAt: now().toISOString(),
    criteria: { service, city, area, urgency },
    consideredCount: eligible.length,
    choices,
    notes,
  };
}

/**
 * Full step used by the app: reads the shared request, asks the directory for
 * matching specialists, and returns the shortlist to save on the request.
 */
export async function buildShortlist(directory, request, options = {}) {
  const input = toMatchingInput(request);
  const specialists = await directory.list({ service: input.service, city: input.city });
  return rankShortlist(specialists, input, { source: directory.source, ...options });
}
