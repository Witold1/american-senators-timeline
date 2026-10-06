/**
 * Collapsible environment info for bug reports (below the page).
 */
(function () {
  const APP_VERSION = "0.1.0-public-beta";

  let open = false;
  let copyDone = false;
  let lastError = null;
  let copyResetTimer = null;

  const root = document.getElementById("debug-section");
  if (!root) return;

  const toggleBtn = root.querySelector("[data-debug-toggle]");
  const panel = root.querySelector("[data-debug-panel]");
  const techLinesEl = root.querySelector("[data-debug-lines-tech]");
  const appLinesEl = root.querySelector("[data-debug-lines-app]");
  const errorActions = root.querySelector("[data-debug-error-actions]");
  const clearBtn = root.querySelector("[data-debug-clear-error]");
  const copyBtn = root.querySelector("[data-debug-copy]");

  function currentTheme() {
    const resolved = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const pref = document.documentElement.dataset.themePref || resolved;
    return pref === resolved ? resolved : `${pref}→${resolved}`;
  }

  function visibleFlag(id, fallback = true) {
    const el = document.getElementById(id);
    if (!el) return fallback ? "yes" : "no";
    return el.checked ? "yes" : "no";
  }

  function buildSections() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sw = window.screen?.width ?? 0;
    const sh = window.screen?.height ?? 0;
    const data = window.TIMELINE_DATA;
    const q = document.getElementById("search")?.value?.trim() || "";

    const technical = [
      { key: "viewport", value: `${w} × ${h}` },
      { key: "screen", value: `${sw} × ${sh}` },
      { key: "devicePixelRatio", value: String(window.devicePixelRatio ?? "") },
      {
        key: "timezone",
        value: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "n/a",
      },
      { key: "language", value: navigator.language || "n/a" },
      { key: "theme", value: currentTheme() },
    ];

    if (typeof window.__lastTimelineRenderMs === "number") {
      technical.push({
        key: "lastRenderMs",
        value: `${window.__lastTimelineRenderMs.toFixed(1)} ms`,
      });
    }

    if (lastError) {
      technical.push({ key: "lastError", value: lastError.message });
      if (lastError.stack) {
        technical.push({ key: "lastErrorStack", value: lastError.stack });
      }
    }

    if (navigator.userAgent) {
      technical.push({ key: "userAgent", value: navigator.userAgent });
    }

    const substantial = [
      { key: "version", value: APP_VERSION },
      {
        key: "seats",
        value: data?.seats?.length != null ? String(data.seats.length) : "n/a",
      },
      {
        key: "timeline",
        value:
          data?.TIMELINE_START != null && data?.TIMELINE_END != null
            ? `${data.TIMELINE_START}-${data.TIMELINE_END}`
            : "n/a",
      },
      { key: "filter", value: q || "(none)" },
      {
        key: "order",
        value: `${window.TimelineFilters?.getOrderMode?.() || "name"} ${window.TimelineFilters?.getOrderDir?.() || "asc"}`,
      },
      {
        key: "regionFilter",
        value: window.TimelineFilters?.getRegionFilter?.() || "all",
      },
      {
        key: "timeRange",
        value: window.TimelineFilters?.getTimeRangeFilter?.() || "all",
      },
      {
        key: "yearOrder",
        value: window.TimelineFilters?.getYearOrder?.() || "descending",
      },
      {
        key: "palette",
        value: document.documentElement.dataset.palette || "vivid",
      },
      { key: "senators", value: visibleFlag("show-ruler-bars") },
      { key: "names", value: visibleFlag("show-bar-labels") },
      { key: "shortNames", value: visibleFlag("short-bar-labels", true) },
      { key: "dynamicNameColors", value: visibleFlag("dynamic-bar-label-colors", true) },
      { key: "admissionYear", value: visibleFlag("show-admission-year", false) },
      { key: "regions", value: visibleFlag("show-regions", true) },
      { key: "congresses", value: visibleFlag("show-congresses", true) },
      { key: "historicalParties", value: visibleFlag("show-party-detail", false) },
    ];

    return { technical, substantial };
  }

  function fillLines(container, lines) {
    container.innerHTML = "";
    for (const { key, value } of lines) {
      const row = document.createElement("div");
      row.className = "debug-line";
      const keyEl = document.createElement("span");
      keyEl.className = "debug-key";
      keyEl.textContent = `${key}:`;
      const valueEl = document.createElement("span");
      valueEl.className = "debug-value";
      valueEl.textContent = value;
      row.append(keyEl, valueEl);
      container.appendChild(row);
    }
  }

  function renderPanel() {
    const { technical, substantial } = buildSections();
    fillLines(techLinesEl, technical);
    fillLines(appLinesEl, substantial);
    errorActions.hidden = !lastError;
    copyBtn.textContent = copyDone ? "Copied!" : "Copy to clipboard";
  }

  function setOpen(next) {
    open = next;
    panel.hidden = !open;
    toggleBtn.setAttribute("aria-expanded", String(open));
    toggleBtn.textContent = open
      ? "Hide environment info (for bug reports)"
      : "Show environment info (for bug reports)";
    if (open) renderPanel();
  }

  function copyText() {
    const { technical, substantial } = buildSections();
    const blocks = [
      ["[Environment]", technical],
      ["[Timeline]", substantial],
    ];
    return blocks
      .map(([heading, lines]) =>
        [heading, ...lines.map(({ key, value }) => `${key}: ${value}`)].join("\n")
      )
      .join("\n\n");
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(copyText());
      copyDone = true;
      copyBtn.textContent = "Copied!";
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => {
        copyDone = false;
        if (open) copyBtn.textContent = "Copy to clipboard";
      }, 2000);
    } catch {
      copyDone = false;
      copyBtn.textContent = "Copy failed";
    }
  }

  toggleBtn.addEventListener("click", () => setOpen(!open));
  clearBtn.addEventListener("click", () => {
    lastError = null;
    if (open) renderPanel();
  });
  copyBtn.addEventListener("click", copyToClipboard);

  window.addEventListener("resize", () => {
    if (open) renderPanel();
  });
  window.addEventListener("timeline-theme-change", () => {
    if (open) renderPanel();
  });
  window.addEventListener("timeline-palette-change", () => {
    if (open) renderPanel();
  });
  window.addEventListener("timeline-debug-refresh", () => {
    if (open) renderPanel();
  });
  window.addEventListener("timeline-data-ready", () => {
    if (open) renderPanel();
  });

  document.getElementById("search")?.addEventListener("input", () => {
    if (open) renderPanel();
  });
  document.querySelectorAll("#settings-panel input").forEach((input) => {
    input.addEventListener("change", () => {
      if (open) renderPanel();
    });
  });

  window.addEventListener("error", (event) => {
    const err = event.error || event;
    lastError = {
      message: event.message || err?.message || String(event),
      stack: err?.stack || "",
    };
    if (open) renderPanel();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    lastError = {
      message: reason?.message || String(reason),
      stack: reason?.stack || "",
    };
    if (open) renderPanel();
  });

  setOpen(false);
})();
