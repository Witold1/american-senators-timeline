/**
 * Display settings inside the upload dialog: checkboxes, labels, and the view object.
 */
import { selectedChecks } from "./cells.js";
import { dateRecord, fieldId, labelFor } from "./records.js";
import { DEFAULT_AUTHOR, PERSON_COLOR_KEY, state } from "./state.js";

export function showError(message) {
  const el = document.getElementById("upload-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}

export function setSectionOpen(btn, open) {
  if (!btn) return;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  const name = btn.getAttribute("data-section-name") || "section";
  btn.setAttribute("aria-label", open ? `Hide ${name}` : `Show ${name}`);
}

export function setSetupVisible(on) {
  const mapping = document.getElementById("upload-mapping-section");
  const meta = document.getElementById("upload-meta-section");
  const chrome = document.getElementById("upload-chrome-section");
  const apply = document.getElementById("upload-apply");
  if (mapping) mapping.hidden = !on;
  if (meta) meta.hidden = !on;
  if (chrome) chrome.hidden = !on;
  if (apply) apply.disabled = !on;
  if (on) {
    // Fresh data: open mapping; keep metadata/controls collapsed until needed.
    setSectionOpen(mapping?.querySelector(".upload-section-toggle"), true);
    setSectionOpen(meta?.querySelector(".upload-section-toggle"), false);
    setSectionOpen(chrome?.querySelector(".upload-section-toggle"), false);
  }
}

export function bindSectionToggles(root) {
  root?.querySelectorAll(".upload-section-toggle").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = btn.getAttribute("aria-expanded") !== "true";
      setSectionOpen(btn, open);
    });
  });
}

export function metaInput(id) {
  return document.querySelector(`#upload-meta-section #${id}`);
}

export function chromeEl(id) {
  return document.getElementById(id);
}

function setChecked(id, on) {
  const el = chromeEl(id);
  if (el) el.checked = !!on;
}

function isChecked(id) {
  return Boolean(chromeEl(id)?.checked);
}

export function syncMetadataFields() {
  const titleEl = metaInput("upload-meta-title");
  const subtitleEl = metaInput("upload-meta-subtitle");
  const sourcesEl = metaInput("upload-meta-sources");
  const authorEl = metaInput("upload-meta-author");
  if (titleEl) titleEl.value = state.presetMeta?.title || state.fileLabel || "";
  if (subtitleEl) {
    subtitleEl.value =
      state.presetMeta?.subtitle ||
      (state.presetMeta ? "" : "Uploaded data. Filters and sorts use the fields you picked.");
  }
  if (sourcesEl) sourcesEl.value = state.presetMeta?.sources || "";
  if (authorEl) authorEl.value = state.presetMeta?.author || DEFAULT_AUTHOR;
}

export function syncChromeFields() {
  const view = state.presetMeta?.view || {};
  const settings = view.settings || {};
  const polity = state.presetMeta?.polityLabel || (state.nested ? "Country" : "Polity");
  const role = state.presetMeta?.roleLabel || "Term";

  const polityEl = chromeEl("upload-chrome-polity");
  const roleEl = chromeEl("upload-chrome-role");
  const searchEl = chromeEl("upload-chrome-search");
  const verbEl = chromeEl("upload-chrome-date-verb");
  const yearLabelEl = chromeEl("upload-chrome-year-label");

  if (polityEl) polityEl.value = polity;
  if (roleEl) roleEl.value = role;
  if (searchEl) {
    searchEl.value =
      view.searchPlaceholder ||
      `${polity.toLowerCase()}, ${role.toLowerCase()}, or region`;
  }
  if (verbEl) verbEl.value = settings.dateVerb || (state.presetMeta?.viewHash === "soviet-states" ? "Independence" : "Admitted");
  if (yearLabelEl) {
    yearLabelEl.value =
      settings.admissionYearLabel ||
      (settings.dateVerb === "Independence" || state.presetMeta?.viewHash === "soviet-states"
        ? "Show independence year"
        : "Show admission year");
  }

  setChecked("upload-chrome-show-year", settings.showAdmissionYear !== false);
  setChecked("upload-chrome-show-region", settings.showRegionFilter !== false);
  setChecked(
    "upload-chrome-show-congress",
    settings.showCongress === true || state.presetMeta?.showCongress === true
  );
  const congressRow = chromeEl("upload-chrome-show-congress")?.closest("label");
  if (congressRow) {
    const allowCongress = !state.presetMeta
      || state.presetMeta.showCongress === true
      || settings.showCongress === true;
    congressRow.hidden = !allowCongress;
  }
  setChecked("upload-chrome-show-party-detail", settings.showPartyDetail === true);
  const allowUssr = Boolean(state.presetMeta?.USSR_DISSOLVED);
  const ussrRow = chromeEl("upload-chrome-show-ussr")?.closest("label");
  if (ussrRow) ussrRow.hidden = !allowUssr;
  setChecked(
    "upload-chrome-show-ussr",
    allowUssr && settings.showUssrDissolution !== false
  );
  const allowSovereignty = state.records.some((row) => dateRecord(row?.sovereignty));
  const sovereigntyRow = chromeEl("upload-chrome-show-sovereignty")?.closest("label");
  if (sovereigntyRow) sovereigntyRow.hidden = !allowSovereignty;
  setChecked(
    "upload-chrome-show-sovereignty",
    allowSovereignty && settings.showSovereigntyMarkers !== false
  );
  const allowIndependence = state.records.some((row) => dateRecord(row?.independence));
  const independenceRow = chromeEl("upload-chrome-show-independence")?.closest("label");
  if (independenceRow) independenceRow.hidden = !allowIndependence;
  setChecked(
    "upload-chrome-show-independence",
    allowIndependence && settings.showIndependenceMarkers !== false
  );

  const copyStatus = chromeEl("upload-chrome-copy-status");
  if (copyStatus) copyStatus.hidden = true;
}

