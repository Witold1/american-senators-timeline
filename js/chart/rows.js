/**
 * One row per polity: its name, its bars, and the sovereignty and independence marks.
 */
(function () {
  const { timelineEl, timelineData, seats, displayBounds, geo, palette, labels, filters, interaction } = window.TimelineChartDom;
  const { renderCongressLayer } = window.TimelineChartAxis;
  const { groupLeadersByReign, renderLeaderBar, renderSteppedLeaderBar } = window.TimelineChartBars;

  function sortValue(group, mode) {
    if (mode === "admitted" || mode === "independence") {
      return group.independenceDate || group.admitted || "";
    }
    if (mode === "sovereignty") {
      return group.sovereigntyDate || "";
    }
    if (!mode || mode === "name") return group.name || "";
    const raw = group.fields?.[mode];
    return raw == null ? "" : raw;
  }

  /** YYYYMMDD for a year or ISO date, so mixed shapes still compare in calendar order. */
  function dateSortKey(value) {
    const m = String(value ?? "").match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    if (!m) return null;
    return Number(m[1]) * 10000 + Number(m[2] || 1) * 100 + Number(m[3] || 1);
  }

  function compareSortValues(a, b) {
    const aDate = dateSortKey(a);
    const bDate = dateSortKey(b);
    if (aDate != null && bDate != null) return aDate - bDate;
    const aNum = typeof a === "number" ? a : Number(a);
    const bNum = typeof b === "number" ? b : Number(b);
    const numeric =
      a !== "" && b !== "" && Number.isFinite(aNum) && Number.isFinite(bNum);
    if (numeric) return aNum - bNum;
    return String(a).localeCompare(String(b));
  }

  /** Month and year of the date the rows are sorted by, or "" for a name sort. */
  function sortCaption(group) {
    const mode = filters().getOrderMode?.() || "name";
    const { compactDateLabel } = labels();
    if (mode === "sovereignty") return compactDateLabel(group.sovereigntyDate);
    if (mode === "independence" || mode === "admitted") {
      return compactDateLabel(group.independenceDate || group.admitted);
    }
    return "";
  }

  function countryColumnLabel(group) {
    const caption = sortCaption(group);
    return caption ? `${group.name} ${caption}` : group.name;
  }

  function seatOverlapsDisplay(seat) {
    const { start, end } = displayBounds();
    return (seat.rulers || []).some(
      (r) => Number(r.start) <= end && Number(r.end) >= start
    );
  }

  function sortStateGroups(groups) {
    const orderMode = filters().getOrderMode?.() || "name";
    const dir = filters().getOrderDir?.() === "desc" ? -1 : 1;
    const sorted = groups.slice();
    sorted.sort((a, b) => {
      const primary = compareSortValues(sortValue(a, orderMode), sortValue(b, orderMode));
      if (primary) return primary * dir;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  function groupSeatsByState(list) {
    const { seatStateName } = labels();
    const groups = [];
    const byKey = new Map();
    const timeRangeActive = (filters().getTimeRangeFilter?.() || "all") !== "all";

    for (const seat of list) {
      if (timeRangeActive && !seatOverlapsDisplay(seat)) continue;

      const key = String(seat.state || seat.flag || seat.id).toUpperCase();
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          name: seatStateName(seat),
          region: seat.region,
          admitted: seat.admitted || "",
          sovereigntyDate: seat.sovereigntyDate || "",
          independenceDate: seat.independenceDate || seat.admitted || "",
          sovereignty: seat.sovereignty || null,
          independence: seat.independence || null,
          fields: seat.fields || null,
          seats: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.seats.push(seat);
      if (!group.admitted && seat.admitted) group.admitted = seat.admitted;
      if (!group.sovereigntyDate && seat.sovereigntyDate) {
        group.sovereigntyDate = seat.sovereigntyDate;
      }
      if (!group.independenceDate && (seat.independenceDate || seat.admitted)) {
        group.independenceDate = seat.independenceDate || seat.admitted;
      }
    }
    return sortStateGroups(groups);
  }

  function renderSeatTrack(seat, metrics) {
    const { normalizeLeaderName, buildLeaderPaletteMap } = palette();
    const colorMode = filters().getColorMode?.() || "party";
    const roleLabel = timelineData().roleLabel || "Ruler";

    const laneCount = Math.max(1, Number(seat.laneCount) || 1);
    // Keep every row/column the same cross size; concurrent rulers still
    // split inside that shared track via localLanes.
    const trackLanes = Math.max(
      1,
      Number(metrics.trackLaneCount) || laneCount
    );
    const horizontal = metrics.orientation === "horizontal";
    const baseCross = horizontal
      ? metrics.seatHeight || 24
      : metrics.seatWidth || 24;
    const trackCross = baseCross * trackLanes;
    const seatMetrics = { ...metrics, laneCount, trackCross };

    const col = document.createElement("div");
    col.className = "country-row";
    col.dataset.seatId = seat.id;
    col.dataset.laneCount = String(laneCount);
    col.dataset.trackLanes = String(trackLanes);

    const track = document.createElement("div");
    track.className = "country-track";
    if (horizontal) {
      track.style.width = `${metrics.trackWidth}px`;
      track.style.height = `${trackCross}px`;
    } else {
      // Column must match the lane-expanded track, or bars spill into neighbors.
      col.style.width = `${trackCross}px`;
      track.style.height = `${metrics.trackHeight}px`;
      track.style.width = `${trackCross}px`;
    }

    const leaders = seat.rulers || [];
    const leaderPalettes = buildLeaderPaletteMap(leaders, colorMode, seat);

    for (const group of groupLeadersByReign(leaders)) {
      const barPalette = leaderPalettes.get(normalizeLeaderName(group[0].name));
      const barOptions = {
        metrics: seatMetrics,
        seatName: seat.name,
        className: "bar ruler",
        palette: barPalette,
        roleLabel,
        seat,
        minSpan: 4,
        laneCount,
      };
      if (group.length === 1) {
        renderLeaderBar(track, group[0], barOptions);
      } else {
        renderSteppedLeaderBar(track, group, barOptions);
      }
    }

    renderSeatDateMarkers(track, seat, seatMetrics);

    col.appendChild(track);
    return col;
  }

  function isoFromDate(date) {
    if (!date?.year) return "";
    const month = String(date.month || 1).padStart(2, "0");
    const day = String(date.day || 1).padStart(2, "0");
    return `${date.year}-${month}-${day}`;
  }

  function markerAct(date) {
    const act = date?.act;
    if (typeof act === "string") return act;
    return act?.title || date?.label || "";
  }

  function markerNotes(date) {
    const notes = [];
    if (date?.note) notes.push(String(date.note));
    if (Array.isArray(date?.notes)) {
      for (const note of date.notes) {
        if (note) notes.push(String(note));
      }
    }
    return notes;
  }

  function lastSovietHead(seat) {
    const rulers = seat.rulers || [];
    for (let i = rulers.length - 1; i >= 0; i--) {
      if (rulers[i].era === "soviet") return rulers[i];
    }
    return null;
  }

  function renderDateMarker(track, date, { className, heading, extraLines = [], metrics }) {
    if (!date?.year || !geo().dateInsideTimeline?.(date)) return;
    const horizontal = metrics.orientation === "horizontal";
    const month = date.month || 1;
    const day = date.day || 1;
    const pos = horizontal
      ? geo().yearToX(date.year, month, day, metrics)
      : geo().yearToY(date.year, month, day, metrics);
    const marker = document.createElement("div");
    marker.className = `marker ${className}`;
    if (horizontal) marker.style.left = `${pos}px`;
    else marker.style.top = `${pos}px`;

    const { escapeHtml, admissionDateLabel } = labels();
    const iso = isoFromDate(date);
    const act = markerAct(date);
    const parts = [`<strong>${escapeHtml(heading)}</strong>`];
    if (act) parts.push(`<span class="role">${escapeHtml(act)}</span>`);
    for (const note of markerNotes(date)) {
      parts.push(`<p class="tooltip-note">${escapeHtml(note)}</p>`);
    }
    if (iso) parts.push(`<div class="dates">${escapeHtml(admissionDateLabel(iso))}</div>`);
    for (const line of extraLines) {
      parts.push(`<p class="role">${escapeHtml(line)}</p>`);
    }
    marker.title = [heading, act, iso ? admissionDateLabel(iso) : ""].filter(Boolean).join(". ");
    interaction().setBarTip?.(marker, parts.join(""));
    track.appendChild(marker);
  }

  function renderSeatDateMarkers(track, seat, metrics) {
    if (seat.sovereignty) {
      renderDateMarker(track, seat.sovereignty, {
        metrics,
        className: "sovereignty",
        heading: "Sovereignty declared",
      });
    }
    if (seat.independence) {
      const lastSoviet = lastSovietHead(seat);
      renderDateMarker(track, seat.independence, {
        metrics,
        className: "independence",
        heading: "Independence declared",
        extraLines: lastSoviet ? [`Last Soviet-era head — ${lastSoviet.name}`] : [],
      });
    }
  }

  function dateVerb() {
    return timelineData().view?.settings?.dateVerb || "Admitted";
  }

  function renderStateGroup(group, metrics, groupIndex) {
    const { admissionYear, admissionDateLabel } = labels();

    const wrap = document.createElement("div");
    wrap.className = "state-group";
    if (groupIndex % 2 === 1) wrap.classList.add("alt");
    wrap.dataset.state = group.key;
    wrap.dataset.region = group.region || "";
    for (const [key, value] of Object.entries(group.fields || {})) {
      if (value == null || value === "") continue;
      wrap.dataset[`fv${key}`] = String(value);
    }
    if (group.admitted) wrap.dataset.admitted = group.admitted;

    const label = document.createElement("div");
    label.className = "country-label";
    const seatNames = group.seats.map((s) => s.name).join(", ");
    const dateIso = group.independenceDate || group.admitted;
    const sovereigntyIso = group.sovereigntyDate || "";
    const tipParts = [seatNames];
    if (sovereigntyIso) {
      tipParts.push(`Sovereignty ${admissionDateLabel(sovereigntyIso)}`);
    }
    if (dateIso) {
      tipParts.push(`${dateVerb()} ${admissionDateLabel(dateIso)}`);
    }
    label.title = tipParts.filter(Boolean).join(". ");

    const name = document.createElement("span");
    name.className = "country-name";
    name.textContent = group.name;
    const caption = metrics.orientation === "horizontal" ? sortCaption(group) : "";
    if (caption) {
      const cap = document.createElement("span");
      cap.className = "country-sort-date";
      cap.textContent = ` ${caption}`;
      name.appendChild(cap);
    }
    label.appendChild(name);

    const year = admissionYear(dateIso);
    if (year) {
      const admitted = document.createElement("span");
      admitted.className = "country-admitted";
      admitted.textContent = year;
      admitted.title = `${dateVerb()} ${admissionDateLabel(dateIso)}`;
      label.appendChild(admitted);
    }

    wrap.appendChild(label);

    const seatsRow = document.createElement("div");
    seatsRow.className = "state-seats";
    if (timelineData().showCongress) {
      seatsRow.appendChild(renderCongressLayer(metrics));
    }
    for (const seat of group.seats) {
      seatsRow.appendChild(renderSeatTrack(seat, metrics));
    }
    wrap.appendChild(seatsRow);
    return wrap;
  }

  function renderEventMarkers(metrics) {
    const layer = document.createElement("div");
    layer.className = "event-markers";
    layer.setAttribute("aria-hidden", "true");
    const ussr = timelineData().USSR_DISSOLVED;
    const showUssr =
      ussr?.year &&
      geo().dateInsideTimeline?.(ussr) &&
      document.documentElement.classList.contains("ussr-marker-enabled");
    if (!showUssr) return layer;

    const horizontal = metrics.orientation === "horizontal";
    const mark = document.createElement("div");
    mark.className = "event-marker event-marker-ussr";
    const label = "USSR dissolved · 26 Dec 1991";
    mark.title = label;
    const y = Number(ussr.year);
    const m = Number(ussr.month) || 12;
    const d = Number(ussr.day) || 26;
    if (horizontal) {
      const x = geo().yearToX(y, m, d, metrics);
      // The overlay covers the name column; the date scale starts after it.
      mark.style.left = `${x + (metrics.labelWidth || 0)}px`;
    } else {
      const top = geo().yearToY(y, m, d, metrics);
      mark.style.top = `${top + (metrics.labelHeight || 0)}px`;
    }
    const caption = document.createElement("span");
    caption.className = "event-marker-label";
    caption.textContent = "USSR ends";
    mark.appendChild(caption);
    layer.appendChild(mark);
    return layer;
  }

  function metricsKey(metrics) {
    return [
      metrics.orientation,
      metrics.yearOrder,
      metrics.yearHeight,
      metrics.seatWidth,
      metrics.labelHeight,
      metrics.yearLabelWidth,
      metrics.trackHeight,
      metrics.yearWidth,
      metrics.seatHeight,
      metrics.labelWidth,
      metrics.axisHeight,
      metrics.trackWidth,
    ].join("|");
  }

  /** Off-screen name used to size the horizontal label column before layout. */
  function countryNameProbe() {
    if (!countryNameProbe.el) {
      const probe = document.createElement("span");
      probe.className = "country-name";
      probe.setAttribute("aria-hidden", "true");
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "0";
      probe.style.visibility = "hidden";
      probe.style.maxWidth = "none";
      probe.style.width = "auto";
      probe.style.overflow = "visible";
      document.body.appendChild(probe);
      countryNameProbe.el = probe;
    }
    return countryNameProbe.el;
  }

  /**
   * Horizontal name column matches the longest country name.
   * Measured before the chart is built so the track width is known in one pass.
   */
  function applyCountryColumnWidth(names) {
    const root = document.documentElement;
    if (geo().getOrientation?.() !== "horizontal") {
      root.style.removeProperty("--label-w");
      geo().invalidateLayoutCache?.();
      return;
    }
    const probe = countryNameProbe();
    let max = 0;
    for (const name of names) {
      probe.textContent = name || "";
      max = Math.max(max, probe.scrollWidth);
    }
    root.style.setProperty("--label-w", `${Math.max(72, Math.ceil(max + 16))}px`);
    geo().invalidateLayoutCache?.();
    geo().setFilledTrackWidth?.(horizontalTrackTarget());
  }

  /** Repaint bar fills and label ink from the current theme and palette. */
  function recolorBars() {
    if (!timelineEl?.querySelector(".timeline-main")) return false;
    palette().invalidate?.();
    const { buildLeaderPaletteMap } = palette();
    const { applyBarLabelColors } = labels();
    const colorMode = filters().getColorMode?.() || "party";
    const seatById = new Map(seats().map((seat) => [seat.id, seat]));
    let missed = 0;

    timelineEl.querySelectorAll(".country-row").forEach((row) => {
      const seat = seatById.get(row.dataset.seatId);
      if (!seat) {
        if (row.querySelector(".bar")) missed += 1;
        return;
      }
      const leaderPalettes = buildLeaderPaletteMap(seat.rulers || [], colorMode, seat);
      row.querySelectorAll(".bar").forEach((bar) => {
        const entry = leaderPalettes.get(bar.dataset.leader || "");
        const color = entry?.color;
        if (!color) {
          missed += 1;
          return;
        }
        bar.dataset.color = color;
        const path = bar.querySelector(".bar-step-path");
        if (path) {
          path.setAttribute("fill", color);
          bar.style.background = "transparent";
        } else {
          bar.style.background = color;
        }
        const text = bar.querySelector(".bar-label-text");
        if (text) applyBarLabelColors(text, color);
      });
    });

    const selected = timelineEl.querySelector(".bar.ruler.selected");
    const sheet = document.querySelector(".tooltip-drawer-sheet");
    if (selected && sheet) {
      const accent = selected.dataset.color;
      if (accent) sheet.style.setProperty("--tip-accent", accent);
    }

    window.TimelineMinimap?.refresh?.();
    if (missed) return false;
    window.dispatchEvent(new Event("timeline-debug-refresh"));
    return true;
  }

  function naturalTrackWidth() {
    const { start, end } = displayBounds();
    if (start == null || end == null) return 0;
    const years = end - start + 1;
    const base =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--year-w")) || 20;
    return years > 0 ? years * base : 0;
  }

  /** Stretch the year axis to the panel when the natural timeline is narrower. */
  function horizontalTrackTarget() {
    if (geo().getOrientation?.() !== "horizontal") return null;
    const clip = document.querySelector(".timeline-scroll-clip");
    if (!clip || clip.clientWidth < 80) return null;
    const natural = naturalTrackWidth();
    if (!natural) return null;
    const labelW =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--label-w")) || 0;
    const available = clip.clientWidth - labelW;
    if (available <= natural + 1) return null;
    return available;
  }

  window.TimelineChartRows = {
    groupSeatsByState,
    countryColumnLabel,
    applyCountryColumnWidth,
    metricsKey,
    renderStateGroup,
    renderEventMarkers,
    recolorBars,
  };
})();
