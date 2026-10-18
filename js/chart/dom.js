/**
 * Handles shared by the chart scripts: the timeline element, the open dataset, and the other chart tools.
 */
(function () {
  const timelineEl = document.getElementById("timeline");
  const geo = () => window.TimelineGeometry;
  const palette = () => window.TimelinePalette;
  const labels = () => window.TimelineLabels;
  const filters = () => window.TimelineFilters;
  const interaction = () => window.TimelineInteraction;

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

  window.TimelineChartDom = {
    timelineEl,
    geo,
    palette,
    labels,
    filters,
    interaction,
    timelineData,
    seats,
    displayBounds,
  };
})();
