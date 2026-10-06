# American Senators - dataset

Structured historical data for the Senate timeline (1789-present).

## Layout

```text
data/
  raw/                   Upstream files, saved unchanged
    legislators-current.yaml
    legislators-historical.yaml
    senate-manual-104.txt   optional Senate Manual text
  auxiliary/             Inputs that are not the chart
    senate-manual-service.json
    meta.json            Timeline bounds
  processed/             Chart dataset the site loads
    seats-all.json       Runtime bundle (all 100 seats)
    seats/
      index.json         Display order (array of seat ids)
      {st}-{class}.json  One file per Senate seat
  SOURCES.md             Upstream dataset notes
```

`raw/` holds the congress-legislators YAML exactly as downloaded. `auxiliary/` holds the Senate Manual service table and timeline bounds. `processed/` is the seat data `js/load.js` fetches (`data/processed/seats-all.json` and `data/auxiliary/meta.json`; HTTP required - see root README). The source list people should read is [`SOURCES.md`](./SOURCES.md).

Regenerate with `python scripts/import_senators.py`. That run reads the YAML already in `raw/` and the Manual table in `auxiliary/`, then rewrites `processed/`. It downloads a YAML file only when that file is missing.

## Seat file fields

| Field | Description |
|-------|-------------|
| `id`, `name`, `flag` | Identity (`ca-1`, `California Class I`, postal `CA`) |
| `state`, `class` | Postal code and Senate class (1, 2, or 3) |
| `region` | Census region: `northeast`, `midwest`, `south`, `west` |
| `admitted` | Date the state entered the Union (`YYYY-MM-DD`) |
| `rulers` | Contiguous senator spans on this seat |

### Senator spans

```json
{
  "name": "Dianne Feinstein",
  "role": "Democrat",
  "party": "Democrat",
  "bioguide": "F000062",
  "start": 1992, "startMonth": 11, "startDay": 10,
  "end": 2023, "endMonth": 9, "endDay": 29
}
```

Contiguous terms for the same Bioguide id are merged into one bar (gaps up to 31 days, covering typical Jan 3 → mid-January swearing-in). Vacancies appear as gaps.

## Editing

Prefer regenerating from upstream rather than hand-editing all 100 seats. A targeted fix goes in `processed/seats/` or `auxiliary/meta.json`.

```powershell
pip install -r scripts/requirements.txt
python scripts/import_senators.py
```

Then refresh the page (with a local server or on GitHub Pages). No build step for the site itself.

## Methodology

- Tenure fields are year + month + day for chart placement and tooltips.
- Current open terms are capped at `TIMELINE_END` in `auxiliary/meta.json`.
- Party on a merged span is the last party recorded in that contiguous service.

### Overlaps and gaps

A bar is an overlap when two different people are both drawn on the same seat for one or more of the same days. Congress-legislators often caused that by storing an unknown day as January 1 or December 31, or by keeping a term running until its official end after the senator had already resigned or died. William Pitt Fessenden is listed through March 3, 1865, while Nathan Allen Farwell's placeholder start is January 1, 1864, so both occupy Maine Class II at once.

Only those overlapping spans are clipped to the Senate Manual, 104th Congress (`auxiliary/senate-manual-service.json`). Newer Manual editions exist and are not applied. A same-day handoff, such as January 3, is left as it is.

A gap is the opposite: the bars do not touch, so nobody is drawn. The Manual is not consulted, even when it shows someone in office the whole time. Congress-legislators often starts a term on the day Congress met, months after the term itself began (March 4, until the Twentieth Amendment). The empty stretch is not a vacant seat.

Moses Edwin Clapp is the handoff on Minnesota Class I. Charles Arnette Towne ends January 28, 1901. The YAML starts Clapp on December 2, 1901, the day the next Congress met. The Manual starts him on January 23, 1901, the day after Towne.

The same holes open inside one person's service on Virginia Class II. The Manual gives Thomas Staples Martin one span, March 4, 1895 to November 17, 1919. The chart starts him on December 2, 1895 and then breaks him each time a new Congress waited until a later session: about March 4 to December 2 in 1901 and 1907, March 4 to April 7 in 1913, and March 4 to May 19 in 1919. Carter Glass follows him. The Manual starts Glass on November 18, 1919, the day after Martin. The chart starts Glass on February 20, 1920, then leaves March 4 to December 7 empty in 1925 and again in 1931.

See **[SOURCES.md](./SOURCES.md)** and **[CHANGELOG.md](./CHANGELOG.md)**.

## License

This dataset is licensed under [CC BY-SA 4.0](../LICENSE-DATA). Legislator records are from [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators). Overlapping spans were checked against the [Senate Manual, 104th Congress](https://www.govinfo.gov/content/pkg/SMAN-104/html/SMAN-104-pg961.htm). Contributions: see [CONTRIBUTING.md](../CONTRIBUTING.md).

_Made with AI. Curated by Human._
