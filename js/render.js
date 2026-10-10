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
    if (metrics.orientation === "horizontal") {
      root.style.setProperty("--year-slot", `${unit}px`);
    } else {
      root.style.removeProperty("--year-slot");
    }
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
    if (timelineData().showCongress) {
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
    <span class="axis-corner-label axis-corner-country">${labels().escapeHtml(timelineData().entityLabel || "State")}</span>
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
      showLabel = false,
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

    if (showLabel) {
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

  /** Inset on each outer end of a reign. Neighbors end up this far apart, twice. */
  const TERM_EDGE = 2;

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
    // Allow sub-2px spans; callers inflate with minSpan / stepped stubs.
    if (span < 0.25) return null;
    return { start, span };
  }

  function trackCrossSize(metrics) {
    const horizontal = metrics.orientation === "horizontal";
    const base = horizontal
      ? metrics.seatHeight || 24
      : metrics.seatWidth || 24;
    if (metrics.trackCross != null) return metrics.trackCross;
    const laneCount = Math.max(1, Number(metrics.laneCount) || 1);
    return base * laneCount;
  }

  function crossLayout(leader, metrics, laneGap = 1) {
    const lane = Math.max(0, Number(leader.lane) || 0);
    const localLanes = Math.max(1, Number(leader.localLanes) || 1);
    const trackCross = trackCrossSize(metrics);
    // Keep outer edges flush with the track so a full-width alone segment and a
    // half-width contest segment share a continuous outer edge (the sketch).
    // The gap lives between lanes, not as an inset on both sides.
    if (localLanes <= 1) {
      return { cross0: 0, cross1: trackCross, localLanes, trackCross };
    }
    const slot = trackCross / localLanes;
    const gap = Math.max(0, laneGap);
    const cross0 = lane === 0 ? 0 : lane * slot + gap / 2;
    const cross1 =
      lane >= localLanes - 1 ? trackCross : (lane + 1) * slot - gap / 2;
    return {
      cross0,
      cross1: Math.max(cross0 + 2, cross1),
      localLanes,
      trackCross,
    };
  }

  /** Rounded path for an axis-aligned polygon (outer silhouette of a stepped bar). */
  function roundedPolygonPath(points, radius) {
    // Drop zero-length edges first so Q corners stay stable.
    const cleaned = [];
    for (const point of points) {
      const prev = cleaned[cleaned.length - 1];
      if (
        prev &&
        Math.abs(prev.x - point.x) < 0.05 &&
        Math.abs(prev.y - point.y) < 0.05
      ) {
        continue;
      }
      cleaned.push(point);
    }
    if (
      cleaned.length > 2 &&
      Math.abs(cleaned[0].x - cleaned[cleaned.length - 1].x) < 0.05 &&
      Math.abs(cleaned[0].y - cleaned[cleaned.length - 1].y) < 0.05
    ) {
      cleaned.pop();
    }
    const n = cleaned.length;
    if (n < 3) return "";
    const rMax = Math.max(0, radius);
    let d = "";
    for (let i = 0; i < n; i++) {
      const prev = cleaned[(i - 1 + n) % n];
      const cur = cleaned[i];
      const next = cleaned[(i + 1) % n];
      const inX = cur.x - prev.x;
      const inY = cur.y - prev.y;
      const outX = next.x - cur.x;
      const outY = next.y - cur.y;
      const inLen = Math.hypot(inX, inY);
      const outLen = Math.hypot(outX, outY);
      if (inLen < 1e-6 || outLen < 1e-6) continue;
      const rr = Math.min(rMax, inLen / 2, outLen / 2);
      const x1 = cur.x - (inX / inLen) * rr;
      const y1 = cur.y - (inY / inLen) * rr;
      const x2 = cur.x + (outX / outLen) * rr;
      const y2 = cur.y + (outY / outLen) * rr;
      if (!d) d += `M${x1.toFixed(2)} ${y1.toFixed(2)}`;
      else d += `L${x1.toFixed(2)} ${y1.toFixed(2)}`;
      if (rr > 0.05) {
        d += `Q${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
      } else {
        d += `L${x2.toFixed(2)} ${y2.toFixed(2)}`;
      }
    }
    return d ? `${d}Z` : "";
  }

  function leaderSegmentBox(leader, metrics, options = {}) {
    const { yearToY, yearToX } = geo();
    const {
      minSpan = 6,
      laneGap = 1,
      trimStart = 0,
      trimEnd = 0,
    } = options;
    const horizontal = metrics.orientation === "horizontal";
    const mapped = leaderAxisSpan(
      leader,
      metrics,
      horizontal ? yearToX : yearToY
    );
    if (!mapped) return null;

    const painted = Math.max(mapped.span, minSpan);
    let trim0 = trimStart;
    let trim1 = trimEnd;
    const maxTrim = Math.max(0, painted - 2);
    if (trim0 + trim1 > maxTrim && trim0 + trim1 > 0) {
      const scale = maxTrim / (trim0 + trim1);
      trim0 *= scale;
      trim1 *= scale;
    }
    const axis0 = mapped.start + trim0;
    const axis1 = mapped.start + painted - trim1;

    const { cross0, cross1, localLanes } = crossLayout(leader, metrics, laneGap);
    return { axis0, axis1, cross0, cross1, localLanes, span: axis1 - axis0 };
  }

  function simplifyAxisAligned(points) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = out[out.length - 1];
      const cur = points[i];
      const next = points[i + 1];
      const colinear =
        (prev.x === cur.x && cur.x === next.x) ||
        (prev.y === cur.y && cur.y === next.y);
      if (!colinear) out.push(cur);
    }
    out.push(points[points.length - 1]);
    return out;
  }

  /** Snap joints and grow short stubs so stepped boxes form a clean silhouette. */
  function normalizeSteppedBoxes(boxes) {
    const ordered = boxes
      .slice()
      .sort((a, b) => a.axis0 - b.axis0 || a.axis1 - b.axis1)
      .map((box) => ({ ...box }));
    // Resolve gaps and overlaps at every joint.
    for (let i = 1; i < ordered.length; i++) {
      const mid = (ordered[i - 1].axis1 + ordered[i].axis0) / 2;
      ordered[i - 1].axis1 = mid;
      ordered[i].axis0 = mid;
    }
    // Grow short stubs inward so the gap against a neighboring reign stays open.
    for (let i = 0; i < ordered.length; i++) {
      const span = ordered[i].axis1 - ordered[i].axis0;
      if (span >= 2) continue;
      const need = 2 - span;
      if (i === 0) ordered[i].axis1 += need;
      else if (i === ordered.length - 1) ordered[i].axis0 -= need;
      else {
        ordered[i].axis0 -= need / 2;
        ordered[i].axis1 += need / 2;
      }
      if (i > 0) ordered[i - 1].axis1 = ordered[i].axis0;
      if (i < ordered.length - 1) ordered[i + 1].axis0 = ordered[i].axis1;
      ordered[i].span = ordered[i].axis1 - ordered[i].axis0;
    }
    return ordered;
  }

  /** Build a stepped polygon from contiguous segment boxes (time = axis, lane = cross). */
  function steppedPolygon(boxes, horizontal) {
    const ordered = normalizeSteppedBoxes(boxes);
    const low = [];
    const high = [];
    for (const box of ordered) {
      if (horizontal) {
        low.push({ x: box.axis0, y: box.cross0 }, { x: box.axis1, y: box.cross0 });
        high.push({ x: box.axis0, y: box.cross1 }, { x: box.axis1, y: box.cross1 });
      } else {
        low.push({ x: box.cross0, y: box.axis0 }, { x: box.cross0, y: box.axis1 });
        high.push({ x: box.cross1, y: box.axis0 }, { x: box.cross1, y: box.axis1 });
      }
    }
    return simplifyAxisAligned([...low, ...high.slice().reverse()]);
  }

  function groupLeadersByReign(leaders) {
    const identity = geo().termIdentity;
    const groups = [];
    const byId = new Map();
    for (const leader of leaders) {
      const id = identity
        ? identity(leader)
        : `${leader.name}|${leader.start}|${leader.end}`;
      let group = byId.get(id);
      if (!group) {
        group = [];
        byId.set(id, group);
        groups.push(group);
      }
      group.push(leader);
    }
    for (const group of groups) {
      group.sort(
        (a, b) =>
          Number(a.start) - Number(b.start) ||
          (a.startMonth || 1) - (b.startMonth || 1) ||
          (a.startDay || 1) - (b.startDay || 1)
      );
    }
    return groups;
  }

  function renderLeaderBar(track, leader, options) {
    const {
      metrics,
      minSpan = 6,
      laneGap = 1,
    } = options;

    const horizontal = metrics.orientation === "horizontal";
    const box = leaderSegmentBox(leader, metrics, {
      minSpan,
      laneGap,
      trimStart: TERM_EDGE,
      trimEnd: TERM_EDGE,
    });
    if (!box) return;

    const bar = document.createElement("div");
    if (horizontal) {
      bar.style.left = `${box.axis0}px`;
      bar.style.width = `${box.axis1 - box.axis0}px`;
      bar.style.top = `${box.cross0}px`;
      bar.style.height = `${box.cross1 - box.cross0}px`;
    } else {
      bar.style.top = `${box.axis0}px`;
      bar.style.height = `${box.axis1 - box.axis0}px`;
      bar.style.left = `${box.cross0}px`;
      bar.style.width = `${box.cross1 - box.cross0}px`;
    }

    appendBarChrome(
      bar,
      leader,
      {
        ...options,
        showLabel: labelFits(
          leader.name,
          box.span,
          box.cross1 - box.cross0,
          horizontal,
          false
        ),
      },
      box.span
    );
    if (box.localLanes > 1) bar.classList.add("split-lane");
    track.appendChild(bar);
  }

  /**
   * One continuous stepped shape for a reign that is full-width when alone
   * and narrow only during the contested window (as in the sketch).
   */
  function renderSteppedLeaderBar(track, segments, options) {
    try {
      const {
        metrics,
        laneGap = 1,
        palette: barPalette,
      } = options;
      const horizontal = metrics.orientation === "horizontal";
      const ascending = metrics.yearOrder === "ascending";
      const radius = 4;

      const boxes = [];
      for (let i = 0; i < segments.length; i++) {
        const isFirst = i === 0;
        const isLast = i === segments.length - 1;
        // Inset only the outer ends of the whole reign, not the step joints.
        let trimStart = 0;
        let trimEnd = 0;
        if (ascending) {
          if (isFirst) trimStart = TERM_EDGE;
          if (isLast) trimEnd = TERM_EDGE;
        } else {
          if (isFirst) trimEnd = TERM_EDGE;
          if (isLast) trimStart = TERM_EDGE;
        }
        const box = leaderSegmentBox(segments[i], metrics, {
          minSpan: 0,
          laneGap,
          trimStart,
          trimEnd,
        });
        if (box) boxes.push(box);
      }
      if (!boxes.length) {
        for (const segment of segments) renderLeaderBar(track, segment, options);
        return;
      }
      if (boxes.length === 1) {
        renderLeaderBar(track, segments[0], options);
        return;
      }

      const points = steppedPolygon(boxes, horizontal);
      if (points.length < 3) {
        for (const segment of segments) renderLeaderBar(track, segment, options);
        return;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      const width = Math.max(maxX - minX, 2);
      const height = Math.max(maxY - minY, 2);
      const local = points.map((point) => ({
        x: point.x - minX,
        y: point.y - minY,
      }));
      const pathD = roundedPolygonPath(local, radius);
      if (!pathD) {
        for (const segment of segments) renderLeaderBar(track, segment, options);
        return;
      }

      const fill = barPalette?.color || "var(--accent)";
      const bar = document.createElement("div");
      bar.style.setProperty("--step-clip", `path('${pathD}')`);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("aria-hidden", "true");
      svg.classList.add("bar-step-svg");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathD);
      path.setAttribute("fill", fill);
      path.classList.add("bar-step-path");
      svg.appendChild(path);
      bar.appendChild(svg);

      const tipLeader = { ...segments[0] };
      const reign = segments[0].reign;
      if (reign) {
        tipLeader.start = reign.start;
        tipLeader.startMonth = reign.startMonth;
        tipLeader.startDay = reign.startDay;
        tipLeader.end = reign.end;
        tipLeader.endMonth = reign.endMonth;
        tipLeader.endDay = reign.endDay;
      }

      const labelBox = fittingLabelBox(boxes, tipLeader.name, horizontal, false);

      appendBarChrome(
        bar,
        tipLeader,
        {
          ...options,
          className: "bar ruler stepped",
          showLabel: Boolean(labelBox),
        },
        labelBox?.span || 0
      );
      placeSteppedLabel(bar, labelBox, {
        minX,
        minY,
        width,
        height,
        horizontal,
        ascending,
      });
      bar.style.background = "transparent";
      bar.style.setProperty("left", `${minX}px`, "important");
      bar.style.setProperty("top", `${minY}px`, "important");
      bar.style.setProperty("width", `${width}px`, "important");
      bar.style.setProperty("height", `${height}px`, "important");
      track.appendChild(bar);
    } catch {
      for (const segment of segments) renderLeaderBar(track, segment, options);
    }
  }

  function sortValue(group, mode) {
    if (mode === "admitted" || mode === "independence") {
      return group.independenceDate || group.admitted || "";
    }
    if (mode === "sovereignty") {
      return group.sovereigntyDate || "";
    }
    if (!mode || mode === "name") return group.name || "";
    const raw = group.fields?.[mode];
    return raw == null ? "" : raw;
  }

  function compareSortValues(a, b) {
    const aNum = typeof a === "number" ? a : Number(a);
    const bNum = typeof b === "number" ? b : Number(b);
    const numeric =
      a !== "" && b !== "" && Number.isFinite(aNum) && Number.isFinite(bNum);
    if (numeric) return aNum - bNum;
    return String(a).localeCompare(String(b));
  }

  function measureLabel(text, horizontal, compact) {
    if (!measureLabel.probe) {
      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "0";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "nowrap";
      probe.style.fontFamily = "var(--font-chart)";
      document.body.appendChild(probe);
      measureLabel.probe = probe;
    }
    const probe = measureLabel.probe;
    probe.style.fontWeight = "600";
    if (horizontal) {
      probe.style.writingMode = "horizontal-tb";
      probe.style.fontSize = compact ? "0.8rem" : "1rem";
      probe.style.lineHeight = compact ? "1" : "1.15";
      probe.style.padding = compact ? "0 4px" : "1px 4px";
      probe.textContent = text;
      return { along: probe.offsetWidth, cross: probe.offsetHeight };
    }
    probe.style.writingMode = "vertical-rl";
    probe.style.fontSize = "1rem";
    probe.style.lineHeight = "1.2";
    probe.style.padding = "4px 1px";
    probe.textContent = text;
    return { along: probe.offsetHeight, cross: probe.offsetWidth };
  }

  /** A name is drawn only when the whole word fits inside the bar. */
  function labelFits(name, span, cross, horizontal, compact) {
    const text = labels().formatLeaderLabel(name);
    if (!text || span <= 0 || cross <= 0) return false;
    const size = measureLabel(text, horizontal, compact);
    return size.along <= span - 10 && size.cross <= cross;
  }

  function fittingLabelBox(boxes, name, horizontal, compact) {
    const ranked = boxes.slice().sort((a, b) => b.span - a.span);
    return (
      ranked.find((box) =>
        labelFits(name, box.span, box.cross1 - box.cross0, horizontal, compact)
      ) || null
    );
  }

  /** Keep a stepped-bar name inside the one slice that can hold it. */
  function placeSteppedLabel(bar, labelBox, frame) {
    const label = bar.querySelector(".bar-label");
    if (!label || !labelBox) return;
    const { minX, minY, width, height, horizontal, ascending } = frame;
    if (horizontal) {
      const localLeft = labelBox.axis0 - minX;
      const localRight = labelBox.axis1 - minX;
      label.style.top = `${(labelBox.cross0 + labelBox.cross1) / 2 - minY}px`;
      label.style.maxWidth = `${Math.max(0, localRight - localLeft - 8)}px`;
      label.style.bottom = "auto";
      label.style.transform = "translateY(-50%)";
      if (ascending) {
        label.style.left = `${localLeft + 4}px`;
        label.style.right = "auto";
      } else {
        label.style.left = "auto";
        label.style.right = `${Math.max(0, width - localRight + 4)}px`;
      }
      return;
    }
    const localTop = labelBox.axis0 - minY;
    const localBottom = labelBox.axis1 - minY;
    label.style.left = `${(labelBox.cross0 + labelBox.cross1) / 2 - minX}px`;
    label.style.maxHeight = `${Math.max(0, localBottom - localTop - 8)}px`;
    label.style.right = "auto";
    label.style.transform = "translateX(-50%)";
    if (ascending) {
      label.style.top = `${localTop + 4}px`;
      label.style.bottom = "auto";
    } else {
      label.style.top = "auto";
      label.style.bottom = `${Math.max(0, height - localBottom + 4)}px`;
    }
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
      const primary = compareSortValues(sortValue(a, orderMode), sortValue(b, orderMode));
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
          sovereigntyDate: seat.sovereigntyDate || "",
          independenceDate: seat.independenceDate || seat.admitted || "",
          sovereignty: seat.sovereignty || null,
          independence: seat.independence || null,
          fields: seat.fields || null,
          seats: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.seats.push(seat);
      if (!group.admitted && seat.admitted) group.admitted = seat.admitted;
      if (!group.sovereigntyDate && seat.sovereigntyDate) {
        group.sovereigntyDate = seat.sovereigntyDate;
      }
      if (!group.independenceDate && (seat.independenceDate || seat.admitted)) {
        group.independenceDate = seat.independenceDate || seat.admitted;
      }
    }
    return sortStateGroups(groups);
  }

  function renderSeatTrack(seat, metrics) {
    const { normalizeLeaderName, buildLeaderPaletteMap } = palette();
    const colorMode = filters().getColorMode?.() || "party";
    const roleLabel = timelineData().roleLabel || "Ruler";

    const laneCount = Math.max(1, Number(seat.laneCount) || 1);
    // Keep every row/column the same cross size; concurrent rulers still
    // split inside that shared track via localLanes.
    const trackLanes = Math.max(
      1,
      Number(metrics.trackLaneCount) || laneCount
    );
    const horizontal = metrics.orientation === "horizontal";
    const baseCross = horizontal
      ? metrics.seatHeight || 24
      : metrics.seatWidth || 24;
    const trackCross = baseCross * trackLanes;
    const seatMetrics = { ...metrics, laneCount, trackCross };

    const col = document.createElement("div");
    col.className = "country-row";
    col.dataset.seatId = seat.id;
    col.dataset.laneCount = String(laneCount);
    col.dataset.trackLanes = String(trackLanes);

    const track = document.createElement("div");
    track.className = "country-track";
    if (horizontal) {
      track.style.width = `${metrics.trackWidth}px`;
      track.style.height = `${trackCross}px`;
    } else {
      // Column must match the lane-expanded track, or bars spill into neighbors.
      col.style.width = `${trackCross}px`;
      track.style.height = `${metrics.trackHeight}px`;
      track.style.width = `${trackCross}px`;
    }

    const leaders = seat.rulers || [];
    const leaderPalettes = buildLeaderPaletteMap(leaders, colorMode, seat);

    for (const group of groupLeadersByReign(leaders)) {
      const barPalette = leaderPalettes.get(normalizeLeaderName(group[0].name));
      const barOptions = {
        metrics: seatMetrics,
        seatName: seat.name,
        className: "bar ruler",
        palette: barPalette,
        roleLabel,
        minSpan: 4,
        laneCount,
      };
      if (group.length === 1) {
        renderLeaderBar(track, group[0], barOptions);
      } else {
        renderSteppedLeaderBar(track, group, barOptions);
      }
    }

    col.appendChild(track);
    return col;
  }

  function dateVerb() {
    return timelineData().view?.settings?.dateVerb || "Admitted";
  }

  function renderStateGroup(group, metrics, groupIndex) {
    const { admissionYear, admissionDateLabel } = labels();

    const wrap = document.createElement("div");
    wrap.className = "state-group";
    if (groupIndex % 2 === 1) wrap.classList.add("alt");
    wrap.dataset.state = group.key;
    wrap.dataset.region = group.region || "";
    for (const [key, value] of Object.entries(group.fields || {})) {
      if (value == null || value === "") continue;
      wrap.dataset[`fv${key}`] = String(value);
    }
    if (group.admitted) wrap.dataset.admitted = group.admitted;

    const label = document.createElement("div");
    label.className = "country-label";
    const seatNames = group.seats.map((s) => s.name).join(", ");
    const dateIso = group.independenceDate || group.admitted;
    const sovereigntyIso = group.sovereigntyDate || "";
    const tipParts = [seatNames];
    if (sovereigntyIso) {
      tipParts.push(`Sovereignty ${admissionDateLabel(sovereigntyIso)}`);
    }
    if (dateIso) {
      tipParts.push(`${dateVerb()} ${admissionDateLabel(dateIso)}`);
    }
    label.title = tipParts.filter(Boolean).join(". ");

    const name = document.createElement("span");
    name.className = "country-name";
    name.textContent = group.name;
    label.appendChild(name);

    const year = admissionYear(dateIso);
    if (year) {
      const admitted = document.createElement("span");
      admitted.className = "country-admitted";
      admitted.textContent = year;
      admitted.title = `${dateVerb()} ${admissionDateLabel(dateIso)}`;
      label.appendChild(admitted);
    }

    wrap.appendChild(label);

    const seatsRow = document.createElement("div");
    seatsRow.className = "state-seats";
    if (timelineData().showCongress) {
      seatsRow.appendChild(renderCongressLayer(metrics));
    }
    for (const seat of group.seats) {
      seatsRow.appendChild(renderSeatTrack(seat, metrics));
    }
    wrap.appendChild(seatsRow);
    return wrap;
  }

  function renderEventMarkers(metrics) {
    const layer = document.createElement("div");
    layer.className = "event-markers";
    layer.setAttribute("aria-hidden", "true");
    const ussr = timelineData().USSR_DISSOLVED;
    const showUssr =
      ussr?.year &&
      document.documentElement.classList.contains("ussr-marker-enabled");
    if (!showUssr) return layer;

    const horizontal = metrics.orientation === "horizontal";
    const mark = document.createElement("div");
    mark.className = "event-marker event-marker-ussr";
    const label = "USSR dissolved · 26 Dec 1991";
    mark.title = label;
    const y = Number(ussr.year);
    const m = Number(ussr.month) || 12;
    const d = Number(ussr.day) || 26;
    if (horizontal) {
      const x = geo().yearToX(y, m, d, metrics);
      mark.style.left = `${x}px`;
    } else {
      const top = geo().yearToY(y, m, d, metrics);
      mark.style.top = `${top}px`;
    }
    const caption = document.createElement("span");
    caption.className = "event-marker-label";
    caption.textContent = "USSR ends";
    mark.appendChild(caption);
    layer.appendChild(mark);
    return layer;
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

  /** Horizontal name column matches the longest country name, not a fixed wide gutter. */
  function fitCountryColumn(orientation) {
    const root = document.documentElement;
    if (orientation !== "horizontal") {
      root.style.removeProperty("--label-w");
      return;
    }
    let max = 0;
    timelineEl.querySelectorAll(".country-name").forEach((name) => {
      max = Math.max(max, name.scrollWidth);
    });
    const width = Math.max(72, Math.ceil(max + 16));
    root.style.setProperty("--label-w", `${width}px`);
  }

  function naturalTrackWidth() {
    const { start, end } = displayBounds();
    if (start == null || end == null) return 0;
    const years = end - start + 1;
    const base =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--year-w")) || 20;
    return years > 0 ? years * base : 0;
  }

  /** Stretch the year axis to the panel when the natural timeline is narrower. */
  function horizontalTrackTarget() {
    if (geo().getOrientation?.() !== "horizontal") return null;
    const clip = document.querySelector(".timeline-scroll-clip");
    if (!clip || clip.clientWidth < 80) return null;
    const natural = naturalTrackWidth();
    if (!natural) return null;
    const labelW =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--label-w")) || 0;
    const available = clip.clientWidth - labelW;
    if (available <= natural + 1) return null;
    return available;
  }

  function render() {
    const list = seats();
    if (!list.length) return;

    const { getMetrics } = geo();

    const t0 = performance.now();
    filters().resetSeatIndexes?.();
    geo().setFilledTrackWidth?.(horizontalTrackTarget());
    const metrics = getMetrics();
    metrics.trackLaneCount = Math.max(
      1,
      ...list.map((seat) => Math.max(1, Number(seat.laneCount) || 1))
    );
    applyYearGridOffsets(metrics);
    window.__timelineMetricsKey = metricsKey(metrics);
    const groups = groupSeatsByState(list);

    const main = document.createElement("div");
    main.className = "timeline-main";

    const body = document.createElement("div");
    body.className = "timeline-body";
    body.style.position = "relative";

    const frag = document.createDocumentFragment();
    for (const [index, group] of groups.entries()) {
      frag.appendChild(renderStateGroup(group, metrics, index));
    }
    body.appendChild(frag);
    body.appendChild(renderEventMarkers(metrics));

    if (metrics.orientation === "horizontal") {
      main.appendChild(renderAxisRow(metrics));
      main.appendChild(body);
    } else {
      main.appendChild(renderYearAxisColumn(metrics));
      main.appendChild(body);
    }

    timelineEl.replaceChildren(main);
    timelineEl.style.position = "relative";
    fitCountryColumn(metrics.orientation);

    if (!render.fitting && metrics.orientation === "horizontal") {
      const next = horizontalTrackTarget();
      const desired = next || naturalTrackWidth();
      if (Math.abs(desired - metrics.trackWidth) > 1) {
        render.fitting = true;
        geo().setFilledTrackWidth?.(next);
        render();
        render.fitting = false;
        return;
      }
    }

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
