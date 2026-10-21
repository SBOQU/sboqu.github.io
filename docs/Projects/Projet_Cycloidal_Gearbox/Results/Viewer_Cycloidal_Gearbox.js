/* ============================================================
   Viewer_Cycloidal_Gearbox.js
   Results page: interactive 3D model of the gearbox (three.js)
   ============================================================
   1. Part catalogue: surfaces and info cards
   2. Lazy start when the viewer comes into view
   3. Scene, lights, ground shadow
   4. Model: materials, motion groups, exploded positions
   5. Kinematics, section view, housing modes, part picking,
      link with the part list of the assembly drawing
   6. Render loop, paused off screen
   ============================================================ */

const viewerFrame = document.getElementById('gearboxViewer');

const INPUT_TURNS_PER_SECOND = 0.25;   // animation speed of the input shaft
const STAGE_RATIO = 10;                // each stage reduces by its number of lobes
const EXPLODE_AXIAL_FACTOR = 1.6;      // axial gaps are multiplied by (1 + factor) in exploded view
const EXPLODE_RATE = 5;                // per second: the exploded view settles in about one second
const EXPLODE_ZOOM_OUT = 0.45;         // the camera backs off by this share when fully exploded
const SECTION_CAP_COLOUR = 0x6e4566;   // fill colour of the cut faces in section view, as displayed

/* ----------------------------------------------------------
   1. PART CATALOGUE
---------------------------------------------------------- */
const SURFACES = {
  polishedSteel:   { color: 0xc9cdd6, metalness: 1.0,  roughness: 0.22 },
  machinedSteel:   { color: 0xa7adb8, metalness: 1.0,  roughness: 0.36 },
  hardenedSteel:   { color: 0xb3a6b9, metalness: 1.0,  roughness: 0.30 },
  darkSteel:       { color: 0x3a3d45, metalness: 0.85, roughness: 0.42 },
  anodizedHousing: { color: 0x383146, metalness: 0.6,  roughness: 0.38 },
  polymer:         { color: 0x55515c, metalness: 0.0,  roughness: 0.55 },
  rubber:          { color: 0x16131b, metalness: 0.0,  roughness: 0.80 },
};

// Keyed by the part names of the STEP file, which are also the titles of the part list on the assembly drawing
const RETAINING_RING = { surface: 'darkSteel', stage: 'Standard part', role: 'Holds a bearing or a washer in place on its shaft.' };
const LIP_SEAL = { surface: 'rubber', stage: 'Sealing', role: 'Keeps the grease in and the dust out.' };