function presetItemLabel(kind, id, fallback) {
  const list = state.presetMeta?.view?.[kind] || [];
  return list.find((item) => item.id === id)?.label || fallback;
}

function colorOption(key, role) {
  const id = key === PERSON_COLOR_KEY ? "person" : fieldId(key);
  const preset = (state.presetMeta?.view?.colorBy || []).find((item) => item.id === id);
  if (preset) {
    return { id, label: preset.label, title: preset.title || preset.label };
  }
  if (id === "person") {
    const who = String(role || "person").toLowerCase();
    return {
      id,
      label: `Individual ${who}`,
      title: `Color each ${who} distinctly`,
    };
  }
  if (id === "party") {
    return {
      id: "party",
      label: "Political party",
      title: "Color bars by political party",
    };
  }
  const label = labelFor(key);
  return {
    id,
    label,
    title: `Color bars by ${label.toLowerCase()}`,
  };
}

function colorSpecs(role) {
  const selected = selectedChecks("upload-color").map((key) => colorOption(key, role));
  const preset = state.presetMeta?.view?.colorBy || [];
  if (preset.length) {
    const rank = new Map(preset.map((item, index) => [item.id, index]));
    selected.sort(
      (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)
    );
  }
  if (!selected.length) selected.push(colorOption(PERSON_COLOR_KEY, role));
  return selected;
}

export function specsFromChecks(name, { includeName = false, polity = "Polity", role = "" } = {}) {
  const specs = [];
  if (includeName) {
    specs.push({
      id: "name",
      label: presetItemLabel("sorts", "name", `${polity} name`),
    });
  }
  for (const key of selectedChecks(name)) {
    const personTip = key === PERSON_COLOR_KEY;
    const id = personTip ? "person" : fieldId(key);
    if (!id || specs.some((spec) => spec.id === id)) continue;
    const kind =
      name === "upload-filter" ? "filters" : name === "upload-tooltip" ? "tooltip" : "sorts";
    let fallback = personTip ? (role ? `${role} name` : "Name") : labelFor(key);
    if (kind === "tooltip" && id === "name") {
      fallback = presetItemLabel("sorts", "name", `${polity} name`);
    }
    if (kind === "tooltip" && id === "bioguide") fallback = "Bioguide";
    const spec = { id, label: presetItemLabel(kind, id, fallback) };
    if (kind === "filters" && id === "region") spec.multi = true;
    specs.push(spec);
  }
  return specs;
}

function paintControlPills(hostId, specs) {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.replaceChildren();
  for (const spec of specs) {
    const pill = document.createElement("span");
    pill.className = "upload-chrome-pill";
    pill.textContent = spec.label;
    host.appendChild(pill);
  }
}

