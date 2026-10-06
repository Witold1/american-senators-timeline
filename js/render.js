/**
 * Timeline DOM: vertical (years Y) or horizontal (years X) layouts and senator bars.
 * Filters → filters.js; tooltips → interaction.js; labels → labels.js.
 */
(function () {
  const geo = () => window.TimelineGeometry;
  const palette = () => window.TimelinePalette;
  const labels = () => window.TimelineLabels;
  const filters = () => window.TimelineFilters;
  const interaction = () => window.TimelineInteraction;

  const timelineEl = document.getElementById("timeline");

  function timelineData() {
    return window.TIMELINE_DATA || {};
  }

  function seats() {
    return timelineData().seats || [];
  }

  function displayBounds() {
    return geo().timelineBounds?.() || {
      start: timelineData().TIMELINE_START,
      end: timelineData().TIMELINE_END,
    };
  }

  function applyYearGridOffsets(metrics) {
    const { start: TIMELINE_START, end: TIMELINE_END } = displayBounds();
    const ascending = (metrics.yearOrder || geo().getYearOrder?.()) === "ascending";
    const unit =
      metrics.orientation === "horizontal" ? metrics.yearWidth : metrics.yearHeight;
    const root = document.documentElement;
    if (ascending) {
      root.style.setProperty(
        "--grid-decade-offset",
        `${((10 - (TIMELINE_START % 10)) % 10) * unit}px`
      );
      root.style.setProperty(
        "--grid-major-offset",
        `${((5 - (TIMELINE_START % 5)) % 5) * unit}px`
      );
    } else {
      root.style.setProperty(
        "--grid-decade-offset",
        `${(TIMELINE_END % 10) * unit}px`
      );
      root.style.setProperty(
        "--grid-major-offset",
        `${(TIMELINE_END % 5) * unit}px`
      );
    }
  }

  function congressSpans(metrics) {
    const { end: timelineEnd } = geo().dataBounds();
    const horizontal = metrics.orientation === "horizontal";
    const yearToPos = horizontal ? geo().yearToX : geo().yearToY;
    const track = horizontal ? metrics.trackWidth : metrics.trackHeight;
    const spans = [];
    for (const term of geo().congressTerms(timelineEnd)) {
      const a = yearToPos(term.startYear, term.startMonth, term.startDay, metrics);
      const b = yearToPos(term.endYear, term.endMonth, term.endDay, metrics);
      let start = Math.min(a, b);
      let end = Math.max(a, b);
      start = Math.max(0, start);
      end = Math.min(track, end);
      if (end - start < 1) continue;
      spans.push({ term, start, size: end - start });
    }
    spans.sort((left, right) => left.start - right.start);
    return spans;
  }

  function congressTitle(term) {
    const ordinal = geo().congressOrdinal(term.number);
    const range = geo().dateLabel(
      term.startYear,
      term.endYear,
      { month: term.startMonth, day: term.startDay },
      { month: term.endMonth, day: term.endDay }
    );
    return `${ordinal} Congress, ${range}`;
  }

  function renderCongressLayer(metrics) {
    const layer = document.createElement("div");
    layer.className = "congress-layer";
    layer.setAttribute("aria-hidden", "true");
    const horizontal = metrics.orientation === "horizontal";
    for (const span of congressSpans(metrics)) {
      if (span.term.number % 2 === 0) continue;
      const band = document.createElement("div");
      band.className = "congress-band";
      band.title = congressTitle(span.term);
      if (horizontal) {
        band.style.left = `${span.start}px`;
        band.style.width = `${span.size}px`;
      } else {
        band.style.top = `${span.start}px`;
        band.style.height = `${span.size}px`;
      }
      layer.appendChild(band);
    }
    return layer;
  }

  function renderYearAxis(metrics) {
    const { start: TIMELINE_START, end: TIMELINE_END } = displayBounds();
    const horizontal = metrics.orientation === "horizontal";
    const ascending = (metrics.yearOrder || geo().getYearOrder?.()) === "ascending";
    const axis = document.createElement("div");
    axis.className = "axis year-axis";
    if (horizontal) {
      axis.style.width = `${metrics.trackWidth}px`;
      axis.style.height = `${metrics.axisHeight}px`;
    } else {
      axis.style.height = `${metrics.trackHeight}px`;
    }

    const frag = document.createDocumentFragment();
    if (horizontal) {
      for (let y = TIMELINE_START; y <= TIMELINE_END; y++) {
        const isDecade = y % 10 === 0;
        const isMajor = isDecade || y % 5 === 0;
        if (!isMajor) continue;
        const label = document.createElement("span");
        label.className = `axis-year-label${isDecade ? " decade" : " major"}`;
        const slot = ascending ? y - TIMELINE_START : TIMELINE_END - y;
        label.style.left = `${slot * metrics.yearWidth + metrics.yearWidth / 2}px`;
        label.textContent = String(y);
        frag.appendChild(label);
      }
    } else {
      for (let y = TIMELINE_END; y >= TIMELINE_START; y--) {
        const isDecade = y % 10 === 0;
        const isMajor = isDecade || y % 5 === 0;
        if (!isMajor) continue;
        const label = document.createElement("span");
        label.className = `axis-year-label${isDecade ? " decade" : " major"}`;
        const slot = ascending ? y - TIMELINE_START : TIMELINE_END - y;
        label.style.top = `${slot * metrics.yearHeight}px`;
        label.style.height = `${metrics.yearHeight}px`;
        label.textContent = String(y);
        frag.appendChild(label);
      }
    }
    const horizontalAxis = metrics.orientation === "horizontal";
    for (const span of congressSpans(metrics)) {
      const mark = document.createElement("span");
      mark.className = "congress-mark";
      mark.title = congressTitle(span.term);
      mark.textContent = String(span.term.number);
      if (horizontalAxis) {
        mark.style.left = `${span.start}px`;
        mark.style.width = `${span.size}px`;
      } else {
        mark.style.top = `${span.start}px`;
        mark.style.height = `${span.size}px`;
      }
      frag.appendChild(mark);
    }
    axis.appendChild(frag);
    return axis;
  }

  function renderAxisCorner() {
    const ascending = geo().getYearOrder?.() === "ascending";
    const horizontal =
      document.documentElement.dataset.orientation === "horizontal";
    const yearHint = horizontal
      ? ascending
        ? "Year, newer to the right"
        : "Year, newer to the left"
      : ascending
        ? "Year, newer toward the bottom"
        : "Year, newer toward the top";

    const corner = document.createElement("div");
    corner.className = "axis-corner";
    corner.innerHTML = `
    <svg class="axis-corner-diag" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100" y2="100" />
    </svg>
    <span class="axis-corner-label axis-corner-year" title="${yearHint}">
      Year
      <svg class="axis-corner-year-arrow" aria-hidden="true" viewBox="0 0 8 8" focusable="false">
        <path d="M4 1.25v5.5M2.1 4.6 4 6.75 5.9 4.6" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span class="axis-corner-label axis-corner-country">State</span>
  `;
    return corner;
  }

  function renderYearAxisColumn(metrics) {
    const col = document.createElement("div");
    col.className = "year-axis-col";
    col.appendChild(renderAxisCorner());
    col.appendChild(renderYearAxis(metrics));
    return col;
  }

  function renderAxisRow(metrics) {
    const row = document.createElement("div");
    row.className = "axis-row";
    row.appendChild(renderAxisCorner());
    row.appendChild(renderYearAxis(metrics));
    return row;
  }

  function appendBarChrome(bar, leader, options, span) {
    const {
      leaderDateLabel,
      serviceFiguresLabel,
      leaderServiceSummary,
    } = geo();
    const { normalizeLeaderName } = palette();
    const {
      formatLeaderLabel,
      applyBarLabelColors,
      escapeHtml,
    } = labels();
    const {
      seatName,
      className,
      palette: barPalette,
      roleLabel,
      labelMinSpan = 36,
    } = options;

    const leaderKey = normalizeLeaderName(leader.name);
    const bioguideId = String(leader.bioguide || "").trim().toUpperCase();
    bar.className = className;
    bar.style.background = barPalette.color;
    bar.dataset.search = `${leader.name} ${seatName} ${leader.party || ""}`.toLowerCase();
    bar.dataset.leader = leaderKey;
    bar.dataset.person = /^[A-Z]\d{6}$/.test(bioguideId) ? bioguideId : leaderKey;
    bar.dataset.name = leader.name;
    bar.dataset.party = leader.party || "";
    bar.dataset.color = barPalette.color;

    if (span > labelMinSpan) {
      const lbl = document.createElement("span");
      lbl.className = "bar-label";
      const text = document.createElement("span");
      text.className = "bar-label-text";
      text.textContent = formatLeaderLabel(leader.name);
      applyBarLabelColors(text, barPalette.color);
      lbl.appendChild(text);
      bar.appendChild(lbl);
    }

    const role = leader.role || roleLabel;
    const summary = leaderServiceSummary(leader);
    const thisTermLabel = summary.hoveredIsCurrent ? "Current term" : "This term";
    const serviceRows = [
      `<div class="served"><span class="served-k">Length</span> ${escapeHtml(serviceFiguresLabel(summary.hovered))}</div>`,
    ];
    if (summary.current && !summary.hoveredIsCurrent) {
      serviceRows.push(
        `<div class="served"><span class="served-k">Current term</span> ${escapeHtml(leaderDateLabel(summary.current))}, ${escapeHtml(serviceFiguresLabel(summary.currentFigures))}</div>`
      );
    }
    serviceRows.push(
      `<div class="served"><span class="served-k">Total served</span> ${escapeHtml(serviceFiguresLabel(summary.total))}</div>`
    );
    const bioguide = bioguideId;
    const bioguideLink = /^[A-Z]\d{6}$/.test(bioguide)
      ? `<a class="bioguide" href="https://bioguide.congress.gov/scripts/biodisplay.pl?index=${bioguide}" target="_blank" rel="noopener noreferrer">Biographical Directory of the U.S. Congress</a>`
      : "";
    interaction().setBarTip?.(
      bar,
      `<strong>${escapeHtml(leader.name)}</strong>
    <span class="role">${escapeHtml(seatName)}, ${escapeHtml(role)}</span>
    ${bioguideLink}
    <div class="dates"><span class="served-k">${thisTermLabel}</span> ${escapeHtml(leaderDateLabel(leader))}</div>
    ${serviceRows.join("")}`
    );
  }

  /** Map a leader span to pixel start/end along the year axis; returns null if too small. */
  function leaderAxisSpan(leader, metrics, yearToPos) {
    const { start: TIMELINE_START, end: TIMELINE_END } = displayBounds();
    const endDay = geo().DEFAULT_END_DAY || 15;
    const axisStart = yearToPos(TIMELINE_START, 1, 1, metrics);
    const axisEnd = yearToPos(TIMELINE_END + 1, 1, 1, metrics);
    const a0 = yearToPos(
      leader.start,
      leader.startMonth || 1,
      leader.startDay || 1,
      metrics
    );
    const endYear = Math.min(leader.end, TIMELINE_END);
    const a1 =
      leader.end >= TIMELINE_END
        ? axisEnd
        : yearToPos(endYear, leader.endMonth || 12, leader.endDay || endDay, metrics);
    const lo = Math.min(axisStart, axisEnd);
    const hi = Math.max(axisStart, axisEnd);
    const start = Math.max(Math.min(a0, a1), lo);
    const end = Math.min(Math.max(a0, a1), hi);
    const span = end - start;
    if (span < 2) return null;
    return { start, span };
  }

  function renderLeaderBar(track, leader, options) {
    const { yearToY, yearToX } = geo();
    const {
      metrics,
      minSpan = 6,
      labelMinSpan = 36,
    } = options;

    const horizontal = metrics.orientation === "horizontal";
    const mapped = leaderAxisSpan(
      leader,
      metrics,
      horizontal ? yearToX : yearToY
    );
    if (!mapped) return;

    const bar = document.createElement("div");
    // Leave 1px of track at the chronological start so touching terms separate.
    // Shrink the box itself, rather than clipping one cap, so a short bar stays a pill.
    const gap = 1;
    const ascending = metrics.yearOrder === "ascending";
    const painted = Math.max(mapped.span, minSpan);
    const length = Math.max(painted - gap, 2);
    const inset = painted - length;
    if (horizontal) {
      bar.style.left = `${mapped.start + (ascending ? inset : 0)}px`;
      bar.style.width = `${length}px`;
    } else {
      bar.style.top = `${mapped.start + (ascending ? inset : 0)}px`;
      bar.style.height = `${length}px`;
    }
    appendBarChrome(bar, leader, { ...options, labelMinSpan }, mapped.span);
    track.appendChild(bar);
  }

  function seatOverlapsDisplay(seat) {
    const { start, end } = displayBounds();
    return (seat.rulers || []).some(
      (r) => Number(r.start) <= end && Number(r.end) >= start
    );
  }

  function sortStateGroups(groups) {
    const orderMode = filters().getOrderMode?.() || "name";
    const dir = filters().getOrderDir?.() === "desc" ? -1 : 1;
    const sorted = groups.slice();
    sorted.sort((a, b) => {
      const primary =
        orderMode === "admitted"
          ? (a.admitted || "").localeCompare(b.admitted || "")
          : a.name.localeCompare(b.name);
      if (primary) return primary * dir;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  function groupSeatsByState(list) {
    const { seatStateName } = labels();
    const groups = [];
    const byKey = new Map();
    const timeRangeActive = (geo().getTimeRangeFilter?.() || "all") !== "all";

    for (const seat of list) {
      if (timeRangeActive && !seatOverlapsDisplay(seat)) continue;

      const key = String(seat.state || seat.flag || seat.id).toUpperCase();
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          name: seatStateName(seat),
          region: seat.region,
          admitted: seat.admitted || "",
          seats: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.seats.push(seat);
      if (!group.admitted && seat.admitted) group.admitted = seat.admitted;
    }
    return sortStateGroups(groups);
  }

  function renderSeatTrack(seat, metrics) {
    const { normalizeLeaderName, buildLeaderPaletteMap } = palette();
    const colorMode = filters().getColorMode?.() || "party";

    const col = document.createElement("div");
    col.className = "country-row";
    col.dataset.seatId = seat.id;

    const track = document.createElement("div");
    track.className = "country-track";
    if (metrics.orientation === "horizontal") {
      track.style.width = `${metrics.trackWidth}px`;
      track.style.height = `${metrics.seatHeight}px`;
    } else {
      track.style.height = `${metrics.trackHeight}px`;
      track.style.width = `${metrics.seatWidth}px`;
    }

    const leaders = seat.rulers || [];
    const leaderPalettes = buildLeaderPaletteMap(leaders, colorMode);

    for (const leader of leaders) {
      const barPalette = leaderPalettes.get(normalizeLeaderName(leader.name));
      renderLeaderBar(track, leader, {
        metrics,
        seatName: seat.name,
        className: "bar ruler",
        palette: barPalette,
        roleLabel: "Senator",
        minSpan: 4,
        labelMinSpan: metrics.orientation === "horizontal" ? 52 : 64,
      });
    }

    col.appendChild(track);
    return col;
  }

  function renderStateGroup(group, metrics, groupIndex) {
    const { admissionYear, admissionDateLabel } = labels();

    const wrap = document.createElement("div");
    wrap.className = "state-group";
    if (groupIndex % 2 === 1) wrap.classList.add("alt");
    wrap.dataset.state = group.key;
    wrap.dataset.region = group.region || "";
    if (group.admitted) wrap.dataset.admitted = group.admitted;

    const label = document.createElement("div");
    label.className = "country-label";
    const seatNames = group.seats.map((s) => s.name).join(", ");
    const admittedTitle = group.admitted
      ? `Admitted ${admissionDateLabel(group.admitted)}`
      : "";
    label.title = [seatNames, admittedTitle].filter(Boolean).join(". ");

    const name = document.createElement("span");
    name.className = "country-name";
    name.textContent = group.name;
    label.appendChild(name);

    const year = admissionYear(group.admitted);
    if (year) {
      const admitted = document.createElement("span");
      admitted.className = "country-admitted";
      admitted.textContent = year;
      admitted.title = `Admitted ${admissionDateLabel(group.admitted)}`;
      label.appendChild(admitted);
    }

    wrap.appendChild(label);

    const seatsRow = document.createElement("div");
    seatsRow.className = "state-seats";
    seatsRow.appendChild(renderCongressLayer(metrics));
    for (const seat of group.seats) {
      seatsRow.appendChild(renderSeatTrack(seat, metrics));
    }
    wrap.appendChild(seatsRow);
    return wrap;
  }

  function metricsKey(metrics) {
    return [
      metrics.orientation,
      metrics.yearOrder,
      metrics.yearHeight,
      metrics.seatWidth,
      metrics.labelHeight,
      metrics.yearLabelWidth,
      metrics.trackHeight,
      metrics.yearWidth,
      metrics.seatHeight,
      metrics.labelWidth,
      metrics.axisHeight,
      metrics.trackWidth,
    ].join("|");
  }

  function render() {
    const list = seats();
    if (!list.length) return;

    const { getMetrics } = geo();

    const t0 = performance.now();
    filters().resetSeatIndexes?.();
    const metrics = getMetrics();
    applyYearGridOffsets(metrics);
    window.__timelineMetricsKey = metricsKey(metrics);
    const groups = groupSeatsByState(list);

    const main = document.createElement("div");
    main.className = "timeline-main";

    const body = document.createElement("div");
    body.className = "timeline-body";

    const frag = document.createDocumentFragment();
    for (const [index, group] of groups.entries()) {
      frag.appendChild(renderStateGroup(group, metrics, index));
    }
    body.appendChild(frag);

    if (metrics.orientation === "horizontal") {
      main.appendChild(renderAxisRow(metrics));
      main.appendChild(body);
    } else {
      main.appendChild(renderYearAxisColumn(metrics));
      main.appendChild(body);
    }

    timelineEl.replaceChildren(main);
    timelineEl.style.position = "relative";

    filters().applyFilters?.();
    window.__lastTimelineRenderMs = performance.now() - t0;
    window.dispatchEvent(new Event("timeline-debug-refresh"));
  }

  interaction().bind?.(timelineEl);
  filters().bind?.();

  window.applyTimelineFilters = () => filters().applyFilters?.();
  window.renderTimeline = render;
  window.timelineMetricsKey = metricsKey;

  window.TimelineRender = {
    render,
    refreshBarLabels: () => labels().refreshBarLabels?.(),
  };
})();
