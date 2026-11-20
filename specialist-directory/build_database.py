#!/usr/bin/env python3
"""Build a Maastricht-only SQLite sample directory and JSON export."""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DB_PATH = DATA / "maastricht-specialists.sqlite"
JSON_PATH = DATA / "maastricht-specialists.json"
VERIFIED_AT = "2026-11-20"
CITY = "Maastricht"

# Neighborhood centroids are intentionally rounded and marked approximate.
# They are demonstration map points, not provider-address geocodes.
AREAS = [
    ("Centrum", 50.852, 5.691),
    ("Wyck", 50.850, 5.703),
    ("Wittevrouwenveld", 50.857, 5.716),
    ("Heer", 50.824, 5.728),
    ("Scharn", 50.852, 5.722),
    ("Amby", 50.875, 5.741),
    ("Randwyck", 50.834, 5.715),
    ("De Heeg", 50.819, 5.716),
    ("Daalhof", 50.846, 5.650),
    ("Brusselsepoort", 50.850, 5.666),
    ("Statenkwartier", 50.856, 5.676),
    ("Malberg", 50.861, 5.637),
    ("Caberg", 50.863, 5.660),
    ("Biesland", 50.837, 5.668),
    ("Sint Pieter", 50.832, 5.688),
    ("Mariaberg", 50.845, 5.674),
    ("Heugem", 50.824, 5.710),
    ("Limmel", 50.872, 5.699),
    ("Borgharen", 50.885, 5.691),
    ("Bosscherveld", 50.870, 5.679),
    ("Nazareth", 50.870, 5.726),
]

CATEGORIES = ("no_heat", "boiler", "radiator", "hot_water", "thermostat", "heat_pump")
BASE_PRICES = {
    "no_heat": (90, 175),
    "boiler": (95, 190),
    "radiator": (75, 155),
    "hot_water": (85, 175),
    "thermostat": (70, 145),
    "heat_pump": (125, 260),
}

