# Contributing

Visualization and web improvements are welcome. Data corrections and regenerations from upstream are welcome too.

## How to contribute /data

1. Fork the repository.
2. Prefer regenerating seats from congress-legislators:

   ```powershell
   pip install -r scripts/requirements.txt
   python scripts/import_senators.py
   ```

   Or edit a file under `data/processed/seats/` (or `data/auxiliary/meta.json`) for a targeted fix.
3. Note material changes in `data/CHANGELOG.md`.
4. Open a pull request with a short explanation and sources where possible.

Schema and field notes: [`data/README.md`](data/README.md).

### Local check

Preferred:
`python -m http.server 8080` or `npx serve .`

Alternatives:
```powershell
.\serve.ps1
```
Then open the URL printed in the terminal (usually `http://localhost:8080`).

Confirm the timeline loads (100 seat rows), filter works, and PNG export still works.

## What makes a good PR

- Prefer regenerating from congress-legislators for bulk updates.
- Keep dates year-first; month/day come from upstream when known.
- One seat or one logical topic per PR when hand-editing.

## License of contributions

- **Code and site files** (HTML, CSS, JS, scripts) are contributed under the **MIT License** ([`LICENSE`](LICENSE)).
- **Dataset and editorial content** under `data/` are contributed under **CC BY-SA 4.0** ([`LICENSE-DATA`](LICENSE-DATA)).
