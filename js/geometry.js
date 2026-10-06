/**
 * Timeline metrics and year→pixel mapping.
 * Vertical/horizontal layouts; year axis ascending (past first) or descending (present first).
 * Bar colors live in palette.js (TimelinePalette).
 */
(function () {
  /** Mid-month default when a term has no end day (bars + service-years agree). */
  const DEFAULT_END_DAY = 15;

  let themeVarsCache = null;
  /** "all", one range ("1800"), or an inclusive span ("1800-2000"). */
  let timeRangeFilter = "all";
  /** "descending" = present first along the axis; "ascending" = past first. */
  let yearOrder = "descending";

  const TIME_RANGE_ORDER = Object.freeze([1700, 1800, 1900, 2000]);

  const TIME_RANGE_BOUNDS = {
    1700: { start: 1700, end: 1799 },
    1800: { start: 1800, end: 1899 },
    1900: { start: 1900, end: 1999 },
    2000: { start: 2000, end: 2099 },
  };

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
  function timeRangeSpan(value = timeRangeFilter) {
    const normalized = normalizeTimeRangeFilter(value);
    if (normalized === "all") return null;
    const [a, b] = normalized.split("-");
    const lo = Number(a);
    return { lo, hi: b == null ? lo : Number(b) };
  }

  function dataBounds() {
    const data = window.TIMELINE_DATA || {};
    return {
      start: data.TIMELINE_START,
      end: data.TIMELINE_END,
    };
  }

  function getTimeRangeFilter() {
    return timeRangeFilter;
  }

  function setTimeRangeFilter(range) {
    const next = normalizeTimeRangeFilter(range);
    if (next === timeRangeFilter) return false;
    timeRangeFilter = next;
    return true;
  }

  function timelineBounds() {
    const full = dataBounds();
    const span = timeRangeSpan();
    if (!span || full.start == null || full.end == null) return full;
    return {
      start: Math.max(full.start, TIME_RANGE_BOUNDS[span.lo].start),
      end: Math.min(full.end, TIME_RANGE_BOUNDS[span.hi].end),
    };
  }

  function getYearOrder() {
    return yearOrder;
  }

  function setYearOrder(order) {
    const next = order === "ascending" ? "ascending" : "descending";
    const changed = next !== yearOrder;
    yearOrder = next;
    document.documentElement.dataset.yearOrder = next;
    return changed;
  }

  function isYearAscending() {
    return yearOrder === "ascending";
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
      return {
        orientation,
        yearOrder,
        yearWidth: vars.yearWidth,
        seatHeight: vars.seatHeight,
        labelWidth: vars.labelWidth,
        axisHeight: vars.axisHeight,
        trackWidth: years * vars.yearWidth,
      };
    }

    return {
      orientation,
      yearOrder,
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
    return dateLabel(
      leader.start,
      leader.end,
      { month: leader.startMonth, day: leader.startDay },
      { month: leader.endMonth, day: leader.endDay }
    );
  }

  function leaderServiceSpan(leader) {
    const { end: timelineEnd } = dataBounds();
    const start = new Date(
      leader.start,
      (leader.startMonth || 1) - 1,
      leader.startDay || 1
    );

    let end;
    if (leader.end >= timelineEnd) {
      end = new Date();
    } else {
      end = new Date(
        leader.end,
        (leader.endMonth || 12) - 1,
        leader.endDay || DEFAULT_END_DAY
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

  function termsForLeader(leader) {
    if (!termIndex) {
      termIndex = new Map();
      const seats = (window.TIMELINE_DATA || {}).seats || [];
      for (const seat of seats) {
        for (const ruler of seat.rulers || []) {
          const key = personKey(ruler);
          const list = termIndex.get(key);
          if (list) list.push(ruler);
          else termIndex.set(key, [ruler]);
        }
      }
    }
    return termIndex.get(personKey(leader)) || [leader];
  }

  function isCurrentTerm(leader) {
    const { end } = dataBounds();
    return end != null && leader.end >= end;
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

  function invalidateLayoutCache() {
    themeVarsCache = null;
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
    timelineBounds,
    dataBounds,
    getTimeRangeFilter,
    setTimeRangeFilter,
    normalizeTimeRangeFilter,
    formatTimeRangeFilter,
    timeRangeSpan,
    TIME_RANGE_ORDER,
    getYearOrder,
    setYearOrder,
    yearToY,
    yearToX,
    congressTerms,
    congressOrdinal,
    dateLabel,
    leaderDateLabel,
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
