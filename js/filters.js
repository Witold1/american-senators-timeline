/**
 * Search and view-state for the timeline: order, region, color, time range,
 * orientation, year-order. Time-range/year-order math still lives in geometry.js;
 * this module is the public API chips and debug should call.
 */
(function () {
  const REGION_LABELS = {
    northeast: "Northeast",
    midwest: "Midwest",
    south: "South",
    west: "West",
  };

  let searchTimer = 0;
  let seatById = null;
  let searchHaystackBySeat = null;
  let orderMode = "name";
  let orderDir = "asc";
  let regionFilter = "all";
  let colorMode = "party";
  let timelineEl = null;
  let searchInput = null;
  let bound = false;

  function geo() {
    return window.TimelineGeometry || {};
  }

  function timelineData() {
    return window.TIMELINE_DATA || {};
  }

  function seats() {
    return timelineData().seats || [];
  }

  function ensureEls() {
    if (!timelineEl) timelineEl = document.getElementById("timeline");
    if (!searchInput) searchInput = document.getElementById("search");
  }

  function rerender() {
    if (typeof window.renderTimeline === "function") window.renderTimeline();
  }

  function getOrderMode() {
    return orderMode;
  }

  function getOrderDir() {
    return orderDir === "desc" ? "desc" : "asc";
  }

  function setOrder(mode, dir) {
    const nextMode = mode === "admitted" ? "admitted" : "name";
    const nextDir = dir === "desc" ? "desc" : "asc";
    if (nextMode === orderMode && nextDir === orderDir) return;
    orderMode = nextMode;
    orderDir = nextDir;
    rerender();
  }

  function setOrderMode(mode) {
    setOrder(mode, orderDir);
  }

  function getRegionFilter() {
    return regionFilter;
  }

  function setRegionFilter(region) {
    const next =
      region === "northeast" ||
      region === "midwest" ||
      region === "south" ||
      region === "west"
        ? region
        : "all";
    if (next === regionFilter) return;
    regionFilter = next;
    applyFilters();
  }

  function getColorMode() {
    return colorMode;
  }

  function setColorMode(mode) {
    const next = mode === "person" ? "person" : "party";
    if (next === colorMode) return;
    colorMode = next;
    document.documentElement.dataset.colorMode = next;
    window.TimelineInteraction?.clearBarSelection?.();
    rerender();
  }

  function getTimeRangeFilter() {
    return geo().getTimeRangeFilter?.() || "all";
  }

  function setTimeRangeFilter(range) {
    const changed = geo().setTimeRangeFilter?.(range);
    if (changed === false) return;
    rerender();
    window.dispatchEvent(
      new CustomEvent("timeline-time-range-change", {
        detail: { timeRange: getTimeRangeFilter() },
      })
    );
  }

  function getOrientation() {
    return document.documentElement.dataset.orientation === "horizontal"
      ? "horizontal"
      : "vertical";
  }

  function setOrientation(orient, { announce = true } = {}) {
    const next = orient === "horizontal" ? "horizontal" : "vertical";
    document.documentElement.dataset.orientation = next;
    // Each orientation resolves --axis-h and --year-label-w differently, so the
    // cached values would describe the layout we just left.
    geo().invalidateLayoutCache?.();
    if (announce) {
      window.dispatchEvent(
        new CustomEvent("timeline-orientation-change", {
          detail: { orientation: next },
        })
      );
    }
  }

  function getYearOrder() {
    return geo().getYearOrder?.() || "descending";
  }

  function setYearOrder(order, { announce = true } = {}) {
    const next = order === "ascending" ? "ascending" : "descending";
    geo().setYearOrder?.(next);
    document.documentElement.dataset.yearOrder = next;
    if (announce) {
      window.dispatchEvent(
        new CustomEvent("timeline-year-order-change", {
          detail: { yearOrder: next },
        })
      );
    }
  }

  function resetSeatIndexes() {
    seatById = null;
    searchHaystackBySeat = null;
  }

  function ensureSeatIndexes() {
    if (seatById) return;
    seatById = new Map();
    searchHaystackBySeat = new Map();
    for (const seat of seats()) {
      seatById.set(seat.id, seat);
      const haystack = [
        seat.name,
        seat.state,
        seat.flag,
        seat.region,
        REGION_LABELS[seat.region],
        seat.admitted,
        ...seat.rulers.map((r) => `${r.name} ${r.party || r.role || ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      searchHaystackBySeat.set(seat.id, haystack);
    }
  }

  function clearBarFocusClasses() {
    ensureEls();
    timelineEl?.querySelectorAll(".bar.focused, .bar.dimmed").forEach((bar) => {
      bar.classList.remove("focused", "dimmed");
    });
  }

  function applyFilters() {
    ensureEls();
    if (!timelineEl) return;

    ensureSeatIndexes();
    const q = searchInput?.value.trim().toLowerCase() || "";
    const region = regionFilter;

    timelineEl.querySelectorAll(".state-group").forEach((groupEl) => {
      const seatEls = groupEl.querySelectorAll(".country-row");
      const regionOk = region === "all" || groupEl.dataset.region === region;
      let searchOk = !q;

      if (q) {
        for (const row of seatEls) {
          const haystack = searchHaystackBySeat.get(row.dataset.seatId) || "";
          const seatMatch = haystack.includes(q);
          if (seatMatch) searchOk = true;

          const bars = row.querySelectorAll(".bar");
          const barMatches = [...bars].map((bar) =>
            (bar.dataset.search || "").includes(q)
          );
          const anyBar = barMatches.some(Boolean);
          bars.forEach((bar, index) => {
            if (anyBar) {
              bar.classList.toggle("focused", barMatches[index]);
              bar.classList.toggle("dimmed", !barMatches[index]);
            } else if (seatMatch) {
              bar.classList.remove("focused", "dimmed");
            } else {
              bar.classList.remove("focused");
              bar.classList.add("dimmed");
            }
          });
        }
      }

      groupEl.classList.toggle("hidden", !(regionOk && searchOk));
    });

    if (!q) clearBarFocusClasses();
  }

  function scheduleFilters() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
  }

  function bind() {
    if (bound) return;
    ensureEls();
    if (!searchInput) return;
    bound = true;
    searchInput.addEventListener("input", scheduleFilters);
  }

  window.TimelineFilters = {
    REGION_LABELS,
    getOrderMode,
    setOrderMode,
    setOrder,
    getOrderDir,
    getRegionFilter,
    setRegionFilter,
    getColorMode,
    setColorMode,
    getTimeRangeFilter,
    setTimeRangeFilter,
    getOrientation,
    setOrientation,
    getYearOrder,
    setYearOrder,
    applyFilters,
    scheduleFilters,
    ensureSeatIndexes,
    resetSeatIndexes,
    bind,
  };
})();
