/* ============================================================
   Drawings_Cycloidal_Gearbox.js
   Results page: interactive drawings
   ============================================================
   1. Part list and balloons of the assembly drawing (mm)
   2. Blueprint / paper style
   3. Scanner reveal, once per drawing
   4. Zoom and pan
   5. Popover next to the clicked marker or part list row
   6. Design notes on the markers
   7. Part list linked with the 3D model
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. PART LIST AND BALLOONS (A3 sheet, 420 × 297 mm)
  ---------------------------------------------------------- */
  const SHEET_WIDTH = 420;
  const SHEET_HEIGHT = 297;

  const ASSEMBLY_PART_LIST = {
    left: 199, right: 419, firstRowTop: 127.648, rowHeight: 7.6475,
    // [title, quantity, description], in the order of the items
    items: [
      ['Cycloidal disc, stage 1', 1, '16MnCr5, case-hardened'],
      ['Flask, stage 1 output', 1, '16MnCr5, case-hardened'],
      ['Eccentric bearing, stage 2', 1, 'SKF NJ 204 ECP'],
      ['Retaining ring Ø20', 1, 'DIN 471, 20 × 1,2'],
      ['Output pin, stage 1', 10, 'Ø6, hardened steel'],
      ['Input shaft', 1, '16MnCr5, case-hardened'],
      ['Retaining ring Ø17', 12, 'DIN 471, 17 × 1'],
      ['Lip seal Ø17', 1, 'ISO 6194, 17 × 28'],
      ['Input bearing', 1, 'SKF QJ 203 N2MA'],
      ['Retaining ring Ø12', 1, 'DIN 471, 12 × 1'],
      ['Eccentric bearing, stage 1', 1, 'INA HK 1210'],
      ['Thrust washer', 2, 'igus GTM 1220 005'],
      ['Cycloidal disc, stage 2', 1, '16MnCr5, case-hardened'],
      ['Output shaft', 1, '42CrMo4, quenched and tempered'],
      ['Output pin, stage 2', 12, 'Ø4, hardened steel'],
      ['Output bearing', 1, 'SKF QJ 206 N2MA'],
      ['Retaining ring Ø30', 1, 'DIN 471, 30 × 1,5'],
      ['Lip seal Ø30', 1, 'ISO 6194, 30 × 42'],
      ['Annular pin plate', 1, '42CrMo4, quenched and tempered'],
      ['Roller pin', 11, '42CrMo4, quenched and tempered'],
      ['Roller bearing', 33, 'SKF 61903'],
      ['Housing', 1, 'Aluminium 7075-T6'],
    ],
    // item: [centre x, centre y, radius] of its balloon on section A-A
    balloons: {
      1: [135.55, 8.58, 2.96], 2: [127.68, 26.76, 3.14], 3: [179.68, 48.76, 3.14], 5: [66.55, 27.76, 3.14],
      6: [104.68, 4.76, 3.14], 7: [140.68, 96.76, 3.14], 8: [117.68, 17.65, 3.14], 9: [64.68, 13.76, 3.14],
      11: [54.02, 9.10, 3.47], 13: [183.28, 68.49, 3.73], 14: [80.38, 115.52, 3.87], 15: [60.41, 114.36, 3.73],
      16: [161.28, 88.63, 3.73], 18: [155.28, 104.16, 3.73], 20: [35.55, 101.66, 4.01], 21: [22.55, 99.36, 3.73],
      22: [15.82, 24.64, 4.01],
    },
  };

  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const ZOOM_STEP = 1.6;
  const POPOVER_GAP = 12;
  const POPOVER_MARGIN = 8;

  document.querySelectorAll('.drawing-viewer').forEach(setUpDrawing);

  function setUpDrawing(viewer) {
    const viewport = viewer.querySelector('.drawing-viewport');
    const canvas = viewer.querySelector('.drawing-canvas');
    const stage = viewer.querySelector('.drawing-stage');
    const hint = viewer.querySelector('.drawing-hint');
    if (coarsePointer && hint) hint.textContent = 'Tap a pink marker · Double-tap to zoom';

    /* ----------------------------------------------------------
       2. BLUEPRINT / PAPER
    ---------------------------------------------------------- */
    const modeButtons = viewer.querySelectorAll('[data-mode]');
    modeButtons.forEach((button) => button.addEventListener('click', () => {
      viewer.dataset.style = button.dataset.mode;
      modeButtons.forEach((other) => {
        other.classList.toggle('is-active', other === button);
        other.setAttribute('aria-pressed', other === button);
      });
    }));

    /* ----------------------------------------------------------
       3. SCANNER REVEAL
    ---------------------------------------------------------- */
    if (!reducedMotion) {
      viewer.classList.add('is-waiting-scan');
      const scanObserver = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        scanObserver.disconnect();
        viewer.classList.remove('is-waiting-scan');
        viewer.classList.add('is-scanning');
        canvas.addEventListener('animationend', () => viewer.classList.remove('is-scanning'), { once: true });
      }, { threshold: 0.35 });
      scanObserver.observe(viewport);
    }

    /* ----------------------------------------------------------
       4. ZOOM AND PAN
       The canvas grows inside a scrolling viewport, so the
       drawing is redrawn sharp at every zoom level.
    ---------------------------------------------------------- */
    let zoomLevel = 1;
    const zoomInButton = viewer.querySelector('[data-zoom="in"]');
    const zoomOutButton = viewer.querySelector('[data-zoom="out"]');

    // About 10 px per mm at the deepest zoom, enough to read the smallest text
    const maximumZoom = () => Math.min(8, Math.max(3, SHEET_WIDTH * 10 / viewport.clientWidth));

    function zoomTo(requestedZoom, clientX, clientY) {
      const bounds = viewport.getBoundingClientRect();
      const focusX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left;
      const focusY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top;
      const contentX = (viewport.scrollLeft + focusX) / zoomLevel;
      const contentY = (viewport.scrollTop + focusY) / zoomLevel;
      zoomLevel = Math.min(maximumZoom(), Math.max(1, requestedZoom));
      canvas.style.width = `${zoomLevel * 100}%`;
      viewport.scrollLeft = contentX * zoomLevel - focusX;
      viewport.scrollTop = contentY * zoomLevel - focusY;
      viewer.classList.toggle('is-zoomed', zoomLevel > 1);
      zoomOutButton.disabled = zoomLevel <= 1;
      zoomInButton.disabled = zoomLevel >= maximumZoom() - 0.001;
      placePopover();
    }

    zoomInButton.addEventListener('click', () => zoomTo(zoomLevel * ZOOM_STEP));
    zoomOutButton.addEventListener('click', () => zoomTo(zoomLevel / ZOOM_STEP));
    viewer.querySelector('[data-zoom="fit"]').addEventListener('click', () => zoomTo(1));
    zoomOutButton.disabled = true;

    // Plain scroll keeps scrolling the page; Ctrl + scroll (or a trackpad pinch) zooms at the pointer,
    // and never zooms the whole browser page, even over the toolbar or the popover
    viewer.addEventListener('wheel', (event) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); }, { passive: false });
    viewport.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(zoomLevel * Math.exp(-event.deltaY * 0.004), event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener('dblclick', (event) => {
      if (event.target.closest('.drawing-hotspot')) return;
      zoomTo(zoomLevel >= maximumZoom() - 0.001 ? 1 : zoomLevel * 2, event.clientX, event.clientY);
    });

    // Mouse drag pans the zoomed drawing; touch screens scroll it natively
    let dragStart = null;
    let suppressClick = false;
    viewport.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || zoomLevel <= 1) return;
      dragStart = { x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop, moved: false };
    });
    window.addEventListener('pointermove', (event) => {
      if (!dragStart) return;
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      if (!dragStart.moved && Math.hypot(deltaX, deltaY) < 5) return;
      dragStart.moved = true;
      viewer.classList.add('is-panning');
      viewport.scrollLeft = dragStart.scrollLeft - deltaX;
      viewport.scrollTop = dragStart.scrollTop - deltaY;
    });
    window.addEventListener('pointerup', () => {
      if (!dragStart) return;
      suppressClick = dragStart.moved;
      dragStart = null;
      viewer.classList.remove('is-panning');
    });
    viewport.addEventListener('click', (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);

    /* ----------------------------------------------------------
       5. POPOVER
       Opens next to the marker or row that was clicked, inside
       the visible part of the drawing, and follows it on zoom.
    ---------------------------------------------------------- */
    const popover = viewer.querySelector('.drawing-popover');
    const popoverTitle = popover.querySelector('.drawing-popover-title');
    const popoverText = popover.querySelector('.drawing-popover-text');
    const popoverAction = popover.querySelector('.drawing-popover-action');
    let popoverAnchor = null;
    let popoverActionHandler = null;

    function clearSelection() {
      viewer.querySelectorAll('.drawing-hotspot.is-active, .drawing-row.is-selected, .drawing-balloon.is-selected')
        .forEach((element) => element.classList.remove('is-active', 'is-selected'));
    }

    function openPopover(anchor, title, text, action) {
      popoverAnchor = anchor;
      popoverTitle.textContent = title;
      popoverText.textContent = text;
      popoverAction.hidden = !action;
      popoverActionHandler = action ? action.onClick : null;
      if (action) popoverAction.textContent = action.label;
      popover.hidden = false;
      placePopover();
    }

    function closePopover() {
      popover.hidden = true;
      popoverAnchor = null;
      clearSelection();
    }

    function placePopover() {
      if (popover.hidden || !popoverAnchor) return;
      const stageBounds = stage.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      const anchorBounds = popoverAnchor.getBoundingClientRect();
      // The anchor scrolled out of the zoomed view: the popover waits until it comes back
      const anchorVisible = anchorBounds.right > viewportBounds.left && anchorBounds.left < viewportBounds.right
        && anchorBounds.bottom > viewportBounds.top && anchorBounds.top < viewportBounds.bottom;
      popover.style.visibility = anchorVisible ? '' : 'hidden';

      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const anchorLeft = anchorBounds.left - stageBounds.left;
      const anchorRight = anchorBounds.right - stageBounds.left;
      const anchorTop = anchorBounds.top - stageBounds.top;
      const anchorBottom = anchorBounds.bottom - stageBounds.top;
      const anchorMiddle = (anchorTop + anchorBottom) / 2;
      let left;
      let top;
      if (anchorRight + POPOVER_GAP + width <= stageBounds.width - POPOVER_MARGIN) {
        left = anchorRight + POPOVER_GAP;
        top = anchorMiddle - height / 2;
      } else if (anchorLeft - POPOVER_GAP - width >= POPOVER_MARGIN) {
        left = anchorLeft - POPOVER_GAP - width;
        top = anchorMiddle - height / 2;
      } else {
        left = (anchorLeft + anchorRight) / 2 - width / 2;
        const fitsBelow = anchorBottom + POPOVER_GAP + height <= stageBounds.height - POPOVER_MARGIN;
        top = fitsBelow ? anchorBottom + POPOVER_GAP : anchorTop - POPOVER_GAP - height;
      }
      const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
      popover.style.left = `${Math.round(clamp(left, POPOVER_MARGIN, stageBounds.width - width - POPOVER_MARGIN))}px`;
      popover.style.top = `${Math.round(clamp(top, POPOVER_MARGIN, stageBounds.height - height - POPOVER_MARGIN))}px`;
    }

    popoverAction.addEventListener('click', () => { if (popoverActionHandler) popoverActionHandler(); });
    popover.querySelector('.drawing-popover-close').addEventListener('click', closePopover);
    viewport.addEventListener('scroll', placePopover, { passive: true });
    window.addEventListener('resize', placePopover);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !popover.hidden) closePopover(); });

    // A click on the drawing itself, away from the markers and the part list, closes the popover
    viewport.addEventListener('click', (event) => {
      if (!event.target.closest('.drawing-hotspot, .drawing-row, .drawing-balloon')) closePopover();
    });

    /* ----------------------------------------------------------
       6. DESIGN NOTES
    ---------------------------------------------------------- */
    viewer.querySelectorAll('.drawing-hotspot').forEach((hotspot) => {
      hotspot.setAttribute('aria-label', hotspot.dataset.title);
      hotspot.addEventListener('click', () => {
        if (hotspot.classList.contains('is-active')) { closePopover(); return; }
        clearSelection();
        hotspot.classList.add('is-active');
        openPopover(hotspot, hotspot.dataset.title, hotspot.dataset.text);
      });
    });

    /* ----------------------------------------------------------
       7. PART LIST LINKED WITH THE 3D MODEL
    ---------------------------------------------------------- */
    if (viewer.dataset.partList !== 'assembly') return;
    const partList = ASSEMBLY_PART_LIST;
    const overlay = document.createElementNS(SVG_NAMESPACE, 'svg');
    overlay.setAttribute('viewBox', `0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}`);
    overlay.setAttribute('class', 'drawing-overlay');
    const rowsByItem = new Map();
    const balloonsByItem = new Map();

    partList.items.forEach(([title], index) => {
      const item = index + 1;
      const row = document.createElementNS(SVG_NAMESPACE, 'rect');
      Object.entries({ x: partList.left, y: partList.firstRowTop + index * partList.rowHeight, width: partList.right - partList.left,
        height: partList.rowHeight, class: 'drawing-row', tabindex: 0, role: 'button', 'aria-label': `Item ${item}: ${title}` })
        .forEach(([key, value]) => row.setAttribute(key, value));
      overlay.appendChild(row);
      rowsByItem.set(item, row);
      const balloon = partList.balloons[item];
      if (balloon) {
        const ring = document.createElementNS(SVG_NAMESPACE, 'circle');
        Object.entries({ cx: balloon[0], cy: balloon[1], r: balloon[2] + 0.6, class: 'drawing-balloon' })
          .forEach(([key, value]) => ring.setAttribute(key, value));
        overlay.appendChild(ring);
        balloonsByItem.set(item, ring);
        ring.addEventListener('click', () => openItem(item));
      }
      row.addEventListener('click', () => openItem(item));
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openItem(item);
      });
    });
    canvas.appendChild(overlay);

    const viewerFrame = document.getElementById('gearboxViewer');

    function highlightItem(item) {
      clearSelection();
      if (!rowsByItem.has(item)) return false;
      rowsByItem.get(item).classList.add('is-selected');
      if (balloonsByItem.has(item)) balloonsByItem.get(item).classList.add('is-selected');
      return true;
    }

    // Row and balloon highlighted, popover next to the row; the 3D model changes only on "Show in 3D"
    function openItem(item) {
      if (!highlightItem(item)) { closePopover(); return; }
      const [title, quantity, description] = partList.items[item - 1];
      const quantityText = quantity > 1 ? ` · ×${quantity}` : '';
      openPopover(rowsByItem.get(item), `Item ${item} · ${title}`, description + quantityText, {
        label: 'Show in 3D ↑',
        onClick: () => {
          document.dispatchEvent(new CustomEvent('gearbox:show-part', { detail: { item } }));
          viewerFrame.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        },
      });
    }

    // A part picked in 3D: its row and balloon light up quietly, without opening anything
    document.addEventListener('gearbox:part-selected', (event) => {
      if (popoverAnchor && popoverAnchor.classList.contains('drawing-row')) { popover.hidden = true; popoverAnchor = null; }
      if (event.detail.item) highlightItem(event.detail.item);
      else clearSelection();
    });
    document.addEventListener('gearbox:find-on-drawing', (event) => {
      zoomTo(1);
      viewer.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      openItem(event.detail.item);
    });
  }
})();
