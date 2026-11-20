// Handoffs to teammates' features:
//  - Person 2 (landlord screen) calls makeSpecialistSelection() when the landlord picks one.
//  - Person 3 (AI workflow) calls buildContactHandoff() to get what it needs to
//    arrange the visit with the chosen specialist.
// This module never contacts anyone. Contacting and booking belong to Person 3.

import { SERVICE_CATEGORIES } from "./catalog.js";
import { toMatchingInput } from "./requestAdapter.js";

function findChoice(request, specialistId) {
  const choices = request?.specialistChoices?.choices ?? [];
  const choice = choices.find((c) => c.specialistId === specialistId);
  if (!choice) {
    throw new Error(`Specialist "${specialistId}" is not one of the shortlisted choices for request "${request?.id}".`);
  }
  return choice;
}

/**
 * Validates the landlord's pick against the saved shortlist and returns the value to
 * store as the request's chosen specialist.
 */
export function makeSpecialistSelection(request, specialistId, { now = () => new Date(), chosenBy = "landlord" } = {}) {
  const choice = findChoice(request, specialistId);
  return {
    specialistId,
    chosenAs: choice.kind,
    chosenBy,
    chosenAt: now().toISOString(),
    specialist: choice.specialist,
  };
}

/**
 * Everything Person 3's workflow needs to arrange the visit with the chosen specialist.
 * Reads fresh availability from the directory, since the shortlist may be hours old.
 */
export async function buildContactHandoff(directory, request, specialistId) {
  const input = toMatchingInput(request);
  const choice = findChoice(request, specialistId);
  const specialist = await directory.get(specialistId);
  if (!specialist) throw new Error(`Specialist "${specialistId}" is no longer in the directory.`);

  const warnings = [
    "The directory has no contact details. Simulate the contact step and label it as simulated.",
  ];
  if (!specialist.isFictional) {
    warnings.push("This is a real business from a public listing. Do not contact it from the demo; its prices and availability here are demo estimates, not quotes.");
  }
  if (specialist.availability.length === 0) {
    warnings.push("This specialist has no open slots left. Ask for a time or go back to the landlord.");
  }

  return {
    requestId: input.requestId,
    specialistId,
    chosenAs: choice.kind,
    isSample: true,
    isFictional: specialist.isFictional,
    specialist: {
      name: specialist.name,
      origin: specialist.origin,
      area: specialist.area,
      address: specialist.address,
      postcode: specialist.postcode,
      sourceUrl: specialist.sourceUrl,
      contact: null, // not in the team database yet
    },
    job: {
      service: input.service,
      serviceLabel: SERVICE_CATEGORIES[input.service],
      city: input.city,
      area: input.area,
      urgency: input.urgency,
      description: input.description,
      accessNotes: input.accessNotes,
    },
    priceEstimate: { ...specialist.priceEstimates[input.service], currency: specialist.currency, simulated: true },
    proposedSlots: specialist.availability.slice(0, 3),
    warnings,
  };
}
