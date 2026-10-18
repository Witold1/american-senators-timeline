/**
 * Colors for parties and for individual people, and whether a name on a bar should be light or dark.
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

  /** Next palette slot, skipping the color of the ruler this person follows. */
  function nextRulerColor(index, previousColor) {
    let cursor = index;
    let palette = rulerPalette(cursor);
    if (previousColor && palette.color === previousColor) {
      cursor += 1;
      palette = rulerPalette(cursor);
    }
    return { palette, nextIndex: cursor + 1 };
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

  function fieldPalette(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return rulerPalette(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
    }
    return rulerPalette(hash);
  }

  function leaderFieldValue(leader, seat, field) {
    const fromLeader = leader?.[field];
    if (fromLeader != null && fromLeader !== "") return fromLeader;
    const fromFields = seat?.fields?.[field];
    if (fromFields != null && fromFields !== "") return fromFields;
    const fromSeat = seat?.[field];
    if (fromSeat != null && fromSeat !== "") return fromSeat;
    return "";
  }

  /**
   * @param {object[]} leaders
   * @param {string} [colorMode] party, person, or another field id
   * @param {object} [seat]
   */
  function buildLeaderPaletteMap(leaders, colorMode = "party", seat) {
    const map = new Map();
    let nextIndex = 0;
    const byPerson = colorMode === "person";
    const byParty = !colorMode || colorMode === "party";

    let previousColor = "";
    for (const leader of leaders) {
      const key = normalizeLeaderName(leader.name);
      if (map.has(key)) {
        previousColor = map.get(key).color || previousColor;
        continue;
      }
      if (byPerson) {
        const entry = nextRulerColor(nextIndex, previousColor);
        nextIndex = entry.nextIndex;
        map.set(key, entry.palette);
        previousColor = entry.palette.color;
      } else if (byParty && leader.party) {
        const entry = partyPalette(leader.party);
        map.set(key, entry);
        previousColor = entry.color || previousColor;
      } else if (byParty) {
        const entry = nextRulerColor(nextIndex, previousColor);
        nextIndex = entry.nextIndex;
        map.set(key, entry.palette);
        previousColor = entry.palette.color;
      } else {
        const entry = fieldPalette(leaderFieldValue(leader, seat, colorMode));
        map.set(key, entry);
        previousColor = entry.color || previousColor;
      }
    }
    return map;
  }

  function parseHexColor(hex) {
    const value = String(hex || "")
      .trim()
      .replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  function srgbChannel(value) {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function relativeLuminance(hex) {
    const rgb = parseHexColor(hex);
    if (!rgb) return null;
    return 0.2126 * srgbChannel(rgb.r) + 0.7152 * srgbChannel(rgb.g) + 0.0722 * srgbChannel(rgb.b);
  }

  function contrastRatio(lighter, darker) {
    const hi = Math.max(lighter, darker);
    const lo = Math.min(lighter, darker);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Ink or ivory, whichever reads on this bar. No scrim pill. */
  function barLabelTheme(hex) {
    const vars = themeVars();
    const lum = relativeLuminance(hex);
    const ink = vars.labelScrimLightFg;
    const ivory = vars.labelScrimDarkFg;
    if (lum == null) {
      return { fg: ivory, bg: "transparent" };
    }
    const inkLum = relativeLuminance(ink);
    const ivoryLum = relativeLuminance(ivory);
    const inkContrast = inkLum == null ? 0 : contrastRatio(lum, inkLum);
    const ivoryContrast = ivoryLum == null ? 0 : contrastRatio(lum, ivoryLum);
    return {
      fg: inkContrast >= ivoryContrast ? ink : ivory,
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
