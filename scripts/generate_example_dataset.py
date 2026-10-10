"""Build data/examples/five-countries.json and print overlap checks."""
import json
import random
from datetime import date, timedelta
from pathlib import Path

START = date(1995, 1, 1)
END = date(2024, 12, 31)
rng = random.Random(30)

FIRST = [
    "Ada", "Bruno", "Clara", "Dorian", "Elena", "Felix", "Greta", "Hugo",
    "Iris", "Jonas", "Kira", "Leo", "Mira", "Nils", "Olga", "Pavel", "Quinn",
    "Rosa", "Soren", "Thea", "Uma", "Viktor", "Willa", "Yara", "Anya", "Boris",
    "Celia", "Dmitri", "Eva", "Farid", "Gita", "Hassan", "Ines", "Jovan",
    "Katya", "Lars", "Nadia", "Omar", "Petra", "Ruben",
]
LAST = [
    "Vale", "Morin", "Keller", "Horvat", "Lind", "Novak", "Berg", "Costa",
    "Petrov", "Almeida", "Sato", "Ibrahim", "Okoye", "Marin", "Vogel", "Rossi",
    "Nagy", "Khoury", "Dalca", "Moreau", "Silva", "Andersen", "Popov", "Laurent",
    "Haddad", "Kowalski", "Fernandez", "Okafor", "Weiss", "Bergstrom",
]
PARTIES = ["Harbor", "Cedar", "Lark", "Northwind", "Independent"]
# name, region, leader count, max people in office on any day
COUNTRIES = [
    ("aurelia", "Aurelia", "West", 3, 2),
    ("brind", "Brind", "North", 8, 3),
    ("calden", "Calden", "East", 15, 4),
    ("dorven", "Dorven", "South", 25, 5),
    ("elmark", "Elmark", "Islands", 40, 5),
]


def date_at(index):
    return START + timedelta(days=index)


def ruler_record(name, start, end):
    return {
        "name": name,
        "party": rng.choice(PARTIES),
        "role": "Head of state",
        "start": start.year,
        "startMonth": start.month,
        "startDay": start.day,
        "end": end.year,
        "endMonth": end.month,
        "endDay": end.day,
    }


def schedule(leader_count, cap):
    """Succession down the middle, plus reigns that start and end inside other reigns."""
    days = (END - START).days + 1
    occupancy = [0] * days
    spans = []

    def fits(lo, hi):
        return all(occupancy[i] < cap for i in range(lo, hi + 1))

    def take(lo, hi):
        for i in range(lo, hi + 1):
            occupancy[i] += 1
        spans.append((lo, hi))

    # A single line of successors covers the whole span. Everyone else cuts across it.
    backbone = max(2, leader_count // 5)
    backbone = min(backbone, leader_count - 1)
    base, rem = divmod(days, backbone)
    cursor = 0
    for i in range(backbone):
        length = base + (1 if i < rem else 0)
        take(cursor, cursor + length - 1)
        cursor += length

    def duration():
        roll = rng.random()
        if roll < 0.35:
            return rng.randint(70, 280)
        if roll < 0.75:
            return rng.randint(280, 1100)
        return rng.randint(1100, 2800)

    placed = backbone
    attempts = 0
    while placed < leader_count and attempts < 20000:
        attempts += 1
        length = min(duration(), days)
        if attempts > 8000:
            length = rng.randint(40, 180)
        start_at = rng.randrange(0, days - length + 1)
        end_at = start_at + length - 1
        if fits(start_at, end_at):
            take(start_at, end_at)
            placed += 1
    if placed != leader_count:
        raise RuntimeError(f"placed {placed} of {leader_count}")
    return spans


used_names = set()


def person():
    for _ in range(1000):
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if name not in used_names:
            used_names.add(name)
            return name
    raise RuntimeError("ran out of unique names")


def to_date(ruler, which):
    if which == "start":
        return date(ruler["start"], ruler["startMonth"], ruler["startDay"])
    return date(ruler["end"], ruler["endMonth"], ruler["endDay"])


def histogram(rulers):
    events = []
    for ruler in rulers:
        events.append((to_date(ruler, "start"), 1))
        events.append((to_date(ruler, "end") + timedelta(days=1), -1))
    events.sort()
    counts = {}
    current = 0
    previous = events[0][0]
    peak = 0
    for moment, delta in events:
        if moment > previous and current:
            counts[current] = counts.get(current, 0) + (moment - previous).days
        current += delta
        peak = max(peak, current)
        previous = moment
    return peak, counts


def partial_overlaps(rulers):
    """Reigns that cross: one starts while the other is already in office, then one ends first."""
    spans = [(to_date(r, "start"), to_date(r, "end")) for r in rulers]
    crossed = 0
    for i, (a0, a1) in enumerate(spans):
        for b0, b1 in spans[i + 1 :]:
            if a0 <= b1 and b0 <= a1 and a0 != b0 and a1 != b1:
                crossed += 1
    return crossed


def main():
    dataset = []
    for cid, name, region, leaders, cap in COUNTRIES:
        rulers = []
        for lo, hi in schedule(leaders, cap):
            rulers.append(ruler_record(person(), date_at(lo), date_at(hi)))
        rulers.sort(key=lambda r: (r["start"], r["startMonth"], r["startDay"], r["name"]))
        dataset.append({"id": cid, "name": name, "region": region, "rulers": rulers})

    print(
        "span",
        START.isoformat(),
        END.isoformat(),
        "years",
        round((END - START).days / 365.25, 2),
    )
    worst = 0
    for country in dataset:
        rulers = country["rulers"]
        peak, counts = histogram(rulers)
        worst = max(worst, peak)
        mix = ", ".join(f"{k} at once: {counts[k]}d" for k in sorted(counts))
        print(
            f"{country['name']}: {len(rulers)} leaders, "
            f"max {peak}, crossings {partial_overlaps(rulers)}"
        )
        print(f"  {mix}")
        if len(counts) < 2:
            raise SystemExit(f"{country['name']} never changes how many people share office")
    print("max simultaneous overall", worst)
    print("countries", len(dataset), "leaders", sum(len(c["rulers"]) for c in dataset))
    if worst > 5:
        raise SystemExit("overlap cap exceeded")

    out = Path("data/examples/five-countries.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
