// Public entry point for the specialist directory and comparison feature (Person 4).
// Teammates should import only from this file.

export { CITY, CURRENCY, SERVICE_CATEGORIES, MAASTRICHT_AREAS, distanceKm } from "./catalog.js";
export { createJsonDirectory, loadDirectory, normalizeRecord, DEFAULT_DATA_URL } from "./directory.js";
export { toMatchingInput, URGENCY_LEVELS } from "./requestAdapter.js";
export {
  RECOMMENDATION_KINDS,
  RECOMMENDATION_LABELS,
  buildShortlist,
  rankShortlist,
  weightedRating,
  formatMoney,
  formatSlot,
} from "./recommend.js";
export { makeSpecialistSelection, buildContactHandoff } from "./handoff.js";
