// The ONLY place this module reads the shared repair request.
//
// Field paths below are Person 4's proposal (see README.md). When the team's agreed
// request format differs, update this one function and everything else keeps working.

import { CITY, SERVICE_CATEGORIES } from "./catalog.js";

export const URGENCY_LEVELS = ["emergency", "urgent", "routine"];

/**
 * Pulls out what the specialist search needs from a shared request.
 * Proposed paths: request.id, request.home.city, request.home.area,
 * request.issue.category, request.issue.urgency, request.issue.description,
 * request.access.notes
 */
export function toMatchingInput(request) {
  const requestId = request?.id;
  const service = request?.issue?.category;
  const urgency = request?.issue?.urgency ?? "routine";

  const missing = [];
  if (!requestId) missing.push("id");
  if (!service) missing.push("issue.category");
  if (missing.length) {
    throw new Error(`Request is missing fields needed to find specialists: ${missing.join(", ")}`);
  }
  if (!(service in SERVICE_CATEGORIES)) {
    throw new Error(`Unknown issue.category "${service}". Use one of: ${Object.keys(SERVICE_CATEGORIES).join(", ")}`);
  }
  if (!URGENCY_LEVELS.includes(urgency)) {
    throw new Error(`Unknown issue.urgency "${urgency}". Use one of: ${URGENCY_LEVELS.join(", ")}`);
  }

  return {
    requestId,
    city: request.home?.city ?? CITY,
    area: request.home?.area ?? null,
    service,
    urgency,
    description: request.issue?.description ?? "",
    accessNotes: request.access?.notes ?? "",
  };
}