const PART_CATALOGUE = {
  'Cycloidal disc, stage 1': { item: 1, surface: 'hardenedSteel', stage: 'Stage 1',
    role: 'Rolls on the 11 rollers and turns 10 times slower than the input shaft, in the opposite direction.',
    figures: ['16MnCr5, case-hardened', '10 lobes · e = 3,0 mm', 'Roller contact: 364 MPa (limit 2 000)', 'Pin contact: 343 MPa (limit 1 800)'] },
  'Flask, stage 1 output': { item: 2, surface: 'machinedSteel', stage: 'Stage 1 → 2',
    role: 'Output of stage 1 and input of stage 2: it collects the 10 pins and carries the second eccentric.',
    figures: ['16MnCr5, case-hardened', 'Eccentric journal Ø20, e = 3,5 mm', '400 rpm'] },
  'Eccentric bearing, stage 2': { item: 3, surface: 'polishedSteel', stage: 'Stage 2',
    role: 'Cylindrical roller bearing pressed into disc 2, recessed 0,5 mm on each side.',
    figures: ['SKF NJ 204 ECP', '20 × 47 × 14 mm · C = 28 500 N', 'L10h = 3 816 h (target 500 h)'] },
  'Retaining ring Ø20': { item: 4, ...RETAINING_RING, figures: ['DIN 471, 20 × 1,2'] },
  'Output pin, stage 1': { item: 5, surface: 'polishedSteel', stage: 'Stage 1',
    role: 'The 10 pins pass the rotation of disc 1 to the flask.',
    figures: ['Ø6 on Ø52 · bores Ø12', 'Contact pressure 343 MPa · λ = 7,3'] },
  'Input shaft': { item: 6, surface: 'machinedSteel', stage: 'Input',
    role: 'Driven by the motor, it carries the eccentric of stage 1.',
    figures: ['16MnCr5, case-hardened', '4 000 rpm', 'Eccentric journal Ø12, e = 3,0 mm'] },
  'Retaining ring Ø17': { item: 7, ...RETAINING_RING, figures: ['DIN 471, 17 × 1'] },
  'Lip seal Ø17': { item: 8, ...LIP_SEAL, figures: ['ISO 6194, 17 × 28'] },
  'Input bearing': { item: 9, surface: 'polishedSteel', stage: 'Input',
    role: 'Four-point contact ball bearing supporting the input shaft, in the top cover.',
    figures: ['SKF QJ 203 N2MA', '17 × 40 × 12 mm'] },
  'Retaining ring Ø12': { item: 10, ...RETAINING_RING, figures: ['DIN 471, 12 × 1'] },
  'Eccentric bearing, stage 1': { item: 11, surface: 'polishedSteel', stage: 'Stage 1',
    role: 'Drawn cup needle bearing pressed into disc 1, recessed 0,5 mm on each side so it never rubs.',
    figures: ['INA HK 1210', '12 × 16 × 10 mm · C = 4 950 N', 'L10h = 1 438 h, 710 h with the unbalance'] },
  'Thrust washer': { item: 12, surface: 'polymer', stage: 'Stage 1',
    role: 'Self-lubricating polymer washer: it guides disc 1 axially without a thrust bearing.',
    figures: ['igus GTM 1220 005', 'Ø12 / Ø20 × 0,5 mm'] },
  'Cycloidal disc, stage 2': { item: 13, surface: 'hardenedSteel', stage: 'Stage 2',
    role: 'Carries the full 250 N·m and passes it to the 12 output pins.',
    figures: ['16MnCr5, case-hardened', '10 lobes · e = 3,5 mm', 'Roller contact: 990 MPa (limit 2 000)', 'Pin contact: 1 043 MPa (limit 1 800)'] },
  'Output shaft': { item: 14, surface: 'machinedSteel', stage: 'Output',
    role: 'Delivers the torque to the robot arm.',
    figures: ['42CrMo4, quenched and tempered', '250 N·m at 40 rpm', 'Overall ratio 100:1'] },
  'Output pin, stage 2': { item: 15, surface: 'polishedSteel', stage: 'Stage 2',
    role: 'The 12 pins are held at both ends, by the output shaft and by the annular pin plate.',
    figures: ['Ø4 on Ø64 · bores Ø11', 'Contact pressure 1 043 MPa (limit 1 800)', 'λ = 0,8: thin film, accepted as a soft constraint'] },
  'Output bearing': { item: 16, surface: 'polishedSteel', stage: 'Output',
    role: 'Four-point contact ball bearing taking the radial and axial loads of the output.',
    figures: ['SKF QJ 206 N2MA', '30 × 62 × 16 mm'] },
  'Retaining ring Ø30': { item: 17, ...RETAINING_RING, figures: ['DIN 471, 30 × 1,5'] },
  'Lip seal Ø30': { item: 18, ...LIP_SEAL, figures: ['ISO 6194, 30 × 42'] },
  'Annular pin plate': { item: 19, surface: 'machinedSteel', stage: 'Stage 2',
    role: 'Holds the free ends of the 12 output pins, so each pin works as a beam on two supports.',
    figures: ['42CrMo4, quenched and tempered', '6 mm thick'] },
  'Roller pin': { item: 20, surface: 'machinedSteel', stage: 'Both stages',
    role: 'Fixed in the housing, it carries the three rollers of its position.',
    figures: ['42CrMo4, quenched and tempered', '11 pins on Ø118 mm, 360/11 apart'] },
  'Roller bearing': { item: 21, surface: 'polishedSteel', stage: 'Both stages',
    role: 'Its outer ring rolls directly on the disc profile: one bearing per pin on stage 1, two side by side on stage 2.',
    figures: ['SKF 61903 · 17 × 30 × 7 mm', 'Stage 2 load: 847 N, 1 695 N peak', 'Life: 160 522 h on stage 2'] },
  'Housing': { item: 22, surface: 'anodizedHousing', stage: 'Structure',
    role: 'Holds the 11 roller pins and the output bearing.',
    figures: ['Aluminium 7075-T6', 'Ø160 × 70,5 mm'] },
};

const DEFAULT_ENTRY = { item: null, surface: 'machinedSteel', stage: '', role: '', figures: [] };

