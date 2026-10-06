/**
 * Export legend + full timeline as PNG or SVG (html-to-image).
 */
(function () {
  const FILENAME_BASE = "american-senators-timeline";
  const HTML_TO_IMAGE_URL = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm";
  const UPNG_URL = "https://cdn.jsdelivr.net/npm/upng-js@2.1.0/+esm";
  const EXPORT_PIXEL_RATIO = 2;
  /**
   * 2× is only worth it while the bitmap stays around this size. The full
   * chart is already ~17 megapixels; doubling it produced a ~9 MB PNG.
   */
  const PNG_MAX_PIXELS = 16_000_000;
  /** Chrome canvas side limit. iOS Safari is far smaller (~4096²). */
  const CANVAS_MAX_SIDE = 16384;
  const SAFARI_MAX_AREA = 16777216;
  const SAFARI_MAX_SIDE = 4096;
  /** Phones run out of memory well before the desktop canvas limits. */
  const MOBILE_MAX_PIXELS = 6_000_000;
  /** Below this the chart stops being readable; better to fail loudly. */
  const MIN_PIXEL_RATIO = 0.25;

  let htmlToImage = null;
  let upngEncode = null;

  function exportFilename(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate()),
      pad(d.getHours()),
      pad(d.getMinutes()),
      pad(d.getSeconds()),
    ].join("-");
    return `${FILENAME_BASE}-${stamp}.${ext}`;
  }

  function chartBg() {
    return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  }

  function visibleSeatCount() {
    return document.querySelectorAll(".state-group:not(.hidden) .country-row").length;
  }

  /** Gaps: axis→body, between states, and between seats within a state. */
  function visibleLayoutGapTotal() {
    const style = getComputedStyle(document.documentElement);
    const stateGap = parseFloat(style.getPropertyValue("--state-gap")) || 0;
    const seatGap = parseFloat(style.getPropertyValue("--seat-gap")) || 0;
    const groups = [...document.querySelectorAll(".state-group:not(.hidden)")];
    if (!groups.length) return 0;

    let betweenSeats = 0;
    for (const group of groups) {
      const seats = group.querySelectorAll(".country-row").length;
      betweenSeats += Math.max(seats - 1, 0) * seatGap;
    }

    const betweenStates = Math.max(groups.length - 1, 0) * stateGap;
    const axisToBody = stateGap;
    return betweenStates + betweenSeats + axisToBody;
  }

  /** Content width from metrics (height comes from natural layout during capture). */
  function timelineContentWidth() {
    if (typeof window.getTimelineMetrics === "function") {
      const metrics = window.getTimelineMetrics();
      const seats = Math.max(visibleSeatCount(), 1);
      const gaps = visibleLayoutGapTotal();

      if (metrics.orientation === "horizontal") {
        return metrics.labelWidth + metrics.trackWidth;
      }

      return metrics.yearLabelWidth + seats * metrics.seatWidth + gaps;
    }
    const timelineEl = document.getElementById("timeline");
    return timelineEl?.scrollWidth || 0;
  }

  /** Full text width of state labels (ignores on-screen ellipsis clipping). */
  function longestStateNameWidth() {
    const names = [...document.querySelectorAll(".state-group:not(.hidden) .country-name")];
    if (!names.length) return 0;

    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "absolute",
      left: "-9999px",
      top: "0",
      visibility: "hidden",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      writingMode: "horizontal-tb",
      transform: "none",
    });
    document.body.appendChild(probe);

    let max = 0;
    for (const el of names) {
      const cs = getComputedStyle(el);
      probe.style.font = cs.font;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.style.textTransform = cs.textTransform;
      probe.style.fontFeatureSettings = cs.fontFeatureSettings;
      probe.textContent = el.textContent || "";
      max = Math.max(max, probe.offsetWidth || 0);
    }

    probe.remove();
    return max;
  }

  function expandTimelineForCapture() {
    const scrollEl = document.getElementById("timeline-scroll");
    const timelineEl = document.getElementById("timeline");
    const root = document.documentElement;
    if (!scrollEl || !timelineEl) return null;

    const horizontal = root.dataset.orientation === "horizontal";
    const width = timelineContentWidth();
    const saved = {
      scrollEl,
      timelineEl,
      root,
      scrollOverflow: scrollEl.style.overflow,
      scrollWidth: scrollEl.style.width,
      scrollHeight: scrollEl.style.height,
      scrollMaxWidth: scrollEl.style.maxWidth,
      scrollMaxHeight: scrollEl.style.maxHeight,
      timelineWidth: timelineEl.style.width,
      timelineHeight: timelineEl.style.height,
      labelW: root.style.getPropertyValue("--label-w"),
      labelH: root.style.getPropertyValue("--label-h"),
    };

    // Let the chart grow to its full content size so the footer stays below it.
    scrollEl.style.overflow = "visible";
    scrollEl.style.width = `${width}px`;
    scrollEl.style.maxWidth = `${width}px`;
    scrollEl.style.height = "auto";
    scrollEl.style.maxHeight = "none";
    timelineEl.style.width = `${width}px`;
    timelineEl.style.height = "auto";

    if (horizontal) {
      const pad = 28;
      const needed = Math.ceil(longestStateNameWidth() + pad);
      const current =
        parseFloat(getComputedStyle(root).getPropertyValue("--label-w")) || 148;
      if (needed > current) {
        root.style.setProperty("--label-w", `${needed}px`);
        const widened = needed + (typeof window.getTimelineMetrics === "function"
          ? window.getTimelineMetrics().trackWidth
          : width - current);
        scrollEl.style.width = `${widened}px`;
        scrollEl.style.maxWidth = `${widened}px`;
        timelineEl.style.width = `${widened}px`;
      }
    } else {
      // Rotated state names need enough label-band height for the longest name.
      const pad = 16;
      const needed = Math.ceil(longestStateNameWidth() + pad);
      const current =
        parseFloat(getComputedStyle(root).getPropertyValue("--label-h")) || 124;
      if (needed > current) {
        root.style.setProperty("--label-h", `${needed}px`);
      }
    }

    return saved;
  }

  function restoreTimelineLayout(saved) {
    if (!saved) return;
    saved.scrollEl.style.overflow = saved.scrollOverflow;
    saved.scrollEl.style.width = saved.scrollWidth;
    saved.scrollEl.style.height = saved.scrollHeight;
    saved.scrollEl.style.maxWidth = saved.scrollMaxWidth;
    saved.scrollEl.style.maxHeight = saved.scrollMaxHeight;
    saved.timelineEl.style.width = saved.timelineWidth;
    saved.timelineEl.style.height = saved.timelineHeight;
    if (saved.labelW) saved.root.style.setProperty("--label-w", saved.labelW);
    else saved.root.style.removeProperty("--label-w");
    if (saved.labelH) saved.root.style.setProperty("--label-h", saved.labelH);
    else saved.root.style.removeProperty("--label-h");
  }

  function insertCaptureHeader(surface) {
    const header = document.createElement("div");
    header.className = "export-capture-header";
    header.innerHTML = `
      <div class="export-capture-lede">
        <h2 class="export-capture-title">American Senators</h2>
        <p class="export-capture-subtitle">Every person who has held a seat in the United States Senate since 1789.</p>
      </div>
    `;
    surface.insertBefore(header, surface.firstChild);
    return header;
  }

  function isAppleTouch() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function isSafariFamily() {
    const ua = navigator.userAgent;
    if (isAppleTouch()) return true;
    return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
  }

  function isMobile() {
    return isAppleTouch() || /Android|Mobile/i.test(navigator.userAgent);
  }

  async function loadHtmlToImage() {
    if (htmlToImage) return htmlToImage;
    htmlToImage = await import(HTML_TO_IMAGE_URL);
    return htmlToImage;
  }

  async function loadUpngEncode() {
    if (upngEncode) return upngEncode;
    const mod = await import(UPNG_URL);
    upngEncode = mod.encode || mod.default?.encode;
    if (typeof upngEncode !== "function") throw new Error("PNG encoder unavailable");
    return upngEncode;
  }

  /**
   * The full chart is taller than a phone can rasterize, so the ratio has to be
   * allowed below 1 — clamping it up to 1 asks for a canvas the device refuses
   * to paint, and every capture then comes back blank.
   */
  function exportPixelRatio(width, height) {
    const safari = isSafariFamily();
    const sideLimit = safari ? SAFARI_MAX_SIDE : CANVAS_MAX_SIDE;
    const areaLimit = Math.min(
      safari ? SAFARI_MAX_AREA : Infinity,
      isMobile() ? MOBILE_MAX_PIXELS : PNG_MAX_PIXELS
    );
    const pixels = Math.max(1, width * height);
    const areaCap = Math.sqrt(areaLimit / pixels);
    const sideCap = Math.min(sideLimit / Math.max(1, width), sideLimit / Math.max(1, height));
    return Math.max(MIN_PIXEL_RATIO, Math.min(EXPORT_PIXEL_RATIO, areaCap, sideCap));
  }

  function dataUrlToBlob(dataUrl) {
    const [header, data] = dataUrl.split(",");
    const isBase64 = /;base64/i.test(header);
    const mime = header.match(/data:([^;]+)/)?.[1] || "image/png";
    if (!isBase64) {
      return new Blob([decodeURIComponent(data)], { type: mime });
    }
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function downloadViaAnchor(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  }

  /**
   * Prefer the system share sheet on iOS (download attributes are unreliable there);
   * otherwise trigger a normal file download.
   */
  async function deliverFile(blob, filename) {
    const type = blob.type || "image/png";
    const file = new File([blob], filename, { type });
    const url = URL.createObjectURL(blob);

    try {
      if (isAppleTouch() && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err?.name === "AbortError") return;
        }
      }
      downloadViaAnchor(url, filename);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  /** Safari often returns a blank canvas on the first foreignObject pass. */
  async function captureUntilStable(run, maxPasses = 3) {
    let best = await run();
    if (!isSafariFamily()) return best;

    for (let i = 1; i < maxPasses; i++) {
      const next = await run();
      const bestScore = typeof best === "string" ? best.length : best?.size || 0;
      const nextScore = typeof next === "string" ? next.length : next?.size || 0;
      if (nextScore > bestScore) best = next;
      if (nextScore === bestScore && nextScore > 1000) return best;
    }
    return best;
  }

  function setExportBusy(busy, activeId, activeLabel) {
    for (const id of ["save-png", "save-svg"]) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.disabled = busy;
      if (busy && id === activeId) {
        const label = btn.querySelector(".export-btn-label");
        if (label) label.textContent = activeLabel;
      }
    }
  }

  function restoreExportLabels() {
    const labels = { "save-png": "PNG", "save-svg": "SVG" };
    for (const [id, text] of Object.entries(labels)) {
      const label = document.getElementById(id)?.querySelector(".export-btn-label");
      if (label) label.textContent = text;
    }
  }

  function pngBytesFromCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const buffer =
      pixels.byteOffset === 0 && pixels.buffer.byteLength === pixels.byteLength
        ? pixels.buffer
        : pixels.slice().buffer;
    return { buffer, width, height };
  }

  /**
   * Quantizing holds the whole bitmap as raw RGBA plus the encoder's own copy.
   * That is fine on desktop and enough to kill the tab on a phone.
   */
  function canQuantize(canvas) {
    return !isMobile() && canvas.width * canvas.height <= PNG_MAX_PIXELS;
  }

  /**
   * The chart is a handful of flat colors plus text. A 256-color PNG keeps that
   * look and is much smaller than the browser's truecolor snapshot.
   */
  async function quantizeCanvas(canvas) {
    const encode = await loadUpngEncode();
    const { buffer, width, height } = pngBytesFromCanvas(canvas);
    const bytes = encode([buffer], width, height, 256);
    const blob = new Blob([bytes], { type: "image/png" });
    if (!blob.size || blob.size < 1000) throw new Error("Empty quantized PNG");
    return blob;
  }

  async function canvasToPngBlob(canvas) {
    if (canQuantize(canvas)) {
      try {
        return await quantizeCanvas(canvas);
      } catch (err) {
        console.warn(err);
      }
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.size < 1000) throw new Error("Empty PNG capture");
    return blob;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "sync";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Export SVG did not rasterize"));
      img.src = src;
    });
  }

  /**
   * Safari can hand back an all-background frame instead of failing, and a solid
   * canvas still encodes to a plausible file size, so sample it before trusting it.
   */
  function looksBlank(canvas) {
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);

    let data;
    try {
      data = ctx.getImageData(0, 0, probe.width, probe.height).data;
    } catch {
      return false;
    }

    for (let i = 4; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - data[0]) > 6 ||
        Math.abs(data[i + 1] - data[1]) > 6 ||
        Math.abs(data[i + 2] - data[2]) > 6
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Rasterize our own compact SVG. html-to-image copies the full computed style
   * onto every node first, which on this chart is a ~136 MB data URL — desktop
   * absorbs it, a phone gives up long before the canvas size matters.
   */
  async function capturePngFromSvg(surface, width, height, ratio) {
    // A blob: URL would taint the canvas and block toBlob; data: stays origin-clean.
    const markup = buildExportSvg(surface, width, height);
    const img = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = chartBg();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function capturePng(surface, options) {
    try {
      const canvas = await capturePngFromSvg(
        surface,
        options.width,
        options.height,
        options.pixelRatio
      );
      if (looksBlank(canvas)) throw new Error("Export SVG rasterized blank");
      return await canvasToPngBlob(canvas);
    } catch (err) {
      // The library needs more memory than a phone has, so retrying there at a
      // smaller scale beats reaching for it and risking a tab crash.
      if (isMobile()) throw err;
      console.warn("Export SVG rasterization failed; trying html-to-image", err);
      return captureWithLibrary(await loadHtmlToImage(), surface, options);
    }
  }

  async function captureWithLibrary(lib, surface, options) {
    const { toCanvas, toBlob, toPng } = lib;
    if (typeof toCanvas === "function") {
      const passes = isSafariFamily() ? 3 : 1;
      let canvas = null;
      for (let i = 0; i < passes; i++) {
        const next = await toCanvas(surface, options);
        if (next && next.width > 1 && next.height > 1) canvas = next;
      }
      if (canvas) {
        try {
          return await canvasToPngBlob(canvas);
        } catch (err) {
          console.warn(err);
        }
      }
    }

    let blob = null;
    if (typeof toBlob === "function") {
      blob = await captureUntilStable(() => toBlob(surface, options));
    }
    if (!blob || blob.size < 1000) {
      const dataUrl = await captureUntilStable(() => toPng(surface, options));
      blob = dataUrlToBlob(dataUrl);
    }
    if (!blob || blob.size < 1000) throw new Error("Empty PNG capture");
    return blob;
  }

  /**
   * An over-budget bitmap fails as a blank canvas rather than an exception, and
   * the real iOS ceiling varies by device and free memory, so step down until
   * something comes back.
   */
  async function capturePngWithRetry(surface, options) {
    let ratio = options.pixelRatio;
    for (;;) {
      try {
        return await capturePng(surface, { ...options, pixelRatio: ratio });
      } catch (err) {
        const next = ratio / 2;
        if (next < MIN_PIXEL_RATIO) throw err;
        console.warn(`PNG capture failed at ${ratio}×, retrying at ${next}×`, err);
        ratio = next;
      }
    }
  }

  /**
   * html-to-image's toSvg pastes the full computed style (hundreds of properties)
   * onto every node. On this chart that is tens of megabytes. Build the SVG from
   * the DOM plus one shared stylesheet instead.
   */
  const SVG_ROOT_ID = "svg-export";

  function serializeCssRules(rules) {
    let out = "";
    for (const rule of rules) {
      if (rule.type === CSSRule.MEDIA_RULE) {
        const cond = rule.conditionText || "";
        if (/width|height/i.test(cond)) continue;
        out += `@media ${cond} {\n${serializeCssRules(rule.cssRules)}\n}\n`;
        continue;
      }
      if (rule.type === CSSRule.SUPPORTS_RULE) {
        out += `@supports ${rule.conditionText} {\n${serializeCssRules(rule.cssRules)}\n}\n`;
        continue;
      }
      if (rule.type === CSSRule.CHARSET_RULE || rule.type === CSSRule.IMPORT_RULE) continue;
      out += `${rule.cssText}\n`;
    }
    return out;
  }

  function pageCssForExport() {
    const parts = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (rules) parts.push(serializeCssRules(rules));
    }
    // Hyphen is not a word character, so \b would also rewrite names such as
    // .timeline-body and --type-body-tracking. Only replace the html/body/:root
    // selectors, which the exported document maps onto #svg-export.
    const id = `#${SVG_ROOT_ID}`;
    const css = parts
      .join("\n")
      .replace(/(?<![\w-]):root\b/g, id)
      .replace(/(?<![\w-])html(?![\w-])/g, id)
      .replace(/(?<![\w-])body(?![\w-])/g, id);
    return `${css}
#${SVG_ROOT_ID} { min-height: 0; height: auto; }
#${SVG_ROOT_ID}.is-exporting #export-surface {
  position: relative;
  left: auto;
  top: auto;
  z-index: auto;
}
`;
  }

  function appliedCustomProperties(css) {
    const names = new Set();
    const re = /(--[A-Za-z0-9_-]+)\s*:/g;
    let match;
    while ((match = re.exec(css))) names.add(match[1]);
    const computed = getComputedStyle(document.documentElement);
    const decls = [];
    for (const name of names) {
      const value = computed.getPropertyValue(name).trim();
      if (value) decls.push(`${name}:${value}`);
    }
    return decls.join(";");
  }

  function xmlAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function xmlText(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  function buildExportSvg(surface, width, height) {
    const css = pageCssForExport();
    const clone = surface.cloneNode(true);
    clone.querySelectorAll(".state-group.hidden, [hidden]").forEach((el) => el.remove());
    for (const name of ["data-search", "data-leader", "data-name", "data-party", "data-color", "data-seat-id"]) {
      clone.querySelectorAll(`[${name}]`).forEach((el) => el.removeAttribute(name));
    }

    const root = document.documentElement;
    const classes = [...root.classList, "is-exporting"].join(" ");
    const dataAttrs = [...root.attributes]
      .filter((attr) => attr.name.startsWith("data-"))
      .map((attr) => ` ${attr.name}="${xmlAttr(attr.value)}"`)
      .join("");
    const vars = appliedCustomProperties(css);
    const markup = new XMLSerializer().serializeToString(clone);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<foreignObject x="0" y="0" width="${width}" height="${height}">
<div xmlns="http://www.w3.org/1999/xhtml" id="${SVG_ROOT_ID}" class="${xmlAttr(classes)}"${dataAttrs} style="${xmlAttr(vars)}">
<style>${xmlText(css)}</style>
${markup}
</div>
</foreignObject>
</svg>`;

    if (svg.length < 1000) throw new Error("Empty SVG capture");
    return svg;
  }

  function captureSvg(surface, width, height) {
    return new Blob([buildExportSvg(surface, width, height)], { type: "image/svg+xml" });
  }

  async function saveImage(format) {
    const svg = format === "svg";
    const buttonId = svg ? "save-svg" : "save-png";
    const labelText = svg ? "SVG" : "PNG";

    const surface = document.getElementById("export-surface");
    const tooltip = document.getElementById("tooltip");

    if (!surface) return;

    if (tooltip) tooltip.hidden = true;
    document.body.classList.add("is-exporting");
    setExportBusy(true, buttonId, "Exporting…");

    const layout = expandTimelineForCapture();
    const header = insertCaptureHeader(surface);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const timelineEl = document.getElementById("timeline");
      const scrollEl = document.getElementById("timeline-scroll");
      const chartWidth = Math.ceil(
        Math.max(
          timelineEl?.scrollWidth || 0,
          scrollEl?.scrollWidth || 0,
          timelineContentWidth()
        )
      );
      const width = Math.ceil(Math.max(surface.scrollWidth, chartWidth));
      const height = Math.ceil(surface.scrollHeight);
      const options = {
        backgroundColor: chartBg(),
        width,
        height,
        pixelRatio: exportPixelRatio(width, height),
        cacheBust: false,
        skipFonts: true,
        style: {
          position: "relative",
          left: "0",
          top: "0",
          zIndex: "auto",
          margin: "0",
          transform: "none",
          overflow: "visible",
        },
      };

      const blob = svg
        ? captureSvg(surface, width, height)
        : await capturePngWithRetry(surface, options);
      await deliverFile(blob, exportFilename(svg ? "svg" : "png"));
    } catch (err) {
      console.error(err);
      window.alert(
        isMobile()
          ? `Could not save ${labelText}. This device may not have enough memory for the whole chart — filter to fewer states, or export from a desktop browser.`
          : `Could not save ${labelText}. If you opened the file directly, try the local server (serve.ps1) so fonts load correctly.`
      );
    } finally {
      header.remove();
      restoreTimelineLayout(layout);
      document.body.classList.remove("is-exporting");
      window.scrollTo(scrollX, scrollY);
      setExportBusy(false);
      restoreExportLabels();
    }
  }

  function savePng() {
    return saveImage("png");
  }

  function saveSvg() {
    return saveImage("svg");
  }

  function init() {
    document.getElementById("save-png")?.addEventListener("click", savePng);
    document.getElementById("save-svg")?.addEventListener("click", saveSvg);
  }

  window.TimelineExport = { init, savePng, saveSvg };
})();
