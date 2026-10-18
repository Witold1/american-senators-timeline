/**
 * Column-mapping table: raw JSON keys, in first-seen order.
 */
import { checkCell, emptyCell, radioCell } from "./cells.js";
import {
  refreshControlLists,
  setSectionOpen,
  setSetupVisible,
  syncChromeFields,
  syncMetadataFields,
} from "./chrome.js";
import {
  arrayExample,
  barListKeysOf,
  childKeysOf,
  exampleOf,
  exampleOfBar,
  fieldId,
  firstBarName,
  guess,
  isSpanLabel,
  labelFor,
  recordLabel,
  scalarKeys,
  spanDateSample,
  unusedKeysOf,
} from "./records.js";
import {
  BAR_FIELD_SKIP,
  BAR_KEYS,
  END_KEYS,
  PERSON_COLOR_KEY,
  ROW_KEYS,
  START_KEYS,
  state,
} from "./state.js";

export function renderMap() {
  const host = document.getElementById("upload-map");
  if (!host) return;
  if (!state.records.length) {
    host.replaceChildren();
    setSetupVisible(false);
    return;
  }

  const keys = [];
  for (const row of state.records.slice(0, 40)) {
    for (const key of scalarKeys(row)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const columns = state.nested
    ? ["Key", "Example", "Filter", "Sort", "Color", "Tooltip"]
    : ["Key", "Example", "Polity", "Person", "Start", "End", "Filter", "Sort", "Color", "Tooltip"];
  const leadName = recordLabel(state.records[0], 0);
  const orderNote =
    state.records.length === 1
      ? `Field names are the raw JSON keys of ${leadName}, in file order.`
      : `Field names are the raw JSON keys, in the order they first appear. ${leadName} is first, so its keys lead; keys that show up only on later records are added at the end of that section.`;
  const actionNote = state.nested
    ? " Choose which of those fields filter, sort, color, or appear in the tooltip."
    : " Mark the polity name, the person, and the start and end years. Other fields can filter, sort, color, or appear in the tooltip.";

  const note = document.createElement("p");
  note.className = "upload-map-note";
  note.textContent = `${state.records.length} entries. ${orderNote}${actionNote}`;

  const table = document.createElement("table");
  table.className = "upload-map";
  const head = document.createElement("tr");
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

  const view = state.presetMeta?.view;
  const filterIds = new Set((view?.filters || []).map((item) => item.id));
  const sortIds = new Set((view?.sorts || []).map((item) => item.id));
  const colorIds = new Set((view?.colorBy || []).map((item) => item.id));
  const tooltipIds = new Set((view?.tooltip || []).map((item) => item.id));
  const guided = Boolean(view?.filters || view?.sorts);
  const colorGuided = Array.isArray(view?.colorBy);
  const tooltipGuided = Array.isArray(view?.tooltip);

  const colorOn = (id) =>
    colorGuided ? colorIds.has(id) : id === "person" || id === "party";

  const tooltipOn = (id) =>
    tooltipGuided
      ? tooltipIds.has(id)
      : id === "name" || id === "person" || id === "bioguide" || id === "role";

  const seenIds = new Set();

  function fieldNameCell(raw, title) {
    const td = document.createElement("td");
    td.className = "upload-field";
    const code = document.createElement("code");
    code.className = "upload-raw";
    code.textContent = raw;
    if (title) code.title = title;
    td.appendChild(code);
    return td;
  }

  function groupHeader(title) {
    const tr = document.createElement("tr");
    tr.className = "upload-map-group";
    const cell = document.createElement("th");
    cell.colSpan = columns.length;
    cell.scope = "colgroup";
    const name = document.createElement("span");
    name.className = "upload-map-group-title";
    name.textContent = title;
    cell.appendChild(name);
    tr.appendChild(cell);
    table.appendChild(tr);
  }

  function appendFixedRow(raw, example) {
    const tr = document.createElement("tr");
    tr.className = "upload-map-fixed";
    const sample = document.createElement("td");
    sample.className = "upload-example";
    sample.textContent = example || "";
    tr.append(fieldNameCell(raw, labelFor(raw.replace(/\[\]$/, ""))), sample);
    for (let i = 0; i < columns.length - 2; i += 1) tr.append(emptyCell());
    table.appendChild(tr);
  }

  const appendFieldRow = (
    key,
    {
      filter = true,
      sort = true,
      color = true,
      tooltip = true,
      tooltipValue = "",
      example = "",
      raw = "",
      force = false,
      colorValue = "",
      colorChecked = false,
    } = {}
  ) => {
    const id = fieldId(key);
    if (!id || (seenIds.has(id) && !force)) return;
    seenIds.add(id);
    const tr = document.createElement("tr");
    const sample = document.createElement("td");
    sample.className = "upload-example";
    sample.textContent = example || exampleOf(key);
    tr.append(fieldNameCell(raw || key, labelFor(key)), sample);
    if (!state.nested) {
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
    if (!color) tr.append(emptyCell());
    else if (colorValue) tr.append(checkCell("upload-color", colorValue, colorChecked));
    else if (id === "person") tr.append(emptyCell());
    else tr.append(checkCell("upload-color", key, colorOn(id)));
    if (tooltip) {
      const tipKey = tooltipValue || key;
      const tipId = tipKey === PERSON_COLOR_KEY ? "person" : fieldId(tipKey);
      tr.append(checkCell("upload-tooltip", tipKey, tooltipOn(tipId)));
    } else {
      tr.append(emptyCell());
    }
    table.appendChild(tr);
  };

  groupHeader("Polity and context");
  for (const key of keys) appendFieldRow(key);

  if (state.nested) {
    const barLists = barListKeysOf(state.records);
    groupHeader("Associated people");

    const childKeyList = [];
    for (const listKey of barLists) {
      for (const key of childKeysOf(state.records, listKey)) {
        if (!childKeyList.includes(key)) childKeyList.push(key);
      }
    }
    const childIds = new Set(childKeyList.map((key) => fieldId(key)));
    const folded = new Set();
    for (const stem of ["start", "end"]) {
      if (!childIds.has(stem)) continue;
      for (const key of childKeyList) {
        const id = fieldId(key);
        if (id === `${stem}month` || id === `${stem}day` || id === `${stem}year`) folded.add(key);
      }
    }

    let gavePersonColor = false;
    for (const key of childKeyList) {
      if (folded.has(key)) continue;
      const id = fieldId(key);
      const stem = id === "start" || id === "end" ? id : "";

      if (isSpanLabel(id)) {
        if (!gavePersonColor) {
          gavePersonColor = true;
          appendFieldRow(key, {
            force: true,
            filter: false,
            sort: false,
            tooltipValue: PERSON_COLOR_KEY,
            example: exampleOfBar(key) || firstBarName(),
            colorValue: PERSON_COLOR_KEY,
            colorChecked: colorOn("person"),
          });
        } else {
          appendFixedRow(key, exampleOfBar(key));
        }
        continue;
      }

      if (id === "bioguide") {
        appendFieldRow(key, {
          filter: false,
          sort: false,
          color: false,
          example: exampleOfBar(key),
        });
        continue;
      }

      if (stem || BAR_FIELD_SKIP.has(id)) {
        const example = stem ? spanDateSample(state.records, barLists, stem) : exampleOfBar(key);
        appendFixedRow(key, example);
        continue;
      }

      if (seenIds.has(id)) continue;
      appendFieldRow(key, {
        filter: false,
        sort: false,
        example: exampleOfBar(key),
      });
    }

    if (!gavePersonColor) {
      const tr = document.createElement("tr");
      const sample = document.createElement("td");
      sample.className = "upload-example";
      sample.textContent = firstBarName();
      tr.append(
        fieldNameCell("name", "Name"),
        sample,
        emptyCell(),
        emptyCell(),
        checkCell("upload-color", PERSON_COLOR_KEY, colorOn("person")),
        checkCell("upload-tooltip", PERSON_COLOR_KEY, tooltipOn("person"))
      );
      table.appendChild(tr);
    }

    const unused = unusedKeysOf(state.records);
    if (unused.length) {
      groupHeader("In the file, not on the chart");
      for (const key of unused) {
        const asList = state.records.some((row) => Array.isArray(row?.[key]));
        appendFixedRow(
          asList ? `${key}[]` : key,
          asList ? arrayExample(state.records, key) : ""
        );
      }
    }
  } else {
    groupHeader("Chart");
    const personRow = document.createElement("tr");
    const personSample = document.createElement("td");
    personSample.className = "upload-example";
    personSample.textContent = firstBarName();
    personRow.append(
      fieldNameCell("person", "Chart color"),
      personSample
    );
    personRow.append(emptyCell(), emptyCell(), emptyCell(), emptyCell());
    personRow.append(emptyCell(), emptyCell());
    personRow.append(checkCell("upload-color", PERSON_COLOR_KEY, colorOn("person")));
    personRow.append(emptyCell());
    table.appendChild(personRow);
  }

  table.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (
      input.name !== "upload-filter" &&
      input.name !== "upload-sort" &&
      input.name !== "upload-color" &&
      input.name !== "upload-tooltip"
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
