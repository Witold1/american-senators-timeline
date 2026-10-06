/**
 * System / dark / light theme preference (resolved to light|dark on <html>).
 * Visual switcher matches rulers-lifetimes-and-reigns.
 */
(function () {
  const STORAGE_KEY = "timeline-theme";
  const PREFS = new Set(["system", "dark", "light"]);

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function readStoredPreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (PREFS.has(stored)) return stored;
    } catch {
      /* ignore */
    }
    return "system";
  }

  function resolveTheme(preference) {
    return preference === "system" ? systemTheme() : preference;
  }

  function syncSwitcher(preference) {
    const root = document.getElementById("theme-switcher");
    if (!root) return;
    root.querySelectorAll("[data-theme-pref]").forEach((btn) => {
      const active = btn.dataset.themePref === preference;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function applyTheme(preference, { announce = true } = {}) {
    const pref = PREFS.has(preference) ? preference : "system";
    const theme = resolveTheme(pref);
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePref = pref;
    root.style.colorScheme = theme;
    syncSwitcher(pref);

    if (announce) {
      window.dispatchEvent(
        new CustomEvent("timeline-theme-change", { detail: { theme, preference: pref } })
      );
    }
  }

  function setThemePreference(preference) {
    const pref = PREFS.has(preference) ? preference : "system";
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    applyTheme(pref);
  }

  function getTheme() {
    return resolveTheme(readStoredPreference());
  }

  function getPreference() {
    return readStoredPreference();
  }

  function init() {
    // Theme already applied in <head>; sync controls without a second chart render.
    applyTheme(readStoredPreference(), { announce: false });

    const root = document.getElementById("theme-switcher");
    if (root) {
      root.addEventListener("click", (e) => {
        const btn = e.target.closest?.("[data-theme-pref]");
        if (!btn || !root.contains(btn)) return;
        setThemePreference(btn.dataset.themePref);
      });
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      if (readStoredPreference() === "system") applyTheme("system");
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onSystemChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onSystemChange);
    }
  }

  window.TimelineTheme = {
    init,
    getTheme,
    getPreference,
    setTheme: setThemePreference,
    setThemePreference,
  };
})();
