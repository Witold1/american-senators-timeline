/**
 * Chip-button UI for view/filter state. Calls TimelineFilters (and palette dataset).
 * Region visibility toggle lives in controls.js and calls onRegionsVisibilityChange.
 */
(function () {
  const ORDER_STORAGE_KEY = "timeline-order-mode";
  const ORDER_DIR_STORAGE_KEY = "timeline-order-dir";
  const REGION_STORAGE_KEY = "timeline-region-filter";
  const TIME_RANGE_STORAGE_KEY = "timeline-time-range-filter";
  const ORIENT_STORAGE_KEY = "timeline-orientation";
  const YEAR_ORDER_STORAGE_KEY = "timeline-year-order";
  const COLOR_MODE_STORAGE_KEY = "timeline-color-mode";
  const PALETTE_STORAGE_KEY = "timeline-palette";
  const PALETTE_STORAGE_KEY_LEGACY = "timeline-party-palette";
  const PALETTES = new Set(["muted", "soft", "vivid"]);

  let regionPreference = "all";

  function filters() {
    return window.TimelineFilters || {};
  }

  function syncChipGroup(root, attr, value) {
    if (!root) return;
    root.querySelectorAll(`[${attr}]`).forEach((btn) => {
      const active = btn.getAttribute(attr) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function readStored(key, normalize, fallback) {
    try {
      const stored = localStorage.getItem(key);
      const value = normalize(stored);
      if (value != null) return value;
    } catch {
      /* ignore */
    }
    return fallback;
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {{
   *   rootId: string,
   *   attr: string,
   *   storageKey?: string,
   *   normalize: (raw: string|null) => string|null,
   *   fallback: string,
   *   apply: (value: string, meta: { announce: boolean }) => void,
   *   onPersist?: (value: string) => void,
   * }} options
   */
  function initChipSwitch({
    rootId,
    attr,
    storageKey,
    normalize,
    fallback,
    apply,
    onPersist,
  }) {
    const root = document.getElementById(rootId);
    const initial = storageKey
      ? readStored(storageKey, normalize, fallback)
      : fallback;

    apply(initial, { announce: false });
    syncChipGroup(root, attr, initial);

    if (!root) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest?.(`[${attr}]`);
      if (!btn || !root.contains(btn)) return;
      const next = normalize(btn.getAttribute(attr));
      if (next == null) return;
      if (storageKey) writeStored(storageKey, next);
      onPersist?.(next);
      syncChipGroup(root, attr, next);
      apply(next, { announce: true });
    });
  }

  function applyRegionFilter() {
    const regionsVisible = document.documentElement.classList.contains("regions-enabled");
    filters().setRegionFilter?.(regionsVisible ? regionPreference : "all");
    window.dispatchEvent(new Event("timeline-debug-refresh"));
  }

  function onRegionsVisibilityChange() {
    syncChipGroup(document.getElementById("region-filter"), "data-region", regionPreference);
    applyRegionFilter();
  }

  function initRegionFilter() {
    const root = document.getElementById("region-filter");
    regionPreference = readStored(
      REGION_STORAGE_KEY,
      (v) =>
        v === "all" ||
        v === "northeast" ||
        v === "midwest" ||
        v === "south" ||
        v === "west"
          ? v
          : null,
      "all"
    );

    syncChipGroup(root, "data-region", regionPreference);
    applyRegionFilter();

    if (!root) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-region]");
      if (!btn || !root.contains(btn)) return;
      const next = btn.getAttribute("data-region") || "all";
      regionPreference =
        next === "northeast" ||
        next === "midwest" ||
        next === "south" ||
        next === "west" ||
        next === "all"
          ? next
          : "all";
      writeStored(REGION_STORAGE_KEY, regionPreference);
      syncChipGroup(root, "data-region", regionPreference);
      applyRegionFilter();
    });
  }

  function syncStateSort(root, mode, dir) {
    if (!root) return;
    root.querySelectorAll("[data-sort]").forEach((btn) => {
      const active = btn.getAttribute("data-sort") === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.dataset.dir = active ? dir : "asc";
      const label = btn.querySelector(".sort-btn-label")?.textContent || btn.dataset.sort;
      const dirLabel =
        btn.dataset.sort === "admitted"
          ? dir === "desc"
            ? "latest first"
            : "earliest first"
          : dir === "desc"
            ? "Z to A"
            : "A to Z";
      btn.setAttribute(
        "aria-label",
        active ? `${label}, ${dirLabel}. Click to reverse` : `Sort by ${label}`
      );
      btn.title = active ? `${dirLabel}. Click to reverse` : `Sort by ${label}`;
    });
  }

  function syncYearSort(btn, order) {
    if (!btn) return;
    const desc = order !== "ascending";
    btn.classList.add("is-active");
    btn.dataset.dir = desc ? "desc" : "asc";
    btn.setAttribute("aria-pressed", "true");
    const sense = desc ? "present first" : "past first";
    btn.title = `${sense}. Click to reverse`;
    btn.setAttribute("aria-label", `Years, ${sense}. Click to reverse`);
  }

  function initSortControls() {
    const stateRoot = document.getElementById("state-sort");
    const yearBtn = document.getElementById("year-sort");
    const mode = readStored(
      ORDER_STORAGE_KEY,
      (raw) => (raw === "admitted" || raw === "name" ? raw : null),
      "name"
    );
    const dir = readStored(
      ORDER_DIR_STORAGE_KEY,
      (raw) => (raw === "asc" || raw === "desc" ? raw : null),
      "asc"
    );
    const yearOrder = readStored(
      YEAR_ORDER_STORAGE_KEY,
      (raw) => (raw === "ascending" || raw === "descending" ? raw : null),
      "descending"
    );

    filters().setOrder?.(mode, dir);
    filters().setYearOrder?.(yearOrder, { announce: false });
    syncStateSort(stateRoot, mode, dir);
    syncYearSort(yearBtn, yearOrder);

    stateRoot?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-sort]");
      if (!btn || !stateRoot.contains(btn)) return;
      const key = btn.getAttribute("data-sort");
      if (key !== "name" && key !== "admitted") return;
      const current = filters().getOrderMode?.() || "name";
      const currentDir = filters().getOrderDir?.() || "asc";
      const nextDir = key === current ? (currentDir === "asc" ? "desc" : "asc") : "asc";
      writeStored(ORDER_STORAGE_KEY, key);
      writeStored(ORDER_DIR_STORAGE_KEY, nextDir);
      filters().setOrder?.(key, nextDir);
      syncStateSort(stateRoot, key, nextDir);
    });

    yearBtn?.addEventListener("click", () => {
      const current = filters().getYearOrder?.() || "descending";
      const next = current === "ascending" ? "descending" : "ascending";
      writeStored(YEAR_ORDER_STORAGE_KEY, next);
      filters().setYearOrder?.(next, { announce: true });
      syncYearSort(yearBtn, next);
    });
  }

  function initPaletteSwitch() {
    const root = document.getElementById("palette-switch");
    const initial = (() => {
      try {
        const stored =
          localStorage.getItem(PALETTE_STORAGE_KEY) ||
          localStorage.getItem(PALETTE_STORAGE_KEY_LEGACY);
        if (PALETTES.has(stored)) return stored;
      } catch {
        /* ignore */
      }
      return "muted";
    })();

    document.documentElement.dataset.palette = initial;
    syncChipGroup(root, "data-palette", initial);

    if (!root) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-palette]");
      if (!btn || !root.contains(btn)) return;
      const next = btn.getAttribute("data-palette");
      if (!PALETTES.has(next)) return;
      writeStored(PALETTE_STORAGE_KEY, next);
      try {
        localStorage.removeItem(PALETTE_STORAGE_KEY_LEGACY);
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.palette = next;
      syncChipGroup(root, "data-palette", next);
      window.dispatchEvent(
        new CustomEvent("timeline-palette-change", { detail: { palette: next } })
      );
    });
  }

  function initTimeRangeFilter() {
    const root = document.getElementById("time-range-filter");
    const geo = () => window.TimelineGeometry || {};
    const order = () => geo().TIME_RANGE_ORDER || [1700, 1800, 1900, 2000];

    function spanOf(value) {
      return geo().timeRangeSpan?.(value) ?? null;
    }

    function formatSpan(lo, hi) {
      return geo().formatTimeRangeFilter?.(lo, hi) || "all";
    }

    // The axis is one continuous run of years, so the selection is a span:
    // click outside it to grow, click an end to shrink, click the middle to
    // keep only that range, click All (or the last range) to clear.
    function nextSelection(current, clicked) {
      if (clicked === "all") return "all";
      const years = order();
      const c = Number(clicked);
      if (!years.includes(c)) return current;
      const span = spanOf(current);
      if (!span) return String(c);
      if (c < span.lo || c > span.hi) return formatSpan(Math.min(span.lo, c), Math.max(span.hi, c));
      if (span.lo === span.hi) return "all";
      if (c === span.lo) return formatSpan(years[years.indexOf(c) + 1], span.hi);
      if (c === span.hi) return formatSpan(span.lo, years[years.indexOf(c) - 1]);
      return String(c);
    }

    function timeRangeName(year) {
      return `${year}s`;
    }

    function chipTitle(value, key) {
      if (key === "all") return "Whole timeline";
      const name = timeRangeName(key);
      const span = spanOf(value);
      if (!span) return `Show the ${name}`;
      const c = Number(key);
      if (c < span.lo || c > span.hi) return `Extend through the ${name}`;
      if (span.lo === span.hi) return "Show the whole timeline";
      if (c === span.lo || c === span.hi) return `Remove the ${name}`;
      return `Show only the ${name}`;
    }

    function sync(value) {
      if (!root) return;
      const span = spanOf(value);
      root.querySelectorAll("[data-time-range]").forEach((btn) => {
        const key = btn.getAttribute("data-time-range");
        const active =
          key === "all" ? !span : span && Number(key) >= span.lo && Number(key) <= span.hi;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.title = chipTitle(value, key);
      });
    }

    function commit(next) {
      const normalized = geo().normalizeTimeRangeFilter?.(next) || next;
      writeStored(TIME_RANGE_STORAGE_KEY, normalized);
      sync(normalized);
      filters().setTimeRangeFilter?.(normalized);
    }

    const initial = readStored(
      TIME_RANGE_STORAGE_KEY,
      (raw) => {
        const normalized = geo().normalizeTimeRangeFilter?.(raw);
        return normalized && normalized !== "all" ? normalized : raw === "all" ? "all" : null;
      },
      "all"
    );
    const starting = geo().normalizeTimeRangeFilter?.(initial) || "all";
    filters().setTimeRangeFilter?.(starting);
    sync(starting);

    if (!root) return;

    let dragAnchor = null;
    let dragged = false;

    root.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest?.("[data-time-range]");
      if (!btn || !root.contains(btn)) return;
      if (btn.getAttribute("data-time-range") === "all") {
        dragAnchor = null;
        dragged = false;
        return;
      }
      dragAnchor = btn.getAttribute("data-time-range");
      dragged = false;
    });

    root.addEventListener("pointerover", (e) => {
      if (!dragAnchor || e.buttons !== 1) return;
      const btn = e.target.closest?.("[data-time-range]");
      if (!btn || !root.contains(btn)) return;
      const key = btn.getAttribute("data-time-range");
      if (!key || key === "all") return;
      if (key === dragAnchor && !dragged) return;
      dragged = true;
      commit(formatSpan(dragAnchor, key));
    });

    root.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-time-range]");
      if (!btn || !root.contains(btn)) return;
      if (dragged) {
        dragged = false;
        dragAnchor = null;
        return;
      }
      dragAnchor = null;
      const clicked = btn.getAttribute("data-time-range") || "all";
      commit(nextSelection(geo().getTimeRangeFilter?.() || "all", clicked));
    });
  }

  function init() {
    initChipSwitch({
      rootId: "orientation-switch",
      attr: "data-orient",
      storageKey: ORIENT_STORAGE_KEY,
      fallback: "vertical",
      normalize: (raw) =>
        raw === "horizontal" || raw === "vertical" ? raw : null,
      apply: (orient, { announce }) => {
        filters().setOrientation?.(orient, { announce });
        syncChipGroup(document.getElementById("orientation-switch"), "data-orient", orient);
      },
    });

    initSortControls();

    initChipSwitch({
      rootId: "color-mode-filter",
      attr: "data-color-mode",
      storageKey: COLOR_MODE_STORAGE_KEY,
      fallback: "party",
      normalize: (raw) => (raw === "party" || raw === "person" ? raw : null),
      apply: (mode) => {
        document.documentElement.dataset.colorMode = mode;
        filters().setColorMode?.(mode);
      },
    });

    initPaletteSwitch();
    initRegionFilter();
    initTimeRangeFilter();
  }

  window.TimelineFilterControls = {
    init,
    onRegionsVisibilityChange,
  };
})();
