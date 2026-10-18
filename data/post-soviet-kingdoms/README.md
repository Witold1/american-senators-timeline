# Rulers of Post-Soviet Domains

Country timelines reused from [rulers-of-post-soviet-kingdoms](https://github.com/Witold1/rulers-of-post-soviet-kingdoms) (`data/countries`).

## Try it

`http://localhost:8080/#soviet-states`

## Layout

```text
data/post-soviet-kingdoms/
  auxiliary/
    meta.json       Bounds + exclusive:false (auto-lanes)
    sources.json    Act / document bibliography
  countries/
    index.json      Display order
    {id}.json       One republic file
  SOURCES.md
  CHANGELOG.md
```

`js/load.js` reads `countries/index.json` and each country file, then maps them into the shared seat shape:

- `rulers[]` is every officeholder, in order. Soviet-era heads are marked `"era": "soviet"`
- Older files that still split `sovietLeaders` or `leaders` are folded into that same list
- `context.independence` → `admitted` for sorting / admission year
- `context` also holds `region`, `flag`, and `sovereignty`
- `exclusive: false` so genuine overlaps get auto-lanes

Edit the country JSON files and refresh — no build step.

## Upstream

Leader lists follow the upstream country files. Place and dates (`region`, `flag`, `sovereignty`, `independence`) live under `context`. Keep long source notes in `SOURCES.md`.