export function refreshControlLists() {
  const polity =
    chromeEl("upload-chrome-polity")?.value.trim() ||
    state.presetMeta?.polityLabel ||
    "Polity";
  const filters = specsFromChecks("upload-filter");
  paintControlPills("upload-chrome-filter-list", filters);
  paintControlPills(
    "upload-chrome-sort-list",
    specsFromChecks("upload-sort", { includeName: true, polity })
  );
  const role =
    chromeEl("upload-chrome-role")?.value.trim() ||
    state.presetMeta?.roleLabel ||
    "Term";
  paintControlPills("upload-chrome-color-list", colorSpecs(role));
  paintControlPills(
    "upload-chrome-tooltip-list",
    specsFromChecks("upload-tooltip", { polity, role })
  );
  const region = filters.some((filter) => filter.id === "region");
  const regionBox = chromeEl("upload-chrome-show-region");
  if (regionBox) regionBox.checked = region;
}

export function setFileName(label) {
  const el = document.getElementById("upload-file-name");
  if (!el) return;
  const text = label || "No file selected";
  el.textContent = text;
  el.title = text;
}

export function markPresetSelection(hash, { sample = false } = {}) {
  const needle = String(hash || "").replace(/^#/, "");
  document.querySelectorAll(".dataset-btn").forEach((btn) => {
    const on = Boolean(needle) && btn.dataset.dataset === needle;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const sampleBtn = document.getElementById("upload-sample");
  sampleBtn?.classList.toggle("is-active", sample);
  sampleBtn?.setAttribute("aria-pressed", sample ? "true" : "false");
}

export function readChromeView(filterSpecs) {
  const polity =
    chromeEl("upload-chrome-polity")?.value.trim() ||
    state.presetMeta?.polityLabel ||
    "Polity";
  const role =
    chromeEl("upload-chrome-role")?.value.trim() ||
    state.presetMeta?.roleLabel ||
    "Term";
  const searchPlaceholder =
    chromeEl("upload-chrome-search")?.value.trim() ||
    `${polity.toLowerCase()}, ${role.toLowerCase()}, or region`;
  const dateVerb =
    chromeEl("upload-chrome-date-verb")?.value.trim() || "Admitted";
  const admissionYearLabel =
    chromeEl("upload-chrome-year-label")?.value.trim() ||
    `Show ${dateVerb.toLowerCase()} year`;

  const colorBy = colorSpecs(role);
  const sorts = specsFromChecks("upload-sort", { includeName: true, polity });

  const showCongress = isChecked("upload-chrome-show-congress");
  const showParty = colorBy.some((option) => option.id === "party");
  const settings = {
    ...(state.presetMeta?.view?.settings || {}),
    showAdmissionYear: isChecked("upload-chrome-show-year"),
    showRegionFilter: isChecked("upload-chrome-show-region"),
    showCongress,
    showPartyDetail: isChecked("upload-chrome-show-party-detail"),
    showPartyLegend: showParty,
    showUssrDissolution: isChecked("upload-chrome-show-ussr"),
    showSovereigntyMarkers: isChecked("upload-chrome-show-sovereignty"),
    showIndependenceMarkers: isChecked("upload-chrome-show-independence"),
    admissionYearLabel,
    admissionYearTitle: `${admissionYearLabel} next to each polity name`,
    regionFilterLabel: "Show region filter",
    barLabelsLabel: `Show ${role.toLowerCase()} names`,
    barLabelsTitle: `Print each ${role.toLowerCase()}'s name along their bar`,
    termBarsTitle: `Draw the colored bar for each ${role.toLowerCase()}'s term`,
    ussrDissolutionLabel: "Show USSR dissolution",
    ussrDissolutionTitle:
      "Mark 26 Dec 1991, when the USSR formally ceased to exist",
    sovereigntyMarkerLabel: "Show sovereignty dates",
    sovereigntyMarkerTitle: "Mark the date each country declared sovereignty",
    independenceMarkerLabel: "Show independence dates",
    independenceMarkerTitle: "Mark the date each country declared independence",
    legendPersonLabel: `${polity === "State" ? "Senators" : polity === "Country" ? "Rulers" : "People"}`,
    legendPersonText: `Distinct colors per individual ${role.toLowerCase()}`,
    dateVerb,
  };

  return {
    filters: filterSpecs,
    sorts,
    colorBy,
    tooltip: specsFromChecks("upload-tooltip", { polity, role }),
    searchPlaceholder,
    settings,
    polityLabel: polity,
    roleLabel: role,
  };
}
