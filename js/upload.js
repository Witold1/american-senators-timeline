/**
 * Upload a JSON timeline and choose which fields become filters and sorts.
 * Flat rows: one object per bar. Timeline files: objects with a rulers list.
 */
(function () {
  const SAMPLE = [
    { country: "Latvia", person: "Gorbunovs", start: 1990, end: 1993, region: "Baltic", party: "Independent" },
    { country: "Latvia", person: "Ulmanis", start: 1993, end: 1999, region: "Baltic", party: "Farmers" },
    { country: "Moldova", person: "Snegur", start: 1990, end: 1997, region: "East", party: "Independent" },
    { country: "Moldova", person: "Lucinschi", start: 1991, end: 2001, region: "East", party: "Agrarian" },
    { country: "Russia", person: "Yeltsin", start: 1991, end: 1999, region: "East", party: "Independent" },
    { country: "Russia", person: "Putin", start: 1999, end: 2026, region: "East", party: "United Russia" },
  ];

  const ROW_KEYS = ["country", "state", "group", "entity", "name"];
  const BAR_KEYS = ["person", "ruler", "leader", "name"];
  const START_KEYS = ["start", "startyear", "from", "begin"];
  const END_KEYS = ["end", "endyear", "to", "until"];
  /** Mapper row for "color each bar by who held it" — not a data column. */
  const PERSON_COLOR_KEY = "__person__";
  const BAR_FIELD_SKIP = new Set([
    "name",
    "person",
    "ruler",
    "leader",
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

  let records = [];
  let nested = false;
  let fileLabel = "Custom timeline";
  let savedSort = null;
  let savedFooter = null;
  /** Catalog preset meta when the field map was filled from a built-in dataset. */
  let presetMeta = null;

  // Same as rulers-of-kazakh-khanate: author/sources may include raw <a> tags.
  const DEFAULT_AUTHOR =
    `witold's data consulting at <a href="https://witold1.github.io/">witold1.github.io</a>`;

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

  function fieldId(key) {
    return String(key || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function labelFor(key) {
    const spaced = String(key)
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function parseDate(value) {
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

  function scalarKeys(row) {
    return Object.keys(row || {}).filter((key) => {
      const value = row[key];
      if (value == null) return false;
      if (Array.isArray(value)) return false;
      if (typeof value === "object" && value.year == null) return false;
      return true;
    });
  }

  function extractRecords(data) {
    if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object");
    if (data && typeof data === "object") {
      for (const key of ["seats", "rows", "records", "data", "countries"]) {
        if (Array.isArray(data[key])) return data[key].filter((row) => row && typeof row === "object");
      }
      if (Array.isArray(data.rulers) || Array.isArray(data.sovietLeaders)) return [data];
    }
    return [];
  }

  function isNested(list) {
    return list.some(
      (row) => Array.isArray(row.rulers) || Array.isArray(row.sovietLeaders)
    );
  }

  function guess(keys, preferred) {
    const lowered = keys.map((key) => [key, fieldId(key)]);
    for (const name of preferred) {
      const hit = lowered.find(([, id]) => id === name);
      if (hit) return hit[0];
    }
    return keys[0] || "";
  }

  function exampleOf(key) {
    for (const row of records) {
      const value = row[key];
      if (value == null || value === "") continue;
      if (typeof value === "object" && value.year) return String(value.year);
      const text = String(value);
      return text.length > 32 ? `${text.slice(0, 29)}…` : text;
    }
    return "";
  }

  function barSpans(row) {
    return [...(row?.rulers || []), ...(row?.sovietLeaders || [])];
  }

  function clipExample(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object" && value.year) return String(value.year);
    const text = String(value);
    return text.length > 32 ? `${text.slice(0, 29)}…` : text;
  }

  function exampleOfBar(key) {
    for (const row of records) {
      for (const span of barSpans(row)) {
        const text = clipExample(span?.[key]);
        if (text) return text;
      }
    }
    return "";
  }

  function firstBarName() {
    for (const row of records) {
      for (const span of barSpans(row)) {
        if (span?.name) return clipExample(span.name);
      }
      if (row?.person) return clipExample(row.person);
    }
    return "";
  }

  function barFieldKeys(list) {
    const keys = [];
    for (const row of list.slice(0, 40)) {
      for (const span of barSpans(row).slice(0, 6)) {
        for (const key of scalarKeys(span)) {
          if (BAR_FIELD_SKIP.has(fieldId(key))) continue;
          if (!keys.includes(key)) keys.push(key);
        }
      }
    }
    return keys;
  }

  function showError(message) {
    const el = document.getElementById("upload-error");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function setSectionOpen(btn, open) {
    if (!btn) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    const name = btn.getAttribute("data-section-name") || "section";
    btn.setAttribute("aria-label", open ? `Hide ${name}` : `Show ${name}`);
  }

  function setSetupVisible(on) {
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

  function bindSectionToggles(root) {
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

  function metaInput(id) {
    return document.querySelector(`#upload-meta-section #${id}`);
  }

  function chromeEl(id) {
    return document.getElementById(id);
  }

  function setChecked(id, on) {
    const el = chromeEl(id);
    if (el) el.checked = !!on;
  }

  function isChecked(id) {
    return Boolean(chromeEl(id)?.checked);
  }

  function syncMetadataFields() {
    const titleEl = metaInput("upload-meta-title");
    const subtitleEl = metaInput("upload-meta-subtitle");
    const sourcesEl = metaInput("upload-meta-sources");
    const authorEl = metaInput("upload-meta-author");
    if (titleEl) titleEl.value = presetMeta?.title || fileLabel || "";
    if (subtitleEl) {
      subtitleEl.value =
        presetMeta?.subtitle ||
        (presetMeta ? "" : "Uploaded data. Filters and sorts use the fields you picked.");
    }
    if (sourcesEl) sourcesEl.value = presetMeta?.sources || "";
    if (authorEl) authorEl.value = presetMeta?.author || DEFAULT_AUTHOR;
  }

  function syncChromeFields() {
    const view = presetMeta?.view || {};
    const settings = view.settings || {};
    const entity = presetMeta?.entityLabel || (nested ? "Country" : "Row");
    const role = presetMeta?.roleLabel || "Term";

    const entityEl = chromeEl("upload-chrome-entity");
    const roleEl = chromeEl("upload-chrome-role");
    const searchEl = chromeEl("upload-chrome-search");
    const verbEl = chromeEl("upload-chrome-date-verb");
    const yearLabelEl = chromeEl("upload-chrome-year-label");

    if (entityEl) entityEl.value = entity;
    if (roleEl) roleEl.value = role;
    if (searchEl) {
      searchEl.value =
        view.searchPlaceholder ||
        `${entity.toLowerCase()}, ${role.toLowerCase()}, or region`;
    }
    if (verbEl) verbEl.value = settings.dateVerb || (presetMeta?.viewHash === "soviet-states" ? "Independence" : "Admitted");
    if (yearLabelEl) {
      yearLabelEl.value =
        settings.admissionYearLabel ||
        (settings.dateVerb === "Independence" || presetMeta?.viewHash === "soviet-states"
          ? "Show independence year"
          : "Show admission year");
    }

    setChecked(
      "upload-chrome-show-year",
      settings.showAdmissionYear !== false
    );
    setChecked(
      "upload-chrome-show-region",
      settings.showRegionFilter !== false
    );
    setChecked(
      "upload-chrome-show-congress",
      settings.showCongress === true || presetMeta?.showCongress === true
    );
    const congressRow = chromeEl("upload-chrome-show-congress")?.closest("label");
    if (congressRow) {
      const allowCongress = !presetMeta
        || presetMeta.showCongress === true
        || settings.showCongress === true;
      congressRow.hidden = !allowCongress;
    }
    setChecked(
      "upload-chrome-show-party-detail",
      settings.showPartyDetail === true
    );
    setChecked(
      "upload-chrome-show-ussr",
      settings.showUssrDissolution === true || Boolean(presetMeta?.USSR_DISSOLVED)
    );

    const copyStatus = chromeEl("upload-chrome-copy-status");
    if (copyStatus) copyStatus.hidden = true;
  }

  function presetItemLabel(kind, id, fallback) {
    const list = presetMeta?.view?.[kind] || [];
    return list.find((item) => item.id === id)?.label || fallback;
  }

  function colorOption(key, role) {
    const id = key === PERSON_COLOR_KEY ? "person" : fieldId(key);
    const preset = (presetMeta?.view?.colorBy || []).find((item) => item.id === id);
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
    const preset = presetMeta?.view?.colorBy || [];
    if (preset.length) {
      const rank = new Map(preset.map((item, index) => [item.id, index]));
      selected.sort(
        (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)
      );
    }
    if (!selected.length) selected.push(colorOption(PERSON_COLOR_KEY, role));
    return selected;
  }

  function specsFromChecks(name, { includeName = false, entity = "Row" } = {}) {
    const specs = [];
    if (includeName) {
      specs.push({
        id: "name",
        label: presetItemLabel("sorts", "name", `${entity} name`),
      });
    }
    for (const key of selectedChecks(name)) {
      const id = fieldId(key);
      if (!id || specs.some((spec) => spec.id === id)) continue;
      const kind = name === "upload-filter" ? "filters" : "sorts";
      const spec = { id, label: presetItemLabel(kind, id, labelFor(key)) };
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

  function refreshControlLists() {
    const entity =
      chromeEl("upload-chrome-entity")?.value.trim() ||
      presetMeta?.entityLabel ||
      "Row";
    const filters = specsFromChecks("upload-filter");
    paintControlPills("upload-chrome-filter-list", filters);
    paintControlPills(
      "upload-chrome-sort-list",
      specsFromChecks("upload-sort", { includeName: true, entity })
    );
    const role =
      chromeEl("upload-chrome-role")?.value.trim() ||
      presetMeta?.roleLabel ||
      "Term";
    paintControlPills("upload-chrome-color-list", colorSpecs(role));
    const region = filters.some((filter) => filter.id === "region");
    const regionBox = chromeEl("upload-chrome-show-region");
    if (regionBox) regionBox.checked = region;
  }

  function readChromeView(filterSpecs) {
    const entity =
      chromeEl("upload-chrome-entity")?.value.trim() ||
      presetMeta?.entityLabel ||
      "Row";
    const role =
      chromeEl("upload-chrome-role")?.value.trim() ||
      presetMeta?.roleLabel ||
      "Term";
    const searchPlaceholder =
      chromeEl("upload-chrome-search")?.value.trim() ||
      `${entity.toLowerCase()}, ${role.toLowerCase()}, or region`;
    const dateVerb =
      chromeEl("upload-chrome-date-verb")?.value.trim() || "Admitted";
    const admissionYearLabel =
      chromeEl("upload-chrome-year-label")?.value.trim() ||
      `Show ${dateVerb.toLowerCase()} year`;

    const colorBy = colorSpecs(role);
    const sorts = specsFromChecks("upload-sort", { includeName: true, entity });

    const showCongress = isChecked("upload-chrome-show-congress");
    const showParty = colorBy.some((option) => option.id === "party");
    const settings = {
      ...(presetMeta?.view?.settings || {}),
      showAdmissionYear: isChecked("upload-chrome-show-year"),
      showRegionFilter: isChecked("upload-chrome-show-region"),
      showCongress,
      showPartyDetail: isChecked("upload-chrome-show-party-detail"),
      showPartyLegend: showParty,
      showUssrDissolution: isChecked("upload-chrome-show-ussr"),
      admissionYearLabel,
      admissionYearTitle: `${admissionYearLabel} next to each row name`,
      regionFilterLabel: "Show region filter",
      barLabelsLabel: `Show ${role.toLowerCase()} names`,
      barLabelsTitle: `Print each ${role.toLowerCase()}'s name along their bar`,
      termBarsTitle: `Draw the colored bar for each ${role.toLowerCase()}'s term`,
      ussrDissolutionLabel: "Show USSR dissolution",
      ussrDissolutionTitle:
        "Mark 26 Dec 1991, when the USSR formally ceased to exist",
      legendPersonLabel: `${entity === "State" ? "Senators" : entity === "Country" ? "Rulers" : "People"}`,
      legendPersonText: `Distinct colors per individual ${role.toLowerCase()}`,
      dateVerb,
    };

    return {
      filters: filterSpecs,
      sorts,
      colorBy,
      searchPlaceholder,
      settings,
      entityLabel: entity,
      roleLabel: role,
    };
  }

  function setFileName(label) {
    const el = document.getElementById("upload-file-name");
    if (el) el.textContent = label || "No file selected";
  }

  function renderMap() {
    const host = document.getElementById("upload-map");
    if (!host) return;
    if (!records.length) {
      host.replaceChildren();
      setSetupVisible(false);
      return;
    }

    const keys = scalarKeys(records[0]);
    for (const row of records.slice(1, 40)) {
      for (const key of scalarKeys(row)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }

    const note = document.createElement("p");
    note.className = "upload-map-note";
    note.textContent = nested
      ? `${records.length} records already include a reign list. Choose which fields filter, sort, or color the rows.`
      : `${records.length} rows. Mark the row name, the bar label, and the start and end years. Other fields can filter, sort, or color.`;

    const table = document.createElement("table");
    table.className = "upload-map";
    const head = document.createElement("tr");
    const columns = nested
      ? ["Field", "Example", "Filter", "Sort", "Color"]
      : ["Field", "Example", "Row", "Bar", "Start", "End", "Filter", "Sort", "Color"];
    for (const column of columns) {
      const cell = document.createElement("th");
      cell.textContent = column;
      head.appendChild(cell);
    }
    table.appendChild(head);

    const rowGuess = guess(keys, ROW_KEYS);
    const barGuess = guess(keys.filter((key) => key !== rowGuess).concat(rowGuess), BAR_KEYS);
    const startGuess = guess(keys, START_KEYS);
    const endGuess = guess(keys, END_KEYS);

    const view = presetMeta?.view;
    const filterIds = new Set((view?.filters || []).map((item) => item.id));
    const sortIds = new Set((view?.sorts || []).map((item) => item.id));
    const colorIds = new Set((view?.colorBy || []).map((item) => item.id));
    const guided = Boolean(view?.filters || view?.sorts);
    const colorGuided = Array.isArray(view?.colorBy);
    const roleLabel = presetMeta?.roleLabel || (nested ? "Head of state" : "Term");

    const colorOn = (id) =>
      colorGuided ? colorIds.has(id) : id === "person" || id === "party";

    const seenIds = new Set();
    const appendFieldRow = (key, { filter = true, sort = true, example = "" } = {}) => {
      const id = fieldId(key);
      if (!id) return;
      seenIds.add(id);
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = labelFor(key);
      const sample = document.createElement("td");
      sample.className = "upload-example";
      sample.textContent = example || exampleOf(key);
      tr.append(name, sample);
      if (!nested) {
        tr.append(
          radioCell("upload-row", key, key === rowGuess),
          radioCell("upload-bar", key, key === barGuess),
          radioCell("upload-start", key, key === startGuess),
          radioCell("upload-end", key, key === endGuess)
        );
      }
      if (filter) {
        const filterChecked = guided
          ? filterIds.has(id)
          : /region|party|role|type|status/i.test(key);
        tr.append(checkCell("upload-filter", key, filterChecked));
      } else {
        tr.append(emptyCell());
      }
      if (sort) {
        const sortChecked = guided
          ? sortIds.has(id)
          : /admitted|independence|sovereignty|year|population/i.test(key);
        tr.append(checkCell("upload-sort", key, sortChecked));
      } else {
        tr.append(emptyCell());
      }
      // The leading Individual row already covers coloring by the person.
      if (id === "person") tr.append(emptyCell());
      else tr.append(checkCell("upload-color", key, colorOn(id)));
      table.appendChild(tr);
    };

    const personExample = firstBarName();
    const personRow = document.createElement("tr");
    const personName = document.createElement("td");
    personName.textContent = colorOption(PERSON_COLOR_KEY, roleLabel).label;
    const personSample = document.createElement("td");
    personSample.className = "upload-example";
    personSample.textContent = personExample;
    personRow.append(personName, personSample);
    if (!nested) {
      personRow.append(emptyCell(), emptyCell(), emptyCell(), emptyCell());
    }
    personRow.append(emptyCell(), emptyCell());
    personRow.append(checkCell("upload-color", PERSON_COLOR_KEY, colorOn("person")));
    table.appendChild(personRow);
    seenIds.add("person");

    for (const key of keys) appendFieldRow(key);
    for (const key of barFieldKeys(records)) {
      if (seenIds.has(fieldId(key))) continue;
      appendFieldRow(key, { filter: false, sort: false, example: exampleOfBar(key) });
    }

    table.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (
        input.name !== "upload-filter" &&
        input.name !== "upload-sort" &&
        input.name !== "upload-color"
      ) {
        return;
      }
      refreshControlLists();
      const toggle = document.querySelector("#upload-chrome-section .upload-section-toggle");
      if (toggle && toggle.getAttribute("aria-expanded") !== "true") {
        setSectionOpen(toggle, true);
      }
    });

    host.replaceChildren(note, table);
    syncMetadataFields();
    syncChromeFields();
    refreshControlLists();
    setSetupVisible(true);
  }

  function radioCell(name, key, checked) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = key;
    input.checked = checked;
    td.appendChild(input);
    return td;
  }

  function checkCell(name, key, checked) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.value = key;
    input.checked = checked;
    td.appendChild(input);
    return td;
  }

  function emptyCell() {
    return document.createElement("td");
  }

  function selectedRadio(name) {
    return document.querySelector(`#upload-dialog input[name="${name}"]:checked`)?.value || "";
  }

  function selectedChecks(name) {
    return [...document.querySelectorAll(`#upload-dialog input[name="${name}"]:checked`)].map(
      (input) => input.value
    );
  }

  function spanFromLeader(leader) {
    const start = parseDate(leader.start ?? leader.startYear);
    const end = parseDate(leader.end ?? leader.endYear);
    if (!start || !end) return null;
    const span = {
      name: String(leader.name || leader.person || "Unknown"),
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

  function fieldsFrom(row, skip) {
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

  function admittedFrom(record) {
    if (record.admitted) return String(record.admitted);
    const independence = parseDate(record.independence);
    if (!independence) return "";
    const month = String(independence.month || 1).padStart(2, "0");
    const day = String(independence.day || 1).padStart(2, "0");
    return `${independence.year}-${month}-${day}`;
  }

  function markPresetSelection(hash, { sample = false } = {}) {
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

  function buildSeats() {
    const filterKeys = selectedChecks("upload-filter");
    const sortKeys = selectedChecks("upload-sort");
    if (nested) {
      const seats = records.map((record, index) => {
        const rulers = [
          ...(record.sovietLeaders || []),
          ...(record.rulers || []),
        ]
          .map(spanFromLeader)
          .filter(Boolean);
        const name = String(record.name || record.country || record.state || `Row ${index + 1}`);
        return {
          id: fieldId(record.id || name) || `row${index + 1}`,
          name,
          state: String(record.state || record.id || name),
          class: record.class,
          flag: record.flag || String(record.id || name),
          region: record.region || "",
          admitted: admittedFrom(record),
          rulers,
          fields: fieldsFrom(
            record,
            new Set(["name", "rulers", "sovietLeaders", "unrest"])
          ),
        };
      }).filter((seat) => seat.rulers.length);
      return {
        seats,
        filterKeys,
        sortKeys,
        rowLabel: presetMeta?.entityLabel || "Name",
      };
    }

    const rowKey = selectedRadio("upload-row");
    const barKey = selectedRadio("upload-bar");
    const startKey = selectedRadio("upload-start");
    const endKey = selectedRadio("upload-end");
    if (!rowKey || !barKey || !startKey || !endKey) {
      throw new Error("Choose a row name, a bar label, a start year, and an end year.");
    }

    const groups = new Map();
    for (const row of records) {
      const rowName = String(row[rowKey] ?? "").trim() || "Unknown";
      let seat = groups.get(rowName);
      if (!seat) {
        seat = {
          id: fieldId(rowName) || `row${groups.size + 1}`,
          name: rowName,
          state: rowName,
          flag: rowName,
          region: "",
          admitted: "",
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
    if (savedSort) return;
    const sortRoot = document.getElementById("state-sort");
    savedSort = {
      html: sortRoot?.innerHTML || "",
      mode: filters().getOrderMode?.() || "name",
      dir: filters().getOrderDir?.() || "asc",
    };
    savedFooter = {
      author: document.getElementById("footer-author")?.innerHTML || "",
      sources: document.getElementById("footer-sources")?.innerHTML || "",
    };
  }

  function restoreChrome() {
    const sortRoot = document.getElementById("state-sort");
    const custom = document.getElementById("custom-filters");
    const uploadBtn = document.getElementById("upload-open");
    if (savedSort && sortRoot) sortRoot.innerHTML = savedSort.html;
    const previous = savedSort;
    savedSort = null;
    if (savedFooter) {
      const author = document.getElementById("footer-author");
      const sources = document.getElementById("footer-sources");
      if (author) author.innerHTML = savedFooter.author;
      if (sources) sources.innerHTML = savedFooter.sources;
      savedFooter = null;
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

  function applyUpload() {
    const built = buildSeats();
    if (!built.seats.length) {
      throw new Error("No rows had both a start year and an end year.");
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
      searchPlaceholder: chromeView.searchPlaceholder,
      settings: chromeView.settings,
    };

    const viewHash = String(presetMeta?.viewHash || "upload").replace(/^#/, "") || "upload";
    const fromPreset = Boolean(presetMeta?.viewHash);
    if (fromPreset) {
      savedSort = null;
      savedFooter = null;
    } else {
      rememberChrome();
    }

    const exclusive = presetMeta?.exclusive === true;
    const annotated = window.TimelineLanes
      ? window.TimelineLanes.annotateSeats(built.seats, { exclusive })
      : built.seats;

    const title =
      metaInput("upload-meta-title")?.value.trim() ||
      presetMeta?.title ||
      fileLabel;
    const subtitle =
      metaInput("upload-meta-subtitle")?.value.trim() ||
      presetMeta?.subtitle ||
      "Uploaded data. Filters and sorts use the fields you picked.";
    const sourcesValue = metaInput("upload-meta-sources")?.value.trim() || "";
    const authorValue =
      metaInput("upload-meta-author")?.value.trim() || DEFAULT_AUTHOR;

    const dataStart = Math.min(...years);
    const dataEnd = Math.max(...years);
    const presetStart = Number(presetMeta?.TIMELINE_START);
    const presetEnd = Number(presetMeta?.TIMELINE_END);

    window.TIMELINE_DATA = {
      TIMELINE_START: Number.isFinite(presetStart) ? presetStart : dataStart,
      TIMELINE_END: Number.isFinite(presetEnd) ? presetEnd : dataEnd,
      exclusive,
      showCongress: view.settings?.showCongress === true,
      USSR_DISSOLVED: presetMeta?.USSR_DISSOLVED || undefined,
      entityLabel: chromeView.entityLabel,
      roleLabel: chromeView.roleLabel,
      title,
      subtitle,
      datasetTitle: title,
      author: authorValue,
      sources: sourcesValue,
      datasetId: fromPreset ? presetMeta.datasetId || viewHash : "upload",
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
      orientation: presetMeta?.orientation,
      yearOrder: presetMeta?.yearOrder,
      lockOrientation: presetMeta?.lockOrientation === true,
    });

    window.TimelineGeometry?.invalidateCaches?.();
    window.TimelinePalette?.invalidate?.();
    window.TimelineGeometry?.setTimeRangeFilter?.("all");
    window.TimelineFilterControls?.syncTimeRangeChips?.("all");
    const alreadyName =
      (filters().getOrderMode?.() || "name") === "name" &&
      (filters().getOrderDir?.() || "asc") === "asc";
    if (!alreadyName) filters().setOrder?.("name", "asc");
    else if (typeof window.renderTimeline === "function") window.renderTimeline();
    window.dispatchEvent(new Event("timeline-dataset-change"));
  }

  function loadParsed(data, label, meta = null) {
    records = extractRecords(data);
    nested = isNested(records);
    fileLabel = label || "Custom timeline";
    presetMeta = meta;
    if (!records.length) {
      showError("That JSON has no rows. Use a list of objects, or records with a rulers list.");
      renderMap();
      return;
    }
    showError("");
    renderMap();
  }

  async function loadPreset(key) {
    const loader = window.TimelineDatasets?.loadPresetRecords;
    if (!loader) throw new Error("Preset loader is not ready.");
    const file = document.getElementById("upload-file");
    if (file) file.value = "";
    setFileName("No file selected");
    showError("");
    const { entry, meta, records: presetRecords } = await loader(key);
    const hash = String(entry.hash || entry.id || "").replace(/^#/, "");
    markPresetSelection(hash);
    loadParsed(presetRecords, entry.title || entry.label || hash, {
      exclusive: meta.exclusive !== false,
      showCongress: meta.showCongress === true,
      entityLabel: meta.entityLabel || "State",
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
      entityLabel: "Country",
      roleLabel: "Head of state",
      sources:
        `Example dataset from <a href="https://github.com/Witold1/american-senators-timeline/blob/main/data/examples/five-countries.json">data/examples/five-countries.json</a>.`,
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

  function bind() {
    const dialog = document.getElementById("upload-dialog");
    const open = document.getElementById("upload-open");
    const file = document.getElementById("upload-file");
    const form = document.getElementById("upload-form");
    const sample = document.getElementById("upload-sample");
    if (!dialog || !open || !file || !form) return;

    bindSectionToggles(dialog);
    chromeEl("upload-chrome-entity")?.addEventListener("input", refreshControlLists);

    open.addEventListener("click", () => {
      showError("");
      dialog.showModal();
      // Match Kazakh: if a catalog preset is already showing, open with its mapper filled.
      const isCustom =
        window.TIMELINE_DATA?.datasetId === "upload" ||
        document.documentElement.classList.contains("custom-upload");
      const active = window.TimelineDatasets?.activeHash?.();
      if (isCustom || !active) return;
      if (presetMeta?.viewHash === active && records.length) {
        markPresetSelection(active);
        return;
      }
      loadPreset(active).catch((err) => {
        console.error("Failed to load active preset into upload map:", err);
        showError(err?.message || "Could not load the current preset.");
      });
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
          records = [];
          presetMeta = null;
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
      setFileName("No file selected");
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
            sources: "Built-in short sample (example file did not load).",
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
      if (!savedSort && !document.documentElement.classList.contains("custom-upload")) return;
      restoreChrome();
    });
  }

  bind();

  window.TimelineUpload = { loadParsed, loadPreset, applyUpload };
})();
