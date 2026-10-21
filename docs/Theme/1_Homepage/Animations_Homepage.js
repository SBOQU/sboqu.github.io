const terrainDivider = document.querySelector('.terrain-divider');
const terrainCanvas  = document.querySelector('.terrain-canvas');
const heroContent    = document.querySelector('.hero-content');
const heroScroll     = document.querySelector('.hero-scroll');

const clamp      = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const lerp       = (startValue, endValue, ratio) => startValue + (endValue - startValue) * clamp(ratio, 0, 1);
const smoothStep = (edgeStart, edgeEnd, value) => {
  const ratio = clamp((value - edgeStart) / (edgeEnd - edgeStart), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
};

// Apparition du relief + texte hero qui disparaît au scroll
if (terrainDivider) {
  function updateOnScroll() {
    const dividerBox     = terrainDivider.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const progress       = (viewportHeight - dividerBox.top - 200) / 100;

    const revealRatio = progress / 2;
    terrainDivider.style.opacity   = lerp(0, 1, revealRatio);
    terrainDivider.style.transform = `translateY(${lerp(30, 0, revealRatio)}px)`;

    // Texte du hero et indicateur de scroll qui disparaissent selon le scroll de la page
    if (heroContent) {
      const fadeRatio = window.scrollY / (viewportHeight * 0.45);
      heroContent.style.opacity   = lerp(1, 0, fadeRatio);
      heroContent.style.transform = `translateY(${lerp(0, -20, fadeRatio)}px)`;
    }

    if (heroScroll) heroScroll.style.opacity = lerp(1, 0, window.scrollY / (viewportHeight * 0.15));
  }

  window.addEventListener('scroll', updateOnScroll, { passive: true });
  updateOnScroll();
}

// Relief procédural (bruit de valeur sur une grille)
function hashToUnit(cellX, cellZ) {
  let hashValue = (Math.imul(cellX, 374761393) + Math.imul(cellZ, 668265263)) | 0;
  hashValue = Math.imul(hashValue ^ (hashValue >>> 13), 1274126177);
  hashValue ^= hashValue >>> 16;
  return (hashValue >>> 0) / 4294967295;
}

function valueNoise(positionX, positionZ) {
  const cellX = Math.floor(positionX);
  const cellZ = Math.floor(positionZ);
  const easeX = smoothStep(0, 1, positionX - cellX);
  const easeZ = smoothStep(0, 1, positionZ - cellZ);
  const nearLeft  = hashToUnit(cellX, cellZ);
  const nearRight = hashToUnit(cellX + 1, cellZ);
  const farLeft   = hashToUnit(cellX, cellZ + 1);
  const farRight  = hashToUnit(cellX + 1, cellZ + 1);
  const nearEdge  = nearLeft + (nearRight - nearLeft) * easeX;
  const farEdge   = farLeft + (farRight - farLeft) * easeX;
  return nearEdge + (farEdge - nearEdge) * easeZ;
}

// Vallée plate au centre, montagnes de plus en plus hautes vers les bords
function terrainHeight(worldX, worldZ) {
  const distanceFromRoad = Math.abs(worldX);
  const valleyMask = smoothStep(0.7, 2.6, distanceFromRoad);
  const amplitude  = 1.5 + Math.min(distanceFromRoad, 14) * 0.1;
  const ridges =
    valueNoise(worldX * 0.45, worldZ * 0.45) * 0.65 +
    valueNoise(worldX * 1.1 + 31, worldZ * 1.1) * 0.35;
  return valleyMask * amplitude * Math.pow(ridges, 1.6) * 1.9;
}

if (terrainCanvas) {
  const context = terrainCanvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rowSpacing    = 0.3;
  const columnSpacing = 0.3;
  const rowCount      = 64;
  const nearDepth     = 0.6;
  const cameraHeight  = 1;
  const travelSpeed   = 0.9;
  const farDepth      = nearDepth + (rowCount - 1) * rowSpacing;

  let canvasWidth     = 0;
  let canvasHeight    = 0;
  let halfColumns     = 0;
  let columnCount     = 0;
  let screenX         = new Float32Array(0);
  let screenY         = new Float32Array(0);
  let backgroundColor = '#0a0714';

  function resizeTerrain() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasWidth  = terrainCanvas.clientWidth;
    canvasHeight = terrainCanvas.clientHeight;
    terrainCanvas.width  = Math.round(canvasWidth * pixelRatio);
    terrainCanvas.height = Math.round(canvasHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const focalLength = canvasHeight * 0.75;
    halfColumns = Math.ceil(((canvasWidth / 2) * farDepth / focalLength) / columnSpacing) + 2;
    columnCount = halfColumns * 2 + 1;
    screenX = new Float32Array(rowCount * columnCount);
    screenY = new Float32Array(rowCount * columnCount);

    const themeBackground = getComputedStyle(document.body).getPropertyValue('--md-default-bg-color').trim();
    if (themeBackground) backgroundColor = themeBackground;
  }

  function drawTerrain(timeSeconds) {
    if (canvasWidth === 0 || canvasHeight === 0) return;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const horizonY    = canvasHeight * 0.4;
    const centerX     = canvasWidth / 2;
    const focalLength = canvasHeight * 0.75;

    // Lueur et ligne d'horizon
    const skyGlow = context.createLinearGradient(0, horizonY - 80, 0, horizonY);
    skyGlow.addColorStop(0, 'rgba(255, 0, 204, 0)');
    skyGlow.addColorStop(1, 'rgba(255, 0, 204, 0.22)');
    context.fillStyle = skyGlow;
    context.fillRect(0, horizonY - 80, canvasWidth, 80);

    const horizonLine = context.createLinearGradient(0, 0, canvasWidth, 0);
    horizonLine.addColorStop(0, 'rgba(255, 0, 204, 0)');
    horizonLine.addColorStop(0.5, 'rgba(255, 120, 230, 1)');
    horizonLine.addColorStop(1, 'rgba(255, 0, 204, 0)');
    context.save();
    context.strokeStyle = horizonLine;
    context.lineWidth   = 1.5;
    context.shadowColor = '#ff00cc';
    context.shadowBlur  = 14;
    context.beginPath();
    context.moveTo(0, horizonY);
    context.lineTo(canvasWidth, horizonY);
    context.stroke();
    context.restore();

    // Projection de la grille (les sommets restent fixes dans le monde, la caméra avance)
    const travel        = timeSeconds * travelSpeed;
    const firstWorldRow = Math.floor(travel / rowSpacing);
    const rowOffset     = travel - firstWorldRow * rowSpacing;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const viewDepth = nearDepth + rowIndex * rowSpacing - rowOffset;
      const worldZ    = (firstWorldRow + rowIndex) * rowSpacing;
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
        const worldX     = (columnIndex - halfColumns) * columnSpacing;
        const pointIndex = rowIndex * columnCount + columnIndex;
        screenX[pointIndex] = centerX + worldX * focalLength / viewDepth;
        screenY[pointIndex] = horizonY + (cameraHeight - terrainHeight(worldX, worldZ)) * focalLength / viewDepth;
      }
    }

    // Dessin de l'arrière vers l'avant : chaque rangée cache ce qui est derrière elle
    context.lineWidth = 1;
    for (let rowIndex = rowCount - 1; rowIndex >= 0; rowIndex--) {
      const viewDepth   = nearDepth + rowIndex * rowSpacing - rowOffset;
      const depthRatio  = clamp((viewDepth - nearDepth) / (farDepth - nearDepth), 0, 1);
      const lineOpacity = Math.pow(1 - depthRatio, 1.3) * smoothStep(1, 0.85, depthRatio);
      const rowStart    = rowIndex * columnCount;

      if (rowIndex < rowCount - 1) {
        const fartherRowStart = rowStart + columnCount;
        context.beginPath();
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
          context.moveTo(screenX[fartherRowStart + columnIndex], screenY[fartherRowStart + columnIndex]);
          context.lineTo(screenX[rowStart + columnIndex], screenY[rowStart + columnIndex]);
        }
        context.strokeStyle = `rgba(170, 0, 255, ${(lineOpacity * 0.7).toFixed(3)})`;
        context.stroke();
      }

      const rowLine = new Path2D();
      const rowMask = new Path2D();
      rowMask.moveTo(screenX[rowStart], canvasHeight + 2);
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
        const pointX = screenX[rowStart + columnIndex];
        const pointY = screenY[rowStart + columnIndex];
        if (columnIndex === 0) rowLine.moveTo(pointX, pointY);
        else rowLine.lineTo(pointX, pointY);
        rowMask.lineTo(pointX, pointY);
      }
      rowMask.lineTo(screenX[rowStart + columnCount - 1], canvasHeight + 2);
      rowMask.closePath();

      context.globalAlpha = 0.35 + 0.65 * smoothStep(1, 0.8, depthRatio);
      context.fillStyle   = backgroundColor;
      context.fill(rowMask);
      context.globalAlpha = 1;

      context.strokeStyle = `rgba(255, 0, 204, ${lineOpacity.toFixed(3)})`;
      context.stroke(rowLine);
    }
  }

  // Boucle d'animation : tourne seulement quand le relief est à l'écran
  let elapsedSeconds    = 0;
  let previousTimestamp = null;
  let animationId       = null;
  let isOnScreen        = false;

  function animationFrame(timestamp) {
    if (previousTimestamp !== null) elapsedSeconds += Math.min((timestamp - previousTimestamp) / 1000, 0.05);
    previousTimestamp = timestamp;
    drawTerrain(elapsedSeconds);
    animationId = isOnScreen ? requestAnimationFrame(animationFrame) : null;
  }

  function startAnimation() {
    if (prefersReducedMotion || animationId !== null) return;
    previousTimestamp = null;
    animationId = requestAnimationFrame(animationFrame);
  }

  new IntersectionObserver(entries => {
    isOnScreen = entries[0].isIntersecting;
    if (isOnScreen) startAnimation();
  }, { rootMargin: '100px' }).observe(terrainCanvas);

  new ResizeObserver(() => {
    resizeTerrain();
    drawTerrain(elapsedSeconds);
  }).observe(terrainCanvas);
}

