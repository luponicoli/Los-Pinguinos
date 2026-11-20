// Shared vocabulary for the specialist feature. These values match the team's
// Maastricht specialist database (specialist-directory/) and the tenant form.

export const CITY = "Maastricht";
export const CURRENCY = "EUR";

export const SERVICE_CATEGORIES = {
  no_heat: "No heating at all",
  boiler: "Boiler fault or error code",
  radiator: "Radiator cold, noisy or leaking",
  hot_water: "No hot water",
  thermostat: "Thermostat or heating controls",
  heat_pump: "Heat pump fault",
};

// Maastricht neighbourhoods with approximate centre points, copied from
// specialist-directory/build_database.py. Used for the tenant's area dropdown
// and to show roughly how far away each specialist is based.
export const MAASTRICHT_AREAS = {
  Centrum: [50.852, 5.691],
  Wyck: [50.85, 5.703],
  Wittevrouwenveld: [50.857, 5.716],
  Heer: [50.824, 5.728],
  Scharn: [50.852, 5.722],
  Amby: [50.875, 5.741],
  Randwyck: [50.834, 5.715],
  "De Heeg": [50.819, 5.716],
  Daalhof: [50.846, 5.65],
  Brusselsepoort: [50.85, 5.666],
  Statenkwartier: [50.856, 5.676],
  Malberg: [50.861, 5.637],
  Caberg: [50.863, 5.66],
  Biesland: [50.837, 5.668],
  "Sint Pieter": [50.832, 5.688],
  Mariaberg: [50.845, 5.674],
  Heugem: [50.824, 5.71],
  Limmel: [50.872, 5.699],
  Borgharen: [50.885, 5.691],
  Bosscherveld: [50.87, 5.679],
  Nazareth: [50.87, 5.726],
};

/** Straight-line distance in km between two [lat, lon] points. */
export function distanceKm([lat1, lon1], [lat2, lon2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
