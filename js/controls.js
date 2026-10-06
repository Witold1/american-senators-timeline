/**
 * Settings panel and display-layer toggles (localStorage + html class flags).
 * Chip filters: filter-controls.js. Region visibility notifies FilterControls.
 */
(function () {
  /**
   * @param {string} checkboxId
   * @param {string} storageKey
   * @param {string} className - toggled on <html>
   * @param {{ defaultVisible?: boolean, mode?: "hide" | "enable", onChange?: (visible: boolean) => void }} [options]
   *   mode "hide" (default): add className when layer is hidden
   *   mode "enable": add className when layer is visible
   */
  function initDisplayToggle(checkboxId, storageKey, className, options = {}) {
    const { defaultVisible = true, mode = "hide", onChange } = options;
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;

    function apply() {
      const visible = checkbox.checked;
      const on = mode === "enable" ? visible : !visible;
      document.documentElement.classList.toggle(className, on);
      try {
        localStorage.setItem(storageKey, visible ? "1" : "0");
      } catch {
        /* ignore */
      }
      onChange?.(visible);
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "0") checkbox.checked = false;
      else if (stored === "1") checkbox.checked = true;
      else checkbox.checked = defaultVisible;
    } catch {
      /* ignore */
    }

    checkbox.addEventListener("change", apply);
    apply();
  }

  function initSettingsPanel() {
    const btn = document.getElementById("settings-btn");
    const panel = document.getElementById("settings-panel");
    if (!btn || !panel) return;

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.classList.toggle("is-open", open);
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(panel.hidden);
    });

    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("click", () => {
      if (!panel.hidden) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });
  }

  function initDisplayToggles() {
    initDisplayToggle("show-ruler-bars", "timeline-ruler-bars-visible", "ruler-bars-hidden");
    initDisplayToggle("show-bar-labels", "timeline-bar-labels-visible", "bar-labels-hidden", {
      onChange: (visible) => {
        for (const id of ["short-bar-labels", "dynamic-bar-label-colors"]) {
          const el = document.getElementById(id);
          if (el) el.disabled = !visible;
        }
      },
    });
    initDisplayToggle("short-bar-labels", "timeline-short-bar-labels", "short-bar-labels", {
      defaultVisible: true,
      mode: "enable",
      onChange: () => window.TimelineLabels?.refreshBarLabels?.(),
    });
    initDisplayToggle(
      "dynamic-bar-label-colors",
      "timeline-dynamic-bar-label-colors",
      "dynamic-bar-label-colors",
      {
        defaultVisible: true,
        mode: "enable",
        onChange: () => window.TimelineLabels?.refreshBarLabels?.(),
      }
    );
    initDisplayToggle(
      "show-admission-year",
      "timeline-admission-year-visible",
      "admission-year-hidden",
      { defaultVisible: false }
    );
    initDisplayToggle(
      "show-regions",
      "timeline-regions-visible",
      "regions-enabled",
      {
        defaultVisible: true,
        mode: "enable",
        onChange: () => window.TimelineFilterControls?.onRegionsVisibilityChange?.(),
      }
    );
    // Congress bands used to default off, and that off state was saved on first load.
    // Drop that saved off once so the new default (on) applies. A later toggle still sticks.
    try {
      if (localStorage.getItem("timeline-congresses-default") !== "on") {
        if (localStorage.getItem("timeline-congresses-visible") === "0") {
          localStorage.removeItem("timeline-congresses-visible");
        }
        localStorage.setItem("timeline-congresses-default", "on");
      }
    } catch {
      /* ignore */
    }
    initDisplayToggle(
      "show-congresses",
      "timeline-congresses-visible",
      "congresses-enabled",
      {
        defaultVisible: true,
        mode: "enable",
        onChange: () => {
          window.TimelineGeometry?.invalidateCaches?.();
          if (typeof window.renderTimeline === "function") window.renderTimeline();
        },
      }
    );
    initDisplayToggle(
      "show-party-detail",
      "timeline-party-detail",
      "party-detail-enabled",
      {
        defaultVisible: false,
        mode: "enable",
        onChange: () => {
          window.TimelinePalette?.invalidate?.();
          if (typeof window.renderTimeline === "function") window.renderTimeline();
        },
      }
    );
  }

  function init() {
    initSettingsPanel();
    // Chips first so region preference exists before the regions toggle applies.
    window.TimelineFilterControls?.init();
    initDisplayToggles();
  }

  window.TimelineControls = { init };
})();