# These public listings establish that the business exists in/serves
# Maastricht and list heating-related services. Prices, live availability,
# and all unverified review metrics stay explicitly marked as demo data.
PUBLIC_PROVIDERS = [
    {
        "id": "pub-cvstoring-maastricht",
        "name": "CV Storing Maastricht",
        "area": "Maastricht",
        "address": None,
        "postcode": None,
        "coords": (50.852, 5.691),
        "services": ["no_heat", "boiler", "radiator", "hot_water", "thermostat"],
        "profile_url": "https://www.cvstoring-maastricht.nl/tarieven.html",
        "review": None,
        "published_prices": [
            {"work_type": "Inspection / diagnosis", "amount_eur": 60, "unit": "hour", "vat_included": False, "conditions": "Weekdays 08:00–17:00; minimum one hour."},
            {"work_type": "Boiler breakdown", "amount_eur": 80, "unit": "hour", "vat_included": False, "conditions": "Same-day visits use the emergency rate; minimum one hour."},
            {"work_type": "One-time boiler maintenance", "amount_eur": 105, "unit": "visit", "vat_included": False, "conditions": "Gaskets and materials excluded; report included."},
        ],
    },
    {
        "id": "pub-gj-installaties",
        "name": "GJ Installaties B.V.",
        "area": "Heer",
        "address": "Oombosch 2",
        "postcode": "6228 SW",
        "coords": (50.828, 5.728),
        "services": ["boiler", "radiator", "hot_water", "thermostat"],
        "profile_url": "https://www.loodgietersbijmij.nl/loodgieter/1854/gj-installaties-b-v",
        "review": {"score_5": 5.0, "count": 13, "source_name": "Google rating as reported by Loodgieters bij mij", "source_score": "5.0/5"},
        "published_prices": [],
    },
    {
        "id": "pub-aa-installaties",
        "name": "AA Installaties Maastricht B.V.",
        "area": "Wittevrouwenveld",
        "address": "Eburonenweg 11",
        "postcode": "6224 HN",
        "coords": (50.857, 5.716),
        "services": ["boiler", "radiator", "hot_water", "thermostat", "heat_pump"],
        "profile_url": "https://brinqs.nl/installatiebedrijf/maastricht/aa-installaties-maastricht-bv-9495",
        "review": {"score_5": 2.8, "count": 63, "source_name": "Brinqs", "source_score": "2.8/5"},
        "published_prices": [],
    },
    {
        "id": "pub-technisch-buro-hermans",
        "name": "Technisch Buro Hermans (TBH)",
        "area": "Amby",
        "address": "Watermolen 24",
        "postcode": "6229 PM",
        "coords": (50.875, 5.741),
        "services": ["boiler", "radiator", "hot_water", "heat_pump"],
        "profile_url": "https://trustoo.nl/limburg/maastricht/cv-verwarmings-installateur/",
        "review": {"score_5": 3.8, "count": 7, "source_name": "Trustoo", "source_score": "7.6/10"},
        "published_prices": [],
    },
    {
        "id": "pub-installatieservice-jurgen",
        "name": "Installatie Service Jurgen",
        "area": "Randwyck",
        "address": "Punterweg 32",
        "postcode": "6222 NW",
        "coords": (50.835, 5.715),
        "services": ["boiler", "radiator", "hot_water", "thermostat"],
        "profile_url": "https://installatieservicejurgen.nl/",
        "review": None,
        "published_prices": [],
    },
    {
        "id": "pub-alberto-thomassen",
        "name": "Loodgieters- en Verwarmingsbedrijf A. Thomassen",
        "area": "Heer",
        "address": "Molenweg 117",
        "postcode": "6225 NB",
        "coords": (50.822, 5.729),
        "services": ["boiler", "radiator", "hot_water"],
        "profile_url": "https://www.cylex.nl/bedrijf/loodgieters-verwarmingsbedrijf-a-thomassen-10890198.html",
        "review": None,
        "published_prices": [],
    },
    {
        "id": "pub-klusbedrijf-r-houben",
        "name": "Klusbedrijf R. Houben",
        "area": "Wyck",
        "address": "Avenue Céramique 221",
        "postcode": "6221 KX",
        "coords": (50.849, 5.704),
        "services": ["no_heat", "boiler", "radiator", "hot_water", "thermostat"],
        "profile_url": "https://bestevakmanindebuurt.nl/cv-monteur/maastricht/klusbedrijf-r-houben-maastricht",
        "review": {"score_5": 5.0, "count": 22, "source_name": "BesteVakmanInDeBuurt", "source_score": "5.0/5"},
        "published_prices": [],
    },
    {
        "id": "pub-mennen-installaties",
        "name": "Mennen Installaties",
        "area": "Maastricht (service area; address not published)",
        "address": None,
        "postcode": None,
        "coords": (50.852, 5.691),
        "services": ["boiler", "radiator", "hot_water", "thermostat"],
        "profile_url": "https://menneninstallaties.nl/",
        "review": None,
        "published_prices": [],
    },
    {
        "id": "pub-hogenboom-installaties",
        "name": "Hogenboom Installaties",
        "area": "Bosscherveld",
        "address": "Sandersweg 110",
        "postcode": "6219 NW",
        "coords": (50.870, 5.679),
        "services": ["boiler", "radiator", "hot_water", "heat_pump"],
        "profile_url": "https://vandekreekegroep.com/wp-content/uploads/2024/03/20240315-KVK-Loodgietersbedrijf-J.P.-Hogenboom-BV-14630581.pdf",
        "review": None,
        "published_prices": [],
    },
    {
        "id": "pub-ramakers-installatie-service",
        "name": "R.I.S. Ramakers Installatie Service",
        "area": "Bosscherveld",
        "address": "Sleperweg 40",
        "postcode": "6222 NK",
        "coords": (50.870, 5.679),
        "services": ["boiler", "radiator", "hot_water", "heat_pump"],
        "profile_url": "https://installatiebedrijf-gids.nl/limburg/maastricht/r-i-s-ramakers-installatie-service/",
        "review": None,
        "published_prices": [],
    },
]

