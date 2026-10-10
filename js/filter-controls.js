/**
 * Chip-button UI for view/filter state. Calls TimelineFilters (and palette dataset).
 * Region chips are shown when the dataset view includes a region filter.
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
  const PALETTES = new Set(["muted", "vivid"]);

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

  /** Hash defaults match data/catalog.json until that file has loaded. */
  const DATASET_VIEW = {
    "soviet-states": {
      orientation: "horizontal",
      yearOrder: "ascending",
    },
    "american-senators": { orientation: "vertical", yearOrder: "descending" },
  };

  function activeDatasetHash() {
    const fromData = window.TIMELINE_DATA?.datasetHash;
    if (fromData) return String(fromData).replace(/^#/, "");
    return location.hash.replace(/^#/, "") || "american-senators";
  }

  function resolveDatasetView(entry) {
    const hash = String(entry?.hash || activeDatasetHash()).replace(/^#/, "") || "american-senators";
    const known = DATASET_VIEW[hash] || {
      orientation: "vertical",
      yearOrder: "descending",
    };
    const orientation =
      entry?.orientation === "horizontal" || entry?.orientation === "vertical"
        ? entry.orientation
        : known.orientation;
    const yearOrder =
      entry?.yearOrder === "ascending" || entry?.yearOrder === "descending"
        ? entry.yearOrder
        : known.yearOrder;
    const lockOrientation =
      entry?.lockOrientation === true || known.lockOrientation === true;
    return {
      hash,
      lockOrientation,
      orientation: lockOrientation
        ? orientation
        : readStored(
            `timeline-orientation:${hash}`,
            (raw) => (raw === "horizontal" || raw === "vertical" ? raw : null),
            orientation
          ),
      yearOrder: readStored(
        `timeline-year-order:${hash}`,
        (raw) => (raw === "ascending" || raw === "descending" ? raw : null),
        yearOrder
      ),
    };
  }

  function syncOrientationLock(locked) {
    const layout = document.getElementById("layout-control");
    if (layout) {
      layout.hidden = !!locked;
      layout.setAttribute("aria-hidden", locked ? "true" : "false");
    }
    document.documentElement.dataset.orientationLocked = locked ? "true" : "false";
    if (locked) {
      try {
        localStorage.removeItem(`timeline-orientation:${activeDatasetHash()}`);
      } catch {
        /* ignore */
      }
    }
  }

  function applyDatasetView(entry) {
    const view = resolveDatasetView(entry);
    filters().setOrientation?.(view.orientation, { announce: false });
    filters().setYearOrder?.(view.yearOrder, { announce: false });
    syncChipGroup(
      document.getElementById("orientation-switch"),
      "data-orient",
      view.orientation
    );
    syncYearSort(document.getElementById("year-sort"), view.yearOrder);
    syncOrientationLock(view.lockOrientation);
    window.TimelineViewChrome?.apply?.();
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
    if (!regionsVisible) {
      filters().setRegionFilter?.("all");
    }
    window.TimelineViewChrome?.syncRegionChips?.();
    window.dispatchEvent(new Event("timeline-debug-refresh"));
  }

  function onRegionsVisibilityChange() {
    applyRegionFilter();
    if (document.documentElement.classList.contains("regions-enabled")) {
      window.TimelineViewChrome?.syncRegionChips?.();
    }
  }

  function initRegionFilter() {
    const root = document.getElementById("region-filter");
    const stored = readStored(
      REGION_STORAGE_KEY,
      (v) => {
        if (!v || v === "all") return "all";
        // Legacy single id or comma-separated multi.
        return String(v);
      },
      "all"
    );
    if (stored === "all") filters().setRegionFilter?.("all");
    else filters().setRegionFilter?.(stored.split(",").map((s) => s.trim()).filter(Boolean));
    window.TimelineViewChrome?.syncRegionChips?.();
    applyRegionFilter();

    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-region]");
      if (!btn || !root.contains(btn)) return;
      const next = btn.getAttribute("data-region") || "all";
      const multi = root.dataset.multi !== "0";
      if (next === "all") filters().setRegionFilter?.("all");
      else filters().setRegionFilter?.(next, { toggle: multi });
      const value = filters().getRegionFilter?.() || "all";
      writeStored(REGION_STORAGE_KEY, value);
      window.TimelineViewChrome?.syncRegionChips?.();
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
      const dateSort =
        btn.dataset.sort === "admitted" ||
        btn.dataset.sort === "sovereignty" ||
        btn.dataset.sort === "independence";
      const dirLabel = dateSort
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

  function allowedSortIds() {
    const sorts = window.TIMELINE_DATA?.view?.sorts;
    if (Array.isArray(sorts) && sorts.length) {
      return new Set(sorts.map((s) => s.id).filter(Boolean));
    }
    return null;
  }

  function initSortControls() {
    const stateRoot = document.getElementById("state-sort");
    const yearBtn = document.getElementById("year-sort");
    const mode = readStored(
      ORDER_STORAGE_KEY,
      (raw) => (raw ? String(raw) : null),
      "name"
    );
    const dir = readStored(
      ORDER_DIR_STORAGE_KEY,
      (raw) => (raw === "asc" || raw === "desc" ? raw : null),
      "asc"
    );
    const yearOrder = resolveDatasetView().yearOrder;

    filters().setOrder?.(mode, dir);
    filters().setYearOrder?.(yearOrder, { announce: false });
    syncStateSort(stateRoot, mode, dir);
    syncYearSort(yearBtn, yearOrder);

    if (stateRoot && stateRoot.dataset.bound !== "1") {
      stateRoot.dataset.bound = "1";
      stateRoot.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-sort]");
        if (!btn || !stateRoot.contains(btn)) return;
        const key = btn.getAttribute("data-sort");
        if (!key) return;
        const allowed = allowedSortIds();
        if (allowed && !allowed.has(key)) return;
        const current = filters().getOrderMode?.() || "name";
        const currentDir = filters().getOrderDir?.() || "asc";
        const nextDir = key === current ? (currentDir === "asc" ? "desc" : "asc") : "asc";
        writeStored(ORDER_STORAGE_KEY, key);
        writeStored(ORDER_DIR_STORAGE_KEY, nextDir);
        filters().setOrder?.(key, nextDir);
        syncStateSort(stateRoot, key, nextDir);
      });
    }

    yearBtn?.addEventListener("click", () => {
      const current = filters().getYearOrder?.() || "descending";
      const next = current === "ascending" ? "descending" : "ascending";
      writeStored(`timeline-year-order:${activeDatasetHash()}`, next);
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
        if (stored) writeStored(PALETTE_STORAGE_KEY, "muted");
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
    const order = () => geo().getTimeRangeOrder?.() || geo().TIME_RANGE_ORDER || [1700, 1800, 1900, 2000];

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
    geo().refreshTimeRanges?.();
    const starting = geo().normalizeTimeRangeFilter?.(initial) || "all";
    filters().setTimeRangeFilter?.(starting);
    sync(starting);

    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

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

    window.TimelineFilterControls.syncTimeRangeChips = sync;
  }

  function init() {
    initChipSwitch({
      rootId: "orientation-switch",
      attr: "data-orient",
      storageKey: null,
      fallback: resolveDatasetView().orientation,
      normalize: (raw) =>
        raw === "horizontal" || raw === "vertical" ? raw : null,
      apply: (orient, { announce }) => {
        const view = resolveDatasetView();
        if (view.lockOrientation) orient = view.orientation;
        filters().setOrientation?.(orient, { announce });
        syncChipGroup(document.getElementById("orientation-switch"), "data-orient", orient);
      },
      onPersist: (orient) => {
        if (resolveDatasetView().lockOrientation) return;
        writeStored(`timeline-orientation:${activeDatasetHash()}`, orient);
      },
    });

    initSortControls();

    initChipSwitch({
      rootId: "color-mode-filter",
      attr: "data-color-mode",
      storageKey: COLOR_MODE_STORAGE_KEY,
      fallback: "party",
      normalize: (raw) => (raw ? String(raw) : null),
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
    applyDatasetView,
    resolveDatasetView,
    syncStateSort,
    syncTimeRangeChips: () => {},
    applyRegionFilter,
  };
})();
