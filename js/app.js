/**
 * Boot glue for the timeline page.
 *
 * Public window API (after scripts load / data ready):
 *   TIMELINE_DATA                 - loaded dataset (load.js)
 *   renderTimeline                - rebuild chart DOM
 *   applyTimelineFilters          - re-apply search filter
 *   getTimelineMetrics            - orientation-aware metrics
 *   TimelineGeometry              - year mapping + layout metrics
 *   TimelinePalette               - party / person bar colors
 *   TimelineLabels                - name formatting + bar labels
 *   TimelineInteraction           - tooltips
 *   TimelineFilters               - view/filter state + search
 *   TimelineControls              - settings panel + display toggles
 *   TimelineFilterControls        - chip filter UI
 *   TimelineRender                - chart DOM render
 *   TimelineTheme / TimelineExport - feature modules
 */
(function () {
  const scrollEl = document.getElementById("timeline-scroll");
  const xScrollEl = document.getElementById("timeline-xscroll");
  const xScrollThumb = xScrollEl?.querySelector(".timeline-xscroll-thumb");
  const xScrollSteps = xScrollEl ? [...xScrollEl.querySelectorAll(".timeline-xscroll-step")] : [];
  const MIN_THUMB = 72;

  function stepInset() {
    let prev = 0;
    let next = 0;
    for (const button of xScrollSteps) {
      const width = button.offsetWidth;
      if (button.dataset.scrollDir === "-1") prev = width;
      else next = width;
    }
    return { prev, next, span: prev + next };
  }

  function xScrollRange() {
    const max = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    const track = Math.max(1, xScrollEl.clientWidth - stepInset().span);
    const thumb = Math.min(track, Math.max(MIN_THUMB, Math.round(track * (scrollEl.clientWidth / scrollEl.scrollWidth))));
    const travel = Math.max(1, track - thumb);
    return { max, track, thumb, travel };
  }

  function layoutXScroll() {
    if (!scrollEl || !xScrollEl || !xScrollThumb) return;
    const overflowX = scrollEl.scrollWidth - scrollEl.clientWidth > 1;
    xScrollEl.hidden = !overflowX;
    if (!overflowX) return;
    const header = document.querySelector(".header");
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--header-h", `${headerH}px`);
    const panel = xScrollEl.parentElement;
    const scrollBox = scrollEl.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    xScrollEl.style.width = `${scrollEl.clientWidth}px`;
    xScrollEl.style.marginLeft = `${scrollBox.left - panelBox.left}px`;
    const { max, thumb, travel } = xScrollRange();
    const left = max > 0 ? (scrollEl.scrollLeft / max) * travel : 0;
    const { prev } = stepInset();
    xScrollThumb.style.width = `${thumb}px`;
    xScrollThumb.style.transform = `translateX(${prev + left}px)`;
    for (const button of xScrollSteps) {
      const atEnd = button.dataset.scrollDir === "-1"
        ? scrollEl.scrollLeft <= 1
        : max - scrollEl.scrollLeft <= 1;
      button.classList.toggle("is-disabled", atEnd);
      button.setAttribute("aria-disabled", atEnd ? "true" : "false");
    }
    xScrollEl.setAttribute("aria-valuemax", String(Math.round(max)));
    xScrollEl.setAttribute("aria-valuenow", String(Math.round(scrollEl.scrollLeft)));
  }

  function scrollByThumbDelta(dx, startLeft) {
    const { max, travel } = xScrollRange();
    scrollEl.scrollLeft = startLeft + (dx / travel) * max;
  }

  function resetScrollForOrientation() {
    requestAnimationFrame(() => {
      const metrics = window.getTimelineMetrics?.();
      if (!metrics || !scrollEl) return;

      if (metrics.orientation === "horizontal") {
        const data = window.TIMELINE_DATA;
        const geo = window.TimelineGeometry || {};
        const { yearToX, timelineBounds } = geo;
        if (data && yearToX) {
          const bounds = timelineBounds?.() || {
            start: data.TIMELINE_START,
            end: data.TIMELINE_END,
          };
          const focusYear = Math.max(bounds.start, bounds.end - 20);
          const x = yearToX(focusYear, 1, 1, metrics) - 80;
          scrollEl.scrollLeft = Math.max(0, x);
        } else {
          scrollEl.scrollLeft = 0;
        }
        scrollEl.scrollTop = 0;
        layoutXScroll();
        return;
      }

      scrollEl.scrollTop = 0;
      scrollEl.scrollLeft = 0;
      layoutXScroll();
    });
  }

  function rerender() {
    if (typeof window.renderTimeline === "function") window.renderTimeline();
    requestAnimationFrame(layoutXScroll);
  }

  function initTimelineApp() {
    const data = window.TIMELINE_DATA;
    if (!data?.seats?.length || window.__timelineAppInitialized) return;
    window.__timelineAppInitialized = true;

    window.TimelineTheme?.init();
    window.TimelineExport?.init();

    rerender();
    resetScrollForOrientation();
  }

  if (scrollEl && xScrollEl && xScrollThumb) {
    scrollEl.addEventListener("scroll", () => layoutXScroll(), { passive: true });

    xScrollThumb.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startLeft = scrollEl.scrollLeft;
      xScrollThumb.classList.add("is-dragging");
      xScrollThumb.setPointerCapture(event.pointerId);
      const move = (ev) => scrollByThumbDelta(ev.clientX - startX, startLeft);
      const end = (ev) => {
        xScrollThumb.classList.remove("is-dragging");
        if (xScrollThumb.hasPointerCapture(ev.pointerId)) {
          xScrollThumb.releasePointerCapture(ev.pointerId);
        }
        xScrollThumb.removeEventListener("pointermove", move);
        xScrollThumb.removeEventListener("pointerup", end);
        xScrollThumb.removeEventListener("pointercancel", end);
      };
      xScrollThumb.addEventListener("pointermove", move);
      xScrollThumb.addEventListener("pointerup", end);
      xScrollThumb.addEventListener("pointercancel", end);
    });

    function stepScroll(dir) {
      const step = Math.max(48, scrollEl.clientWidth * 0.1);
      scrollEl.scrollLeft += dir * step;
    }

    for (const button of xScrollSteps) {
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (button.classList.contains("is-disabled")) return;
        event.preventDefault();
        stepScroll(Number(button.dataset.scrollDir));
      });
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || button.classList.contains("is-disabled")) return;
        event.stopPropagation();
        const dir = Number(button.dataset.scrollDir);
        stepScroll(dir);
        let repeat = null;
        const hold = setTimeout(() => {
          repeat = setInterval(() => stepScroll(dir), 80);
        }, 280);
        const end = () => {
          clearTimeout(hold);
          clearInterval(repeat);
          if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId);
          }
          button.removeEventListener("pointerup", end);
          button.removeEventListener("pointercancel", end);
        };
        button.setPointerCapture(event.pointerId);
        button.addEventListener("pointerup", end);
        button.addEventListener("pointercancel", end);
      });
    }

    xScrollEl.addEventListener("pointerdown", (event) => {
      if (event.target === xScrollThumb || event.target.closest(".timeline-xscroll-step")) return;
      const rect = xScrollEl.getBoundingClientRect();
      const { max, thumb, travel } = xScrollRange();
      const { prev } = stepInset();
      const x = event.clientX - rect.left - prev - thumb / 2;
      const next = Math.min(travel, Math.max(0, x));
      scrollEl.scrollLeft = (next / travel) * max;
      xScrollEl.focus();
    });

    xScrollEl.addEventListener(
      "wheel",
      (event) => {
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        scrollEl.scrollLeft += delta;
        event.preventDefault();
      },
      { passive: false }
    );

    xScrollEl.addEventListener("keydown", (event) => {
      const step = Math.max(48, scrollEl.clientWidth * 0.1);
      if (event.key === "ArrowRight") scrollEl.scrollLeft += step;
      else if (event.key === "ArrowLeft") scrollEl.scrollLeft -= step;
      else if (event.key === "Home") scrollEl.scrollLeft = 0;
      else if (event.key === "End") scrollEl.scrollLeft = scrollEl.scrollWidth;
      else return;
      event.preventDefault();
    });

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => layoutXScroll());
      observer.observe(scrollEl);
      const timelineEl = document.getElementById("timeline");
      if (timelineEl) observer.observe(timelineEl);
    }
  }

  window.TimelineControls?.init();

  window.addEventListener("timeline-data-ready", initTimelineApp);
  if (window.TIMELINE_DATA?.seats?.length) initTimelineApp();

  window.addEventListener("timeline-theme-change", () => {
    window.TimelineGeometry?.invalidateCaches?.();
    rerender();
  });

  window.addEventListener("timeline-palette-change", () => {
    window.TimelinePalette?.invalidate?.();
    rerender();
  });

  window.addEventListener("timeline-orientation-change", () => {
    rerender();
    resetScrollForOrientation();
  });

  window.addEventListener("timeline-year-order-change", () => {
    rerender();
    resetScrollForOrientation();
  });

  window.addEventListener("timeline-time-range-change", () => {
    resetScrollForOrientation();
  });

  window.addEventListener("resize", () => {
    clearTimeout(window._timelineResizeTimer);
    window._timelineResizeTimer = setTimeout(() => {
      layoutXScroll();
      if (typeof window.renderTimeline !== "function") return;
      window.TimelineGeometry?.invalidateLayoutCache?.();
      const metrics = window.getTimelineMetrics?.();
      if (!metrics) return;
      const key = window.timelineMetricsKey?.(metrics);
      if (key && key === window.__timelineMetricsKey) return;
      rerender();
    }, 150);
  });
})();
