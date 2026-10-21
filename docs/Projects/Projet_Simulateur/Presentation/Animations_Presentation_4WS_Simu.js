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

/* ---- Background perspective grid ---- */
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

/* ---- Hero path animation ---- */
(function() {
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Define an S-curve path (reference trajectory)
  function refPath(s) {
    // s in [0..1], returns {x,y}
    const x = W * 0.1 + s * W * 0.8;
    const y = H * 0.55 + Math.sin(s * Math.PI * 2.5) * H * 0.18;
    return { x, y };
  }

  // Robot position along path with a lateral error that decays
  function robotPos(s, errorMag) {
    const p  = refPath(s);
    const p2 = refPath(Math.min(s + 0.001, 1));
    const dx = p2.x - p.x, dy = p2.y - p.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    // normal vector
    const nx = -dy/len, ny = dx/len;
    return { x: p.x + nx * errorMag, y: p.y + ny * errorMag };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.004;

    const N = 200;

    // --- Draw reference path ---
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const p = refPath(s);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(170,0,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Draw robot actual path (converging error) ---
    ctx.beginPath();
    const trailLen = 0.5;
    const sStart = Math.max(0, (t * 0.35) % 1 - trailLen);
    const sEnd   = (t * 0.35) % 1;
    for (let i = 0; i <= 120; i++) {
      const s = sStart + (sEnd - sStart) * (i / 120);
      const age    = (s - sStart) / (sEnd - sStart);
      const sPhase = s % 1;
      const errorDecay = Math.exp(-sPhase * 3) * 30 * Math.sin(sPhase * 8 + 1);
      const rp = robotPos(sPhase, errorDecay);
      i === 0 ? ctx.moveTo(rp.x, rp.y) : ctx.lineTo(rp.x, rp.y);
    }
    const grad = ctx.createLinearGradient(W*0.1, 0, W*0.9, 0);
    grad.addColorStop(0, 'rgba(255,0,204,0)');
    grad.addColorStop(0.2, 'rgba(255,0,204,0.6)');
    grad.addColorStop(1, 'rgba(0,229,204,0.9)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- Robot head (glowing dot) ---
    const sNow = (t * 0.35) % 1;
    const errNow = Math.exp(-sNow * 3) * 30 * Math.sin(sNow * 8 + 1);
    const rNow = robotPos(sNow, errNow);
    ctx.beginPath();
    ctx.arc(rNow.x, rNow.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#00e5cc';
    ctx.shadowColor = '#00e5cc';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // --- Lateral error line ---
    const pRef = refPath(sNow);
    ctx.beginPath();
    ctx.moveTo(rNow.x, rNow.y);
    ctx.lineTo(pRef.x, pRef.y);
    ctx.strokeStyle = 'rgba(255,229,102,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Error label
    ctx.fillStyle = 'rgba(255,229,102,0.7)';
    ctx.font = '11px JetBrains Mono, monospace';
    const ex = (rNow.x + pRef.x) / 2 + 8;
    const ey = (rNow.y + pRef.y) / 2;
    ctx.fillText(`Lat_Err`, ex, ey);

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ---- Intersection observer for reveals ---- */
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
    let current = 0;
    const step = () => {
      current++;
      el.textContent = current;
      if (current < target) setTimeout(step, 80);
    };
    setTimeout(step, Math.random() * 200);
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-item').forEach(el => statObs.observe(el));

/* ---- Diagram canvas (control law architecture) ---- */
(function() {
const canvas = document.getElementById('diagramCanvas');
if (!canvas) return;
const ctx = canvas.getContext('2d');

// Fix pixelisation écrans HiDPI
const dpr = window.devicePixelRatio || 1;
const W = 900, H = 380;
canvas.width  = W * dpr;
canvas.height = H * dpr;
canvas.style.width  = W + 'px';
canvas.style.height = H + 'px';
ctx.scale(dpr, dpr);

let t = 0;

const nodes = [
  { id:'errors', label:'Errors\ny, θ̃',      x:80,  y:190, color:'#aa00ff' },
  { id:'pd',     label:'PD',                  x:240, y:95,  color:'#cc88ff' },
  { id:'bs',     label:'Back-\nStepping',         x:240, y:190, color:'#ff00cc' },
  { id:'gpc',    label:'GPC',                 x:240, y:285, color:'#00e5cc' },
  { id:'mux',    label:'δ_F cmd',             x:420, y:190, color:'#ffe566' },
  { id:'act',    label:'Actuator',            x:580, y:190, color:'#10b981' },
  { id:'veh',    label:'Vehicle',             x:750, y:190, color:'#3b82f6' },
  { id:'obs',    label:'Observer\nβ_F, β_R',  x:600, y:310, color:'#f59e0b' },
];

  const edges = [
    { from:'errors', to:'pd'  },
    { from:'errors', to:'bs'  },
    { from:'errors', to:'gpc' },
    { from:'pd',     to:'mux' },
    { from:'bs',     to:'mux' },
    { from:'gpc',    to:'mux' },
    { from:'mux',    to:'act' },
    { from:'act',    to:'veh' },
    { from:'veh',    to:'obs' },
    { from:'obs',    to:'bs'  },
    { from:'obs',    to:'gpc' },
  ];

  function getNode(id) { return nodes.find(n => n.id === id); }

  // Particle system
  const particles = [];
  edges.forEach((e, i) => {
    const from = getNode(e.from), to = getNode(e.to);
    particles.push({ edge:e, progress: (i * 0.27) % 1, speed: 0.004 + Math.random()*0.003 });
  });

  function drawNode(n) {
    const r = 24;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI*2);
    ctx.fillStyle   = 'rgba(10,7,20,0.9)';
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = n.color;
    ctx.shadowBlur  = 5;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.fillStyle   = n.color;
    ctx.font        = '9px JetBrains Mono, monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    const lines = n.label.split('\n');
    if (lines.length === 2) {
      ctx.fillText(lines[0], n.x, n.y - 5);
      ctx.fillText(lines[1], n.x, n.y + 6);
    } else {
      ctx.fillText(n.label, n.x, n.y);
    }
  }

  function drawEdge(e) {
    const from = getNode(e.from), to = getNode(e.to);
    const r = 24;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const x1 = from.x + ux*r, y1 = from.y + uy*r;
    const x2 = to.x - ux*r, y2 = to.y - uy*r;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(170,0,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawParticle(p) {
    const from = getNode(p.edge.from), to = getNode(p.edge.to);
    const r = 24;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const x1 = from.x + ux*r, y1 = from.y + uy*r;
    const x2 = to.x - ux*r,   y2 = to.y - uy*r;
    const px = x1 + (x2-x1)*p.progress;
    const py = y1 + (y2-y1)*p.progress;
    const col = from.color;

    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI*2);
    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 5;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    t += 0.016;
    edges.forEach(drawEdge);
    particles.forEach(p => {
      p.progress += p.speed;
      if (p.progress > 1) p.progress = 0;
      drawParticle(p);
    });
    nodes.forEach(drawNode);
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ---- Trajectory canvas (large demo) ---- */
(function() {
  const canvas = document.getElementById('trajCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let t = 0;
  const history = [];
  const maxHist = 400;

  function refY(x) {
    // S-curve reference
    return H/2 + Math.sin(x / (W*0.18)) * H * 0.22;
  }

  let robotX = 0, robotY = H/2;
  const speed = 1.2;

  function update() {
    robotX += speed;
    if (robotX > W + 30) { robotX = -30; robotY = H/2; history.length = 0; }
    const targetY = refY(robotX);
    const errDecay = Math.exp(-robotX / (W*0.4));
    const error = (robotY - targetY);
    const kp = 0.06 * (1 - errDecay * 0.5);
    robotY += (targetY - robotY) * kp + (Math.random()-0.5)*0.4;
    history.push({ x: robotX, y: robotY, ref: targetY });
    if (history.length > maxHist) history.shift();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(10,7,20,0.95)';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(170,0,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
    }

    // Reference path (full)
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = refY(x);
      x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.strokeStyle = 'rgba(170,0,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10,7]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Robot trail
    if (history.length > 2) {
      ctx.beginPath();
      history.forEach((h, i) => i===0 ? ctx.moveTo(h.x, h.y) : ctx.lineTo(h.x, h.y));
      const grad = ctx.createLinearGradient(history[0].x, 0, history[history.length-1].x, 0);
      grad.addColorStop(0, 'rgba(255,0,204,0)');
      grad.addColorStop(0.5, 'rgba(255,0,204,0.5)');
      grad.addColorStop(1, 'rgba(0,229,204,1)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff00cc';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Error shading
    if (history.length > 1) {
      ctx.beginPath();
      history.forEach((h, i) => i===0 ? ctx.moveTo(h.x, h.y) : ctx.lineTo(h.x, h.y));
      history.slice().reverse().forEach(h => ctx.lineTo(h.x, h.ref));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,229,102,0.04)';
      ctx.fill();
    }

    // Error lines (sparse)
    history.filter((_,i) => i % 30 === 0).forEach(h => {
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.x, h.ref);
      ctx.strokeStyle = 'rgba(255,229,102,0.3)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2,3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Robot dot
    ctx.beginPath();
    ctx.arc(robotX, robotY, 6, 0, Math.PI*2);
    ctx.fillStyle = '#00e5cc';
    ctx.shadowColor = '#00e5cc';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD overlay
    ctx.fillStyle = 'rgba(0,229,204,0.8)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    const lat_err = history.length ? (robotY - history[history.length-1].ref).toFixed(2) : '0.00';
    ctx.fillText(`Lat_Err : ${lat_err} cm`, 16, 22);
    ctx.fillStyle = 'rgba(170,0,255,0.7)';
    ctx.fillText(`Speed   : ${(speed * 10).toFixed(1)} km/h`, 16, 36);
    ctx.fillStyle = 'rgba(255,0,204,0.7)';
    ctx.fillText(`Path    : 4WS Agricultural Route`, 16, 50);

    // Labels
    ctx.fillStyle = 'rgba(170,0,255,0.6)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('— — Reference Path', W-16, 22);
    ctx.fillStyle = 'rgba(255,0,204,0.8)';
    ctx.fillText('—— Robot Trajectory', W-16, 36);

    update();
    requestAnimationFrame(draw);
  }
  draw();
})();

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