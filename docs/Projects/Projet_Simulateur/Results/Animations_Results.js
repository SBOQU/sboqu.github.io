/* ============================================================
   Animations_Results.js
   Page de résultats — 4WS Simulator
   ============================================================
   1. Curseur personnalisé
   2. Canvas background grid
   3. Scroll reveal — cards
   4. Toggle graphe braquage
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. CURSEUR PERSONNALISÉ
  ---------------------------------------------------------- */
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');

  if (dot && ring) {
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    });

    (function animate() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(animate);
    })();

    document.querySelectorAll('a, button, .rc-toggle').forEach(el => {
      el.addEventListener('mouseenter', () => {
        ring.style.width  = '48px';
        ring.style.height = '48px';
        ring.style.borderColor = 'rgba(0,229,204,0.6)';
      });
      el.addEventListener('mouseleave', () => {
        ring.style.width  = '30px';
        ring.style.height = '30px';
        ring.style.borderColor = 'rgba(255,0,204,0.5)';
      });
    });
  }


  /* ----------------------------------------------------------
     2. CANVAS BACKGROUND GRID
  ---------------------------------------------------------- */
  const bgCanvas = document.getElementById('bgCanvas');
  if (bgCanvas) {
    const ctx = bgCanvas.getContext('2d');

    function resizeBg() {
      bgCanvas.width  = window.innerWidth;
      bgCanvas.height = window.innerHeight;
      drawBg();
    }

    function drawBg() {
      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      const spacing = 60;
      ctx.strokeStyle = 'rgba(170,0,255,0.12)';
      ctx.lineWidth   = 0.5;

      for (let x = 0; x < bgCanvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, bgCanvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < bgCanvas.height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(bgCanvas.width, y);
        ctx.stroke();
      }
    }

    resizeBg();
    window.addEventListener('resize', resizeBg);
  }


  /* ----------------------------------------------------------
     3. SCROLL REVEAL — CARDS
  ---------------------------------------------------------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseInt(entry.target.dataset.revealDelay || '0', 10);
      setTimeout(() => entry.target.classList.add('visible'), delay);
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  /* Assigner un délai échelonné par section */
  document.querySelectorAll('.result-section').forEach(section => {
    section.querySelectorAll('.result-card').forEach((card, i) => {
      card.dataset.revealDelay = i * 100;
      revealObserver.observe(card);
    });
  });


  /* ----------------------------------------------------------
     4. TOGGLE GRAPHE BRAQUAGE
  ---------------------------------------------------------- */
  document.querySelectorAll('.rc-toggle').forEach(btn => {
    const card     = btn.closest('.result-card');
    const optional = card ? card.querySelector('.rc-graph--optional') : null;

    if (!optional) return;

    btn.setAttribute('title', 'Afficher l\'angle de braquage');
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', () => {
      const isOpen = optional.classList.contains('open');

      optional.classList.toggle('open', !isOpen);
      btn.classList.toggle('active', !isOpen);

      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.setAttribute(
        'title',
        isOpen
          ? 'Afficher l\'angle de braquage'
          : 'Masquer l\'angle de braquage'
      );
    });
  });

})();
