/**
 * Click-to-copy for senator names, and a bottom drawer for the details.
 */
(function () {
  const tipByBar = new WeakMap();
  let timelineEl = null;
  let drawerEl = null;
  let drawerSheet = null;
  let drawerBody = null;
  let drawerToggle = null;
  let bound = false;
  let selectedBars = [];

  function ensureEls() {
    if (!timelineEl) timelineEl = document.getElementById("timeline");
    if (!drawerEl) drawerEl = document.getElementById("tooltip-drawer");
    if (!drawerSheet) drawerSheet = drawerEl?.querySelector(".tooltip-drawer-sheet") || null;
    if (!drawerBody) drawerBody = document.getElementById("tooltip-drawer-body");
    if (!drawerToggle) drawerToggle = document.getElementById("tooltip-drawer-toggle");
  }

  function setBarTip(bar, html) {
    tipByBar.set(bar, html);
  }

  function partyAccent(bar) {
    const color = window.TimelinePalette?.partyPalette?.(bar?.dataset.party)?.color;
    return color || bar?.dataset.color || "";
  }

  function openDrawer(html, accent) {
    ensureEls();
    if (!drawerEl || !drawerBody) return;
    drawerBody.innerHTML = html;
    if (drawerSheet && accent) drawerSheet.style.setProperty("--tip-accent", accent);
    drawerEl.hidden = false;
    drawerToggle?.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    ensureEls();
    if (!drawerEl) return;
    drawerEl.hidden = true;
    drawerToggle?.setAttribute("aria-expanded", "false");
    if (drawerBody) drawerBody.innerHTML = "";
  }

  function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }

  function copySenatorName(bar) {
    const name = bar.dataset.name?.trim();
    if (!name) return;
    writeClipboard(name).catch(() => {
      const tip = tipByBar.get(bar) || "";
      openDrawer(
        `${tip}<p class="tooltip-note">Could not copy</p>`,
        partyAccent(bar)
      );
    });
  }

  function barFromEvent(e) {
    ensureEls();
    const bar = e.target.closest?.(".bar.ruler");
    if (!bar || !timelineEl?.contains(bar)) return null;
    return bar;
  }

  function clearSelection() {
    for (const bar of selectedBars) bar.classList.remove("selected");
    selectedBars = [];
  }

  function selectBar(bar) {
    const person = bar.dataset.person || bar.dataset.leader || "";
    clearSelection();
    if (!person || !timelineEl) {
      bar.classList.add("selected");
      selectedBars = [bar];
      return;
    }
    timelineEl.querySelectorAll(".bar.ruler").forEach((el) => {
      if ((el.dataset.person || "") !== person) return;
      el.classList.add("selected");
      selectedBars.push(el);
    });
    if (!selectedBars.length) {
      bar.classList.add("selected");
      selectedBars = [bar];
    }
  }

  function bind(rootEl) {
    if (bound) return;
    ensureEls();
    if (rootEl) timelineEl = rootEl;
    if (!timelineEl || !drawerEl) return;
    bound = true;

    timelineEl.addEventListener("click", (e) => {
      const bar = barFromEvent(e);
      if (!bar) {
        clearSelection();
        return;
      }
      selectBar(bar);
      const tip = tipByBar.get(bar);
      if (tip) openDrawer(tip, partyAccent(bar));
      copySenatorName(bar);
    });

    drawerToggle?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeDrawer();
    });

    document.addEventListener("click", (e) => {
      if (!drawerEl || drawerEl.hidden) return;
      if (drawerEl.contains(e.target)) return;
      if (e.target.closest?.(".bar.ruler")) return;
      closeDrawer();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawerEl && !drawerEl.hidden) closeDrawer();
    });
  }

  window.TimelineInteraction = {
    setBarTip,
    bind,
  };
})();
