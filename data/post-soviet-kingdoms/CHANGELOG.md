# Data changelog

Record substantive changes to dates, acts, rulers, or schema. Editorial typos in notes need not be logged.

Format: **YYYY-MM-DD** — brief description. List affected `{id}.json` files where helpful.

---

## 2026-10-08

- Timeline start moved from 1985 to **1975**.
- Filled leaders in office on 1 Jan 1975 who were missing:
  - **estonia** — Johannes Käbin (First Secretary, 26 Mar 1950 – 26 Jul 1978)
  - **latvia** — Augusts Voss (First Secretary, 15 Apr 1966 – 14 Apr 1984)
  - **moldova** — Ivan Bodiul (First Secretary, 29 May 1961 – 30 Dec 1980)
  - **belarus** — Pyotr Masherov (30 Mar 1965 – 4 Oct 1980) and Tikhon Kiselyov (16 Oct 1980 – 11 Jan 1983)
  - **uzbekistan** — Sharof Rashidov (First Secretary, 15 Mar 1959 – 31 Oct 1983)
  - **tajikistan** — Jabbor Rasulov (First Secretary, 12 Apr 1961 – 4 Apr 1982)
  - **azerbaijan** — Heydar Aliyev as First Secretary (14 Jul 1969 – 3 Dec 1982) before Baghirov

## 2026-07-14

- Closed later succession gaps:
  - **tajikistan** — Aslonov (acting), Nabiyev, Iskandrov (acting) between Mahkamov’s Aug 1991 resignation and Nabiyev’s elected presidency (Dec 1991)
  - **georgia** — Nino Burjanadze acting president (23 Nov 2003 – 25 Jan 2004) after the Rose Revolution
  - **turkmenistan** — Gurbanguly Berdimuhamedow as acting president from Niyazov’s death (21 Dec 2006), not only from the Feb 2007 election
  - **kyrgyzstan** — Sadyr Japarov acting (15 Oct – 14 Nov 2020) and Talant Mamytov acting (14 Nov 2020 – 28 Jan 2021) between Jeenbekov and Japarov’s inauguration
- Added **SOURCES.md** — per-country Wikipedia / rulers.org office lists used for succession dates (keeps `sources.json` for act documents)
- Closed visible 1989–93 succession gaps:
  - **ukraine** — Kravchuk as acting/president from independence (24 Aug 1991), not only from 5 Dec inauguration; soviet chair term ends at independence
  - **georgia** — Military Council (Jan–Mar 1992) between Gamsakhurdia and Shevardnadze
  - **armenia** — Levon Ter-Petrosyan as Supreme Council chairman from 4 Aug 1990 through independence (replacing late First Secretaries who no longer headed the republic); president bar from 21 Sep 1991
  - **azerbaijan** — Yaqub Mammadov and Isa Gambar (acting) plus Mutallibov’s brief May 1992 restoration between Mar and Jun 1992
  - **kyrgyzstan** — Masaliyev through Akayev’s election as president (27 Oct 1990); removed bogus Apr 1990 cutoff
- Filled early-1985 Soviet coverage gaps (leaders in office on 1 Jan 1985 who were missing):
  - **georgia** — Eduard Shevardnadze (First Secretary, 29 Sep 1972 – 6 Jul 1985)
  - **kyrgyzstan** — Turdakun Usubaliyev (First Secretary, 9 May 1961 – 2 Nov 1985)
  - **tajikistan** — Rahmon Nabiyev as First Secretary (20 Apr 1982 – 14 Dec 1985) before Mahkamov
  - **russia** — Mikhail Yasnov (Chairman, RSFSR Supreme Soviet, 23 Dec 1966 – 26 Mar 1985) before Orlov
- Added `startMonth` / `startDay` / `endMonth` / `endDay` on all `sovietLeaders` and `rulers` across all 15 country files.
- Tooltips now show month (and day when not the 1st) for leader tenures.
- Corrections / expansions with the month–day pass:
  - **lithuania** — 2003–04 presidency corrected to Rolandas Paksas (was mislabeled Brazauskas); added Artūras Paulauskas (acting).
  - **ukraine** — added Oleksandr Turchynov (acting, Feb–Jun 2014).
  - **belarus** — added Myechyslaw Hryb (Supreme Soviet chair, Jan–Jul 1994).
  - **uzbekistan** — added Rafiq Nishanov (First Secretary, 1988–89).
  - **turkmenistan** — Gurbanguly Berdimuhamedow ends Mar 2022; added Serdar Berdimuhamedow from 19 Mar 2022.
  - **armenia** — Nikol Pashinyan marked as Prime Minister (executive) from 8 May 2018.
- Precision caveat: many late-Soviet First Secretary days remain secondary-source estimates; inauguration days for presidents are generally stronger.

## 2026-07-12

- Restructured dataset: split monolithic `countries.js` into `meta.json`, `sources.json`, and `countries/{id}.json`.
- Added `countries/index.json` for display order.
- Normalized act fields: `act` is now `{ "title": "..." }`; editorial text moved to `notes[]`.
- Added sovereignty declarations for all 15 republics (dates + act titles).
- Added independence act titles and notes where applicable.
- Fixed Armenia independence date: 23 Aug 1991 → **21 Sep 1991** (referendum).
- Added starter entry in `sources.json` for USSR dissolution (Declaration No. 142-N).

## Prior (pre-changelog)

- Initial timeline data: Soviet-era heads, independence dates, post-independence rulers, unrest events (1985–2026).
- Region groupings: slavic, baltic, transcaucasus, central-asia; Moldova ungrouped.
