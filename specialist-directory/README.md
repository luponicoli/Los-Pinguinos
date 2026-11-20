# Maastricht heating specialist sample directory

This is a team-shared, Maastricht-only fixture for the Retrix demo. It provides provider profiles, supported heating problem types, comparable price ranges, review data, approximate map points, and next-available times.

The directory is not a Centrix replica or a live provider integration. The 10 `public_listing` entries are based on public business listings. Thirty `demo_sample` entries are fictional. All comparison prices and appointment times are demo estimates. Synthetic review scores are marked as simulated. Public review scores are attributed to the listing that reported them and may change over time.

## Files

- `data/maastricht-specialists.sqlite` — SQLite database for queries and local demos.
- `data/maastricht-specialists.json` — portable JSON export for browser apps and AI tools.
- `schema.sql` — relational schema, constraints, and a joined directory view.
- `build_database.py` — rebuilds the SQLite and JSON artifacts using Python’s standard library.

## Run it

From the project root:

```sh
python3 specialist-directory/build_database.py
```

The database uses the exact heating problem values supplied for the tenant form: `no_heat`, `boiler`, `radiator`, `hot_water`, `thermostat`, and `heat_pump`.

## Data contract

The JSON export keeps the specialist listing independent of the shared repair request. Each record has:

- `id`, `name`, `city`, `area`, `address`, and `postcode`
- `position.latitude`, `position.longitude`, and `position.precision`
- `services`, using the agreed heating problem values
- `priceRanges`, with EUR min/max estimates by problem type
- `reviews.score`, `reviews.count`, and `reviews.simulated`
- `nextAvailableAt` and `availabilitySimulated`
- `recordOrigin` and `sourceUrl`

The three shortlist recommendations remain a consumer of this data; they are not embedded into the tenant request format. Person 4’s shortlist code can import the JSON and adapt it to its agreed specialist interface.

## SQLite tables

- `specialists`: business or sample profile, city area, and map point
- `specialist_services`: supported heating problem types
- `price_estimates`: comparable demo job ranges, with VAT and parts flags
- `published_prices`: exact public rates and their conditions, when a source publishes them
- `reviews`: score, count, source, and simulated-data flag
- `availability`: next-available time and simulated-data flag
- `source_notes`: market references and data limitations
- `specialist_directory`: joined view for quick lookup

Example queries:

```sql
SELECT name, area, review_score, review_count, next_available_at
FROM specialist_directory
WHERE city = 'Maastricht'
ORDER BY review_score DESC;
```

```sql
SELECT s.name, s.area, p.minimum_eur, p.maximum_eur
FROM specialists AS s
JOIN price_estimates AS p USING (specialist_id)
WHERE s.city = 'Maastricht' AND p.problem_type = 'boiler'
ORDER BY p.minimum_eur ASC;
```

```sql
SELECT s.name, pp.work_type, pp.amount_eur, pp.unit, pp.vat_included, pp.conditions, pp.source_url
FROM specialists AS s
JOIN published_prices AS pp ON pp.specialist_id = s.id
WHERE s.record_origin = 'public_listing';
```

## Real and simulated fields

| Field | Public listing records | Demo sample records |
|---|---|---|
| Business name and listed location | Publicly listed details where found | Fictional names and neighborhoods |
| Services | Public listing, mapped to Retrix problem values | Generated sample service coverage |
| Review score and count | Included only when found; attributed to its source | Generated and marked simulated |
| Comparable repair price range | Simulated estimate for every provider | Simulated estimate |
| Exact published price | Included only when the provider publishes a rate and terms | None |
| Map point | Approximate neighborhood centroid, not an address geocode | Approximate neighborhood centroid with tiny visual separation |
| Next availability | Simulated; not a live calendar | Simulated; not a live calendar |

Sample price ranges describe a daytime diagnostic visit / first labor period, including VAT and local travel but excluding replacement parts. They are deliberately not represented as provider quotes. The separate `published_prices` rows retain the real provider’s unit, VAT basis, and conditions.

## Public sources

Business identity, services, locations, and any numerical review data are linked per provider in `profile_url` and `reviews.source_url`. Public price examples and regional context are also recorded in `source_notes`:

- [CV Storing Maastricht tariffs](https://www.cvstoring-maastricht.nl/tarieven.html) — published diagnostic, boiler-breakdown, and maintenance rates with VAT and timing conditions.
- [CV Ketel Nu Maastricht price guide](https://www.cvketel-nu.nl/maastricht/) — market context for hourly rates and maintenance prices.
- [Ubaghs tariffs](https://ubaghs.nl/tarieven/) — regional hourly and call-out price context; this business is not listed as a Maastricht-city provider.

Public listings and prices should be rechecked before using this fixture to contact a provider or make a real repair decision.
