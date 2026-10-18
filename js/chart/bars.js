/**
 * The colored term shapes and the names drawn on them.
 */
(function () {
  const { displayBounds, geo, palette, labels, interaction } = window.TimelineChartDom;

  function factText(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") return "";
    return String(value);
  }

  function factFrom(leader, seat, id) {
    const spots = [leader, leader?.fields, seat, seat?.fields];
    for (const spot of spots) {
      const text = factText(spot?.[id]);
      if (text) return text;
    }
    return "";
  }

  function tooltipSpecs() {
    const specs = window.TIMELINE_DATA?.view?.tooltip;
    return Array.isArray(specs) ? specs : null;
  }

  function tooltipShows(specs, id) {
    if (!specs) return true;
    return specs.some((spec) => spec && spec.id === id);
  }

  /** Extra lines from the data mapper. Name, polity, role, and bioguide are the drawer itself. */
  function tooltipFactRows(leader, seat, escapeHtml) {
    const specs = tooltipSpecs();
    if (!specs || !specs.length) return "";
    const builtIn = new Set(["person", "name", "role", "bioguide"]);
    return specs
      .map((spec) => {
        const id = spec?.id;
        if (!id || builtIn.has(id)) return "";
        const value = factFrom(leader, seat, id);
        if (!value) return "";
        const label = spec.label || id;
        return `<div class="served"><span class="served-k">${escapeHtml(label)}</span> ${escapeHtml(value)}</div>`;
      })
      .filter(Boolean)
      .join("");
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
      seat = null,
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

    const specs = tooltipSpecs();
    const role = leader.role || roleLabel;
    const showPerson = tooltipShows(specs, "person");
    const showPolity = tooltipShows(specs, "name");
    const showOffice = tooltipShows(specs, "role") || !String(leader.role || "").trim();
    const subtitle = [
      showPolity ? seatName : "",
      showOffice ? role : "",
    ]
      .filter(Boolean)
      .join(", ");
    const tooltipFacts = tooltipFactRows(leader, seat, escapeHtml);
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
    const bioguideLink =
      tooltipShows(specs, "bioguide") && /^[A-Z]\d{6}$/.test(bioguide)
        ? `<a class="bioguide" href="https://bioguide.congress.gov/scripts/biodisplay.pl?index=${bioguide}" target="_blank" rel="noopener noreferrer">Biographical Directory of the U.S. Congress</a>`
        : "";
    const title = showPerson ? `<strong>${escapeHtml(leader.name)}</strong>` : "";
    const subtitleHtml = subtitle ? `<span class="role">${escapeHtml(subtitle)}</span>` : "";
    interaction().setBarTip?.(
      bar,
      `${title}
    ${subtitleHtml}
    ${tooltipFacts}
    ${bioguideLink}
    <div class="dates"><span class="served-k">${thisTermLabel}</span> ${escapeHtml(leaderDateLabel(leader))}</div>
    ${serviceRows.join("")}`
    );
  }

  /** Inset on each outer end of a reign. Neighbors end up this far apart, twice. */
  const TERM_EDGE = 2;

  function horizontalChart(metrics) {
    return metrics.orientation === "horizontal";
  }

  /** Year mapping along the time axis for this orientation. */
  function yearAlong(metrics) {
    const { yearToX, yearToY } = geo();
    return horizontalChart(metrics) ? yearToX : yearToY;
  }

  /** Lane thickness: seat height when time runs sideways, seat width when time runs down. */
  function crossUnit(metrics) {
    return horizontalChart(metrics) ? metrics.seatHeight || 24 : metrics.seatWidth || 24;
  }

  /**
   * One place that turns time (axis) and lane (cross) into screen x/y.
   * Horizontal: time is x. Vertical: time is y.
   */
  function screenPoint(axis, cross, horizontal) {
    return horizontal ? { x: axis, y: cross } : { x: cross, y: axis };
  }

  function screenBox(axis0, axis1, cross0, cross1, horizontal) {
    const start = screenPoint(axis0, cross0, horizontal);
    const end = screenPoint(axis1, cross1, horizontal);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    return {
      left,
      top,
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  function writeScreenBox(el, box, important) {
    const set = (prop, value) => {
      if (important) el.style.setProperty(prop, `${value}px`, "important");
      else el.style[prop] = `${value}px`;
    };
    set("left", box.left);
    set("top", box.top);
    set("width", box.width);
    set("height", box.height);
  }

  /** Map a leader span to pixel start/end along the year axis; returns null if too small. */
  function leaderAxisSpan(leader, metrics, yearToPos) {
    const { start: TIMELINE_START, end: TIMELINE_END } = displayBounds();
    const fallbackEndDay = geo().DEFAULT_END_DAY || 15;
    const axisStart = yearToPos(TIMELINE_START, 1, 1, metrics);
    const axisEnd = yearToPos(TIMELINE_END + 1, 1, 1, metrics);
    const a0 = yearToPos(
      leader.start,
      leader.startMonth || 1,
      leader.startDay || 1,
      metrics
    );
    const endMonth = leader.endMonth || 12;
    const endDay = leader.endDay || fallbackEndDay;
    const endYear = Math.min(leader.end, TIMELINE_END);
    // Only a term that runs through the final year should meet the axis edge.
    // A May end in that same year must stop in May, or it covers later lanes.
    const reachesEdge =
      leader.end > TIMELINE_END ||
      (leader.end === TIMELINE_END && endMonth === 12 && endDay >= 28);
    const a1 = reachesEdge
      ? axisEnd
      : yearToPos(endYear, endMonth, endDay, metrics);
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
    const base = crossUnit(metrics);
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
    const {
      minSpan = 6,
      laneGap = 1,
      trimStart = 0,
      trimEnd = 0,
    } = options;
    const mapped = leaderAxisSpan(leader, metrics, yearAlong(metrics));
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
      low.push(
        screenPoint(box.axis0, box.cross0, horizontal),
        screenPoint(box.axis1, box.cross0, horizontal)
      );
      high.push(
        screenPoint(box.axis0, box.cross1, horizontal),
        screenPoint(box.axis1, box.cross1, horizontal)
      );
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
    writeScreenBox(
      bar,
      screenBox(box.axis0, box.axis1, box.cross0, box.cross1, horizontal)
    );

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
      writeScreenBox(
        bar,
        { left: minX, top: minY, width, height },
        true
      );
      track.appendChild(bar);
    } catch {
      for (const segment of segments) renderLeaderBar(track, segment, options);
    }
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
    const along0 = horizontal ? labelBox.axis0 - minX : labelBox.axis0 - minY;
    const along1 = horizontal ? labelBox.axis1 - minX : labelBox.axis1 - minY;
    const crossMid = horizontal
      ? (labelBox.cross0 + labelBox.cross1) / 2 - minY
      : (labelBox.cross0 + labelBox.cross1) / 2 - minX;
    const alongExtent = horizontal ? width : height;
    const span = Math.max(0, along1 - along0 - 8);

    label.style.left = "auto";
    label.style.right = "auto";
    label.style.top = "auto";
    label.style.bottom = "auto";
    label.style.maxWidth = "";
    label.style.maxHeight = "";
    label.style.transform = horizontal ? "translateY(-50%)" : "translateX(-50%)";
    if (horizontal) {
      label.style.top = `${crossMid}px`;
      label.style.maxWidth = `${span}px`;
    } else {
      label.style.left = `${crossMid}px`;
      label.style.maxHeight = `${span}px`;
    }
    const startEdge = horizontal ? "left" : "top";
    const endEdge = horizontal ? "right" : "bottom";
    if (ascending) label.style[startEdge] = `${along0 + 4}px`;
    else label.style[endEdge] = `${Math.max(0, alongExtent - along1 + 4)}px`;
  }

  window.TimelineChartBars = {
    groupLeadersByReign,
    renderLeaderBar,
    renderSteppedLeaderBar,
  };
})();
