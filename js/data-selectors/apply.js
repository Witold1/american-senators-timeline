/**
 * Turn the mapped file into the chart's seat list and swap the dataset.
 */
import { selectedChecks, selectedRadio } from "./cells.js";
import { markPresetSelection, metaInput, readChromeView } from "./chrome.js";
import {
  admittedFrom,
  dateRecord,
  fieldId,
  fieldsFrom,
  labelFor,
  parseDate,
  spanFromLeader,
} from "./records.js";
import { DEFAULT_AUTHOR, state } from "./state.js";

function filters() {
  return window.TimelineFilters || {};
}

function stripMetaPrefix(prefix, value) {
  const re = new RegExp(`^${prefix}\\s*:\\s*`, "i");
  return String(value || "").trim().replace(re, "");
}

function formatFooterLine(prefix, value) {
  const body = stripMetaPrefix(prefix, value);
  if (!body) return "";
  return `${prefix}: ${body}`;
}

export function buildSeats() {
  const filterKeys = selectedChecks("upload-filter");
  const sortKeys = selectedChecks("upload-sort");
  if (state.nested) {
    const seats = state.records.map((record, index) => {
      const rulers = [
        ...(record.sovietLeaders || []).map((leader) =>
          spanFromLeader({ ...leader, era: "soviet" })
        ),
        ...(record.leaders || []).map((leader) =>
          spanFromLeader({ ...leader, era: leader.era || "independent" })
        ),
        ...(record.rulers || []).map((leader) =>
          spanFromLeader({ ...leader, era: leader.era || "independent" })
        ),
      ].filter(Boolean);
      const name = String(
        record.nameCountry || record.nameSenateSeat || record.name || record.country || record.state || `Row ${index + 1}`
      );
      return {
        id: fieldId(record.id || name) || `row${index + 1}`,
        name,
        state: String(record.state || record.id || name),
        class: record.class,
        flag: record.flag || String(record.id || name),
        region: record.region || "",
        admitted: admittedFrom(record),
        sovereignty: dateRecord(record.sovereignty),
        independence: dateRecord(record.independence),
        rulers,
        fields: fieldsFrom(
          record,
          new Set(["name", "rulers", "leaders", "sovietLeaders", "unrest", "sovereignty", "independence"])
        ),
      };
    }).filter((seat) => seat.rulers.length);
    return {
      seats,
      filterKeys,
      sortKeys,
      rowLabel: state.presetMeta?.polityLabel || "Name",
    };
  }

  const rowKey = selectedRadio("upload-row");
  const barKey = selectedRadio("upload-bar");
  const startKey = selectedRadio("upload-start");
  const endKey = selectedRadio("upload-end");
  if (!rowKey || !barKey || !startKey || !endKey) {
    throw new Error("Choose a polity name, a person, a start year, and an end year.");
  }

  const groups = new Map();
  for (const row of state.records) {
    const rowName = String(row[rowKey] ?? "").trim() || "Unknown";
    let seat = groups.get(rowName);
    if (!seat) {
      seat = {
        id: fieldId(rowName) || `row${groups.size + 1}`,
        name: rowName,
        state: rowName,
        flag: row.flag || rowName,
        region: row.region || "",
        admitted: admittedFrom(row),
        sovereignty: dateRecord(row.sovereignty),
        independence: dateRecord(row.independence),
        rulers: [],
        fields: fieldsFrom(row, new Set([rowKey, barKey, startKey, endKey])),
      };
      groups.set(rowName, seat);
    }
    const start = parseDate(row[startKey]);
    const end = parseDate(row[endKey]);
    if (!start || !end) continue;
    const extra = fieldsFrom(row, new Set([rowKey, barKey, startKey, endKey]));
    seat.rulers.push({
      name: String(row[barKey] ?? rowName),
      start: start.year,
      startMonth: start.month,
      startDay: start.day,
      end: end.year,
      endMonth: end.month,
      endDay: end.day,
      ...extra,
      party: extra.party || row.party || "",
      role: extra.role || row.role || "",
    });
  }
  return {
    seats: [...groups.values()].filter((seat) => seat.rulers.length),
    filterKeys,
    sortKeys,
    rowLabel: labelFor(rowKey),
  };
}

function rememberChrome() {
  if (state.savedSort) return;
  const sortRoot = document.getElementById("state-sort");
  state.savedSort = {
    html: sortRoot?.innerHTML || "",
    mode: filters().getOrderMode?.() || "name",
    dir: filters().getOrderDir?.() || "asc",
  };
  state.savedFooter = {
    author: document.getElementById("footer-author")?.innerHTML || "",
    sources: document.getElementById("footer-sources")?.innerHTML || "",
  };
}

export function restoreChrome() {
  const sortRoot = document.getElementById("state-sort");
  const custom = document.getElementById("custom-filters");
  const uploadBtn = document.getElementById("upload-open");
  if (state.savedSort && sortRoot) sortRoot.innerHTML = state.savedSort.html;
  const previous = state.savedSort;
  state.savedSort = null;
  if (state.savedFooter) {
    const author = document.getElementById("footer-author");
    const sources = document.getElementById("footer-sources");
    if (author) author.innerHTML = state.savedFooter.author;
    if (sources) sources.innerHTML = state.savedFooter.sources;
    state.savedFooter = null;
  }
  if (custom) {
    custom.replaceChildren();
    custom.hidden = true;
  }
  document.documentElement.classList.remove("custom-upload");
  uploadBtn?.classList.remove("is-active");
  uploadBtn?.setAttribute("aria-pressed", "false");
  filters().clearFieldFilters?.();
  if (previous) filters().setOrder?.(previous.mode, previous.dir);
}

