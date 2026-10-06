#!/usr/bin/env python3
"""
Repair Senate seat spans that overlap because congress-legislators stored
unknown days as January 1 / December 31, or kept a full term end after the
senator had already resigned or died.

Actual service comes from the official succession in the Senate Manual
(104th Congress), "Senators of the United States". A span that overlaps
someone else is clipped to that service. A one-day handoff (January 3)
is left alone. A span that sits entirely after the person had already
left is moved onto the real interval.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from calendar import monthrange
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PROCESSED = DATA / "processed"
MANUAL_JSON = DATA / "auxiliary" / "senate-manual-service.json"
MANUAL_TEXT = DATA / "raw" / "senate-manual-104.txt"
MANUAL_URL = "https://www.govinfo.gov/content/pkg/SMAN-104/html/SMAN-104-pg961.htm"

STATE_BY_NAME = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
}

# Manual spellings that do not match Bioguide / congress-legislators surnames.
SURNAME_ALIASES = {
    "tatnall": "tattnall",
    "vandeventer": "van deventer",
    "mcduffie": "mcduffie",
}

MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "aug": 8,
    "sept": 9,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

ROW_RE = re.compile(
    r"^\s*(?P<cong>(?:\d+(?:st|nd|rd|th|d))(?:-(?:\d+(?:st|nd|rd|th|d)))?|Do)\.+\s+(?P<rest>\S.*)$"
)
TOKEN_RE = re.compile(
    r"Do\.|(?:Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*\d{1,2},?\s*\d{4}",
    re.I,
)
EVENT_RE = re.compile(
    r"(?:Res(?:igned)?|Died|Exp(?:elled)?|Retired)\.?\s+"
    r"(?:in\s+)?"
    r"(?:(?P<mon>Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*)?"
    r"(?:(?P<day>\d{1,2}),?\s*)?"
    r"(?P<year>\d{4})",
    re.I,
)
DATE_ONLY_RE = re.compile(
    r"(?:Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*\d{1,2},?\s*\d{4}",
    re.I,
)
DATE_RE = re.compile(
    r"(?P<mon>Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*"
    r"(?P<day>\d{1,2}),?\s*(?P<year>\d{4})",
    re.I,
)


def parse_date(text: str) -> date | None:
    match = DATE_RE.search(text)
    if not match:
        return None
    month = MONTHS[match.group("mon").lower()]
    day = int(match.group("day"))
    year = int(match.group("year"))
    return date(year, month, day)


def clean_name(raw: str) -> str:
    name = re.sub(r",?\s+of\s+\S.*$", "", raw)
    name = name.replace(".", " ")
    name = re.sub(r"\\+\d+\\*", " ", name)
    name = re.sub(r"\s+", " ", name).strip(" -")
    if name.lower() in {"do", "ditto"}:
        return ""
    return name


def event_end(remarks: str) -> tuple[date | None, str]:
    """Return (end, precision) from a resignation / death note, if any."""
    match = EVENT_RE.search(remarks)
    if not match:
        return None, "day"
    year = int(match.group("year"))
    mon = match.group("mon")
    day = match.group("day")
    if mon and day:
        month = MONTHS[mon.lower()]
        return date(year, month, int(day)), "day"
    if mon:
        month = MONTHS[mon.lower()]
        return date(year, month, monthrange(year, month)[1]), "month"
    return date(year, 12, 31), "year"


def parse_manual(text: str) -> tuple[dict[str, list[dict]], dict[str, list[str]]]:
    state = None
    cls = None
    rows: list[dict] = []
    footnotes: dict[tuple[str, int], str] = {}
    pending_disq: list[tuple[str, str, int, str]] = []
    current_key = None
    pending_name = False

    def seat_key() -> str | None:
        if not state or not cls:
            return None
        return f"{state}-{cls}"

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("[[") or stripped.startswith("---"):
            continue
        if stripped.title() in STATE_BY_NAME:
            state = STATE_BY_NAME[stripped.title()]
            cls = None
            pending_name = False
            continue
        class_match = re.fullmatch(r"Class\s+([123])", stripped)
        if class_match:
            cls = int(class_match.group(1))
            current_key = seat_key()
            pending_name = False
            continue
        if stripped.startswith("\\") or stripped.startswith("Congress"):
            note = re.match(r"\\(\d+)\\(.*)", stripped)
            if note and state:
                footnotes[(state, int(note.group(1)))] = note.group(2).strip()
            pending_name = False
            continue

        row_match = ROW_RE.match(line)
        if not row_match or not current_key:
            if (
                pending_name
                and rows
                and rows[-1]["seat"] == current_key
                and re.search(r"[A-Za-z]", stripped)
            ):
                extra = clean_name(stripped)
                if extra:
                    rows[-1]["name"] = (rows[-1]["name"] + " " + extra).strip()
            continue

        rest = row_match.group("rest")
        # "Do." in the name column (......do.) is not the expiration date.
        first_date = DATE_ONLY_RE.search(rest)
        if not first_date:
            footnote = re.search(r"\\(\d+)\\", rest)
            rough = clean_name(re.split(r"\\|\.{3,}", rest)[0])
            if footnote and rough and state and current_key and len(name_tokens(rough)) >= 2:
                pending_disq.append((state, current_key, int(footnote.group(1)), rough))
            pending_name = False
            continue
        after = rest[first_date.end() :]
        second = TOKEN_RE.search(after)
        if not second:
            pending_name = False
            continue

        name = clean_name(rest[: first_date.start()])
        start = parse_date(first_date.group(0))
        end_token = second.group(0)
        expiration = None if end_token.lower().startswith("do") else parse_date(end_token)
        remarks = after[second.end() :]
        if start is None:
            pending_name = False
            continue

        rows.append(
            {
                "seat": current_key,
                "name": name,
                "start": start,
                "expiration": expiration,
                "remarks": remarks.strip(" ."),
            }
        )
        pending_name = True

    # Resolve "Do." expiration and "......do" names, then actual service ends.
    last_name: dict[str, str] = {}
    last_expiration: dict[str, date] = {}
    by_seat: dict[str, list[dict]] = {}

    for row in rows:
        key = row["seat"]
        name = row["name"] or last_name.get(key, "")
        if not name:
            continue
        last_name[key] = name
        expiration = row["expiration"] or last_expiration.get(key)
        if expiration:
            last_expiration[key] = expiration
        by_seat.setdefault(key, []).append(
            {
                "name": name,
                "start": row["start"],
                "expiration": expiration,
                "remarks": row["remarks"],
            }
        )

    service: dict[str, list[dict]] = {}
    for key, seat_rows in by_seat.items():
        resolved = []
        for index, row in enumerate(seat_rows):
            event, precision = event_end(row["remarks"])
            expiration = row["expiration"]
            if expiration and expiration < row["start"]:
                expiration = None
            if event and event >= row["start"]:
                end = event
                if expiration and event > expiration:
                    end = expiration
                precision = "day" if precision == "day" else precision
            elif expiration:
                end = expiration
                precision = "day"
            else:
                continue
            name = re.sub(r",?\s+of\s+.+$", "", row["name"]).strip(" ,")
            resolved.append(
                {
                    "name": name,
                    "start": row["start"],
                    "end": end,
                    "precision": precision if event else "day",
                }
            )
        ordered = []
        for row in resolved:
            if ordered and row["start"] < ordered[-1]["start"]:
                bumped = row["start"]
                while bumped < ordered[-1]["start"] and bumped.year < row["end"].year + 10:
                    try:
                        bumped = bumped.replace(year=bumped.year + 10)
                    except ValueError:
                        break
                if ordered[-1]["start"] <= bumped <= row["end"]:
                    print(
                        f"  shifted {key} {row['name']} start {row['start']} -> {bumped}"
                    )
                    row["start"] = bumped
                else:
                    print(f"  dropped out-of-order {key} {row['name']} {row['start']}..{row['end']}")
                    continue
            ordered.append(row)
        resolved = ordered
        for index, row in enumerate(resolved):
            if row["precision"] == "day":
                continue
            nxt = next(
                (
                    other["start"]
                    for other in resolved[index + 1 :]
                    if norm_name(other["name"]) != norm_name(row["name"])
                    or other["start"] > row["start"]
                ),
                None,
            )
            # Only clip to a later row when the approximate end runs into it.
            if nxt and row["end"] >= nxt and nxt > row["start"]:
                row["end"] = nxt - timedelta(days=1)
                row["precision"] = "clipped"
        # Same-day succession: inclusive ranges would share the handoff day.
        for index, row in enumerate(resolved):
            if index + 1 >= len(resolved):
                continue
            nxt = resolved[index + 1]
            if norm_name(nxt["name"]) == norm_name(row["name"]):
                continue
            if row["end"] >= nxt["start"] > row["start"]:
                row["end"] = nxt["start"] - timedelta(days=1)
        cleaned = [row for row in resolved if row["end"] >= row["start"]]
        service[key] = cleaned

    disqualified: dict[str, list[str]] = {}
    for state, seat, number, name in pending_disq:
        note = footnotes.get((state, number), "")
        if re.search(r"did not qualify|not admitted|did not present credentials", note, re.I):
            disqualified.setdefault(seat, [])
            if name not in disqualified[seat]:
                disqualified[seat].append(name)
                print(f"  never seated {seat} {name}")
    return service, disqualified


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def norm_name(text: str) -> str:
    text = fold(text).lower().replace("’", "'")
    text = text.replace(".", " ")
    text = re.sub(r"[^a-z\s'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def name_tokens(text: str) -> list[str]:
    text = re.sub(r"\b\d+(?:st|nd|rd|th|d)\b", " ", text, flags=re.I)
    stop = {"jr", "sr", "ii", "iii", "iv", "do", "ditto"}
    return [tok for tok in norm_name(text).replace("'", "").split() if tok not in stop]


def surname_key(token: str) -> str:
    return SURNAME_ALIASES.get(token, token)


def score_name(manual_name: str, person_name: str) -> float:
    manual = name_tokens(manual_name)
    person = name_tokens(person_name)
    if len(manual) < 2 or len(person) < 2:
        return 0.0
    last = surname_key(manual[-1])
    person_last = surname_key(person[-1])
    if last != person_last:
        pair = surname_key(" ".join(manual[-2:]))
        person_pair = surname_key(" ".join(person[-2:]))
        if pair == person_pair or pair == person_last:
            last_score = 0.95
            manual_given = manual[:-2] if pair == person_pair else manual[:-1]
        else:
            return 0.0
    else:
        last_score = 1.0
        manual_given = manual[:-1]
    person_given = person[:-1]
    if not manual_given or not person_given:
        return 0.0

    def token_match(left: str, right: str) -> bool:
        if left == right:
            return True
        if len(left) == 1 and right.startswith(left):
            return True
        if len(right) == 1 and left.startswith(right):
            return True
        return False

    # Manual often drops a forename ("Pope Barrow" for Middleton Pope Barrow).
    cursor = 0
    for token in manual_given:
        while cursor < len(person_given) and not token_match(token, person_given[cursor]):
            cursor += 1
        if cursor >= len(person_given):
            if len(token) == 1:
                continue
            return 0.0
        cursor += 1
    given_score = 1.0 if token_match(manual_given[0], person_given[0]) else 0.8
    return last_score + given_score


def load_manual_service() -> tuple[dict[str, list[dict]], dict[str, list[str]]]:
    payload = json.loads(MANUAL_JSON.read_text(encoding="utf-8"))
    service = {}
    for key, rows in payload["seats"].items():
        service[key] = [
            {
                "name": row["name"],
                "start": date.fromisoformat(row["start"]),
                "end": date.fromisoformat(row["end"]),
            }
            for row in rows
        ]
    never = {key: list(names) for key, names in payload.get("neverSeated", {}).items()}
    return service, never


def write_manual_service(service: dict[str, list[dict]], never: dict[str, list[str]]) -> None:
    seats = {}
    for key in sorted(service):
        seats[key] = [
            {
                "name": row["name"],
                "start": row["start"].isoformat(),
                "end": row["end"].isoformat(),
            }
            for row in service[key]
        ]
    payload = {
        "source": "United States Senate Manual, 104th Congress: Senators of the United States",
        "url": MANUAL_URL,
        "seats": seats,
        "neverSeated": {key: names for key, names in sorted(never.items()) if names},
    }
    MANUAL_JSON.parent.mkdir(parents=True, exist_ok=True)
    MANUAL_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ranges_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return max(a_start, b_start) <= min(a_end, b_end) and (
        min(a_end, b_end) - max(a_start, b_start)
    ).days >= 1


def real_overlap_indexes(terms: list[dict]) -> set[int]:
    involved: set[int] = set()
    for i, left in enumerate(terms):
        for j in range(i + 1, len(terms)):
            right = terms[j]
            if left["bioguide"] == right["bioguide"]:
                continue
            if ranges_overlap(left["start"], left["end"], right["start"], right["end"]):
                involved.add(i)
                involved.add(j)
    return involved


def match_bioguide(manual_name: str, people: dict[str, str], when: date, terms: list[dict]) -> str | None:
    scored = []
    for bioguide, full_name in people.items():
        score = score_name(manual_name, full_name)
        if score >= 1.7:
            scored.append((score, bioguide))
    if not scored:
        return None
    best = max(score for score, _bio in scored)
    tied = [bioguide for score, bioguide in scored if best - score < 0.05]
    if len(tied) == 1:
        return tied[0]

    def distance(bioguide: str) -> int:
        spans = [term for term in terms if term["bioguide"] == bioguide]
        if not spans:
            return 10**9
        return min(abs((term["start"] - when).days) for term in spans)

    tied.sort(key=distance)
    return tied[0]


def people_on_terms(terms: list[dict]) -> dict[str, str]:
    return {term["bioguide"]: term["name"] for term in terms}


def clip_term_to_manual(term: dict, manuals: list[dict], siblings: list[dict]) -> list[dict]:
    """Clip an overlapping span to real service. Do not extend a span that already sits inside it.

    Some congress-legislators spans miss the real window entirely (a December 31
    placeholder that starts after the senator had already left). Those move onto
    the nearest manual interval when it is not already covered by another span.
    """
    hits = [
        row
        for row in manuals
        if max(term["start"], row["start"]) <= min(term["end"], row["end"])
    ]
    if hits:
        clipped = []
        for row in hits:
            start = max(term["start"], row["start"])
            end = min(term["end"], row["end"])
            if end < start:
                continue
            if start == term["start"] and end == term["end"]:
                clipped.append(term)
                continue
            nxt = dict(term)
            nxt["start"] = start
            nxt["end"] = end
            clipped.append(nxt)
        return clipped or [term]

    if not manuals:
        return [term]

    def gap(row: dict) -> int:
        if row["end"] < term["start"]:
            return (term["start"] - row["end"]).days
        if term["end"] < row["start"]:
            return (row["start"] - term["end"]).days
        return 0

    nearest = min(manuals, key=gap)
    if gap(nearest) > 550:
        return [term]
    for other in siblings:
        if other["bioguide"] != term["bioguide"]:
            continue
        if other["start"] == term["start"] and other["end"] == term["end"]:
            continue
        if max(other["start"], nearest["start"]) <= min(other["end"], nearest["end"]):
            return []
    moved = dict(term)
    moved["start"] = nearest["start"]
    moved["end"] = nearest["end"]
    return [moved]


def adjust_seat_terms(
    terms: list[dict],
    manuals: list[dict],
    never_names: list[str] | None = None,
) -> list[dict]:
    if not terms:
        return terms
    involved = real_overlap_indexes(terms)
    if not involved:
        return terms

    people = people_on_terms(terms)
    by_bioguide: dict[str, list[dict]] = {}
    for row in manuals:
        bioguide = match_bioguide(row["name"], people, row["start"], terms)
        if not bioguide:
            continue
        by_bioguide.setdefault(bioguide, []).append(row)

    never_ids = set()
    for name in never_names or []:
        for term in terms:
            if score_name(name, term["name"]) >= 1.7:
                never_ids.add(term["bioguide"])

    adjusted: list[dict] = []
    for index, term in enumerate(terms):
        if term["bioguide"] in never_ids and term["bioguide"] not in by_bioguide:
            continue
        if index not in involved or term["bioguide"] not in by_bioguide:
            adjusted.append(term)
            continue
        adjusted.extend(clip_term_to_manual(term, by_bioguide[term["bioguide"]], terms))

    adjusted.sort(key=lambda term: (term["start"], term["end"], term["bioguide"]))
    deduped = []
    seen = set()
    for term in adjusted:
        if term["end"] < term["start"]:
            continue
        key = (term["bioguide"], term["start"], term["end"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(term)
    return deduped


def align_service(
    service: dict[str, list[dict]],
    seats: list[dict],
    never: dict[str, list[str]] | None = None,
) -> tuple[dict[tuple[str, int], list[dict]], dict[tuple[str, int], list[str]]]:
    """Match each seat to a manual class by who served, so a mislabeled class still lines up."""
    never = never or {}
    by_state: dict[str, dict[int, list[dict]]] = {}
    for seat in seats:
        by_state.setdefault(seat["state"], {})[seat["class"]] = [
            ruler_to_term(ruler) for ruler in seat["rulers"]
        ]

    aligned: dict[tuple[str, int], list[dict]] = {}
    aligned_never: dict[tuple[str, int], list[str]] = {}
    for state, by_class in by_state.items():
        manual_by_cls = {}
        for key, rows in service.items():
            manual_state, manual_cls = key.split("-")
            if manual_state == state:
                manual_by_cls[int(manual_cls)] = rows
        scores = []
        for our_cls, terms in by_class.items():
            people = people_on_terms(terms)
            for manual_cls, rows in manual_by_cls.items():
                hits = sum(
                    1
                    for row in rows[:12]
                    if match_bioguide(row["name"], people, row["start"], terms)
                )
                scores.append((hits, our_cls, manual_cls))
        scores.sort(reverse=True)
        used_ours: set[int] = set()
        used_manual: set[int] = set()
        for hits, our_cls, manual_cls in scores:
            if hits == 0 or our_cls in used_ours or manual_cls in used_manual:
                continue
            aligned[(state, our_cls)] = manual_by_cls[manual_cls]
            aligned_never[(state, our_cls)] = never.get(f"{state}-{manual_cls}", [])
            used_ours.add(our_cls)
            used_manual.add(manual_cls)
        for our_cls in by_class:
            aligned.setdefault((state, our_cls), [])
            aligned_never.setdefault((state, our_cls), [])
    return aligned, aligned_never


def ruler_to_term(ruler: dict) -> dict:
    return {
        "bioguide": ruler["bioguide"],
        "name": ruler["name"],
        "party": ruler.get("party") or ruler.get("role") or "Unknown",
        "start": date(ruler["start"], ruler["startMonth"], ruler["startDay"]),
        "end": date(ruler["end"], ruler["endMonth"], ruler["endDay"]),
    }


def term_to_ruler(term: dict) -> dict:
    party = term["party"] or "Unknown"
    return {
        "name": term["name"],
        "role": party,
        "party": party,
        "bioguide": term["bioguide"],
        "start": term["start"].year,
        "startMonth": term["start"].month,
        "startDay": term["start"].day,
        "end": term["end"].year,
        "endMonth": term["end"].month,
        "endDay": term["end"].day,
    }


def count_real_overlaps(seats: list[dict]) -> list[tuple]:
    found = []
    for seat in seats:
        terms = [ruler_to_term(ruler) for ruler in seat["rulers"]]
        involved = real_overlap_indexes(terms)
        if not involved:
            continue
        for i in sorted(involved):
            for j in sorted(involved):
                if j <= i:
                    continue
                left, right = terms[i], terms[j]
                if left["bioguide"] == right["bioguide"]:
                    continue
                if ranges_overlap(left["start"], left["end"], right["start"], right["end"]):
                    start = max(left["start"], right["start"])
                    end = min(left["end"], right["end"])
                    found.append(
                        (
                            (end - start).days + 1,
                            seat["id"],
                            left["name"],
                            left["start"],
                            left["end"],
                            right["name"],
                            right["start"],
                            right["end"],
                        )
                    )
    return found


def settle_terms(terms: list[dict], manuals: list[dict], never_names: list[str]) -> list[dict]:
    current = terms
    for _ in range(4):
        nxt = adjust_seat_terms(current, manuals, never_names)
        if [(t["bioguide"], t["start"], t["end"]) for t in nxt] == [
            (t["bioguide"], t["start"], t["end"]) for t in current
        ]:
            return nxt
        current = nxt
    return current


def repair_seat_records(seats: list[dict]) -> list[dict]:
    """Clip overlapping spans to official service. No-op if the manual file is absent."""
    if not MANUAL_JSON.exists():
        return seats
    service, never = load_manual_service()
    aligned, aligned_never = align_service(service, seats, never)
    repaired = []
    for seat in seats:
        terms = [ruler_to_term(ruler) for ruler in seat["rulers"]]
        key = (seat["state"], seat["class"])
        adjusted = settle_terms(terms, aligned.get(key, []), aligned_never.get(key, []))
        repaired.append({**seat, "rulers": [term_to_ruler(term) for term in adjusted]})
    return repaired


def main() -> None:
    if MANUAL_TEXT.exists():
        service, never = parse_manual(MANUAL_TEXT.read_text(encoding="utf-8", errors="replace"))
        write_manual_service(service, never)
        print(f"parsed {sum(len(v) for v in service.values())} service rows across {len(service)} seats")
    else:
        service, never = load_manual_service()

    seats = []
    for path in sorted((PROCESSED / "seats").glob("*.json")):
        if path.name == "index.json":
            continue
        seats.append(json.loads(path.read_text(encoding="utf-8")))
    before = count_real_overlaps(seats)
    print(f"real overlaps before: {len(before)}")
    aligned, aligned_never = align_service(service, seats, never)

    preview = []
    for seat in seats:
        terms = [ruler_to_term(ruler) for ruler in seat["rulers"]]
        key = (seat["state"], seat["class"])
        preview.append(
            {
                **seat,
                "rulers": [
                    term_to_ruler(term)
                    for term in settle_terms(terms, aligned.get(key, []), aligned_never.get(key, []))
                ],
            }
        )
    after = count_real_overlaps(preview)
    print(f"real overlaps after: {len(after)}")
    for item in after[:40]:
        days, sid, ln, ls, le, rn, rs, re_ = item
        print(f"  {sid} {days}d {ln} {ls}..{le} || {rn} {rs}..{re_}")

    if "--write" not in sys.argv:
        return
    if after:
        print("refusing to write while overlaps remain", file=sys.stderr)
        raise SystemExit(1)

    index = json.loads((PROCESSED / "seats" / "index.json").read_text(encoding="utf-8"))
    by_id = {seat["id"]: seat for seat in preview}
    ordered = [by_id[seat_id] for seat_id in index]
    seats_dir = PROCESSED / "seats"
    seats_dir.mkdir(parents=True, exist_ok=True)
    for seat in ordered:
        path = seats_dir / f"{seat['id']}.json"
        path.write_text(json.dumps(seat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PROCESSED / "seats-all.json").write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(ordered)} seats")

    # Show the examples the overlap report was opened with.
    want = {
        "John McCracken Robinson",
        "John McLean",
        "Thomas Posey",
        "James Brown",
        "Lewis Cass",
        "Thomas Fitzgerald",
        "John Macpherson Berrien",
        "Robert Milledge Charlton",
        "James Jackson",
        "George Walton",
        "Josiah Tattnall",
    }
    print("--- examples ---")
    for seat in preview:
        for ruler in seat["rulers"]:
            if ruler["name"] in want and ruler["start"] < 1860:
                print(
                    f"{seat['id']} {ruler['name']} "
                    f"{ruler['start']:04d}-{ruler['startMonth']:02d}-{ruler['startDay']:02d} .. "
                    f"{ruler['end']:04d}-{ruler['endMonth']:02d}-{ruler['endDay']:02d}"
                )


if __name__ == "__main__":
    main()
