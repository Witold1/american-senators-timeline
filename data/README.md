# Timeline datasets

Each chart dataset lives in its own folder under `data/`:

```text
data/
  catalog.json                 Which datasets exist; default id
  american-senators/           U.S. Senate seats (exclusive tracks)
    raw/
    auxiliary/meta.json
    processed/seats-all.json
  post-soviet-kingdoms/        Kingdoms scaffold (allows co-rule)
    auxiliary/meta.json
    processed/seats-all.json
```

`js/load.js` reads `catalog.json`, picks a dataset (`#american-senators`-style hash, else `?dataset=`, else catalog default), then loads that folder. Formats:

- `seats` — `auxiliary/meta.json` + `processed/seats-all.json` (Senate)
- `countries` — `auxiliary/meta.json` + `countries/index.json` and `{id}.json` (post-Soviet pack)

The top theme bar shows a dataset switcher when more than one pack is listed.

## Dataset `meta.json` flags

| Field | Meaning |
|-------|---------|
| `TIMELINE_START`, `TIMELINE_END` | Year axis bounds |
| `exclusive` | `true` = one person per seat (Senate). `false` = overlapping spans get auto-assigned lanes |
| `showCongress` | Draw Congress band overlays (Senate only) |
| `entityLabel` | Axis corner label (`State`, `Kingdom`, …) |
| `roleLabel` | Default tooltip role when a span has no `role` |
| `title`, `subtitle` | Export / page copy |

## Processed seat shape

Same contract for every dataset: an array of seats/entities with `id`, `name`, and `rulers[]` spans (`start` / `end` plus optional month/day). See [`american-senators/README.md`](./american-senators/README.md) for the full Senate field list.

Lane indexes are **not** stored in JSON. When `exclusive` is false, `js/lanes.js` assigns them at load time.
