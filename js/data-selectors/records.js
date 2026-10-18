/**
 * Read a timeline file: keys, dates, and the people lists on each polity.
 */
import { state } from "./state.js";

export function fieldId(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function labelFor(key) {
  const spaced = String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function parseDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return { year: value, month: 1, day: 1 };
  }
  if (typeof value === "object" && Number.isFinite(Number(value.year))) {
    return {
      year: Number(value.year),
      month: Number(value.month) || 1,
      day: Number(value.day) || 1,
    };
  }
  const text = String(value).trim();
  const iso = text.match(/^(-?\d{3,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2] || 1),
      day: Number(iso[3] || 1),
    };
  }
  const year = Number(text);
  if (Number.isFinite(year) && text.length >= 3) {
    return { year, month: 1, day: 1 };
  }
  return null;
}

export function scalarKeys(row) {
  return Object.keys(row || {}).filter((key) => {
    const value = row[key];
    if (value == null) return false;
    if (Array.isArray(value)) return false;
    if (typeof value === "object" && value.year == null) return false;
    return true;
  });
}

export function liftContext(record) {
  const ctx = record?.context;
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return record;
  const { context, ...rest } = record;
  return { ...rest, ...ctx };
}

export function extractRecords(data) {
  let rows = [];
  if (Array.isArray(data)) rows = data.filter((row) => row && typeof row === "object");
  else if (data && typeof data === "object") {
    for (const key of ["seats", "rows", "records", "data", "countries"]) {
      if (Array.isArray(data[key])) {
        rows = data[key].filter((row) => row && typeof row === "object");
        break;
      }
    }
    if (!rows.length && (Array.isArray(data.rulers) || Array.isArray(data.leaders) || Array.isArray(data.sovietLeaders))) {
      rows = [data];
    }
  }
  return rows.map(liftContext);
}

export function isNested(list) {
  return list.some(
    (row) => Array.isArray(row.rulers) || Array.isArray(row.leaders) || Array.isArray(row.sovietLeaders)
  );
}

export function guess(keys, preferred) {
  const lowered = keys.map((key) => [key, fieldId(key)]);
  for (const name of preferred) {
    const hit = lowered.find(([, id]) => id === name);
    if (hit) return hit[0];
  }
  return keys[0] || "";
}

export function formatSample(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && Number.isFinite(Number(value.year))) {
    const year = Number(value.year);
    const month = Number(value.month) || 0;
    const day = Number(value.day) || 0;
    if (month && day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return String(year);
  }
  const text = String(value);
  return text.length > 42 ? `${text.slice(0, 39)}…` : text;
}

export function exampleOf(key) {
  for (const row of state.records) {
    const text = formatSample(row?.[key]);
    if (text) return text;
  }
  return "";
}

export function barSpans(row) {
  return [...(row?.sovietLeaders || []), ...(row?.leaders || []), ...(row?.rulers || [])];
}

export function clipExample(value) {
  return formatSample(value);
}

