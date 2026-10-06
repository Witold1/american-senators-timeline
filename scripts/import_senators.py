#!/usr/bin/env python3
"""
Import U.S. Senate seat timelines from unitedstates/congress-legislators.

Reads legislators-current.yaml and legislators-historical.yaml from data/raw/,
buckets federal Senate terms by (state, class), merges contiguous service by
the same person, applies Senate Manual date repair, and writes the chart files
to data/processed/. Timeline bounds stay in data/auxiliary/meta.json.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Install PyYAML first: pip install pyyaml", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
AUXILIARY = DATA / "auxiliary"
PROCESSED = DATA / "processed"
SEATS_DIR = PROCESSED / "seats"

TIMELINE_START = 1789
TIMELINE_END = date.today().year

SOURCES = {
    "legislators-current": (
        "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml"
    ),
    "legislators-historical": (
        "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-historical.yaml"
    ),
}

STATE_NAMES = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}

# Current Senate class pairs (state → two classes). Stable for all 50 states.
STATE_CLASSES = {
    "AL": (2, 3),
    "AK": (2, 3),
    "AZ": (1, 3),
    "AR": (2, 3),
    "CA": (1, 3),
    "CO": (2, 3),
    "CT": (1, 3),
    "DE": (1, 2),
    "FL": (1, 3),
    "GA": (2, 3),
    "HI": (1, 3),
    "ID": (2, 3),
    "IL": (2, 3),
    "IN": (1, 3),
    "IA": (2, 3),
    "KS": (2, 3),
    "KY": (2, 3),
    "LA": (2, 3),
    "ME": (1, 2),
    "MD": (1, 3),
    "MA": (1, 2),
    "MI": (1, 2),
    "MN": (1, 2),
    "MS": (1, 2),
    "MO": (1, 3),
    "MT": (1, 2),
    "NE": (1, 2),
    "NV": (1, 3),
    "NH": (2, 3),
    "NJ": (1, 2),
    "NM": (1, 2),
    "NY": (1, 3),
    "NC": (2, 3),
    "ND": (1, 3),
    "OH": (1, 3),
    "OK": (2, 3),
    "OR": (2, 3),
    "PA": (1, 3),
    "RI": (1, 2),
    "SC": (2, 3),
    "SD": (2, 3),
    "TN": (1, 2),
    "TX": (1, 2),
    "UT": (1, 3),
    "VT": (1, 3),
    "VA": (1, 2),
    "WA": (1, 3),
    "WV": (1, 2),
    "WI": (1, 3),
    "WY": (1, 2),
}

CENSUS_REGION = {
    "CT": "northeast",
    "ME": "northeast",
    "MA": "northeast",
    "NH": "northeast",
    "RI": "northeast",
    "VT": "northeast",
    "NJ": "northeast",
    "NY": "northeast",
    "PA": "northeast",
    "IL": "midwest",
    "IN": "midwest",
    "MI": "midwest",
    "OH": "midwest",
    "WI": "midwest",
    "IA": "midwest",
    "KS": "midwest",
    "MN": "midwest",
    "MO": "midwest",
    "NE": "midwest",
    "ND": "midwest",
    "SD": "midwest",
    "DE": "south",
    "FL": "south",
    "GA": "south",
    "MD": "south",
    "NC": "south",
    "SC": "south",
    "VA": "south",
    "WV": "south",
    "AL": "south",
    "KY": "south",
    "MS": "south",
    "TN": "south",
    "AR": "south",
    "LA": "south",
    "OK": "south",
    "TX": "south",
    "AZ": "west",
    "CO": "west",
    "ID": "west",
    "MT": "west",
    "NV": "west",
    "NM": "west",
    "UT": "west",
    "WY": "west",
    "AK": "west",
    "CA": "west",
    "HI": "west",
    "OR": "west",
    "WA": "west",
}

# Date the state entered the Union (ratification for the original 13; admission otherwise).
STATE_ADMITTED = {
    "DE": "1787-12-07",
    "PA": "1787-12-12",
    "NJ": "1787-12-18",
    "GA": "1788-01-02",
    "CT": "1788-01-09",
    "MA": "1788-02-06",
    "MD": "1788-04-28",
    "SC": "1788-05-23",
    "NH": "1788-06-21",
    "VA": "1788-06-25",
    "NY": "1788-07-26",
    "NC": "1789-11-21",
    "RI": "1790-05-29",
    "VT": "1791-03-04",
    "KY": "1792-06-01",
    "TN": "1796-06-01",
    "OH": "1803-03-01",
    "LA": "1812-04-30",
    "IN": "1816-12-11",
    "MS": "1817-12-10",
    "IL": "1818-12-03",
    "AL": "1819-12-14",
    "ME": "1820-03-15",
    "MO": "1821-08-10",
    "AR": "1836-06-15",
    "MI": "1837-01-26",
    "FL": "1845-03-03",
    "TX": "1845-12-29",
    "IA": "1846-12-28",
    "WI": "1848-05-29",
    "CA": "1850-09-09",
    "MN": "1858-05-11",
    "OR": "1859-02-14",
    "KS": "1861-01-29",
    "WV": "1863-06-20",
    "NV": "1864-10-31",
    "NE": "1867-03-01",
    "CO": "1876-08-01",
    "ND": "1889-11-02",
    "SD": "1889-11-02",
    "MT": "1889-11-08",
    "WA": "1889-11-11",
    "ID": "1890-07-03",
    "WY": "1890-07-10",
    "UT": "1896-01-04",
    "OK": "1907-11-16",
    "NM": "1912-01-06",
    "AZ": "1912-02-14",
    "AK": "1959-01-03",
    "HI": "1959-08-21",
}

CLASS_ROMAN = {1: "I", 2: "II", 3: "III"}
# Re-elected senators often end Jan 3 and swear in mid-January; keep one bar.
GAP_TOLERANCE = timedelta(days=31)


def fetch_yaml(url: str, dest: Path):
    """Use the YAML already saved in data/raw. Download only if that file is missing."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"Using saved {dest.name}")
        return yaml.safe_load(dest.read_bytes())
    req = urllib.request.Request(url, headers={"User-Agent": "senators-timeline-import/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = resp.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(payload)
    return yaml.safe_load(payload)


def parse_ymd(value) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def display_name(person: dict) -> str:
    name = person.get("name") or {}
    official = name.get("official_full")
    if official:
        return official
    parts = [name.get("first"), name.get("middle"), name.get("last")]
    base = " ".join(p for p in parts if p)
    suffix = name.get("suffix")
    if suffix:
        return f"{base} {suffix}"
    return base or "Unknown"


def collect_terms(people: list[dict]) -> dict[tuple[str, int], list[dict]]:
    buckets: dict[tuple[str, int], list[dict]] = defaultdict(list)

    for person in people:
        bioguide = (person.get("id") or {}).get("bioguide")
        if not bioguide:
            continue
        full_name = display_name(person)

        for term in person.get("terms") or []:
            if term.get("type") != "sen":
                continue
            state = term.get("state")
            cls = term.get("class")
            start = term.get("start")
            end = term.get("end")
            if not state or cls is None or not start or not end:
                continue
            if state not in STATE_NAMES:
                continue
            cls = int(cls)
            if cls not in (1, 2, 3):
                continue

            start_d = parse_ymd(start)
            end_d = parse_ymd(end)
            # Cap open / future ends at timeline end (Dec 31 of TIMELINE_END).
            cap = date(TIMELINE_END, 12, 31)
            if end_d > cap:
                end_d = cap
            if start_d > cap:
                continue
            if end_d < start_d:
                continue

            buckets[(state, cls)].append(
                {
                    "bioguide": bioguide,
                    "name": full_name,
                    "party": term.get("party") or "Unknown",
                    "start": start_d,
                    "end": end_d,
                }
            )

    return buckets


def merge_contiguous(terms: list[dict]) -> list[dict]:
    if not terms:
        return []

    ordered = sorted(terms, key=lambda t: (t["start"], t["end"], t["bioguide"]))
    merged: list[dict] = []

    for term in ordered:
        if not merged:
            merged.append(dict(term))
            continue
        prev = merged[-1]
        same_person = prev["bioguide"] == term["bioguide"]
        contiguous = term["start"] <= prev["end"] + GAP_TOLERANCE
        if same_person and contiguous:
            if term["end"] > prev["end"]:
                prev["end"] = term["end"]
            prev["party"] = term["party"] or prev["party"]
            continue
        merged.append(dict(term))

    return merged


def to_ruler(term: dict) -> dict:
    start = term["start"]
    end = term["end"]
    party = term["party"] or "Unknown"
    return {
        "name": term["name"],
        "role": party,
        "party": party,
        "bioguide": term["bioguide"],
        "start": start.year,
        "startMonth": start.month,
        "startDay": start.day,
        "end": end.year,
        "endMonth": end.month,
        "endDay": end.day,
    }


def seat_id(state: str, cls: int) -> str:
    return f"{state.lower()}-{cls}"


def seat_record(state: str, cls: int, rulers: list[dict]) -> dict:
    state_name = STATE_NAMES[state]
    return {
        "id": seat_id(state, cls),
        "name": f"{state_name} Class {CLASS_ROMAN[cls]}",
        "state": state,
        "class": cls,
        "flag": state,
        "region": CENSUS_REGION[state],
        "admitted": STATE_ADMITTED[state],
        "rulers": rulers,
    }


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def write_seat_tree(directory: Path, seats: list[dict]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for old in directory.glob("*.json"):
        old.unlink()
    write_json(directory / "index.json", [seat["id"] for seat in seats])
    for seat in seats:
        write_json(directory / f"{seat['id']}.json", seat)


def main() -> int:
    print("Fetching legislators-current.yaml …")
    current = fetch_yaml(SOURCES["legislators-current"], RAW / "legislators-current.yaml")
    print("Fetching legislators-historical.yaml …")
    historical = fetch_yaml(SOURCES["legislators-historical"], RAW / "legislators-historical.yaml")

    people = list(historical) + list(current)
    buckets = collect_terms(people)

    seats: list[dict] = []
    missing: list[str] = []

    for state in sorted(STATE_NAMES, key=lambda s: STATE_NAMES[s]):
        for cls in STATE_CLASSES[state]:
            terms = merge_contiguous(buckets.get((state, cls), []))
            rulers = [to_ruler(t) for t in terms]
            if not rulers:
                missing.append(seat_id(state, cls))
            seats.append(seat_record(state, cls, rulers))

    if len(seats) != 100:
        print(f"ERROR: expected 100 seats, got {len(seats)}", file=sys.stderr)
        return 1

    # congress-legislators uses Jan 1 / Dec 31 when the day is unknown, which
    # stacks two senators on one seat. Pull those spans back to official service.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from resolve_overlaps import repair_seat_records

    seats = repair_seat_records(seats)

    write_seat_tree(SEATS_DIR, seats)

    # Single-file bundle for the web app (avoids ~100 HTTP requests on load).
    write_json(PROCESSED / "seats-all.json", seats)

    write_json(
        AUXILIARY / "meta.json",
        {
            "TIMELINE_START": TIMELINE_START,
            "TIMELINE_END": TIMELINE_END,
        },
    )

    total_rulers = sum(len(s["rulers"]) for s in seats)
    print(f"Saved raw YAML to {RAW}")
    print(f"Wrote {len(seats)} seats ({total_rulers} senator spans) to {SEATS_DIR}")
    print(f"Wrote runtime bundle {PROCESSED / 'seats-all.json'}")
    if missing:
        print(f"WARNING: empty seats: {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
