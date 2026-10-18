/** Shared upload session. Other upload scripts read and write this object. */

export const state = {
  records: [],
  nested: false,
  fileLabel: "Custom timeline",
  savedSort: null,
  savedFooter: null,
  /** Catalog preset meta when the field map was filled from a built-in dataset. */
  presetMeta: null,
};

export const SAMPLE = [
  { country: "Latvia", person: "Gorbunovs", start: 1990, end: 1993, region: "Baltic", party: "Independent" },
  { country: "Latvia", person: "Ulmanis", start: 1993, end: 1999, region: "Baltic", party: "Farmers" },
  { country: "Moldova", person: "Snegur", start: 1990, end: 1997, region: "East", party: "Independent" },
  { country: "Moldova", person: "Lucinschi", start: 1991, end: 2001, region: "East", party: "Agrarian" },
  { country: "Russia", person: "Yeltsin", start: 1991, end: 1999, region: "East", party: "Independent" },
  { country: "Russia", person: "Putin", start: 1999, end: 2026, region: "East", party: "United Russia" },
];

export const ROW_KEYS = ["namecountry", "namesenateseat", "country", "state", "group", "polity", "entity", "name"];
export const BAR_KEYS = ["nameleader", "namesenator", "person", "ruler", "leader", "name"];
export const START_KEYS = ["start", "startyear", "from", "begin"];
export const END_KEYS = ["end", "endyear", "to", "until"];
/** Mapper row for "color each bar by who held it" — not a data column. */
export const PERSON_COLOR_KEY = "__person__";
export const BAR_FIELD_SKIP = new Set([
  "name",
  "person",
  "ruler",
  "leader",
  "nameleader",
  "namesenator",
  "start",
  "end",
  "startmonth",
  "startday",
  "endmonth",
  "endday",
  "startyear",
  "endyear",
  "bioguide",
  "id",
]);

// Same as rulers-of-kazakh-khanate: author/sources may include raw <a> tags.
export const DEFAULT_AUTHOR =
  `witold's data consulting at <a href="https://witold1.github.io/">witold1.github.io</a>`;