export function firstSeenKeys(list) {
  const keys = [];
  for (const row of list.slice(0, 40)) {
    for (const key of Object.keys(row || {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export function recordLabel(row, index) {
  const name = row?.nameCountry || row?.nameSenateSeat || row?.name || row?.country || row?.state || row?.id;
  return name ? String(name) : `record ${index + 1}`;
}

export function isMappableRecordValue(value) {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return false;
  if (typeof value === "object" && value.year == null) return false;
  return true;
}

export function childKeysOf(list, listKey) {
  const keys = [];
  for (const row of list.slice(0, 40)) {
    const items = row?.[listKey];
    if (!Array.isArray(items)) continue;
    for (const item of items.slice(0, 12)) {
      if (!item || typeof item !== "object") continue;
      for (const key of Object.keys(item)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
  }
  return keys;
}

export function barListKeysOf(list) {
  const keys = [];
  for (const row of list.slice(0, 40)) {
    for (const key of Object.keys(row || {})) {
      if (key !== "rulers" && key !== "leaders" && key !== "sovietLeaders") continue;
      if (Array.isArray(row[key]) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export function unusedKeysOf(list) {
  const keys = [];
  for (const key of firstSeenKeys(list)) {
    if (key === "rulers" || key === "leaders" || key === "sovietLeaders") continue;
    const present = list.some((row) => row && row[key] != null && row[key] !== "");
    if (!present) continue;
    if (list.some((row) => isMappableRecordValue(row?.[key]))) continue;
    keys.push(key);
  }
  return keys;
}

export function arrayExample(list, key) {
  for (const row of list) {
    const items = row?.[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item == null || item === "") continue;
      if (typeof item !== "object") return formatSample(item);
      for (const child of ["name", "title", "type"]) {
        const text = formatSample(item[child]);
        if (text) return text;
      }
      const child = scalarKeys(item)[0];
      if (child) return formatSample(item[child]);
    }
  }
  return "";
}

export function spanDateSample(list, listKeys, stem) {
  const yearKey = `${stem}Year`;
  const monthKey = `${stem}Month`;
  const dayKey = `${stem}Day`;
  for (const row of list) {
    for (const listKey of listKeys) {
      const items = row?.[listKey];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item) continue;
        const year = item[stem] ?? item[yearKey];
        if (year == null || year === "") continue;
        const month = Number(item[monthKey]) || 0;
        const day = Number(item[dayKey]) || 0;
        if (month && day) {
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
        return formatSample(year);
      }
    }
  }
  return "";
}

export function isSpanLabel(id) {
  return id === "name" || id === "person" || id === "ruler" || id === "leader" || id === "nameleader" || id === "namesenator";
}

export function exampleOfBar(key) {
  for (const row of state.records) {
    for (const span of barSpans(row)) {
      const text = clipExample(span?.[key]);
      if (text) return text;
    }
  }
  return "";
}

export function firstBarName() {
  for (const row of state.records) {
    for (const span of barSpans(row)) {
      if (span?.nameLeader || span?.name) return clipExample(span.nameLeader || span.name);
    }
    if (row?.nameSenator || row?.person) return clipExample(row.nameSenator || row.person);
  }
  return "";
}

export function fieldsFrom(row, skip) {
  const fields = {};
  for (const key of scalarKeys(row)) {
    if (skip.has(key)) continue;
    const id = fieldId(key);
    if (!id) continue;
    const date = parseDate(row[key]);
    fields[id] = date && typeof row[key] === "object" ? date.year : row[key];
  }
  return fields;
}

export function spanFromLeader(leader) {
  const start = parseDate(leader.start ?? leader.startYear);
  const end = parseDate(leader.end ?? leader.endYear);
  if (!start || !end) return null;
  const span = {
    name: String(leader.nameLeader || leader.nameSenator || leader.name || leader.person || "Unknown"),
    start: start.year,
    startMonth: leader.startMonth || start.month,
    startDay: leader.startDay || start.day,
    end: end.year,
    endMonth: leader.endMonth || end.month,
    endDay: leader.endDay || end.day,
    party: leader.party || "",
    role: leader.role || "",
  };
  const extra = fieldsFrom(
    leader,
    new Set([
      "name",
      "person",
      "nameLeader",
      "nameSenator",
      "start",
      "end",
      "startMonth",
      "startDay",
      "endMonth",
      "endDay",
      "startYear",
      "endYear",
      "party",
      "role",
    ])
  );
  return { ...span, ...extra };
}

export function dateRecord(value) {
  if (!value) return null;
  if (typeof value === "object" && value.year) return value;
  const parsed = parseDate(value);
  if (!parsed) return null;
  return { year: parsed.year, month: parsed.month, day: parsed.day };
}

export function admittedFrom(record) {
  if (record.admitted) return String(record.admitted);
  const independence = dateRecord(record.independence);
  if (!independence) return "";
  const month = String(independence.month || 1).padStart(2, "0");
  const day = String(independence.day || 1).padStart(2, "0");
  return `${independence.year}-${month}-${day}`;
}
