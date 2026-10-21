/* ============================================================
   CUSTOM CURSOR
   ============================================================ */
const dot  = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
(function animCursor() {
  dot.style.left  = mx + 'px';
  dot.style.top   = my + 'px';
  rx += (mx - rx) * 0.14;
  ry += (my - ry) * 0.14;
  ring.style.left = rx + 'px';
  ring.style.top  = ry + 'px';
  requestAnimationFrame(animCursor);
})();

/* ============================================================
   BACKGROUND PERSPECTIVE GRID  (unchanged from 4WS)
   ============================================================ */
(function() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.003;
    const vp = { x: W/2, y: H * 0.45 };

    // Horizontal lines (receding)
    for (let i = 0; i < 14; i++) {
      const frac = i / 14;
      const y = vp.y + (H * 0.8) * (frac * frac);
      const spread = (frac * frac) * W * 0.8;
      const alpha = 0.08 + frac * 0.12;
      ctx.beginPath();
      ctx.moveTo(vp.x - spread, y);
      ctx.lineTo(vp.x + spread, y);
      const grad = ctx.createLinearGradient(vp.x - spread, 0, vp.x + spread, 0);
      grad.addColorStop(0, `rgba(170,0,255,0)`);
      grad.addColorStop(0.35, `rgba(170,0,255,${alpha})`);
      grad.addColorStop(0.5,  `rgba(255,0,204,${alpha})`);
      grad.addColorStop(0.65, `rgba(170,0,255,${alpha})`);
      grad.addColorStop(1, `rgba(170,0,255,0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // Vertical lines (converging to VP)
    const nLines = 12;
    for (let i = 0; i <= nLines; i++) {
      const frac = i / nLines;
      const xBot = W * frac;
      const alpha = 0.05 + 0.08 * Math.abs(frac - 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(xBot, H);
      ctx.strokeStyle = `rgba(170,0,255,${alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Moving dots on the grid
    for (let k = 0; k < 5; k++) {
      const phase = (t + k * 0.4) % 1;
      const frac  = phase * phase;
      const y     = vp.y + (H * 0.8) * frac;
      const spread = frac * W * 0.3;
      const xOffset = Math.sin(k * 2.3) * spread;
      const r = 2 * frac + 0.5;
      const alpha = (1 - frac) * 0.7;
      ctx.beginPath();
      ctx.arc(vp.x + xOffset, y, r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,0,204,${alpha})`;
      ctx.shadowColor = '#ff00cc';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ============================================================
   HERO KINEMATIC PLAYBACK  (cycloidal reducer in motion)
   The orbiting cycloidal disk rotates in the stator ring, and a
   marker point on one lobe traces its trajectory in the stator
   frame — the real principle of the reducer, visualised live.
   Canvas is sized to its parent (the hero section only).
   ============================================================ */
(function() {
  const canvas = document.getElementById('cycloCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const TWO = Math.PI * 2;
  const Z = 7, K1 = 0.6, ecc = 0.09;
  let W, H;
  let trace = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trace = []; // reset trace on resize (coords are absolute)
  }
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  const CX = () => W * 0.80;
  const CY = () => H * 0.42;
  const K  = () => Math.min(W, H) * 0.32 / (1 + 1 / Z);

  function drawPins() {
    const cx = CX(), cy = CY(), k = K();
    const R = k * (1 + 1 / Z) * 1.02;
    for (let j = 0; j < Z + 1; j++) {
      const a = TWO * j / (Z + 1);
      const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, TWO);
      ctx.fillStyle = 'rgba(10,7,20,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(170,0,255,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,229,204,0.15)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function computeMarker() {
    const cx = CX(), cy = CY(), k = K();
    const orbitAng = t, rot = -t / Z;
    const ox = cx + ecc * k * Math.cos(orbitAng);
    const oy = cy + ecc * k * Math.sin(orbitAng);
    const R = 1, r = 1 / Z, th = 0;
    const lx = ((R + r) * Math.cos(th) - K1 * r * Math.cos((R + r) / r * th)) * k;
    const ly = ((R + r) * Math.sin(th) - K1 * r * Math.sin((R + r) / r * th)) * k;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    return [ox + lx * cs - ly * sn, oy + lx * sn + ly * cs, ox, oy, rot];
  }

  function drawDisk(ox, oy, rot) {
    const k = K();
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-k, 0, k, 0);
    g.addColorStop(0, 'rgba(255,0,204,0.75)');
    g.addColorStop(1, 'rgba(170,0,255,0.7)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const th = (i / 360) * TWO;
      const R = 1, r = 1 / Z;
      const px = ((R + r) * Math.cos(th) - K1 * r * Math.cos((R + r) / r * th)) * k;
      const py = ((R + r) * Math.sin(th) - K1 * r * Math.sin((R + r) / r * th)) * k;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,229,102,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, TWO);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    const hudX = W * 0.47;
    const hudY = H * 0.63;
    const sigma = 1180 + 320 * (0.5 + 0.5 * Math.sin(t * Z));

    // Live Hertzian pressure
    ctx.textAlign = 'left';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00e5cc';
    ctx.fillText('σ_H  = ' + sigma.toFixed(0) + ' MPa', hudX, hudY);

    // Admissible reference
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(154,134,184,0.7)';
    ctx.fillText('admissible  1800 MPa', hudX, hudY + 16);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const [mx, my, ox, oy, rot] = computeMarker();
    trace.push([mx, my]);
    if (trace.length > 1000) trace.shift();

    ctx.strokeStyle = 'rgba(0,229,204,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    trace.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    drawPins();
    drawDisk(ox, oy, rot);

    ctx.fillStyle = 'rgba(0,229,204,0.28)';
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, TWO);
    ctx.fill();
    ctx.fillStyle = '#00e5cc';
    ctx.shadowColor = '#00e5cc';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, TWO);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawHUD();

    t += 0.020;
    requestAnimationFrame(draw);
  }
  draw();
})();


/* ============================================================
   INTERSECTION OBSERVER FOR REVEALS  (unchanged)
   ============================================================ */
const revealEls = document.querySelectorAll('.stat-item, .pipe-block, .pipe-arrow');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const i = Array.from(revealEls).indexOf(entry.target);
    setTimeout(() => entry.target.classList.add('visible'), i * 80);
    revealObs.unobserve(entry.target);
  });
}, { threshold: 0.1 });
revealEls.forEach(el => revealObs.observe(el));

/* ---- Control list reveal ---- */
const ctrlItems = document.querySelectorAll('.control-list li');
const ctrlObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const i = Array.from(ctrlItems).indexOf(entry.target);
    setTimeout(() => entry.target.classList.add('visible'), i * 120);
    ctrlObs.unobserve(entry.target);
  });
}, { threshold: 0.1 });
ctrlItems.forEach(el => ctrlObs.observe(el));

/* ---- Counter animation ---- */
const statNums = document.querySelectorAll('.stat-num');
let counted = false;
const statObs = new IntersectionObserver(entries => {
  if (counted || !entries.some(e => e.isIntersecting)) return;
  counted = true;

  statNums.forEach(el => {
  const target = parseInt(el.dataset.target);
  const prefix = el.dataset.prefix || '';
  const duration = 1100;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(target * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = prefix + target;
  };
  setTimeout(() => requestAnimationFrame(step), Math.random() * 200);
});

}, { threshold: 0.5 });
document.querySelectorAll('.stat-item').forEach(el => statObs.observe(el));

/* ============================================================
   DIAGRAM CANVAS  (triaxial validation radar)
   The three verification planes — geometry, tribology, dynamics —
   form a radar. The filled polygon breathes and a sweep line
   passes over each axis, illustrating "all cross-checked".
   ============================================================ */
(function() {
  const canvas = document.getElementById('diagramCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const TWO = Math.PI * 2;

  const dpr = window.devicePixelRatio || 1;
  const W = 560, H = 560;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = '100%';
  canvas.style.height = 'auto';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let t = 0;
  const axes = ['GEOMETRY', 'TRIBOLOGY', 'DYNAMICS'];
  const cols = ['#aa00ff', '#ff00cc', '#00e5cc'];

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.52, R = Math.min(W, H) * 0.36;
    t += 0.02;

    // Concentric triangular grid rings
    for (let g = 1; g <= 4; g++) {
      ctx.strokeStyle = 'rgba(170,0,255,0.12)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = -Math.PI / 2 + i * TWO / 3, rr = R * g / 4;
        const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Axis spokes + labels
    ctx.textAlign = 'center';
    ctx.font = '11px JetBrains Mono, monospace';
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TWO / 3;
      ctx.strokeStyle = 'rgba(170,0,255,0.2)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.stroke();
      ctx.fillStyle = cols[i];
      ctx.fillText(axes[i], cx + (R + 26) * Math.cos(a), cy + (R + 26) * Math.sin(a) + 4);
    }

    // Breathing validation polygon
    const vals = [
      0.82 + 0.10 * Math.sin(t),
      0.90 + 0.06 * Math.sin(t * 1.3 + 1),
      0.78 + 0.12 * Math.sin(t * 0.8 + 2)
    ];
    const grd = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    grd.addColorStop(0, 'rgba(170,0,255,0.28)');
    grd.addColorStop(1, 'rgba(0,229,204,0.28)');
    ctx.fillStyle = grd;
    ctx.strokeStyle = 'rgba(255,0,204,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const idx = i % 3, a = -Math.PI / 2 + idx * TWO / 3, rr = R * vals[idx];
      const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertex markers
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TWO / 3, rr = R * vals[i];
      const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a);
      ctx.fillStyle = cols[i];
      ctx.shadowColor = cols[i];
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, TWO);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Sweep line
    const sweep = (t * 0.5) % TWO;
    const sx = cx + R * Math.cos(sweep - Math.PI / 2);
    const sy = cy + R * Math.sin(sweep - Math.PI / 2);
    ctx.strokeStyle = 'rgba(0,229,204,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ============================================================
   MODULE CARDS REVEAL  (unchanged)
   ============================================================ */
const modCards = document.querySelectorAll('.mod-card');
const modObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const i = Array.from(modCards).indexOf(entry.target);
    const col = i % 3;
    setTimeout(() => entry.target.classList.add('visible'), col * 150);
    modObs.unobserve(entry.target);
  });
}, { threshold: 0.1 });
modCards.forEach(el => modObs.observe(el));

/* ---- Halo des module cards qui suit la souris ---- */
document.querySelectorAll('.mod-card-link').forEach(cardLink => {
  cardLink.addEventListener('pointermove', event => {
    const cardBox = cardLink.getBoundingClientRect();
    cardLink.style.setProperty('--pointer-x', `${event.clientX - cardBox.left}px`);
    cardLink.style.setProperty('--pointer-y', `${event.clientY - cardBox.top}px`);
  });
});
