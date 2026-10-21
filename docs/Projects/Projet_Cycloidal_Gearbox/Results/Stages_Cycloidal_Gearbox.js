/* ============================================================
   Stages_Cycloidal_Gearbox.js
   Results page: animated meshing of each stage (inline SVG)
   ============================================================
   1. Geometry of the final design
   2. Disc profile, from the equations of the profile generator
   3. Drawing of one stage
   4. Animation, paused off screen
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. GEOMETRY (mm)
  ---------------------------------------------------------- */
  const PITCH_RADIUS = 59;          // roller pins on Ø118
  const ROLLER_RADIUS = 15;         // SKF 61903, outer Ø30
  const ROLLER_PIN_RADIUS = 8.5;    // roller pin Ø17
  const ROLLER_COUNT = 11;
  const LOBE_COUNT = ROLLER_COUNT - 1;
  const ECCENTRIC_TURNS_PER_SECOND = 0.35;
  const PROFILE_POINTS = 1200;

  const STAGES = {
    1: { eccentricity: 3.0, pinCount: 10, pinCircleRadius: 26, pinRadius: 3, boreRadius: 6, bearingSeatRadius: 8, journalRadius: 6 },
    2: { eccentricity: 3.5, pinCount: 12, pinCircleRadius: 32, pinRadius: 2, boreRadius: 5.5, bearingSeatRadius: 23.5, journalRadius: 10 },
  };

  /* ----------------------------------------------------------
     2. DISC PROFILE
     Disc centre at the origin; in the gearbox the centre orbits
     at the eccentricity and the disc turns back by 1/10 of the
     eccentric angle, which keeps every roller in contact.
  ---------------------------------------------------------- */
  function profilePath(eccentricity) {
    const points = [];
    for (let index = 0; index < PROFILE_POINTS; index++) {
      const t = 2 * Math.PI * index / PROFILE_POINTS;
      const psi = Math.atan2(Math.sin((1 - ROLLER_COUNT) * t), PITCH_RADIUS / (eccentricity * ROLLER_COUNT) - Math.cos((1 - ROLLER_COUNT) * t));
      const x = PITCH_RADIUS * Math.cos(t) - ROLLER_RADIUS * Math.cos(t + psi) - eccentricity * Math.cos(ROLLER_COUNT * t);
      const y = -PITCH_RADIUS * Math.sin(t) + ROLLER_RADIUS * Math.sin(t + psi) + eccentricity * Math.sin(ROLLER_COUNT * t);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return 'M' + points.join('L') + 'Z';
  }

  /* ----------------------------------------------------------
     3. DRAWING OF ONE STAGE
  ---------------------------------------------------------- */
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  function svgElement(name, attributes, parent) {
    const element = document.createElementNS(SVG_NAMESPACE, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (parent) parent.appendChild(element);
    return element;
  }

  function circleAt(angle, radius) {
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  }

  function buildStage(container, stage) {
    const svg = svgElement('svg', { viewBox: '-80 -80 160 160', class: 'stage-svg', role: 'img',
      'aria-label': `Stage ${container.dataset.stage}: the disc orbits on its eccentric inside the 11 rollers` });

    svgElement('circle', { r: 79, class: 'stage-housing' }, svg);
    for (let index = 0; index < ROLLER_COUNT; index++) {
      const [x, y] = circleAt(2 * Math.PI * index / ROLLER_COUNT, PITCH_RADIUS);
      svgElement('circle', { cx: x, cy: y, r: ROLLER_RADIUS, class: 'stage-roller' }, svg);
      svgElement('circle', { cx: x, cy: y, r: ROLLER_PIN_RADIUS, class: 'stage-roller-pin' }, svg);
    }

    // Disc: profile, bearing seat and pin bores
    const disc = svgElement('g', {}, svg);
    svgElement('path', { d: profilePath(stage.eccentricity), class: 'stage-disc' }, disc);
    svgElement('circle', { r: stage.bearingSeatRadius, class: 'stage-bore' }, disc);
    for (let index = 0; index < stage.pinCount; index++) {
      const [x, y] = circleAt(2 * Math.PI * index / stage.pinCount, stage.pinCircleRadius);
      svgElement('circle', { cx: x, cy: y, r: stage.boreRadius, class: 'stage-bore' }, disc);
    }

    // Output pins: on a circle centred on the gearbox axis, each one rolling inside its bore; the marked one shows the slow output
    const outputPins = svgElement('g', {}, svg);
    for (let index = 0; index < stage.pinCount; index++) {
      const [x, y] = circleAt(2 * Math.PI * index / stage.pinCount, stage.pinCircleRadius);
      svgElement('circle', { cx: x, cy: y, r: stage.pinRadius, class: index === 0 ? 'stage-pin is-marked' : 'stage-pin' }, outputPins);
    }

    // Eccentric journal, and the arm from the gearbox axis to the disc centre
    const journal = svgElement('circle', { r: stage.journalRadius, class: 'stage-journal' }, svg);
    const eccentricArm = svgElement('line', { x1: 0, y1: 0, class: 'stage-arm' }, svg);
    svgElement('circle', { r: 1.1, class: 'stage-axis' }, svg);

    container.prepend(svg);

    return function setInputAngle(eccentricAngle) {
      const centreX = stage.eccentricity * Math.cos(eccentricAngle);
      const centreY = stage.eccentricity * Math.sin(eccentricAngle);
      const discAngleDegrees = -eccentricAngle / LOBE_COUNT * 180 / Math.PI;
      disc.setAttribute('transform', `translate(${centreX.toFixed(3)} ${centreY.toFixed(3)}) rotate(${discAngleDegrees.toFixed(3)})`);
      outputPins.setAttribute('transform', `rotate(${discAngleDegrees.toFixed(3)})`);
      journal.setAttribute('cx', centreX.toFixed(3));
      journal.setAttribute('cy', centreY.toFixed(3));
      eccentricArm.setAttribute('x2', centreX.toFixed(3));
      eccentricArm.setAttribute('y2', centreY.toFixed(3));
    };
  }

  /* ----------------------------------------------------------
     4. ANIMATION, PAUSED OFF SCREEN
  ---------------------------------------------------------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.stage-visual[data-stage]').forEach((container) => {
    const stage = STAGES[container.dataset.stage];
    if (!stage) return;
    const setInputAngle = buildStage(container, stage);
    let eccentricAngle = Math.PI / 6;
    setInputAngle(eccentricAngle);
    if (reducedMotion) return;

    let previousTime = null;
    let frameRequest = null;
    function animate(time) {
      if (previousTime !== null) {
        const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.1);
        eccentricAngle += elapsedSeconds * ECCENTRIC_TURNS_PER_SECOND * 2 * Math.PI;
        setInputAngle(eccentricAngle);
      }
      previousTime = time;
      frameRequest = requestAnimationFrame(animate);
    }

    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && frameRequest === null) {
        previousTime = null;
        frameRequest = requestAnimationFrame(animate);
      } else if (!entries[0].isIntersecting && frameRequest !== null) {
        cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
    }).observe(container);
  });
})();
