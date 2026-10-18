/**
 * Where a date sits on the chart, and how wide or tall each year is. Horizontal or vertical.
 */
(function () {
  /** Mid-month default when a term has no end day (bars + service-years agree). */
  const DEFAULT_END_DAY = 15;

  let themeVarsCache = null;
  /** Horizontal track width when the chart is stretched to the panel. */
  let filledTrackWidth = null;

  let TIME_RANGE_ORDER = [1700, 1800, 1900, 2000];
  let TIME_RANGE_BOUNDS = {
    1700: { start: 1700, end: 1799 },
    1800: { start: 1800, end: 1899 },
    1900: { start: 1900, end: 1999 },
    2000: { start: 2000, end: 2099 },
  };

  function dataBounds() {
    const data = window.TIMELINE_DATA || {};
    return {
      start: data.TIMELINE_START,
      end: data.TIMELINE_END,
    };
  }

  /** Centuries for long spans, decades when the chart covers ≤80 years. */
  function computeTimeRanges(start, end) {
    const s = Number(start);
    const e = Number(end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) {
      return {
        order: [1700, 1800, 1900, 2000],
        bounds: {
          1700: { start: 1700, end: 1799 },
          1800: { start: 1800, end: 1899 },
          1900: { start: 1900, end: 1999 },
          2000: { start: 2000, end: 2099 },
        },
      };
    }
    const step = e - s <= 80 ? 10 : 100;
    const lo = Math.floor(s / step) * step;
    const hi = Math.floor(e / step) * step;
    const order = [];
    const bounds = {};
    for (let y = lo; y <= hi; y += step) {
      order.push(y);
      bounds[y] = { start: y, end: y + step - 1 };
    }
    return { order, bounds };
  }

  function refreshTimeRanges() {
    const { start, end } = dataBounds();
    const next = computeTimeRanges(start, end);
    TIME_RANGE_ORDER = next.order;
    TIME_RANGE_BOUNDS = next.bounds;
    const current = getTimeRangeFilter();
    const normalized = normalizeTimeRangeFilter(current);
    if (normalized !== current) setTimeRangeFilter(normalized);
    return TIME_RANGE_ORDER;
  }

  function getTimeRangeOrder() {
    return TIME_RANGE_ORDER;
  }

  function formatTimeRangeFilter(lo, hi) {
    const a = Math.min(Number(lo), Number(hi));
    const b = Math.max(Number(lo), Number(hi));
    if (!TIME_RANGE_BOUNDS[a] || !TIME_RANGE_BOUNDS[b]) return "all";
    if (a === TIME_RANGE_ORDER[0] && b === TIME_RANGE_ORDER[TIME_RANGE_ORDER.length - 1]) {
      return "all";
    }
    if (a === b) return String(a);
    return `${a}-${b}`;
  }

  /** @returns {"all"|string} */
  function normalizeTimeRangeFilter(raw) {
    if (raw == null || raw === "all") return "all";
    const text = String(raw);
    if (TIME_RANGE_BOUNDS[text]) return text;
    const parts = text.split("-");
    if (parts.length !== 2) return "all";
    return formatTimeRangeFilter(parts[0], parts[1]);
  }

  /** Inclusive time-range span, or null for the full timeline. */
  function timeRangeSpan(value = getTimeRangeFilter()) {
    const normalized = normalizeTimeRangeFilter(value);
    if (normalized === "all") return null;
    const [a, b] = normalized.split("-");
    const lo = Number(a);
    return { lo, hi: b == null ? lo : Number(b) };
  }

  function viewFilters() {
    return window.TimelineFilters || {};
  }

  /** "all", one century ("1800"), or an inclusive span ("1800-2000"). Owned by the page filters. */
  function getTimeRangeFilter() {
    return viewFilters().getTimeRangeFilter?.() || "all";
  }

  /** Layout code writes through here without rebuilding. The chip control announces and redraws. */
  function setTimeRangeFilter(range) {
    const next = normalizeTimeRangeFilter(range);
    if (next === getTimeRangeFilter()) return false;
    if (viewFilters().setTimeRangeFilter) {
      return viewFilters().setTimeRangeFilter(next, { announce: false }) !== false;
    }
    return false;
  }

  function getYearOrder() {
    const fromView = viewFilters().getYearOrder?.();
    if (fromView === "ascending" || fromView === "descending") return fromView;
    return document.documentElement.dataset.yearOrder === "ascending"
      ? "ascending"
      : "descending";
  }

  function setYearOrder(order) {
    const before = getYearOrder();
    viewFilters().setYearOrder?.(order, { announce: false });
    return getYearOrder() !== before;
  }

  function isYearAscending() {
    return getYearOrder() === "ascending";
  }

  /** True when a year/month/day mark falls inside the years currently on screen. */
  function dateInsideTimeline(date) {
    const year = Number(date?.year);
    if (!Number.isFinite(year)) return false;
    const { start, end } = timelineBounds();
    if (start == null || end == null) return false;
    return year >= start && year <= end;
  }

  function timelineBounds() {
    const full = dataBounds();
    const span = timeRangeSpan();
    if (!span || full.start == null || full.end == null) return full;
    const loBound = TIME_RANGE_BOUNDS[span.lo];
    const hiBound = TIME_RANGE_BOUNDS[span.hi];
    if (!loBound || !hiBound) return full;
    return {
      start: Math.max(full.start, loBound.start),
      end: Math.min(full.end, hiBound.end),
    };
  }

  function getOrientation() {
    return document.documentElement.dataset.orientation === "horizontal"
      ? "horizontal"
      : "vertical";
  }

  function readThemeVars() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      yearHeight: parseFloat(read("--year-h")) || 24,
      seatWidth: parseFloat(read("--seat-w")) || 24,
      labelHeight: parseFloat(read("--label-h")) || 144,
      yearLabelWidth: parseFloat(read("--year-label-w")) || 64,
      yearWidth: parseFloat(read("--year-w")) || 20,
      seatHeight: parseFloat(read("--seat-h")) || 24,
      labelWidth: parseFloat(read("--label-w")) || 148,
      axisHeight: parseFloat(read("--axis-h")) || 28,
    };
  }

  function themeVars() {
    if (!themeVarsCache) themeVarsCache = readThemeVars();
    return themeVarsCache;
  }

  function yearFractionFromStart(year, month = 1, day = 1) {
    const { start } = timelineBounds();
    return year + (month - 1) / 12 + (day - 1) / 365 - start;
  }

  function getMetrics() {
    const { start, end } = timelineBounds();
    const vars = themeVars();
    const years = end - start + 1;
    const orientation = getOrientation();

    if (orientation === "horizontal") {
      const natural = years * vars.yearWidth;
      const trackWidth =
        filledTrackWidth && filledTrackWidth > natural ? filledTrackWidth : natural;
      return {
        orientation,
        yearOrder: getYearOrder(),
        yearWidth: trackWidth / years,
        seatHeight: vars.seatHeight,
        labelWidth: vars.labelWidth,
        axisHeight: vars.axisHeight,
        trackWidth,
      };
    }

    return {
      orientation,
      yearOrder: getYearOrder(),
      yearHeight: vars.yearHeight,
      seatWidth: vars.seatWidth,
      labelHeight: vars.labelHeight,
      yearLabelWidth: vars.yearLabelWidth,
      trackHeight: years * vars.yearHeight,
    };
  }

  /** Vertical: ascending = past at top; descending = present at top. */
  function yearToY(year, month = 1, day = 1, metrics = getMetrics()) {
    const fromStart = yearFractionFromStart(year, month, day);
    const trackHeight = metrics.trackHeight ?? getMetrics().trackHeight;
    const yearHeight = metrics.yearHeight ?? getMetrics().yearHeight;
    const y = fromStart * yearHeight;
    return isYearAscending() ? y : trackHeight - y;
  }

  /** Horizontal: ascending = past at left; descending = present at left. */
  function yearToX(year, month = 1, day = 1, metrics = getMetrics()) {
    const fromStart = yearFractionFromStart(year, month, day);
    const yearWidth = metrics.yearWidth ?? getMetrics().yearWidth;
    const trackWidth = metrics.trackWidth ?? getMetrics().trackWidth;
    const x = fromStart * yearWidth;
    return isYearAscending() ? x : trackWidth - x;
  }

  function dateLabel(startYear, endYear, startMeta = {}, endMeta = {}) {
    const { end: dataEnd } = dataBounds();
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    function formatPoint(year, meta = {}) {
      const month = meta.month;
      const day = meta.day;
      if (month) {
        const mon = months[month - 1] || "";
        if (day && day !== 1) return `${mon} ${day}, ${year}`;
        return `${mon} ${year}`;
      }
      return String(year);
    }

    const startStr = formatPoint(startYear, startMeta);
    if (endYear >= dataEnd) return `${startStr} to present`;
    if (
      startYear === endYear &&
      !startMeta.month &&
      !endMeta.month
    ) {
      return String(startYear);
    }
    const endStr = formatPoint(endYear, endMeta);
    return `${startStr} to ${endStr}`;
  }

  function leaderDateLabel(leader) {
    const span = leader.reign || leader;
    return dateLabel(
      span.start,
      span.end,
      { month: span.startMonth, day: span.startDay },
      { month: span.endMonth, day: span.endDay }
    );
  }

  function leaderServiceSpan(leader) {
    const { end: timelineEnd } = dataBounds();
    const span = leader.reign || leader;
    const start = new Date(
      span.start,
      (span.startMonth || 1) - 1,
      span.startDay || 1
    );

    let end;
    if (span.end >= timelineEnd) {
      end = new Date();
    } else {
      end = new Date(
        span.end,
        (span.endMonth || 12) - 1,
        span.endDay || DEFAULT_END_DAY
      );
    }

    const ms = Math.max(0, end.getTime() - start.getTime());
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      years: ms / (365.25 * dayMs),
      days: Math.round(ms / dayMs),
    };
  }

  function yearsPhrase(years) {
    if (years < 0.08) return "less than a month";
    if (years < 1) {
      const months = Math.max(1, Math.round(years * 12));
      return months === 1 ? "1 month" : `${months} months`;
    }
    const rounded = Math.round(years * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
      const n = Math.round(rounded);
      return n === 1 ? "1 year" : `${n} years`;
    }
    return `${rounded.toFixed(1)} years`;
  }

  function daysPhrase(days) {
    return days === 1 ? "1 day" : `${days.toLocaleString("en-US")} days`;
  }

  function serviceFiguresLabel(span) {
    return `${yearsPhrase(span.years)} or ${daysPhrase(span.days)}`;
  }

  function leaderYearsServedLabel(leader) {
    return yearsPhrase(leaderServiceSpan(leader).years);
  }

  function leaderDaysServedLabel(leader) {
    return daysPhrase(leaderServiceSpan(leader).days);
  }

  let termIndex = null;

  function personKey(leader) {
    if (leader.bioguide) return `id:${leader.bioguide}`;
    return `name:${String(leader.name || "").trim().toLowerCase()}`;
  }

  function termIdentity(leader) {
    const span = leader.reign || leader;
    return [
      personKey(leader),
      span.start,
      span.startMonth || 1,
      span.startDay || 1,
      span.end,
      span.endMonth || 12,
      span.endDay || DEFAULT_END_DAY,
    ].join("|");
  }

  function termsForLeader(leader) {
    if (!termIndex) {
      termIndex = new Map();
      const seats = (window.TIMELINE_DATA || {}).seats || [];
      for (const seat of seats) {
        for (const ruler of seat.rulers || []) {
          const key = personKey(ruler);
          const id = termIdentity(ruler);
          const list = termIndex.get(key) || [];
          if (!list.some((term) => termIdentity(term) === id)) {
            list.push(ruler);
          }
          termIndex.set(key, list);
        }
      }
    }
    return termIndex.get(personKey(leader)) || [leader];
  }

  function isCurrentTerm(leader) {
    const { end } = dataBounds();
    const span = leader.reign || leader;
    return end != null && span.end >= end;
  }

  function sumServiceSpans(leaders) {
    const days = leaders.reduce((sum, leader) => sum + leaderServiceSpan(leader).days, 0);
    return { years: days / 365.25, days };
  }

  function leaderServiceSummary(leader) {
    const terms = termsForLeader(leader);
    const current = terms.find(isCurrentTerm) || null;
    return {
      hovered: leaderServiceSpan(leader),
      hoveredIsCurrent: isCurrentTerm(leader),
      current,
      currentFigures: current ? leaderServiceSpan(current) : null,
      total: sumServiceSpans(terms),
    };
  }

  /** Clears cached layout CSS vars (metrics). */
  /**
   * Congress terms that overlap the chart. The 1st Congress begins March 4, 1789.
   * Each term runs two years until the 73rd, which the Twentieth Amendment ends
   * on January 3, 1935. From the 74th Congress onward, terms begin January 3.
   * The end date is the day the next Congress begins.
   */
  function congressTerms(timelineEndYear) {
    const terms = [];
    for (let n = 1; n <= 73; n++) {
      const year = 1789 + (n - 1) * 2;
      terms.push({
        number: n,
        startYear: year,
        startMonth: 3,
        startDay: 4,
        endYear: n === 73 ? 1935 : year + 2,
        endMonth: n === 73 ? 1 : 3,
        endDay: n === 73 ? 3 : 4,
      });
    }
    let year = 1935;
    let n = 74;
    const limit = timelineEndYear == null ? year : timelineEndYear + 1;
    while (year <= limit) {
      terms.push({
        number: n,
        startYear: year,
        startMonth: 1,
        startDay: 3,
        endYear: year + 2,
        endMonth: 1,
        endDay: 3,
      });
      year += 2;
      n += 1;
    }
    return terms;
  }

  function congressOrdinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }

  function setFilledTrackWidth(px) {
    const next = Number(px);
    filledTrackWidth = Number.isFinite(next) && next > 0 ? next : null;
  }

  /**
   * @param {{ keepTrack?: boolean }} [options]
   *   keepTrack leaves a stretched horizontal axis in place so a color-only
   *   refresh can compare metrics without forcing a second layout.
   */
  function invalidateLayoutCache(options) {
    themeVarsCache = null;
    if (!options?.keepTrack) filledTrackWidth = null;
  }

  /** Clears layout + color caches (theme changes). */
  function invalidateCaches() {
    invalidateLayoutCache();
    window.TimelinePalette?.invalidate();
  }

  window.TimelineGeometry = {
    DEFAULT_END_DAY,
    getOrientation,
    getMetrics,
    setFilledTrackWidth,
    timelineBounds,
    dateInsideTimeline,
    dataBounds,
    getTimeRangeFilter,
    setTimeRangeFilter,
    normalizeTimeRangeFilter,
    formatTimeRangeFilter,
    timeRangeSpan,
    refreshTimeRanges,
    getTimeRangeOrder,
    get TIME_RANGE_ORDER() {
      return TIME_RANGE_ORDER;
    },
    getYearOrder,
    setYearOrder,
    yearToY,
    yearToX,
    congressTerms,
    congressOrdinal,
    dateLabel,
    leaderDateLabel,
    termIdentity,
    personKey,
    leaderYearsServedLabel,
    leaderDaysServedLabel,
    serviceFiguresLabel,
    leaderServiceSummary,
    invalidateLayoutCache,
    invalidateCaches,
    /** @deprecated use invalidateCaches / invalidateLayoutCache */
    invalidateRulerPalette: invalidateCaches,
  };

  window.getTimelineMetrics = getMetrics;
})();
