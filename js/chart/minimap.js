/**
 * Bird's-eye strip. One canvas, colored the same way as the chart, redrawn
 * when the chart or its colors change. Scroll only moves the viewport box.
 *
 * The strip sits under the header with the sideways scroller and stays on
 * screen while the chart scrolls. Time runs left-to-right and seats
 * top-to-bottom, in the same order as the chart. A vertical chart maps page
 * scroll onto the strip's width, and sideways scroll onto its height.
 */
(function () {
  const STRIP_MAX = 56;
  const host = document.getElementById("minimap");
  const frame = document.getElementById("minimap-frame");
  const canvas = document.getElementById("minimap-canvas");
  const box = document.getElementById("minimap-viewport");
  const yearStartEl = document.getElementById("minimap-year-start");
  const yearEndEl = document.getElementById("minimap-year-end");
  const scrollEl = document.getElementById("timeline-scroll");

  if (!host || !frame || !canvas || !box || !scrollEl) return;

  let drawnKey = "";
  let scheduled = false;
  let wantDraw = false;
  let drag = null;
  let view = { time: { start: 0, end: 1 }, seat: { start: 0, end: 1 } };

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function horizontalChart() {
    return document.documentElement.dataset.orientation === "horizontal";
  }

  function syncHeaderHeight() {
    const header = document.querySelector(".header");
    const height = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--header-h", `${height}px`);
  }

  function schedule(draw) {
    wantDraw = wantDraw || draw;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const drawNow = wantDraw;
      wantDraw = false;
      if (drawNow) paint();
      syncPresence();
      placeViewport();
      syncHeaderHeight();
    });
  }

  function syncPresence() {
    frame.tabIndex = host.hidden ? -1 : 0;
  }

  function visibleRows() {
    const timeline = document.getElementById("timeline");
    if (!timeline) return [];
    return [...timeline.querySelectorAll(".state-group:not(.hidden) .country-row")];
  }

  function paintKey(rows) {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return [
      frame.clientWidth,
      rows.length,
      rows.map((row) => row.dataset.seatId || "").join(","),
      root.dataset.orientation,
      root.dataset.yearOrder,
      root.dataset.palette,
      colorMode(),
      root.dataset.theme,
      root.classList.contains("party-detail-enabled") ? "detail" : "major",
      style.getPropertyValue("--party-democrat").trim(),
      style.getPropertyValue("--chart-bg").trim(),
      window.TimelineGeometry?.timelineBounds?.()?.start,
      window.TimelineGeometry?.timelineBounds?.()?.end,
    ].join("|");
  }

  /** Whatever Color by is set to. Datasets can add modes beyond party and person. */
  function colorMode() {
    return (
      window.TimelineFilters?.getColorMode?.() ||
      document.documentElement.dataset.colorMode ||
      ""
    );
  }

  function unitFrac(bounds, ascending, year, month, day) {
    const span = bounds.end - bounds.start + 1;
    if (span <= 0) return 0;
    let raw = (year + (month - 1) / 12 + (day - 1) / 365 - bounds.start) / span;
    if (!ascending) raw = 1 - raw;
    return raw;
  }

  /** Fractions along the strip for one term. Null when it misses the visible years. */
  function leaderSpan(leader, bounds, ascending) {
    const startYear = Number(leader.start);
    if (!Number.isFinite(startYear)) return null;
    const endYear = Number.isFinite(Number(leader.end)) ? Number(leader.end) : bounds.end;
    const startMonth = Number(leader.startMonth) || 1;
    const startDay = Number(leader.startDay) || 1;
    const endMonth = Number(leader.endMonth) || 12;
    const endDay = Number(leader.endDay) || 15;
    const f0 =
      startYear < bounds.start
        ? ascending
          ? 0
          : 1
        : unitFrac(bounds, ascending, startYear, startMonth, startDay);
    const throughEnd =
      endYear > bounds.end || (endYear === bounds.end && endMonth === 12 && endDay >= 28);
    const f1 = throughEnd
      ? ascending
        ? 1
        : 0
      : unitFrac(bounds, ascending, endYear, endMonth, endDay);
    const lo = Math.max(0, Math.min(f0, f1));
    const hi = Math.min(1, Math.max(f0, f1));
    if (hi - lo <= 0) return null;
    return { lo, hi };
  }

  function paint() {
    const rows = visibleRows();
    if (!rows.length) {
      host.hidden = true;
      drawnKey = "";
      return;
    }
    host.hidden = false;
    const key = paintKey(rows);
    if (!frame.clientWidth || key === drawnKey) return;

    const geo = window.TimelineGeometry;
    const palette = window.TimelinePalette;
    const body = document.querySelector(".timeline-body");
    const bounds = geo?.timelineBounds?.();
    if (!geo || !palette || !body || bounds?.start == null || bounds?.end == null) return;

    const horizontal = horizontalChart();
    const bodyRect = body.getBoundingClientRect();
    const bodySpan = horizontal ? bodyRect.height : bodyRect.width;
    if (bodySpan <= 0) return;

    const slots = [];
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const start = horizontal
        ? (rect.top - bodyRect.top) / bodySpan
        : (rect.left - bodyRect.left) / bodySpan;
      const size = (horizontal ? rect.height : rect.width) / bodySpan;
      if (size <= 0) continue;
      slots.push({ row, start, size });
    }
    if (!slots.length) return;

    const cssH = Math.min(STRIP_MAX, Math.max(40, rows.length * 2));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(frame.clientWidth * dpr));
    const height = Math.max(1, Math.round(cssH * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pageStyle = getComputedStyle(document.documentElement);
    ctx.fillStyle = pageStyle.getPropertyValue("--chart-bg").trim() || "#171d2b";
    ctx.fillRect(0, 0, width, height);

    const ascending = geo.getYearOrder?.() === "ascending";
    const seats = new Map((window.TIMELINE_DATA?.seats || []).map((seat) => [seat.id, seat]));
    for (const slot of slots) {
      const seat = seats.get(slot.row.dataset.seatId || "");
      if (!seat) continue;
      const y0 = Math.round(slot.start * height);
      const y1 = Math.round((slot.start + slot.size) * height);
      const rowH = Math.max(1, y1 - y0);
      const rulers = (seat.rulers || [])
        .slice()
        .sort((a, b) => (a.start || 0) - (b.start || 0));
      const leaderColors = palette.buildLeaderPaletteMap(rulers, colorMode(), seat);
      for (const leader of rulers) {
        const span = leaderSpan(leader, bounds, ascending);
        if (!span) continue;
        const color =
          leaderColors.get(palette.normalizeLeaderName(leader.name))?.color || "#8f8f8a";
        const x0 = span.lo * width;
        const x1 = span.hi * width;
        ctx.fillStyle = color;
        ctx.fillRect(x0, y0, Math.max(1, x1 - x0), rowH);
      }
    }

    if (yearStartEl) yearStartEl.textContent = String(ascending ? bounds.start : bounds.end);
    if (yearEndEl) yearEndEl.textContent = String(ascending ? bounds.end : bounds.start);
    drawnKey = key;
  }

  function spanAlong(origin, size, view0, view1) {
    if (size <= 0) return { start: 0, end: 1 };
    const start = clamp01((view0 - origin) / size);
    const end = clamp01((view1 - origin) / size);
    return { start, end: Math.max(start, end) };
  }

  function clipY() {
    let top = 0;
    const header = document.querySelector(".header");
    const nav = document.getElementById("chart-nav");
    if (header) top = Math.max(top, header.getBoundingClientRect().bottom);
    if (nav) top = Math.max(top, nav.getBoundingClientRect().bottom);
    if (horizontalChart()) {
      const axis = document.querySelector(".axis-row");
      if (axis) top = Math.max(top, axis.getBoundingClientRect().bottom);
    } else {
      const label = document.querySelector(".state-group:not(.hidden) .country-label");
      if (label) top = Math.max(top, label.getBoundingClientRect().bottom);
    }
    return { top: Math.max(0, top), bottom: window.innerHeight };
  }

  function clipX() {
    const scrollRect = scrollEl.getBoundingClientRect();
    let left = scrollRect.left;
    const right = scrollRect.right;
    if (horizontalChart()) {
      const labels = document.querySelectorAll(".state-group:not(.hidden) .country-label");
      let found = false;
      for (const label of labels) {
        const rect = label.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        if (rect.right > left && rect.right < right) left = rect.right;
        found = true;
        break;
      }
      if (!found) {
        const labelW =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--label-w")
          ) || 0;
        left = Math.max(left, scrollRect.left + labelW);
      }
    } else {
      const axis = document.querySelector(".year-axis-col");
      if (axis) {
        const edge = axis.getBoundingClientRect().right;
        if (edge > left && edge < right) left = edge;
      }
    }
    return { left, right };
  }

  function placeViewport() {
    if (host.hidden) return;
    const track = document.querySelector(".state-group:not(.hidden) .country-track");
    const body = document.querySelector(".timeline-body");
    if (!track || !body) return;
    const horizontal = horizontalChart();
    const trackRect = track.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const yClip = clipY();
    const xClip = clipX();
    const time = horizontal
      ? spanAlong(trackRect.left, trackRect.width, xClip.left, xClip.right)
      : spanAlong(trackRect.top, trackRect.height, yClip.top, yClip.bottom);
    const seat = horizontal
      ? spanAlong(bodyRect.top, bodyRect.height, yClip.top, yClip.bottom)
      : spanAlong(bodyRect.left, bodyRect.width, xClip.left, xClip.right);
    view = { time, seat };
    box.style.left = `${time.start * 100}%`;
    box.style.width = `${Math.max(0, time.end - time.start) * 100}%`;
    box.style.top = `${seat.start * 100}%`;
    box.style.height = `${Math.max(0, seat.end - seat.start) * 100}%`;
  }

  function jump(timeFrac, seatFrac) {
    const track = document.querySelector(".state-group:not(.hidden) .country-track");
    const body = document.querySelector(".timeline-body");
    if (!track || !body) return;
    // Keep the aimed center before the scroll listener measures the real window,
    // so a drag can accumulate more than one move per frame.
    const time = clamp01(timeFrac);
    const seat = clamp01(seatFrac);
    view = { time: { start: time, end: time }, seat: { start: seat, end: seat } };
    const horizontal = horizontalChart();
    const trackRect = track.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const yClip = clipY();
    const xClip = clipX();
    const timeMid = horizontal
      ? (xClip.left + xClip.right) / 2
      : (yClip.top + yClip.bottom) / 2;
    const seatMid = horizontal
      ? (yClip.top + yClip.bottom) / 2
      : (xClip.left + xClip.right) / 2;
    const timePoint = horizontal
      ? trackRect.left + time * trackRect.width
      : trackRect.top + time * trackRect.height;
    const seatPoint = horizontal
      ? bodyRect.top + seat * bodyRect.height
      : bodyRect.left + seat * bodyRect.width;
    if (horizontal) {
      scrollEl.scrollLeft += timePoint - timeMid;
      window.scrollBy(0, seatPoint - seatMid);
    } else {
      window.scrollBy(0, timePoint - timeMid);
      scrollEl.scrollLeft += seatPoint - seatMid;
    }
    schedule(false);
  }

  function centerOf(span) {
    return (span.start + span.end) / 2;
  }

  function fractionsFromEvent(event) {
    const rect = frame.getBoundingClientRect();
    return {
      time: clamp01((event.clientX - rect.left) / rect.width),
      seat: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function pointerInsideBox(event) {
    const rect = box.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  frame.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    frame.focus({ preventScroll: true });
    frame.setPointerCapture(event.pointerId);
    frame.classList.add("is-dragging");
    if (pointerInsideBox(event)) {
      drag = { mode: "pan", x: event.clientX, y: event.clientY };
      return;
    }
    drag = { mode: "center" };
    const point = fractionsFromEvent(event);
    jump(point.time, point.seat);
  });

  frame.addEventListener("pointermove", (event) => {
    if (!drag || !frame.hasPointerCapture(event.pointerId)) return;
    if (drag.mode === "center") {
      const point = fractionsFromEvent(event);
      jump(point.time, point.seat);
      return;
    }
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dx = (event.clientX - drag.x) / rect.width;
    const dy = (event.clientY - drag.y) / rect.height;
    drag.x = event.clientX;
    drag.y = event.clientY;
    jump(centerOf(view.time) + dx, centerOf(view.seat) + dy);
  });

  function endDrag(event) {
    drag = null;
    frame.classList.remove("is-dragging");
    if (frame.hasPointerCapture(event.pointerId)) {
      frame.releasePointerCapture(event.pointerId);
    }
  }

  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);

  frame.addEventListener("keydown", (event) => {
    const timeStep = Math.max(0.02, (view.time.end - view.time.start) * 0.45);
    const seatStep = Math.max(0.02, (view.seat.end - view.seat.start) * 0.45);
    const time = centerOf(view.time);
    const seat = centerOf(view.seat);
    if (event.key === "ArrowLeft") jump(time - timeStep, seat);
    else if (event.key === "ArrowRight") jump(time + timeStep, seat);
    else if (event.key === "ArrowUp") jump(time, seat - seatStep);
    else if (event.key === "ArrowDown") jump(time, seat + seatStep);
    else if (event.key === "Home") jump(0, seat);
    else if (event.key === "End") jump(1, seat);
    else return;
    event.preventDefault();
  });

  scrollEl.addEventListener("scroll", () => schedule(false), { passive: true });
  window.addEventListener("scroll", () => schedule(false), { passive: true });
  window.addEventListener("resize", () => schedule(true));

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => schedule(true));
    observer.observe(frame);
  }

  syncHeaderHeight();

  window.TimelineMinimap = {
    refresh: () => schedule(true),
  };
})();