DEMO_PREFIXES = [
    "MaasWarm", "Limburg Heat", "Stadsverwarming Service", "ComfortKetel",
    "Heater Help", "Maasland Installaties", "WarmThuis", "Zuid Service",
    "KetelKeur", "Heer Heating", "ThermoFix", "Centrale Warmte",
    "Radiator & Co", "BoilerCare", "HeatPoint", "WarmteWerk",
    "Maas Klimaat", "HomeHeat", "CV Partner", "Limburg Comfort",
]
DEMO_SUFFIXES = ["Team", "Installatiegroep", "Service", "Monteurs", "Techniek", "Onderhoud"]


def demo_review(index: int) -> dict[str, object]:
    score = 3.6 + ((index * 7) % 14) / 10
    count = 8 + ((index * 19) % 137)
    return {
        "score_5": round(min(score, 4.9), 1),
        "count": count,
        "source_name": "Synthetic demo reviews",
        "source_score": f"{min(score, 4.9):.1f}/5",
        "is_simulated": True,
        "verified_at": None,
    }


def next_slot(index: int) -> str:
    target = date(2026, 11, 23) + timedelta(days=(index * 3) % 17)
    while target.weekday() >= 5:
        target += timedelta(days=1)
    hour = 9 + ((index * 2) % 8)
    return datetime.combine(target, time(hour, 0), tzinfo=timezone(timedelta(hours=1))).isoformat()


def estimate_prices(index: int, service_types: list[str]) -> list[dict[str, object]]:
    factor = 0.86 + (index % 9) * 0.045
    rows = []
    for service in service_types:
        low, high = BASE_PRICES[service]
        adjusted_low = int(round((low * factor) / 5) * 5)
        adjusted_high = int(round((high * factor) / 5) * 5)
        rows.append({
            "problem_type": service,
            "minimum_eur": adjusted_low,
            "maximum_eur": max(adjusted_low, adjusted_high),
            "currency": "EUR",
            "price_basis": "demo_estimate",
            "includes_vat": True,
            "includes_parts": False,
        })
    return rows


