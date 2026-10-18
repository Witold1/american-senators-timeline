/**
 * Upload dialog: open it, load a file or preset, and apply the chart.
 */
import { applyUpload, restoreChrome } from "./apply.js";
import {
  bindSectionToggles,
  chromeEl,
  markPresetSelection,
  readChromeView,
  refreshControlLists,
  setFileName,
  showError,
  specsFromChecks,
} from "./chrome.js";
import { renderMap } from "./map.js";
import { extractRecords, isNested } from "./records.js";
import { DEFAULT_AUTHOR, SAMPLE, state } from "./state.js";

export function loadParsed(data, label, meta = null) {
  state.records = extractRecords(data);
  state.nested = isNested(state.records);
  state.fileLabel = label || "Custom timeline";
  state.presetMeta = meta;
  if (!state.records.length) {
    showError("That JSON has no entries. Use a list of entries, or polities with a leaders list.");
    renderMap();
    return;
  }
  showError("");
  renderMap();
}

function presetSourcePath(entry) {
  const base = String(entry?.path || "").replace(/\/$/, "");
  if (!base) return "";
  if ((entry.format || "seats") === "countries") return `${base}/countries/`;
  return `${base}/processed/seats-all.json`;
}

export async function loadPreset(key) {
  const loader = window.TimelineDatasets?.loadPresetRecords;
  if (!loader) throw new Error("Preset loader is not ready.");
  const file = document.getElementById("upload-file");
  if (file) file.value = "";
  setFileName("No file selected");
  showError("");
  const { entry, meta, records: presetRecords } = await loader(key);
  setFileName(presetSourcePath(entry));
  const hash = String(entry.hash || entry.id || "").replace(/^#/, "");
  markPresetSelection(hash);
  loadParsed(presetRecords, entry.title || entry.label || hash, {
    exclusive: meta.exclusive !== false,
    showCongress: meta.showCongress === true,
    polityLabel: meta.polityLabel || "State",
    roleLabel: meta.roleLabel || "Ruler",
    title: meta.title || entry.title || entry.label,
    subtitle: meta.subtitle || "",
    datasetTitle: entry.title || meta.title || entry.label,
    sources: meta.sources || "",
    author: meta.author || DEFAULT_AUTHOR,
    datasetId: entry.id,
    view: meta.view || null,
    TIMELINE_START: meta.TIMELINE_START,
    TIMELINE_END: meta.TIMELINE_END,
    USSR_DISSOLVED: meta.USSR_DISSOLVED || null,
    viewHash: hash,
    orientation: entry.orientation,
    yearOrder: entry.yearOrder,
    lockOrientation: entry.lockOrientation === true,
  });
}

function copyViewJson() {
  const chromeView = readChromeView(specsFromChecks("upload-filter"));
  const payload = {
    filters: chromeView.filters,
    sorts: chromeView.sorts,
    colorBy: chromeView.colorBy,
    tooltip: chromeView.tooltip,
    searchPlaceholder: chromeView.searchPlaceholder,
    settings: chromeView.settings,
  };
  const text = JSON.stringify(payload, null, 2);
  const status = chromeEl("upload-chrome-copy-status");
  const done = () => {
    if (!status) return;
    status.hidden = false;
    status.textContent = "Copied — paste into meta.json → view";
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      window.prompt("Copy view JSON:", text);
      done();
    });
  } else {
    window.prompt("Copy view JSON:", text);
    done();
  }
}

function exampleMeta() {
  return {
    title: "Five countries",
    subtitle: "Small sample timeline for upload and field mapping.",
    author: DEFAULT_AUTHOR,
    polityLabel: "Country",
    roleLabel: "Head of state",
    orientation: "horizontal",
    sources:
      `Example dataset from <a href="https://github.com/Witold1/american-senators-timeline/blob/main/data/examples/five-countries.json">data/examples/five-countries.json</a>. AI assistant helped compile and verify the data.`,
    view: {
      filters: [{ id: "region", label: "Region", multi: true }],
      sorts: [
        { id: "name", label: "Country name" },
        { id: "independence", label: "Independence" },
      ],
      colorBy: [{ id: "person", label: "Individual ruler" }],
      searchPlaceholder: "country, ruler, or region",
      settings: {
        showAdmissionYear: true,
        showRegionFilter: true,
        showCongress: false,
        showPartyDetail: false,
        showUssrDissolution: false,
        dateVerb: "Independence",
        admissionYearLabel: "Show independence year",
      },
    },
  };
}

export function bind() {
  const dialog = document.getElementById("upload-dialog");
  const open = document.getElementById("upload-open");
  const file = document.getElementById("upload-file");
  const form = document.getElementById("upload-form");
  const sample = document.getElementById("upload-sample");
  if (!dialog || !open || !file || !form) {
    return { loadParsed, loadPreset, applyUpload };
  }

  bindSectionToggles(dialog);
  chromeEl("upload-chrome-polity")?.addEventListener("input", refreshControlLists);

  function openDialog() {
    showError("");
    if (!dialog.open) dialog.showModal();
    // Match Kazakh: if a catalog preset is already showing, open with its mapper filled.
    const isCustom =
      window.TIMELINE_DATA?.datasetId === "upload" ||
      document.documentElement.classList.contains("custom-upload");
    const active = window.TimelineDatasets?.activeHash?.();
    if (isCustom || !active) return;
    if (state.presetMeta?.viewHash === active && state.records.length) {
      markPresetSelection(active);
      return;
    }
    loadPreset(active).catch((err) => {
      console.error("Failed to load active preset into upload map:", err);
      showError(err?.message || "Could not load the current preset.");
    });
  }

  open.addEventListener("click", () => {
    openDialog();
  });

  file.addEventListener("change", () => {
    const picked = file.files?.[0];
    if (!picked) return;
    markPresetSelection("");
    setFileName(picked.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadParsed(JSON.parse(String(reader.result || "")), picked.name.replace(/\.json$/i, ""));
      } catch (err) {
        state.records = [];
        state.presetMeta = null;
        renderMap();
        showError(err instanceof SyntaxError ? "That file is not JSON." : err.message);
      }
    };
    reader.readAsText(picked);
  });

  chromeEl("upload-chrome-copy-view")?.addEventListener("click", () => {
    try {
      copyViewJson();
    } catch (err) {
      showError(err.message || "Could not build view JSON.");
    }
  });

  sample?.addEventListener("click", () => {
    file.value = "";
    setFileName("data/examples/five-countries.json");
    markPresetSelection("", { sample: true });
    const meta = exampleMeta();
    fetch("data/examples/five-countries.json")
      .then((response) => {
        if (!response.ok) throw new Error("Example file did not load.");
        return response.json();
      })
      .then((data) => loadParsed(data, meta.title, meta))
      .catch(() => {
        loadParsed(SAMPLE, "Sample timeline", {
          ...meta,
          title: "Sample timeline",
          sources: "Built-in short sample (example file did not load). AI assistant helped compile and verify the data.",
        });
        showError("Could not load data/examples/five-countries.json, so a short sample was used.");
      });
  });

  form.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    try {
      applyUpload();
      dialog.close();
    } catch (err) {
      showError(err.message || "Could not build a timeline from those fields.");
    }
  });

  window.addEventListener("timeline-dataset-change", () => {
    if (window.TIMELINE_DATA?.datasetId === "upload") return;
    if (!state.savedSort && !document.documentElement.classList.contains("custom-upload")) return;
    restoreChrome();
  });

  return { loadParsed, loadPreset, applyUpload, open: openDialog };
}