function applyFooterMeta(authorValue, sourcesValue) {
  const authorEl = document.getElementById("footer-author");
  const sourcesEl = document.getElementById("footer-sources");
  const authorLine = formatFooterLine("Author", authorValue);
  const sourcesLine = formatFooterLine("Sources", sourcesValue);
  if (authorEl && authorLine) authorEl.innerHTML = authorLine;
  if (sourcesEl && sourcesLine) sourcesEl.innerHTML = sourcesLine;
}

export function applyUpload() {
  const built = buildSeats();
  if (!built.seats.length) {
    throw new Error("No entries had both a start year and an end year.");
  }
  const years = built.seats.flatMap((seat) =>
    seat.rulers.flatMap((ruler) => [ruler.start, ruler.end])
  );
  const filterSpecs = [...new Set(built.filterKeys.map(fieldId).filter(Boolean))].map((id) => ({
    id,
    label: labelFor(
      built.filterKeys.find((key) => fieldId(key) === id) || id
    ),
    multi: id === "region",
  }));
  const chromeView = readChromeView(filterSpecs);
  const view = {
    filters: chromeView.filters,
    sorts: chromeView.sorts,
    colorBy: chromeView.colorBy,
    tooltip: chromeView.tooltip,
    searchPlaceholder: chromeView.searchPlaceholder,
    settings: chromeView.settings,
  };

  const viewHash = String(state.presetMeta?.viewHash || "upload").replace(/^#/, "") || "upload";
  const fromPreset = Boolean(state.presetMeta?.viewHash);
  if (fromPreset) {
    state.savedSort = null;
    state.savedFooter = null;
  } else {
    rememberChrome();
  }

  const exclusive = state.presetMeta?.exclusive === true;
  const annotated = window.TimelineLanes
    ? window.TimelineLanes.annotateSeats(built.seats, { exclusive })
    : built.seats;

  const title =
    metaInput("upload-meta-title")?.value.trim() ||
    state.presetMeta?.title ||
    state.fileLabel;
  const subtitle =
    metaInput("upload-meta-subtitle")?.value.trim() ||
    state.presetMeta?.subtitle ||
    "Uploaded data. Filters and sorts use the fields you picked.";
  const sourcesValue = metaInput("upload-meta-sources")?.value.trim() || "";
  const authorValue =
    metaInput("upload-meta-author")?.value.trim() || DEFAULT_AUTHOR;

  const dataStart = Math.min(...years);
  const dataEnd = Math.max(...years);
  const presetStart = Number(state.presetMeta?.TIMELINE_START);
  const presetEnd = Number(state.presetMeta?.TIMELINE_END);

  window.TIMELINE_DATA = {
    TIMELINE_START: Number.isFinite(presetStart) ? presetStart : dataStart,
    TIMELINE_END: Number.isFinite(presetEnd) ? presetEnd : dataEnd,
    exclusive,
    showCongress: view.settings?.showCongress === true,
    USSR_DISSOLVED: state.presetMeta?.USSR_DISSOLVED || undefined,
    polityLabel: chromeView.polityLabel,
    roleLabel: chromeView.roleLabel,
    title,
    subtitle,
    datasetTitle: title,
    author: authorValue,
    sources: sourcesValue,
    datasetId: fromPreset ? state.presetMeta.datasetId || viewHash : "upload",
    datasetHash: viewHash,
    seats: annotated,
    view,
  };

  const heading = document.querySelector(".title-block h1");
  const lede = document.querySelector(".title-block .subtitle");
  if (heading) heading.textContent = title;
  if (lede) lede.textContent = subtitle;
  document.title = title;
  applyFooterMeta(authorValue, sourcesValue);

  window.TimelineDatasets?.setViewHash?.(viewHash);
  markPresetSelection(fromPreset ? viewHash : "");
  const uploadBtn = document.getElementById("upload-open");
  uploadBtn?.classList.toggle("is-active", !fromPreset);
  uploadBtn?.setAttribute("aria-pressed", fromPreset ? "false" : "true");
  document.documentElement.classList.toggle("custom-upload", !fromPreset);

  filters().clearFieldFilters?.();
  filters().setRegionFilter?.("all");
  window.TimelineFilterControls?.applyDatasetView?.({
    hash: viewHash,
    orientation: state.presetMeta?.orientation,
    yearOrder: state.presetMeta?.yearOrder,
    lockOrientation: state.presetMeta?.lockOrientation === true,
  });

  window.TimelineGeometry?.invalidateCaches?.();
  window.TimelinePalette?.invalidate?.();
  filters().setTimeRangeFilter?.("all", { announce: false });
  window.TimelineFilterControls?.syncTimeRangeChips?.("all");
  const alreadyName =
    (filters().getOrderMode?.() || "name") === "name" &&
    (filters().getOrderDir?.() || "asc") === "asc";
  if (!alreadyName) filters().setOrder?.("name", "asc");
  else if (typeof window.renderTimeline === "function") window.renderTimeline();
  window.dispatchEvent(new Event("timeline-dataset-change"));
}
