// Type definitions for the specialist module, for teammates using TypeScript.

export type ServiceKey = "no_heat" | "boiler" | "radiator" | "hot_water" | "thermostat" | "heat_pump";
export type Urgency = "emergency" | "urgent" | "routine";
export type RecommendationKind = "lowest_price" | "best_reviews" | "soonest_availability";
export type RecordOrigin = "public_listing" | "demo_sample";

export interface PriceRange { low: number; high: number; }
export interface Slot { start: string; end: string; } // ISO 8601 timestamps

export interface Rating {
  average: number;
  count: number;
  simulated: boolean; // true = synthetic demo reviews
  source: string | null; // where a real score was reported
}

/** A specialist as this module uses it (converted from the team's JSON export). */
export interface Specialist {
  id: string;
  name: string;
  city: string;
  area: string;
  address: string | null;
  postcode: string | null;
  position: [number, number] | null; // approximate [lat, lon]
  services: ServiceKey[];
  priceEstimates: Partial<Record<ServiceKey, PriceRange>>;
  currency: string;
  rating: Rating | null; // null = no review score known
  availability: Slot[]; // upcoming open slots, earliest first
  origin: RecordOrigin;
  isFictional: boolean;
  isSample: true;
  pricesSimulated: boolean;
  availabilitySimulated: boolean;
  sourceUrl: string | null;
}

/** Any specialist source (team JSON now, Centrix later) must implement this. */
export interface SpecialistDirectory {
  source: string;
  list(filter?: { service?: ServiceKey; city?: string; area?: string }): Promise<Specialist[]>;
  get(id: string): Promise<Specialist | null>;
  markSlotBooked(id: string, start: string): Promise<void>;
}

export interface MatchingInput {
  requestId: string;
  city: string;
  area: string | null;
  service: ServiceKey;
  urgency: Urgency;
  description: string;
  accessNotes: string;
}

/** Copy of a specialist saved on the request, so it still reads correctly later. */
export interface SpecialistSnapshot {
  id: string;
  name: string;
  origin: RecordOrigin;
  isFictional: boolean;
  isSample: boolean;
  area: string;
  address: string | null;
  postcode: string | null;
  distanceKm: number | null; // from the tenant's area, approximate
  services: ServiceKey[];
  rating: (Rating & { weighted: number }) | null;
  priceEstimate: PriceRange & { currency: string; simulated: boolean };
  nextAvailable: Slot;
  availableSlots: Slot[];
  availabilitySimulated: boolean;
  sourceUrl: string | null;
}

export interface SpecialistChoice {
  kind: RecommendationKind;
  label: string;
  specialistId: string;
  specialist: SpecialistSnapshot;
  reason: string;
  alsoBestFor: RecommendationKind[];
}

/** Proposed value of request.specialistChoices */
export interface SpecialistShortlist {
  requestId: string;
  source: string;
  isSample: boolean;
  generatedAt: string;
  criteria: { service: ServiceKey; city: string; area: string | null; urgency: Urgency };
  consideredCount: number;
  choices: SpecialistChoice[]; // display order: lowest_price, best_reviews, soonest_availability
  notes: string[];
}

/** Proposed value of request.chosenSpecialist */
export interface SpecialistSelection {
  specialistId: string;
  chosenAs: RecommendationKind;
  chosenBy: string;
  chosenAt: string;
  specialist: SpecialistSnapshot;
}

/** What Person 3's workflow receives to arrange the visit. */
export interface ContactHandoff {
  requestId: string;
  specialistId: string;
  chosenAs: RecommendationKind;
  isSample: true;
  isFictional: boolean;
  specialist: {
    name: string;
    origin: RecordOrigin;
    area: string;
    address: string | null;
    postcode: string | null;
    sourceUrl: string | null;
    contact: null; // the team database has no contact details yet
  };
  job: {
    service: ServiceKey;
    serviceLabel: string;
    city: string;
    area: string | null;
    urgency: Urgency;
    description: string;
    accessNotes: string;
  };
  priceEstimate: PriceRange & { currency: string; simulated: true };
  proposedSlots: Slot[];
  warnings: string[];
}

export const CITY: string;
export const CURRENCY: string;
export const SERVICE_CATEGORIES: Record<ServiceKey, string>;
export const MAASTRICHT_AREAS: Record<string, [number, number]>;
export const URGENCY_LEVELS: Urgency[];
export const RECOMMENDATION_KINDS: RecommendationKind[];
export const RECOMMENDATION_LABELS: Record<RecommendationKind, string>;
export const DEFAULT_DATA_URL: string;

export function distanceKm(a: [number, number], b: [number, number]): number;
export function normalizeRecord(record: unknown): Specialist;
export function createJsonDirectory(options: { data: { records: unknown[] }; now?: () => Date }): SpecialistDirectory;
export function loadDirectory(url?: string, options?: { now?: () => Date }): Promise<SpecialistDirectory>;
export function toMatchingInput(request: unknown): MatchingInput;
export function weightedRating(rating: { average: number; count: number } | null): number | null;
export function formatMoney(amount: number, currency?: string): string;
export function formatSlot(iso: string): string;
export function rankShortlist(
  specialists: Specialist[],
  input: MatchingInput,
  options?: { distinct?: boolean; now?: () => Date; source?: string },
): SpecialistShortlist;
export function buildShortlist(
  directory: SpecialistDirectory,
  request: unknown,
  options?: { distinct?: boolean; now?: () => Date },
): Promise<SpecialistShortlist>;
export function makeSpecialistSelection(
  request: unknown,
  specialistId: string,
  options?: { now?: () => Date; chosenBy?: string },
): SpecialistSelection;
export function buildContactHandoff(
  directory: SpecialistDirectory,
  request: unknown,
  specialistId: string,
): Promise<ContactHandoff>;