function catalogueEntry(productName) {
  return { ...DEFAULT_ENTRY, ...PART_CATALOGUE[productName], title: productName };
}

// The assembly drawing can ask for a part before the model is loaded: the last request waits here
let pendingDrawingRequest = null;
document.addEventListener('gearbox:show-part', (event) => { pendingDrawingRequest = event.detail; });


/* ----------------------------------------------------------
   2. LAZY START
---------------------------------------------------------- */
if (viewerFrame) {
  // Ctrl + scroll anywhere on the viewer zooms the model, never the whole browser page
  viewerFrame.addEventListener('wheel', (event) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); }, { passive: false });
  const startObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    startObserver.disconnect();
    startViewer().catch((error) => showViewerMessage('The 3D model could not be loaded.', error));
  }, { rootMargin: '300px' });
  startObserver.observe(viewerFrame);
}

function showViewerMessage(message, error) {
  viewerFrame.querySelector('.viewer-loading-text').textContent = message;
  viewerFrame.querySelector('.viewer-progress').style.display = 'none';
  if (error) console.warn(error);
}


async function startViewer() {
  const [THREE, { OrbitControls }, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ----------------------------------------------------------
     3. SCENE, LIGHTS, GROUND SHADOW
  ---------------------------------------------------------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    showViewerMessage('3D view unavailable on this device.', error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  viewerFrame.prepend(renderer.domElement);

  // Plain scroll keeps scrolling the page; Ctrl + scroll (or a trackpad pinch) zooms
  renderer.domElement.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
  }, { capture: true });

  const scene = new THREE.Scene();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.0;

  // White key light for the shapes, pink and cyan rims only touch the edges
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  const pinkRimLight = new THREE.DirectionalLight(0xff4fd8, 0.9);
  const cyanRimLight = new THREE.DirectionalLight(0x4ff0e0, 0.9);
  const skyFill = new THREE.HemisphereLight(0xc4c8ff, 0x1a1024, 0.5);
  scene.add(keyLight, keyLight.target, pinkRimLight, cyanRimLight, skyFill);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  let cameraMovedByUser = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; cameraMovedByUser = true; });

  /* ----------------------------------------------------------
     4. MODEL
  ---------------------------------------------------------- */
  const progressBar = viewerFrame.querySelector('.viewer-progress-bar');
  const loadingText = viewerFrame.querySelector('.viewer-loading-text');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(viewerFrame.dataset.model, (progressEvent) => {
    if (!progressEvent.total) return;
    const loadedPercent = Math.round(100 * progressEvent.loaded / progressEvent.total);
    progressBar.style.width = loadedPercent + '%';
    loadingText.textContent = 'Loading the 3D model · ' + loadedPercent + ' %';
  });

  // Materials: one per surface type, with a flat fill on the back faces for the section view
  // The cap is written after tone mapping, so the colour is passed as display values
  const sectionCapColour = { value: new THREE.Color().setHex(SECTION_CAP_COLOUR, THREE.LinearSRGBColorSpace) };
  function withSectionCap(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.sectionCapColour = sectionCapColour;
      shader.fragmentShader = 'uniform vec3 sectionCapColour;\n' + shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n\tif ( !gl_FrontFacing ) gl_FragColor = vec4( sectionCapColour, 1.0 );');
    };
    material.customProgramCacheKey = () => 'section-cap';
    return material;
  }
  const surfaceMaterials = Object.fromEntries(Object.entries(SURFACES).map(([name, surface]) => [name, withSectionCap(
    new THREE.MeshStandardMaterial({ ...surface, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))]));
  const xrayHousingMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a4c9c, metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0a0812, transparent: true, opacity: 0.3, depthWrite: false });
  const xrayEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xb86bff, transparent: true, opacity: 0.45, depthWrite: false });
  const highlightMaterials = new Map();
  // Parts around a part asked by the drawing fade to a ghost, so that the part stays visible inside the assembly
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a4c9c, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  // Only the parts are cut in section view, the ground and its shadow stay whole
  const clippableMaterials = [...Object.values(surfaceMaterials), xrayHousingMaterial, edgeMaterial, xrayEdgeMaterial, ghostMaterial];

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  modelRoot.add(gltf.scene);
  const sceneExtras = gltf.scene.userData;
  const toVector = (values) => new THREE.Vector3(values[0], values[1], values[2]);
  const axisPoint = toVector(sceneExtras.axisPoint);
  const discCentre1 = toVector(sceneExtras.discCentre1);
  const discCentre2 = toVector(sceneExtras.discCentre2);

  // Motion groups: each one turns about the gearbox axis (CAD Y), the discs about their own eccentric centre
  function makePivot(position) {
    const pivot = new THREE.Group();
    pivot.position.copy(position);
    modelRoot.add(pivot);
    return pivot;
  }
  const pivots = {
    input: makePivot(axisPoint), flask: makePivot(axisPoint), output: makePivot(axisPoint),
    disc1: makePivot(discCentre1), disc2: makePivot(discCentre2),
  };
  modelRoot.updateMatrixWorld(true);

  const partNodes = gltf.scene.children.filter((child) => child.userData.product);
  const pickableMeshes = [];
  const housingNodes = [];
  const nodesByProduct = new Map();
  for (const node of partNodes) {
    const entry = catalogueEntry(node.userData.product);
    node.userData.entry = entry;
    if (!nodesByProduct.has(entry.title)) nodesByProduct.set(entry.title, []);
    nodesByProduct.get(entry.title).push(node);
    node.traverse((object) => {
      if (object.isLineSegments) {
        object.material = edgeMaterial;
        object.userData.edges = true;
      } else if (object.isMesh) {
        object.material = surfaceMaterials[entry.surface];
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData.partNode = node;
        pickableMeshes.push(object);
      }
    });
    if (node.userData.product === 'Housing') housingNodes.push(node);
    const pivot = pivots[node.userData.group];
    if (pivot) pivot.attach(node);
  }

  // Centre the model on the origin and frame it
  const modelBox = new THREE.Box3().setFromObject(modelRoot);
  const modelCentre = modelBox.getCenter(new THREE.Vector3());
  modelRoot.position.sub(modelCentre);
  modelRoot.updateMatrixWorld(true);
  const modelRadius = modelBox.getBoundingSphere(new THREE.Sphere()).radius;

  // Exploded positions: every moving part slides along the axis, in proportion to its distance from the centre
  const explodableParts = [];
  let lowestExplodedOffset = 0;
  for (const node of partNodes) {
    const partCentreY = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()).y;
    const axialOffset = node.userData.group === 'fixed' ? 0 : partCentreY * EXPLODE_AXIAL_FACTOR;
    lowestExplodedOffset = Math.min(lowestExplodedOffset, axialOffset);
    explodableParts.push({ node, restPosition: node.position.clone(), explodedPosition: node.position.clone().add(new THREE.Vector3(0, axialOffset, 0)) });
  }

  // Lights and ground placed around the centred model
  keyLight.position.set(0.55, 1.1, 0.75).multiplyScalar(modelRadius * 3);
  pinkRimLight.position.set(-1.1, 0.35, -0.8).multiplyScalar(modelRadius * 3);
  cyanRimLight.position.set(1.1, 0.15, -1.0).multiplyScalar(modelRadius * 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(isCoarsePointer ? 1024 : 2048, isCoarsePointer ? 1024 : 2048);
  const shadowCamera = keyLight.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -modelRadius * 1.6;
  shadowCamera.right = shadowCamera.top = modelRadius * 1.6;
  shadowCamera.near = modelRadius;
  shadowCamera.far = modelRadius * 6;
  shadowCamera.updateProjectionMatrix();
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = modelRadius * 0.004;

  const groundRestY = modelBox.min.y - modelCentre.y - 0.5;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(modelRadius * 8, modelRadius * 8),
                                new THREE.ShadowMaterial({ color: 0x05030a, opacity: 0.4 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundRestY;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ----------------------------------------------------------
     5. KINEMATICS, SECTION, HOUSING, PICKING
  ---------------------------------------------------------- */
  const verticalAxis = new THREE.Vector3(0, 1, 0);
  let inputAngle = 0;
  let playing = false;
  let explodeTarget = 0;
  let explodeAmount = 0;

  // Input turns by theta; stage 1 disc and flask turn by -theta/10; stage 2 disc and output by +theta/100
  function applyKinematics() {
    const flaskAngle = -inputAngle / STAGE_RATIO;
    const outputAngle = -flaskAngle / STAGE_RATIO;
    pivots.input.rotation.y = inputAngle;
    pivots.disc1.position.copy(discCentre1).sub(axisPoint).applyAxisAngle(verticalAxis, inputAngle).add(axisPoint);
    pivots.disc1.rotation.y = flaskAngle;
    pivots.flask.rotation.y = flaskAngle;
    pivots.disc2.position.copy(discCentre2).sub(axisPoint).applyAxisAngle(verticalAxis, flaskAngle).add(axisPoint);
    pivots.disc2.rotation.y = outputAngle;
    pivots.output.rotation.y = outputAngle;
  }

  const hud = viewerFrame.querySelector('.viewer-hud');
  const inputTurnsText = hud.querySelector('[data-hud="input"]');
  const outputTurnsText = hud.querySelector('[data-hud="output"]');
  function updateHud() {
    const inputTurns = inputAngle / (2 * Math.PI);
    inputTurnsText.textContent = inputTurns.toFixed(1).replace('.', ',');
    outputTurnsText.textContent = (inputTurns / (STAGE_RATIO * STAGE_RATIO)).toFixed(3).replace('.', ',');
  }

  // Section view: a vertical plane through the gearbox axis that always faces the viewer
  const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const axisInWorld = new THREE.Vector3();
  let sectionEnabled = false;
  function updateSectionPlane() {
    axisInWorld.copy(axisPoint).add(modelRoot.position);
    const awayFromCamera = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
    sectionPlane.setFromNormalAndCoplanarPoint(awayFromCamera, axisInWorld);
  }

  // Housing: solid, then X-ray, then hidden
  const HOUSING_MODES = ['solid', 'x-ray', 'hidden'];
  let housingModeIndex = 0;
  function applyHousingMode() {
    const mode = HOUSING_MODES[housingModeIndex];
    for (const node of housingNodes) {
      node.visible = mode !== 'hidden';
      node.traverse((object) => {
        if (object.userData.edges) object.material = mode === 'x-ray' ? xrayEdgeMaterial : edgeMaterial;
        else if (object.isMesh) {
          object.material = mode === 'x-ray' ? xrayHousingMaterial : surfaceMaterials.anodizedHousing;
          object.castShadow = mode === 'solid';
        }
      });
    }
  }

  // Picking: a click (not a drag) on a part opens its card and tints every copy of it in cyan
  const card = viewerFrame.querySelector('.viewer-card');
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPosition = null;
  let selectedNodes = [];

  function highlightMaterialFor(material) {
    if (!highlightMaterials.has(material)) {
      const highlight = material.clone();
      highlight.emissive = new THREE.Color(0x00e5cc);
      highlight.emissiveIntensity = 0.45;
      withSectionCap(highlight);
      highlight.clippingPlanes = material.clippingPlanes;
      highlightMaterials.set(material, highlight);
      clippableMaterials.push(highlight);
    }
    return highlightMaterials.get(material);
  }

  function restoreMaterials(node) {
    node.traverse((object) => { if (object.userData.restMaterial) { object.material = object.userData.restMaterial; delete object.userData.restMaterial; } });
  }

  function highlightNode(node) {
    node.traverse((object) => {
      if (object.isMesh && !object.userData.edges && !object.userData.restMaterial) {
        object.userData.restMaterial = object.material;
        object.material = highlightMaterialFor(object.material);
      }
    });
  }

  // Selects one part of the model with all its copies; the source tells who asked ('viewer' or 'drawing')
  // Every part except the kept ones and the housing (which keeps its own mode) turns to a ghost
  let ghostNodes = [];
  function ghostAllBut(keptNodes) {
    ghostNodes = partNodes.filter((node) => !keptNodes.includes(node) && !housingNodes.includes(node));
    for (const node of ghostNodes) {
      node.traverse((object) => {
        if (!object.isMesh && !object.isLineSegments) return;
        object.userData.ghostRestMaterial = object.material;
        object.material = object.userData.edges ? xrayEdgeMaterial : ghostMaterial;
        object.castShadow = false;
      });
    }
  }

  function endGhosts() {
    for (const node of ghostNodes) {
      node.traverse((object) => {
        if (!object.userData.ghostRestMaterial) return;
        object.material = object.userData.ghostRestMaterial;
        delete object.userData.ghostRestMaterial;
        if (object.isMesh && !object.userData.edges) object.castShadow = true;
      });
    }
    ghostNodes = [];
  }

  function selectProduct(productName, source) {
    if (source === 'viewer') endFocus();
    endGhosts();
    selectedNodes.forEach(restoreMaterials);
    selectedNodes = nodesByProduct.get(productName) || [];
    const entry = selectedNodes.length ? selectedNodes[0].userData.entry : null;
    if (source === 'viewer') {
      document.dispatchEvent(new CustomEvent('gearbox:part-selected', { detail: { item: entry ? entry.item : null } }));
    }
    if (!entry) { card.hidden = true; return; }
    selectedNodes.forEach(highlightNode);
    card.querySelector('.viewer-card-stage').textContent = entry.stage;
    card.querySelector('.viewer-card-title').textContent = entry.title;
    card.querySelector('.viewer-card-role').textContent = entry.role;
    const figureList = card.querySelector('.viewer-card-figures');
    figureList.replaceChildren(...entry.figures.map((figure) => Object.assign(document.createElement('li'), { textContent: figure })));
    const quantity = selectedNodes.length > 1 ? ` · ×${selectedNodes.length}` : '';
    card.querySelector('.viewer-card-item').hidden = !entry.item;
    card.querySelector('.viewer-card-item-label').textContent = entry.item ? `Item ${entry.item}${quantity}` : '';
    card.dataset.item = entry.item || '';
    card.hidden = false;
  }

  // Focus on a part asked by the drawing: the housing turns to X-ray and the other parts to ghosts,
  // so that the part stays visible, until "Show all parts", the card close button or a click in the model
  let focusActive = false;
  let housingModeBeforeFocus = 0;

  function showPartFromDrawing({ item }) {
    const productName = Object.keys(PART_CATALOGUE).find((name) => PART_CATALOGUE[name].item === item);
    if (!productName) return;
    if (!focusActive) housingModeBeforeFocus = housingModeIndex;
    focusActive = true;
    if (productName !== 'Housing' && HOUSING_MODES[housingModeIndex] === 'solid') {
      housingModeIndex = HOUSING_MODES.indexOf('x-ray');
      applyHousingMode();
      updateHousingButton();
    }
    selectProduct(productName, 'drawing');
    ghostAllBut(selectedNodes);
    buttonFor('show-all').hidden = false;
  }

  // Back to the normal view: no ghost, and the housing as it was before the focus
  function endFocus() {
    if (!focusActive) return;
    focusActive = false;
    endGhosts();
    housingModeIndex = housingModeBeforeFocus;
    applyHousingMode();
    updateHousingButton();
    buttonFor('show-all').hidden = true;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => { pointerDownPosition = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerDownPosition) return;
    const dragDistance = Math.hypot(event.clientX - pointerDownPosition[0], event.clientY - pointerDownPosition[1]);
    pointerDownPosition = null;
    if (dragDistance > 5) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickableMeshes, false).find((intersection) => {
      let visible = true;
      intersection.object.traverseAncestors((ancestor) => { if (!ancestor.visible) visible = false; });
      const cutAway = sectionEnabled && sectionPlane.distanceToPoint(intersection.point) < 0;
      const ghost = Boolean(intersection.object.userData.ghostRestMaterial);   // clicks go through the ghosts
      return visible && intersection.object.visible && !cutAway && !ghost;
    });
    selectProduct(hit ? hit.object.userData.partNode.userData.entry.title : null, 'viewer');
  });
  card.querySelector('.viewer-card-close').addEventListener('click', () => selectProduct(null, 'viewer'));
  card.querySelector('.viewer-card-link').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('gearbox:find-on-drawing', { detail: { item: Number(card.dataset.item) } }));
  });

  /* ----------------------------------------------------------
     CAMERA, BUTTONS
  ---------------------------------------------------------- */
  const viewDirection = new THREE.Vector3(1.0, 0.78, 1.35).normalize();

  function defaultCameraDistance() {
    const verticalHalfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * camera.aspect);
    const fitMargin = camera.aspect < 1 ? 0.9 : 0.74;   // below 1, the view zooms past the bounding sphere
    return modelRadius / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle)) * fitMargin * (1 + EXPLODE_ZOOM_OUT * explodeAmount);
  }

  function resetView() {
    const cameraDistance = defaultCameraDistance();
    camera.position.copy(viewDirection).multiplyScalar(cameraDistance);
    camera.near = cameraDistance / 50;
    camera.far = cameraDistance * 10;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = cameraDistance * 0.3;
    controls.maxDistance = cameraDistance * 2.5;
    controls.autoRotate = !playing;
    cameraMovedByUser = false;
  }

  function resizeViewer() {
    renderer.setSize(viewerFrame.clientWidth, viewerFrame.clientHeight, false);
    camera.aspect = viewerFrame.clientWidth / viewerFrame.clientHeight;
    camera.updateProjectionMatrix();
    if (!cameraMovedByUser) resetView();   // keep the framing on rotation or resize until the visitor takes over
  }
  new ResizeObserver(resizeViewer).observe(viewerFrame);
  resizeViewer();
  resetView();

  if (isCoarsePointer) viewerFrame.querySelector('.viewer-hint').textContent = 'Drag to rotate · Pinch to zoom · Tap a part';

  const buttonFor = (action) => viewerFrame.querySelector(`[data-action="${action}"]`);
  buttonFor('play').addEventListener('click', () => {
    playing = !playing;
    if (playing) controls.autoRotate = false;
    hud.hidden = false;
    buttonFor('play').classList.toggle('is-active', playing);
    buttonFor('play').textContent = playing ? 'Pause' : 'Play';
  });
  buttonFor('explode').addEventListener('click', () => {
    explodeTarget = explodeTarget === 0 ? 1 : 0;
    buttonFor('explode').classList.toggle('is-active', explodeTarget === 1);
  });
  buttonFor('section').addEventListener('click', () => {
    sectionEnabled = !sectionEnabled;
    if (sectionEnabled) updateSectionPlane();
    for (const material of clippableMaterials) {
      material.clippingPlanes = sectionEnabled ? [sectionPlane] : null;
      material.needsUpdate = true;
    }
    buttonFor('section').classList.toggle('is-active', sectionEnabled);
  });
  function updateHousingButton() {
    buttonFor('housing').textContent = 'Housing: ' + HOUSING_MODES[housingModeIndex];
    buttonFor('housing').classList.toggle('is-active', housingModeIndex !== 0);
  }
  buttonFor('housing').addEventListener('click', () => {
    housingModeIndex = (housingModeIndex + 1) % HOUSING_MODES.length;
    applyHousingMode();
    updateHousingButton();
    if (focusActive) housingModeBeforeFocus = housingModeIndex;   // the visitor's choice stays after the focus
  });
  buttonFor('show-all').addEventListener('click', () => selectProduct(null, 'viewer'));
  buttonFor('reset').addEventListener('click', resetView);

  viewerFrame.querySelector('.viewer-loading').classList.add('is-hidden');

  // Link with the part list of the assembly drawing
  document.addEventListener('gearbox:show-part', (event) => showPartFromDrawing(event.detail));
  if (pendingDrawingRequest) showPartFromDrawing(pendingDrawingRequest);

  /* ----------------------------------------------------------
     6. RENDER LOOP, PAUSED OFF SCREEN
  ---------------------------------------------------------- */
  const clock = new THREE.Clock();
  function renderFrame() {
    const elapsedSeconds = Math.min(clock.getDelta(), 0.25);
    if (playing) {
      inputAngle += elapsedSeconds * INPUT_TURNS_PER_SECOND * 2 * Math.PI;
      applyKinematics();
      updateHud();
    }
    if (explodeAmount !== explodeTarget) {
      const previousAmount = explodeAmount;
      explodeAmount += (explodeTarget - explodeAmount) * (1 - Math.exp(-EXPLODE_RATE * elapsedSeconds));
      if (Math.abs(explodeTarget - explodeAmount) < 0.001) explodeAmount = explodeTarget;
      // Back the camera off (or bring it closer) so the exploded stack stays in frame
      const zoomRatio = (1 + EXPLODE_ZOOM_OUT * explodeAmount) / (1 + EXPLODE_ZOOM_OUT * previousAmount);
      camera.position.sub(controls.target).multiplyScalar(zoomRatio).add(controls.target);
      for (const { node, restPosition, explodedPosition } of explodableParts) node.position.lerpVectors(restPosition, explodedPosition, explodeAmount);
      ground.position.y = groundRestY + lowestExplodedOffset * explodeAmount;
    }
    controls.update();
    if (sectionEnabled) updateSectionPlane();
    renderer.render(scene, camera);
  }

  new IntersectionObserver((entries) => {
    const visible = entries[0].isIntersecting;
    if (visible) clock.getDelta();
    renderer.setAnimationLoop(visible ? renderFrame : null);
  }).observe(viewerFrame);
}
