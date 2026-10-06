# Dataset changelog

## 2026-10-01

- Replaced `interim/` with `auxiliary/` for the Senate Manual table and `meta.json`. `processed/` keeps the seat files the site loads. Dropped the unused `sources.json` bibliography; `SOURCES.md` is the source note.
- Listed unitedstates/congress-legislators as the primary source. The Senate Manual, 104th Congress, is a secondary check for overlapping spans; later Manual editions through the 118th Congress are not applied.

## 2026-07-30

- Widened contiguous-term merge to 31 days so re-elected senators (e.g. Stevens, Murkowski) stay one bar across Congress swearing-in gaps.
- Replaced post-Soviet republic rulers with U.S. federal Senate seats (100 rows: state × class).
- Imported terms from unitedstates/congress-legislators (current + historical).
- Timeline bounds: 1789-2026.
- Added `admitted` (Union entry date) on each seat for chronological ordering.
