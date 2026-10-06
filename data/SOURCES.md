# Sources

Primary source for terms, parties, and Bioguide ids:

- [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) — `legislators-current.yaml`, `legislators-historical.yaml`

Copies of those two files are in `data/raw/`, taken from commit `4458244` (2026-07-15), the last commit on or before the 2026-07-30 import. They are the upstream files, unchanged.

Secondary source, used only to correct a span when it overlaps someone else on the same seat:

- [United States Senate Manual, 104th Congress: Senators of the United States](https://www.govinfo.gov/content/pkg/SMAN-104/html/SMAN-104-pg961.htm). The parsed copy is `data/auxiliary/senate-manual-service.json`.

Newer editions of the same table are on the [GovInfo Senate Manual collection](https://www.govinfo.gov/app/collection/SMAN/): the 106th, 107th, 110th, 112th, 113th, 116th, 117th, and [118th](https://www.govinfo.gov/content/pkg/CDOC-118sdoc1/pdf/CDOC-118sdoc1.pdf) Congresses (the 118th is S. Doc. 118-1; "Senators of the United States" begins on page 1804). This dataset has not been realigned to those later editions. GovInfo does not have the 105th, 108th, 109th, 111th, 114th, or 115th.

Biographical identifiers:

- [Biographical Directory of the United States Congress](https://bioguide.congress.gov/)

Reference database of current senators and the former senators who preceded them:

- [SenatorDB](https://senatordb.com)

Seat identity (state × class) follows the Constitution’s three-class Senate system; each state has exactly two classes. Census regions follow the U.S. Census Bureau four-region grouping.

The importer reads the YAML already in `data/raw/` and the Manual table in `data/auxiliary/`, then writes the chart files to `data/processed/`. It downloads a YAML file only when that file is missing.

Regenerate with:

```powershell
pip install -r scripts/requirements.txt
python scripts/import_senators.py
```