def build_records() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for index, provider in enumerate(PUBLIC_PROVIDERS):
        records.append({
            **provider,
            "record_origin": "public_listing",
            "city": CITY,
            "location_precision": "approximate_area_centroid",
            "verified_at": VERIFIED_AT,
            "prices": estimate_prices(index, provider["services"]),
            "review_is_simulated": False,
            "next_available_at": next_slot(index),
        })

    for index in range(30):
        area, lat, lon = AREAS[index % len(AREAS)]
        prefix = DEMO_PREFIXES[index % len(DEMO_PREFIXES)]
        suffix = DEMO_SUFFIXES[(index // len(DEMO_PREFIXES)) % len(DEMO_SUFFIXES)]
        service_count = 3 + (index % 4)
        service_start = (index * 2) % len(CATEGORIES)
        services = [CATEGORIES[(service_start + offset) % len(CATEGORIES)] for offset in range(service_count)]
        # Keep each neighborhood point on its approximate centroid; the tiny
        # offset separates map markers without implying exact addresses.
        latitude = round(lat + ((index % 3) - 1) * 0.0005, 4)
        longitude = round(lon + (((index // 3) % 3) - 1) * 0.0005, 4)
        review = demo_review(index)
        records.append({
            "id": f"demo-maastricht-{index + 1:03d}",
            "name": f"{prefix} {suffix} Demo {index + 1:02d}",
            "record_origin": "demo_sample",
            "city": CITY,
            "area": area,
            "address": None,
            "postcode": None,
            "coords": (latitude, longitude),
            "location_precision": "synthetic_area_centroid",
            "services": services,
            "profile_url": None,
            "verified_at": None,
            "review": review,
            "review_is_simulated": True,
            "prices": estimate_prices(index + len(PUBLIC_PROVIDERS), services),
            "published_prices": [],
            "next_available_at": next_slot(index + len(PUBLIC_PROVIDERS)),
        })
    return records


def export_json(records: list[dict[str, object]]) -> None:
    exported = []
    for row in records:
        review = row.get("review")
        exported.append({
            "id": row["id"],
            "name": row["name"],
            "city": row["city"],
            "area": row["area"],
            "address": row["address"],
            "postcode": row["postcode"],
            "position": {
                "latitude": row["coords"][0],
                "longitude": row["coords"][1],
                "precision": row["location_precision"],
            },
            "services": row["services"],
            "priceRanges": row["prices"],
            "reviews": {
                "score": review["score_5"] if review else None,
                "scale": 5,
                "count": review["count"] if review else 0,
                "source": review["source_name"] if review else None,
                "sourceUrl": row["profile_url"] if review else None,
                "simulated": row["review_is_simulated"],
            },
            "nextAvailableAt": row["next_available_at"],
            "availabilitySimulated": True,
            "recordOrigin": row["record_origin"],
            "sourceUrl": row["profile_url"],
        })
    payload = {
        "dataset": "Maastricht heating specialists",
        "version": 1,
        "generatedAt": VERIFIED_AT,
        "city": CITY,
        "records": exported,
    }
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_database(records: list[dict[str, object]]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    connection = sqlite3.connect(DB_PATH)
    connection.executescript((ROOT / "schema.sql").read_text(encoding="utf-8"))
    for row in records:
        connection.execute(
            """INSERT INTO specialists
               (id, name, record_origin, city, area, address, postcode, latitude, longitude,
                location_precision, profile_url, verified_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (row["id"], row["name"], row["record_origin"], row["city"], row["area"], row["address"],
             row["postcode"], row["coords"][0], row["coords"][1], row["location_precision"],
             row["profile_url"], row["verified_at"]),
        )
        for service in row["services"]:
            connection.execute("INSERT INTO specialist_services VALUES (?, ?)", (row["id"], service))
        for price in row["prices"]:
            connection.execute(
                """INSERT INTO price_estimates
                   (specialist_id, problem_type, minimum_eur, maximum_eur, currency,
                    price_basis, includes_vat, includes_parts)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (row["id"], price["problem_type"], price["minimum_eur"], price["maximum_eur"],
                 price["currency"], price["price_basis"], int(price["includes_vat"]), int(price["includes_parts"])),
            )
        review = row.get("review")
        connection.execute(
            """INSERT INTO reviews
               (specialist_id, score_5, review_count, source_name, source_score,
                source_url, is_simulated, verified_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (row["id"], review.get("score_5") if review else None, review.get("count", 0) if review else 0,
             review.get("source_name") if review else None, review.get("source_score") if review else None,
             row["profile_url"] if review else None, int(row["review_is_simulated"]), row["verified_at"]),
        )
        connection.execute(
            "INSERT INTO availability VALUES (?, ?, ?, 1)",
            (row["id"], row["next_available_at"], "Illustrative slot; not a live provider calendar."),
        )
        for price in row.get("published_prices", []):
            connection.execute(
                """INSERT INTO published_prices
                   (specialist_id, work_type, amount_eur, unit, vat_included, conditions, source_url, verified_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (row["id"], price["work_type"], price["amount_eur"], price["unit"],
                 int(price["vat_included"]), price["conditions"], row["profile_url"], VERIFIED_AT),
            )

    notes = [
        ("benchmark-cvstoring", "CV Storing Maastricht published rates", "https://www.cvstoring-maastricht.nl/tarieven.html",
         "Published rate examples are stored in published_prices; provider terms specify ex-VAT rates and conditions.", VERIFIED_AT),
        ("benchmark-maastricht-market", "Maastricht CV price guide", "https://www.cvketel-nu.nl/maastricht/",
         "Used only as market context. Per-provider comparison ranges in price_estimates are simulated and are not provider quotes.", VERIFIED_AT),
        ("benchmark-regional-rates", "Ubaghs published installation rates", "https://ubaghs.nl/tarieven/",
         "Regional rate context for hourly and call-out costs; Ubaghs itself is not included as a Maastricht-city provider record.", VERIFIED_AT),
    ]
    connection.executemany("INSERT INTO source_notes VALUES (?, ?, ?, ?, ?)", notes)
    connection.commit()
    connection.close()


if __name__ == "__main__":
    directory = build_records()
    build_database(directory)
    export_json(directory)
    print(f"Created {DB_PATH} with {len(directory)} specialist records.")
    print(f"Created {JSON_PATH} for app and AI imports.")