// Animation des feature cards au scroll
const cards = document.querySelectorAll('.feature-card');
if (cards.length > 0) {
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Délai en cascade basé sur la position dans la grille
        const index = Array.from(cards).indexOf(entry.target);
        const delay = (index % 3) * 150; // 150ms entre chaque colonne
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  cards.forEach(card => cardObserver.observe(card));

  // Halo des cards qui suit la souris
  cards.forEach(card => {
    card.addEventListener('pointermove', event => {
      const cardBox = card.getBoundingClientRect();
      card.style.setProperty('--pointer-x', `${event.clientX - cardBox.left}px`);
      card.style.setProperty('--pointer-y', `${event.clientY - cardBox.top}px`);
    });
  });
}

// Animation des project cards au scroll
const projCards = document.querySelectorAll('.proj-card');
if (projCards.length > 0) {
  const projObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(projCards).indexOf(entry.target);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 120); // ← 120ms de délai entre chaque card
        projObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  projCards.forEach(card => projObserver.observe(card));
}

// Halo des project cards qui suit la souris
projCards.forEach(card => {
  card.addEventListener('pointermove', event => {
    const cardBox = card.getBoundingClientRect();
    card.style.setProperty('--pointer-x', `${event.clientX - cardBox.left}px`);
    card.style.setProperty('--pointer-y', `${event.clientY - cardBox.top}px`);
  });
});

