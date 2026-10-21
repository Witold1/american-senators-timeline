/**
 * Draws the chart: year scale plus one row per polity. Call renderTimeline() after data or layout changes.
 */
(function () {
  const { timelineEl, seats, geo, labels, filters, interaction } = window.TimelineChartDom;
  const { applyYearGridOffsets, renderAxisRow, renderYearAxisColumn } = window.TimelineChartAxis;
  const {
    groupSeatsByState,
    countryColumnLabel,
    applyCountryColumnWidth,
    metricsKey,
    renderStateGroup,
    renderEventMarkers,
    recolorBars,
  } = window.TimelineChartRows;
  function render() {
    const list = seats();
    if (!list.length) return;

    const { getMetrics } = geo();

    const t0 = performance.now();
    const inside = (date) => geo().dateInsideTimeline?.(date);
    const sovereigntyInRange = list.some((seat) => inside(seat.sovereignty));
    const independenceInRange = list.some((seat) => inside(seat.independence));
    document.documentElement.classList.toggle(
      "date-markers",
      sovereigntyInRange || independenceInRange
    );
    document.documentElement.classList.toggle("sovereignty-in-range", sovereigntyInRange);
    document.documentElement.classList.toggle("independence-in-range", independenceInRange);
    filters().resetSeatIndexes?.();
    const groups = groupSeatsByState(list);
    applyCountryColumnWidth(groups.map((group) => countryColumnLabel(group)));
    const metrics = getMetrics();
    metrics.trackLaneCount = Math.max(
      1,
      ...list.map((seat) => Math.max(1, Number(seat.laneCount) || 1))
    );
    applyYearGridOffsets(metrics);
    window.__timelineMetricsKey = metricsKey(metrics);

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
    recolorBars,
    refreshBarLabels: () => labels().refreshBarLabels?.(),
  };
})();
