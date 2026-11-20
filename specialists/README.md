# Specialists — directory and comparison (Person 4)

This feature reads the team's **Maastricht specialist database**
(`specialist-directory/data/maastricht-specialists.json`) and builds the three
recommendations the landlord chooses from: **lowest price**, **best reviews** and
**soonest availability**, each with a plain-English reason.

> **Demo data.** 10 specialists are real businesses from public listings and 30 are
> fictional "Demo" businesses. **All prices and appointment times are demo estimates**
> for every specialist. The database has no contact details, and **real businesses must
> not be contacted from the demo.** This is not the Centrix-like database; see
> "Swapping in Centrix later".

## Repo layout

```
specialist-directory/          ← team's database (build script, JSON, SQLite)
  data/maastricht-specialists.json
specialists/                   ← this feature (Person 4)
  src/index.js                 ← the only file teammates import from
  src/index.d.ts               ← types
  src/catalog.js               ← problem types, Maastricht areas, distance helper
  src/directory.js             ← reads the team JSON (list / get / markSlotBooked)
  src/recommend.js             ← three-choice shortlist and reasons
  src/handoff.js               ← landlord's selection + handoff to the AI workflow
  src/requestAdapter.js        ← the ONLY place that reads the shared request
  tests/                       ← 16 tests (incl. checks against the real database)
  preview/index.html           ← preview page
```

`specialists/` and `specialist-directory/` must sit **side by side** at the top of the
repo, because the code finds the data at `../../specialist-directory/data/...`
relative to `src/directory.js`.

The code is plain HTML + JavaScript (ES modules) with no dependencies, so it works in
a plain HTML site or any framework.

## Try it

From the top of the repo:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/specialists/preview/ (preview) and
http://localhost:8765/specialists/tests/run.html (tests). Opening the HTML file
directly (double-click) won't work, because browsers block loading data from `file://` pages.

## How teammates use it

```js
import { loadDirectory, buildShortlist, makeSpecialistSelection, buildContactHandoff }
  from "../specialists/src/index.js"; // adjust the path to your page

const directory = await loadDirectory(); // loads the team JSON once
```

### Person 3: AI workflow

1. After the landlord approves (status `finding_specialists`):
   ```js
   request.specialistChoices = await buildShortlist(directory, request);
   ```
   Save it, add an activity entry, then set the status to `awaiting_specialist_choice`.
   If `specialistChoices.choices` is empty, set it to `needs_attention`; `notes` says why.
2. After the landlord picks (status `booking`):
   ```js
   const handoff = await buildContactHandoff(directory, request, request.chosenSpecialist.specialistId);
   ```
   `handoff` gives the specialist's name, area, address and listing link, the job details,
   the price estimate, the proposed time slot and `warnings`. `handoff.specialist.contact`
   is `null`, because the database has no contact details. **Simulate the contact step and
   label it simulated. If `handoff.isFictional` is false, it's a real business: never
   message it.**
3. Once the (simulated) appointment is confirmed:
   ```js
   await directory.markSlotBooked(specialistId, slot.start);
   ```

### Person 2: landlord screen

- Show `request.specialistChoices.choices`, already in display order. Each choice has
  `label`, `reason` and `alsoBestFor`, plus `specialist` with:
  - `name`, `isFictional`, `priceEstimate {low, high, currency}`
  - `rating {average, count, simulated}`, which can be `null` (no score known)
  - `nextAvailable {start, end}`, `area`, `distanceKm` and `sourceUrl`
- Show `request.specialistChoices.notes` if not empty.
- Label the demo data: "Fictional demo business" or "Real business (public listing)",
  and "demo estimate" on prices and times. See `preview/index.html` for an example.
- When the landlord picks one:
  ```js
  request.chosenSpecialist = makeSpecialistSelection(request, specialistId);
  ```
  This throws an error if the id isn't on the shortlist. Save it to the same shared
  request, then set the status to `booking`.
- `formatMoney(amount, "EUR")` and `formatSlot(isoString)` give matching formats
  (times shown in Maastricht time).

### Person 1: tenant form

- **Problem type** → `issue.category`: `no_heat`, `boiler`, `radiator`, `hot_water`,
  `thermostat` or `heat_pump`. `SERVICE_CATEGORIES` has the labels for a dropdown.
- **Urgency** → `issue.urgency`: `emergency`, `urgent` or `routine`.
- **Neighbourhood** → `home.area`: one of the keys of `MAASTRICHT_AREAS` (21 Maastricht
  neighbourhoods), plus `home.city: "Maastricht"`.

## Proposed shared request fields (needs team agreement)

```js
{
  id: "req_123",
  status: "finding_specialists",
  home:  { city: "Maastricht", area: "Wyck", /* address, unit… (Person 1) */ },
  issue: { category: "radiator", urgency: "routine", description: "…" },
  access: { notes: "Key with neighbour" },
  specialistChoices: SpecialistShortlist,  // written by Person 3 via buildShortlist()
  chosenSpecialist: SpecialistSelection,   // written by Person 2 via makeSpecialistSelection()
}
```

If the agreed names differ, only `src/requestAdapter.js` changes.

## How the recommendations work

- **Who qualifies:** specialists in Maastricht who handle that problem type and have an
  upcoming slot. The database lists one base area per specialist, not the areas they
  cover, so everyone in the city qualifies, and `distanceKm` shows roughly how far away they're based.
- **Lowest price:** the lowest middle of the estimate range. Ties go to better reviews.
- **Best reviews:** the score is weighted by the number of reviews (blended with 10
  imaginary 4.0★ reviews), so a 5.0★ from 3 reviews doesn't beat a 4.8★ from 200.
  Specialists with no score are never picked here. The reason says whether the reviews are
  demo reviews or where a real score was reported.
- **Soonest availability:** the earliest slot. Ties go to the lower price.
- **Three different specialists:** if one wins two categories, the second category shows
  its runner-up, the reason names the true winner, and the winner gets `alsoBestFor`.
  For `emergency`/`urgent` requests, "soonest" is filled first. `{ distinct: false }`
  allows repeats.

## Known data limits

- Each specialist has **one** demo slot, between 23 Nov and 9 Dec 2026, and slots in the
  past are hidden. **After 9 Dec 2026 nobody has a free slot**, so for a later demo,
  regenerate the data with newer dates (`specialist-directory/build_database.py`).
- `build_database.py` needs `schema.sql`, which isn't in the files Person 4 received.
- No contact details, so the contact step must be simulated.

## Swapping in Centrix later

Any object with `list()`, `get()` and `markSlotBooked()` (see `SpecialistDirectory` in
`src/index.d.ts`) can replace `loadDirectory()`. Nothing else changes.

## Still to agree with the team

- [ ] Request field names (above), with everyone.
- [ ] Handoff shape and the simulated contact step, with Person 3.
- [ ] Choice display, with Person 2.
- [ ] Where `AGREEMENT.md` says folders go, if different from the layout above.