// ============================================================
// Visuels animés des project cards
// ============================================================

// Simulateur : le robot 4WS converge vers la trajectoire de référence
function drawSimulator(context, width, height, timeSeconds) {
  context.clearRect(0, 0, width, height);

  context.strokeStyle = 'rgba(170, 0, 255, 0.1)';
  context.lineWidth = 1;
  context.beginPath();
  for (let rowStart = -height; rowStart < width + height; rowStart += 20) {
    context.moveTo(rowStart, height);
    context.lineTo(rowStart + height * 0.45, 0);
  }
  context.stroke();

  const marginX = width * 0.07;
  const pathX = progress => marginX + progress * (width - 2 * marginX);
  const referenceY = progress => height * 0.56 + height * 0.2 * Math.sin(2 * Math.PI * progress * 1.2 + 0.4);
  const lateralError = progress => height * 0.2 * Math.exp(-4.5 * progress) * Math.cos(8 * progress);
  const vehicleY = progress => referenceY(progress) + lateralError(progress);

  context.save();
  context.setLineDash([5, 6]);
  context.strokeStyle = 'rgba(0, 255, 255, 0.6)';
  context.lineWidth = 1.4;
  context.beginPath();
  for (let progress = 0; progress <= 1.0001; progress += 0.005) {
    if (progress === 0) context.moveTo(pathX(progress), referenceY(progress));
    else context.lineTo(pathX(progress), referenceY(progress));
  }
  context.stroke();
  context.restore();

  const travelDuration = 7;
  const pauseDuration = 1.5;
  const cycleTime = timeSeconds % (travelDuration + pauseDuration);
  const currentProgress = clamp(cycleTime / travelDuration, 0, 1) * 0.94 + 0.03;

  const trail = new Path2D();
  trail.moveTo(pathX(0), vehicleY(0));
  for (let progress = 0; progress <= currentProgress; progress += 0.004) trail.lineTo(pathX(progress), vehicleY(progress));
  context.save();
  context.strokeStyle = '#ff00cc';
  context.lineJoin = 'round';
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = 0.3;
  context.lineWidth = 6;
  context.stroke(trail);
  context.globalAlpha = 1;
  context.lineWidth = 2;
  context.stroke(trail);
  context.restore();

  const lookAhead = 0.01;
  const headingAt = progress => Math.atan2(vehicleY(progress + lookAhead) - vehicleY(progress), pathX(progress + lookAhead) - pathX(progress));
  const heading = headingAt(currentProgress);
  const headingChange = headingAt(currentProgress + lookAhead) - heading;
  const frontSteer = clamp(headingChange * 9, -0.5, 0.5);
  const rearSteer = -0.6 * frontSteer;

  const bodyLength = clamp(width * 0.075, 34, 52);
  const bodyWidth = bodyLength * 0.56;
  const wheelLength = bodyLength * 0.28;
  const wheelWidth = bodyLength * 0.11;
  context.save();
  context.translate(pathX(currentProgress), vehicleY(currentProgress));
  context.rotate(heading);
  const wheels = [
    { offsetX: bodyLength * 0.32, offsetY: -bodyWidth * 0.62, steer: frontSteer },
    { offsetX: bodyLength * 0.32, offsetY: bodyWidth * 0.62, steer: frontSteer },
    { offsetX: -bodyLength * 0.32, offsetY: -bodyWidth * 0.62, steer: rearSteer },
    { offsetX: -bodyLength * 0.32, offsetY: bodyWidth * 0.62, steer: rearSteer },
  ];
  context.fillStyle = '#ffe566';
  wheels.forEach(wheel => {
    context.save();
    context.translate(wheel.offsetX, wheel.offsetY);
    context.rotate(wheel.steer);
    context.fillRect(-wheelLength / 2, -wheelWidth / 2, wheelLength, wheelWidth);
    context.restore();
  });
  context.shadowColor = '#ff00cc';
  context.shadowBlur = 14;
  context.fillStyle = 'rgba(25, 12, 45, 0.95)';
  context.strokeStyle = '#ff00cc';
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(-bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth, 5);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = '#00ffff';
  context.beginPath();
  context.arc(bodyLength * 0.3, 0, 2.2, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const legendX = width - 112;
  context.font = '11px "JetBrains Mono", monospace';
  context.lineWidth = 1.6;
  context.setLineDash([3, 3]);
  context.strokeStyle = 'rgba(0, 255, 255, 0.75)';
  context.beginPath();
  context.moveTo(legendX, height - 34);
  context.lineTo(legendX + 16, height - 34);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = '#ff66dd';
  context.beginPath();
  context.moveTo(legendX, height - 18);
  context.lineTo(legendX + 16, height - 18);
  context.stroke();
  context.fillStyle = 'rgba(207, 198, 228, 0.75)';
  context.fillText('reference', legendX + 24, height - 30);
  context.fillText('trajectory', legendX + 24, height - 14);
}

// Réducteur : vraie cinématique du disque cycloïdal (11 galets, 10 lobes, e = 3 mm)
const rollerCount = 11;
const pitchRadius = 59;
const rollerRadius = 15;
const eccentricity = 3;
const outputPinCount = 6;
const outputPinCircle = 26;
const outputPinRadius = 4;
const discProfile = new Path2D();
for (let sampleIndex = 0; sampleIndex <= 720; sampleIndex++) {
  const profileAngle = 2 * Math.PI * sampleIndex / 720;
  const contactAngle = Math.atan2(
    Math.sin((1 - rollerCount) * profileAngle),
    pitchRadius / (eccentricity * rollerCount) - Math.cos((1 - rollerCount) * profileAngle)
  );
  const profileX = pitchRadius * Math.cos(profileAngle) - rollerRadius * Math.cos(profileAngle + contactAngle) - eccentricity * Math.cos(rollerCount * profileAngle);
  const profileY = -pitchRadius * Math.sin(profileAngle) + rollerRadius * Math.sin(profileAngle + contactAngle) + eccentricity * Math.sin(rollerCount * profileAngle);
  if (sampleIndex === 0) discProfile.moveTo(profileX, profileY);
  else discProfile.lineTo(profileX, profileY);
}
discProfile.closePath();

function drawGearbox(context, width, height, timeSeconds) {
  context.clearRect(0, 0, width, height);
  const scale = Math.min(width * 0.43, height * 0.38) / 80;
  const pixel = 1 / scale;
  const inputAngle = timeSeconds * 2.2;
  const discRotation = -inputAngle / (rollerCount - 1);

  context.save();
  context.translate(width / 2, height * 0.55);
  context.scale(scale, scale);

  context.strokeStyle = 'rgba(170, 0, 255, 0.35)';
  context.lineWidth = 1.2 * pixel;
  context.beginPath();
  context.arc(0, 0, 80, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([3 * pixel, 4 * pixel]);
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.beginPath();
  context.arc(0, 0, pitchRadius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  context.save();
  context.translate(eccentricity * Math.cos(inputAngle), eccentricity * Math.sin(inputAngle));
  context.rotate(discRotation);
  const discFill = context.createRadialGradient(0, 0, 10, 0, 0, 47);
  discFill.addColorStop(0, 'rgba(255, 0, 204, 0.04)');
  discFill.addColorStop(1, 'rgba(255, 0, 204, 0.16)');
  context.fillStyle = discFill;
  context.fill(discProfile);
  context.shadowColor = '#ff00cc';
  context.shadowBlur = 12;
  context.strokeStyle = '#ff00cc';
  context.lineWidth = 1.6 * pixel;
  context.stroke(discProfile);
  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(255, 0, 204, 0.7)';
  context.lineWidth = 1.2 * pixel;
  for (let holeIndex = 0; holeIndex < outputPinCount; holeIndex++) {
    const holeAngle = 2 * Math.PI * holeIndex / outputPinCount;
    context.beginPath();
    context.arc(outputPinCircle * Math.cos(holeAngle), outputPinCircle * Math.sin(holeAngle), outputPinRadius + eccentricity, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.arc(0, 0, 12, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  context.fillStyle = 'rgba(12, 8, 24, 0.9)';
  context.strokeStyle = '#00ffff';
  context.lineWidth = 1.4 * pixel;
  for (let rollerIndex = 0; rollerIndex < rollerCount; rollerIndex++) {
    const rollerAngle = 2 * Math.PI * rollerIndex / rollerCount;
    context.beginPath();
    context.arc(pitchRadius * Math.cos(rollerAngle), pitchRadius * Math.sin(rollerAngle), rollerRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.fillStyle = '#ffe566';
  for (let pinIndex = 0; pinIndex < outputPinCount; pinIndex++) {
    const pinAngle = discRotation + 2 * Math.PI * pinIndex / outputPinCount;
    context.beginPath();
    context.arc(outputPinCircle * Math.cos(pinAngle), outputPinCircle * Math.sin(pinAngle), outputPinRadius, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = '#00ffff';
  context.lineWidth = 1.6 * pixel;
  context.beginPath();
  context.arc(0, 0, 5, 0, Math.PI * 2);
  context.moveTo(0, 0);
  context.lineTo(12 * Math.cos(inputAngle), 12 * Math.sin(inputAngle));
  context.stroke();
  context.restore();

  context.font = '11px "JetBrains Mono", monospace';
  context.fillStyle = 'rgba(207, 198, 228, 0.75)';
  if (width > 440) context.fillText('11 rollers · 10 lobes · e = 3 mm', 14, height - 14);
}

const projectCanvases = document.querySelectorAll('.proj-canvas');
if (projectCanvases.length > 0) {
  const visualDrawers = { simulator: drawSimulator, gearbox: drawGearbox };
  const visuals = Array.from(projectCanvases).map(canvas => ({
    canvas,
    context: canvas.getContext('2d'),
    draw: visualDrawers[canvas.dataset.visual],
    width: 0,
    height: 0,
    isOnScreen: false,
  }));

  function resizeVisual(visual) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    visual.width  = visual.canvas.clientWidth;
    visual.height = visual.canvas.clientHeight;
    visual.canvas.width  = Math.round(visual.width * pixelRatio);
    visual.canvas.height = Math.round(visual.height * pixelRatio);
    visual.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawVisual(visual, timeSeconds) {
    if (visual.draw && visual.width > 0 && visual.height > 0) visual.draw(visual.context, visual.width, visual.height, timeSeconds);
  }

  // Image fixe au chargement (et seule image si le visiteur coupe les animations)
  const startTime = 4.2;
  let elapsedSeconds = startTime;
  new ResizeObserver(() => visuals.forEach(visual => {
    resizeVisual(visual);
    drawVisual(visual, elapsedSeconds);
  })).observe(document.querySelector('.projects-list'));

  // Boucle d'animation : tourne seulement quand une card est à l'écran
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let previousTimestamp = null;
    let animationId = null;

    function animationFrame(timestamp) {
      if (previousTimestamp !== null) elapsedSeconds += Math.min((timestamp - previousTimestamp) / 1000, 0.05);
      previousTimestamp = timestamp;
      visuals.forEach(visual => { if (visual.isOnScreen) drawVisual(visual, elapsedSeconds); });
      animationId = visuals.some(visual => visual.isOnScreen) ? requestAnimationFrame(animationFrame) : null;
    }

    const visibilityObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        visuals.find(visual => visual.canvas === entry.target).isOnScreen = entry.isIntersecting;
      });
      if (animationId === null && visuals.some(visual => visual.isOnScreen)) {
        previousTimestamp = null;
        animationId = requestAnimationFrame(animationFrame);
      }
    }, { rootMargin: '100px' });
    projectCanvases.forEach(canvas => visibilityObserver.observe(canvas));
  }
}