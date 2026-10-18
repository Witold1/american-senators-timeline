/**
 * The year scale, the corner label, and the Congress bands.
 */
(function () {
  const { geo, labels, timelineData, displayBounds } = window.TimelineChartDom;
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

  function renderAxisTicks(metrics) {
    const { start: TIMELINE_START, end: TIMELINE_END } = displayBounds();
    const horizontal = metrics.orientation === "horizontal";
    const ascending = (metrics.yearOrder || geo().getYearOrder?.()) === "ascending";
    const unit = horizontal ? metrics.yearWidth : metrics.yearHeight;
    const rootStyle = getComputedStyle(document.documentElement);
    const readPx = (name, fallback) => {
      const value = parseFloat(rootStyle.getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const tick = readPx("--year-tick", 8);
    const congress = document.documentElement.classList.contains("congresses-enabled");
    const rail = congress ? readPx("--congress-rail", horizontal ? 16 : 28) : 0;
    const along = horizontal ? metrics.trackWidth : metrics.yearLabelWidth;
    const crossSize = horizontal ? metrics.axisHeight : metrics.trackHeight;
    const cross = ((horizontal ? metrics.axisHeight : metrics.yearLabelWidth) - rail - tick) / 2;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "axis-ticks");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", String(horizontal ? along : metrics.yearLabelWidth));
    svg.setAttribute("height", String(horizontal ? metrics.axisHeight : crossSize));
    for (let year = TIMELINE_START; year <= TIMELINE_END; year += 1) {
      const slot = ascending ? year - TIMELINE_START : TIMELINE_END - year;
      const pos = slot * unit;
      const isDecade = year % 10 === 0;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute(
        "class",
        isDecade ? "tick-decade" : year % 5 === 0 ? "tick-major" : "tick-minor"
      );
      if (horizontal) {
        line.setAttribute("x1", String(pos));
        line.setAttribute("x2", String(pos));
        line.setAttribute("y1", String(cross));
        line.setAttribute("y2", String(cross + tick));
      } else {
        line.setAttribute("y1", String(pos));
        line.setAttribute("y2", String(pos));
        line.setAttribute("x1", String(cross));
        line.setAttribute("x2", String(cross + tick));
      }
      svg.appendChild(line);
    }
    return svg;
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
    axis.appendChild(renderAxisTicks(metrics));
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
    <span class="axis-corner-label axis-corner-country">${labels().escapeHtml(timelineData().polityLabel || "State")}</span>
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

  window.TimelineChartAxis = {
    applyYearGridOffsets,
    congressSpans,
    congressTitle,
    renderCongressLayer,
    renderYearAxis,
    renderAxisCorner,
    renderYearAxisColumn,
    renderAxisRow,
  };
})();
