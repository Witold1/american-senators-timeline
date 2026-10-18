/**
 * Rebuilds the chips and the gear labels from the dataset that is open.
 */
(function () {
  const REGION_LABELS = {
    northeast: "Northeast",
    midwest: "Midwest",
    south: "South",
    west: "West",
    baltic: "Baltic",
    slavic: "Slavic",
    caucasus: "Caucasus",
    transcaucasus: "Transcaucasus",
    centralasia: "Central Asia",
    "central-asia": "Central Asia",
    moldova: "Moldova",
    east: "East",
  };

  const SORT_ARROW =
    '<svg class="sort-arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 9.25V2.75M3.4 5.35 6 2.75l2.6 2.6"/></svg>';

  function filters() {
    return window.TimelineFilters || {};
  }

  function data() {
    return window.TIMELINE_DATA || {};
  }

  function viewSpec() {
    return data().view || {};
  }

  function titleCase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (REGION_LABELS[raw]) return REGION_LABELS[raw];
    if (REGION_LABELS[raw.toLowerCase()]) return REGION_LABELS[raw.toLowerCase()];
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function uniqueSeatValues(seats, id) {
    const values = new Set();
    for (const seat of seats || []) {
      let value;
      if (id === "region") value = seat.region;
      else if (id === "name") value = seat.name;
      else value = seat.fields?.[id] ?? seat[id];
      if (value != null && value !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }

  function defaultViewFromData() {
    const polity = data().polityLabel || "Row";
    const role = data().roleLabel || "Term";
    return {
      filters: [{ id: "region", label: "Region", multi: true }],
      sorts: [
        { id: "name", label: `${polity} name` },
        { id: "admitted", label: "Start date" },
      ],
      colorBy: [
        { id: "party", label: "Political party" },
        { id: "person", label: `Individual ${role.toLowerCase()}` },
      ],
      searchPlaceholder: `${polity.toLowerCase()}, ${role.toLowerCase()}, or region`,
      settings: {
        showAdmissionYear: true,
        showRegionFilter: true,
        showCongress: data().showCongress === true,
        showPartyDetail: data().showCongress === true,
      },
    };
  }

  function resolvedView() {
    const base = defaultViewFromData();
    const view = viewSpec();
    return {
      filters: Array.isArray(view.filters) ? view.filters : base.filters,
      sorts: Array.isArray(view.sorts) && view.sorts.length ? view.sorts : base.sorts,
      colorBy:
        Array.isArray(view.colorBy) && view.colorBy.length ? view.colorBy : base.colorBy,
      searchPlaceholder: view.searchPlaceholder || base.searchPlaceholder,
      settings: { ...base.settings, ...(view.settings || {}) },
    };
  }

  function syncChipGroup(root, attr, value) {
    if (!root) return;
    root.querySelectorAll(`[${attr}]`).forEach((btn) => {
      const active = btn.getAttribute(attr) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function rebuildTimeRangeChips() {
    const root = document.getElementById("time-range-filter");
    const group = root?.querySelector(".chip-switch-group");
    const geo = window.TimelineGeometry;
    if (!group || !geo?.refreshTimeRanges) return;
    const order = geo.refreshTimeRanges();
    group.replaceChildren();
    const add = (value, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.dataset.timeRange = value;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = label;
      group.appendChild(btn);
    };
    add("all", "All");
    for (const year of order) add(String(year), `${year}s`);
    const current = geo.normalizeTimeRangeFilter?.(filters().getTimeRangeFilter?.()) || "all";
    filters().setTimeRangeFilter?.(current, { announce: false });
    window.TimelineFilterControls?.syncTimeRangeChips?.(current);
  }

  function rebuildRegionFilter(view) {
    const root = document.getElementById("region-filter");
    const group = root?.querySelector(".chip-switch-group");
    const regionSpec = (view.filters || []).find((f) => f.id === "region");
    const settings = view.settings || {};
    const show = settings.showRegionFilter !== false && Boolean(regionSpec);
    if (!root || !group) return;

    if (!show) {
      root.hidden = true;
      document.documentElement.classList.remove("regions-enabled");
      filters().setRegionFilter?.("all");
      return;
    }

    root.hidden = false;
    const label = root.querySelector(".chip-switch-label");
    if (label) label.textContent = regionSpec.label || "Region";

    const values = uniqueSeatValues(data().seats, "region");
    group.replaceChildren();
    const add = (id, text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.dataset.region = id;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = text;
      group.appendChild(btn);
    };
    add("all", "All");
    for (const value of values) add(value, titleCase(value));

    const multi = regionSpec.multi !== false;
    root.dataset.multi = multi ? "1" : "0";
    syncRegionChips();
    if (!document.documentElement.classList.contains("regions-enabled")) {
      document.documentElement.classList.add("regions-enabled");
    }
    window.TimelineFilterControls?.applyRegionFilter?.();
  }

  function syncRegionChips() {
    const root = document.getElementById("region-filter");
    if (!root) return;
    const selected = filters().getRegionFilters?.() || new Set();
    const none = !selected.size;
    root.querySelectorAll("[data-region]").forEach((btn) => {
      const id = btn.getAttribute("data-region");
      const on = id === "all" ? none : selected.has(id);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function rebuildColorBy(view) {
    const root = document.getElementById("color-mode-filter");
    const group = root?.querySelector(".chip-switch-group");
    if (!group) return;
    const options = view.colorBy || [];
    const hasParty = options.some((option) => option.id === "party");
    document.documentElement.classList.toggle("legend-party", hasParty);
    // One mode (typical for kingdoms: person only) — no need for a switch.
    if (options.length <= 1) {
      group.replaceChildren();
      if (root) root.hidden = true;
      const only = options[0]?.id || "person";
      document.documentElement.dataset.colorMode = only;
      filters().setColorMode?.(only);
      return;
    }
    if (root) root.hidden = false;
    group.replaceChildren();
    const choice = filters().getColorModeChoice?.() || options[0]?.id || "party";
    const activeId = options.some((o) => o.id === choice) ? choice : options[0]?.id || "party";
    for (const option of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.dataset.colorMode = option.id;
      btn.title = option.title || option.label;
      btn.textContent = option.label;
      const on = option.id === activeId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      group.appendChild(btn);
    }
    document.documentElement.dataset.colorMode = activeId;
    filters().setColorMode?.(activeId);
  }

  function rebuildSorts(view) {
    const sortRoot = document.getElementById("state-sort");
    if (!sortRoot) return;
    const sorts = view.sorts || [];
    const current = filters().getOrderMode?.() || sorts[0]?.id || "name";
    const dir = filters().getOrderDir?.() || "asc";
    const activeId = sorts.some((s) => s.id === current) ? current : sorts[0]?.id || "name";
    sortRoot.replaceChildren();
    sortRoot.setAttribute("aria-label", `Sort ${data().polityLabel || "rows"}`);
    sorts.forEach((sort) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sort-btn";
      btn.dataset.sort = sort.id;
      btn.dataset.dir = sort.id === activeId ? dir : "asc";
      const on = sort.id === activeId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      const label = document.createElement("span");
      label.className = "sort-btn-label";
      label.textContent = sort.label;
      btn.appendChild(label);
      btn.insertAdjacentHTML("beforeend", SORT_ARROW);
      sortRoot.appendChild(btn);
    });
    filters().setOrder?.(activeId, dir);
    window.TimelineFilterControls?.syncStateSort?.(sortRoot, activeId, dir);
  }

  function rebuildExtraFilters(view) {
    const host = document.getElementById("custom-filters");
    if (!host) return;
    const extras = (view.filters || []).filter((f) => f && f.id && f.id !== "region");
    if (!host.dataset.multiBound) {
      host.dataset.multiBound = "1";
      const closeMenus = (event) => {
        if (event?.target?.closest?.(".filter-multi, .filter-multi-menu")) return;
        document.querySelectorAll(".filter-multi-menu").forEach((menu) => {
          menu.hidden = true;
          menu._button?.setAttribute("aria-expanded", "false");
        });
      };
      document.addEventListener("click", closeMenus);
      window.addEventListener(
        "scroll",
        (event) => {
          if (event.target?.closest?.(".filter-multi-menu")) return;
          document.querySelectorAll(".filter-multi-menu").forEach((menu) => {
            if (!menu.hidden) menu._place?.();
          });
        },
        true
      );
      window.addEventListener("resize", () => {
        document.querySelectorAll(".filter-multi-menu").forEach((menu) => {
          if (!menu.hidden) menu._place?.();
        });
      });
    }

    document.querySelectorAll(".filter-multi-menu").forEach((menu) => menu.remove());
    host.replaceChildren();
    filters().clearFieldFilters?.();
    if (!extras.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    for (const filter of extras) {
      const values = uniqueSeatValues(data().seats, filter.id);
      if (!values.length) continue;
      const wrap = document.createElement("div");
      wrap.className = "chip-switch";
      const label = document.createElement("span");
      label.className = "chip-switch-label";
      label.textContent = filter.label || titleCase(filter.id);
      const group = document.createElement("div");
      group.className = "chip-switch-group";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", label.textContent);

      const addChip = (value, text) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `chip-btn${value === "all" ? " is-active" : ""}`;
        btn.dataset.field = filter.id;
        btn.dataset.value = value;
        btn.setAttribute("aria-pressed", value === "all" ? "true" : "false");
        btn.textContent = text;
        group.appendChild(btn);
      };

      if (values.length > 8) {
        const picker = document.createElement("div");
        picker.className = "filter-multi";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upload-filter-select";
        button.textContent = "All";
        button.setAttribute("aria-haspopup", "listbox");
        button.setAttribute("aria-expanded", "false");
        const menu = document.createElement("div");
        menu.className = "filter-multi-menu";
        menu.hidden = true;
        menu.setAttribute("role", "listbox");
        menu.setAttribute("aria-multiselectable", "true");
        menu.setAttribute("aria-label", label.textContent);

        const paint = () => {
          const selected = filters().getFieldSelection?.(filter.id) || new Set();
          const names = [...selected].map((value) => titleCase(value));
          button.textContent = !names.length
            ? "All"
            : names.length <= 2
              ? names.join(", ")
              : `${names.length} selected`;
          menu.querySelectorAll("input[type='checkbox']").forEach((box) => {
            box.checked = selected.has(box.value);
          });
        };

        const allRow = document.createElement("button");
        allRow.type = "button";
        allRow.className = "filter-multi-all";
        allRow.textContent = "All";
        allRow.addEventListener("click", () => {
          filters().setFieldFilter?.(filter.id, "all", { toggle: true });
          paint();
        });
        menu.appendChild(allRow);

        for (const value of values) {
          const row = document.createElement("label");
          row.className = "filter-multi-option";
          const box = document.createElement("input");
          box.type = "checkbox";
          box.value = value;
          box.addEventListener("change", () => {
            filters().setFieldFilter?.(filter.id, value, { toggle: true });
            paint();
          });
          row.append(box, document.createTextNode(titleCase(value)));
          menu.appendChild(row);
        }

        const placeMenu = () => {
          const rect = button.getBoundingClientRect();
          const width = Math.max(rect.width, 200);
          let left = rect.left;
          if (left + width > window.innerWidth - 8) {
            left = Math.max(8, window.innerWidth - width - 8);
          }
          menu.style.left = `${left}px`;
          menu.style.top = `${rect.bottom + 4}px`;
          menu.style.minWidth = `${width}px`;
        };
        menu._button = button;
        menu._place = placeMenu;

        button.addEventListener("click", () => {
          const open = menu.hidden;
          document.querySelectorAll(".filter-multi-menu").forEach((other) => {
            other.hidden = true;
            other._button?.setAttribute("aria-expanded", "false");
          });
          if (!open) return;
          document.body.appendChild(menu);
          menu.hidden = false;
          placeMenu();
          button.setAttribute("aria-expanded", "true");
        });
        picker.appendChild(button);
        group.appendChild(picker);
        paint();
      } else {
        addChip("all", "All");
        for (const value of values) addChip(value, titleCase(value));
        group.addEventListener("click", (event) => {
          const btn = event.target.closest?.("[data-value]");
          if (!btn || !group.contains(btn)) return;
          group.querySelectorAll("[data-value]").forEach((chip) => {
            const on = chip === btn;
            chip.classList.toggle("is-active", on);
            chip.setAttribute("aria-pressed", on ? "true" : "false");
          });
          filters().setFieldFilter?.(filter.id, btn.dataset.value);
        });
      }

      wrap.append(label, group);
      host.appendChild(wrap);
    }
  }

  function seatsHaveDate(key) {
    return (data().seats || []).some((seat) => seat?.[key]?.year);
  }

  function applySettings(view) {
    const settings = view.settings || {};
    const map = [
      {
        id: "show-admission-year",
        show: settings.showAdmissionYear !== false,
        label: settings.admissionYearLabel,
        title: settings.admissionYearTitle,
      },
      {
        id: "show-congresses",
        show: settings.showCongress === true,
        label: null,
        title: null,
      },
      {
        id: "show-party-detail",
        show: settings.showPartyDetail === true,
        label: null,
        title: null,
      },
      {
        id: "show-sovereignty-markers",
        show: seatsHaveDate("sovereignty"),
        settingKey: "showSovereigntyMarkers",
        className: "sovereignty-markers-enabled",
        label: settings.sovereigntyMarkerLabel || "Show sovereignty dates",
        title:
          settings.sovereigntyMarkerTitle ||
          "Mark the date each country declared sovereignty",
      },
      {
        id: "show-independence-markers",
        show: seatsHaveDate("independence"),
        settingKey: "showIndependenceMarkers",
        className: "independence-markers-enabled",
        label: settings.independenceMarkerLabel || "Show independence dates",
        title:
          settings.independenceMarkerTitle ||
          "Mark the date each country declared independence",
      },
      {
        id: "show-ussr-dissolution",
        show: settings.showUssrDissolution === true && Boolean(data().USSR_DISSOLVED),
        label: settings.ussrDissolutionLabel,
        title: settings.ussrDissolutionTitle,
      },
      {
        id: "show-ruler-bars",
        show: true,
        label: null,
        title: settings.termBarsTitle,
      },
      {
        id: "show-bar-labels",
        show: true,
        label: settings.barLabelsLabel,
        title: settings.barLabelsTitle,
      },
    ];

    for (const item of map) {
      const input = document.getElementById(item.id);
      const row = input?.closest("label.toggle, .settings-nest");
      if (!input) continue;
      if (row && row.matches("label.toggle")) row.hidden = !item.show;
      else if (!item.show && item.id.startsWith("show-")) {
        const label = input.closest("label");
        if (label) label.hidden = !item.show;
      }
      const span = input.parentElement?.querySelector("span");
      if (span && item.label) span.textContent = item.label;
      if (span && item.title) span.title = item.title;
      if (item.settingKey && typeof settings[item.settingKey] === "boolean") {
        input.checked = settings[item.settingKey];
      }
      if (item.className) {
        document.documentElement.classList.toggle(
          item.className,
          item.show && input.checked
        );
      }
      if (!item.show) {
        // Force off hidden features so they don't affect the chart.
        if (item.id === "show-party-detail") {
          document.documentElement.classList.remove("party-detail-enabled");
        }
        if (item.id === "show-ussr-dissolution") {
          document.documentElement.classList.remove("ussr-marker-enabled");
        }
      } else if (item.id === "show-ussr-dissolution") {
        document.documentElement.classList.add("ussr-marker-enabled");
      }
      if (item.id === "show-congresses") {
        document.documentElement.dataset.congressSettings = item.show ? "true" : "false";
        document.documentElement.classList.toggle(
          "congresses-enabled",
          item.show && input.checked
        );
      }
    }

    // Keep Congress render flag in sync with dataset meta / view.
    data().showCongress = settings.showCongress === true;

    const personHeading = document.getElementById("legend-person-heading");
    const personText = document.getElementById("legend-person-text");
    if (personHeading) {
      personHeading.textContent = settings.legendPersonLabel || "Senators";
    }
    if (personText) {
      personText.textContent =
        settings.legendPersonText || "Distinct colors per individual senators";
    }
  }

  function applySearchPlaceholder(view) {
    const input = document.getElementById("search");
    if (input && view.searchPlaceholder) input.placeholder = view.searchPlaceholder;
  }

  function applyViewChrome() {
    const view = resolvedView();
    // Uploads used to stash filters only in #custom-filters; catalog presets
    // now share the same rebuild path.
    document.documentElement.classList.toggle(
      "view-has-region",
      (view.filters || []).some((f) => f.id === "region")
    );
    applySearchPlaceholder(view);
    rebuildTimeRangeChips();
    rebuildRegionFilter(view);
    rebuildExtraFilters(view);
    rebuildColorBy(view);
    rebuildSorts(view);
    applySettings(view);
    filters().applyFilters?.();
    return view;
  }

  window.TimelineViewChrome = {
    apply: applyViewChrome,
    resolvedView,
    syncRegionChips,
    titleCase,
    REGION_LABELS,
  };
})();
