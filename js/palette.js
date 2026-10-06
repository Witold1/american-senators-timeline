/**
 * Senator bar colors: party map, person-mode palette, label contrast.
 */
(function () {
  const PALETTE_VARS = [
    "--palette-1",
    "--palette-2",
    "--palette-3",
    "--palette-4",
    "--palette-5",
    "--palette-6",
    "--palette-7",
  ];

  /** Normalized party name → CSS variable (stable across seats). */
  const PARTY_COLOR_VARS = {
    democrat: "--party-democrat",
    democratic: "--party-democrat",
    republican: "--party-republican",
    whig: "--party-whig",
    federalist: "--party-federalist",
    "democratic-republican": "--party-democratic-republican",
    "democratic republican": "--party-democratic-republican",
    "anti-administration": "--party-other",
    "pro-administration": "--party-federalist",
    jackson: "--party-democrat",
    jacksonian: "--party-democrat",
    "anti-jackson": "--party-whig",
    "national republican": "--party-whig",
    "free soil": "--party-other",
    american: "--party-other",
    "know nothing": "--party-other",
    unionist: "--party-other",
    "unconditional unionist": "--party-other",
    "liberal republican": "--party-other",
    populist: "--party-other",
    progressive: "--party-other",
    "silver republican": "--party-republican",
    independent: "--party-independent",
    "independent democrat": "--party-independent",
    "independent republican": "--party-independent",
  };

  let rulerPaletteCache = null;
  let themeVarsCache = null;
  let partyColorCache = null;

  function readThemeVars() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      stripe: read("--palette-stripe") || "rgba(0,0,0,0.07)",
      labelScrimLightFg: read("--label-scrim-light-fg"),
      labelScrimDarkFg: read("--label-scrim-dark-fg"),
      partyColors: Object.fromEntries(
        [
          "--party-democrat",
          "--party-republican",
          "--party-whig",
          "--party-federalist",
          "--party-democratic-republican",
          "--party-independent",
          "--party-other",
        ].map((name) => [name, read(name)])
      ),
      palette: PALETTE_VARS.map((key) => read(key)).filter(Boolean),
    };
  }

  function themeVars() {
    if (!themeVarsCache) themeVarsCache = readThemeVars();
    return themeVarsCache;
  }

  function readRulerPalette() {
    const vars = themeVars();
    return vars.palette.map((color) => ({
      color,
      stripe: vars.stripe,
    }));
  }

  function rulerPalette(index) {
    if (!rulerPaletteCache) rulerPaletteCache = readRulerPalette();
    const palette = rulerPaletteCache;
    if (!palette.length) {
      return { color: "#8f8f8a", stripe: "rgba(0,0,0,0.07)" };
    }
    return palette[index % palette.length];
  }

  function invalidate() {
    rulerPaletteCache = null;
    themeVarsCache = null;
    partyColorCache = null;
  }

  function normalizeLeaderName(name) {
    return name.trim().toLowerCase();
  }

  function normalizeParty(party) {
    return String(party || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, " ");
  }

  /** Parties that stay distinct when historical parties are collapsed. */
  const MAJOR_PARTY_VARS = new Set(["--party-democrat", "--party-republican"]);

  function partyDetailEnabled() {
    return document.documentElement.classList.contains("party-detail-enabled");
  }

  function partyPalette(party) {
    if (!partyColorCache) partyColorCache = new Map();
    const key = normalizeParty(party);
    const detail = partyDetailEnabled();
    const cacheKey = `${detail ? "d" : "c"}:${key}`;
    if (partyColorCache.has(cacheKey)) return partyColorCache.get(cacheKey);

    const vars = themeVars();
    let varName = PARTY_COLOR_VARS[key] || "--party-other";
    if (!detail && !MAJOR_PARTY_VARS.has(varName)) {
      varName = "--party-other";
    }
    const color = vars.partyColors[varName];
    const entry = color ? { color, stripe: vars.stripe } : rulerPalette(0);
    partyColorCache.set(cacheKey, entry);
    return entry;
  }

  /**
   * @param {object[]} leaders
   * @param {"party" | "person"} [colorMode]
   */
  function buildLeaderPaletteMap(leaders, colorMode = "party") {
    const map = new Map();
    let nextIndex = 0;
    const byPerson = colorMode === "person";

    for (const leader of leaders) {
      const key = normalizeLeaderName(leader.name);
      if (map.has(key)) continue;
      if (!byPerson && leader.party) {
        map.set(key, partyPalette(leader.party));
      } else {
        map.set(key, rulerPalette(nextIndex));
        nextIndex += 1;
      }
    }
    return map;
  }

  function parseHexColor(hex) {
    const value = hex.replace("#", "");
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  /** Contrast-aware label colors — ink on bar, no scrim pill. */
  function barLabelTheme(hex) {
    const { r, g, b } = parseHexColor(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const vars = themeVars();
    if (luminance > 0.58) {
      return {
        fg: vars.labelScrimLightFg,
        bg: "transparent",
      };
    }
    return {
      fg: vars.labelScrimDarkFg,
      bg: "transparent",
    };
  }

  window.TimelinePalette = {
    invalidate,
    normalizeLeaderName,
    buildLeaderPaletteMap,
    partyPalette,
    barLabelTheme,
  };
})();
