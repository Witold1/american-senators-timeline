/**
 * Senator name formatting and bar label styling.
 */
(function () {
  const NAME_SUFFIXES = new Set([
    "jr",
    "jr.",
    "sr",
    "sr.",
    "ii",
    "iii",
    "iv",
    "v",
    "esq",
    "esq.",
  ]);

  function nameParts(fullName) {
    return String(fullName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function surnameIndex(parts) {
    let end = parts.length - 1;
    while (end > 0 && NAME_SUFFIXES.has(parts[end].toLowerCase().replace(/,/g, ""))) {
      end -= 1;
    }
    return end;
  }

  function surnameLeaderName(fullName) {
    const parts = nameParts(fullName);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    return parts[surnameIndex(parts)].replace(/,/g, "");
  }

  function abbreviatedLeaderName(fullName) {
    const parts = nameParts(fullName);
    if (parts.length <= 1) return fullName;
    const idx = surnameIndex(parts);
    const surname = parts[idx].replace(/,/g, "");
    const given = parts.slice(0, idx);
    if (!given.length) return surname;
    const initials = given.map((p) => `${p[0].toUpperCase()}.`).join(" ");
    return `${initials} ${surname}`;
  }

  function formatLeaderLabel(fullName) {
    if (document.documentElement.classList.contains("short-bar-labels")) {
      return surnameLeaderName(fullName);
    }
    return abbreviatedLeaderName(fullName);
  }

  function applyBarLabelColors(textEl, barColor) {
    const themeFn = window.TimelinePalette?.barLabelTheme;
    const dynamic = document.documentElement.classList.contains("dynamic-bar-label-colors");
    if (dynamic && barColor && themeFn) {
      const theme = themeFn(barColor);
      textEl.style.color = theme.fg;
      textEl.style.backgroundColor = theme.bg;
      return;
    }
    textEl.style.color = "";
    textEl.style.backgroundColor = "";
  }

  function refreshBarLabels() {
    document.querySelectorAll(".bar[data-name] .bar-label-text").forEach((el) => {
      const bar = el.closest(".bar");
      const name = bar?.dataset.name;
      if (name) el.textContent = formatLeaderLabel(name);
      applyBarLabelColors(el, bar?.dataset.color || "");
    });
  }

  function seatStateName(seat) {
    const raw = String(seat.name || seat.state || "").trim();
    const cut = raw.search(/\s+Class\s+/i);
    return (cut === -1 ? raw : raw.slice(0, cut)).trim();
  }

  function admissionYear(admitted) {
    const m = String(admitted || "").match(/^(\d{4})/);
    return m ? m[1] : "";
  }

  function admissionDateLabel(admitted) {
    const m = String(admitted || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return admissionYear(admitted);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const mon = months[Number(m[2]) - 1] || m[2];
    return `${mon} ${Number(m[3])}, ${m[1]}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.TimelineLabels = {
    formatLeaderLabel,
    applyBarLabelColors,
    refreshBarLabels,
    seatStateName,
    admissionYear,
    admissionDateLabel,
    escapeHtml,
  };
})();
