/**
 * nav_dropdown.js — version body-attached, multi-projets
 * Le dropdown est injecté dans <body> pour échapper aux transformations
 * CSS de Material Theme qui cassent position:fixed.
 *
 * Pour ajouter un projet : une entrée de plus dans PROJECTS ci-dessous.
 *   tabLabel   = le texte exact de l'onglet, tel qu'il apparaît dans mkdocs.yml
 *   folderName = le dossier du projet sous docs/Projects/
 *   items      = les pages du déroulant, en chemins relatifs au dossier projet
 */
document.addEventListener('DOMContentLoaded', function () {

  /* ── Configuration : un bloc par projet ──────────────────── */
  const PROJECTS = [
    {
      tabLabel: 'Simulator Project',
      folderName: 'Projet_Simulateur',
      items: [
        { label: 'Présentation',   path: 'index_Presentation_4WS_Simu/' },
        { label: 'Theory',         path: 'Theory/1_Simulator_Overview/' },
        { label: 'Implementation', path: 'Implementation/1_Parameters_Launch/' },
        { label: 'Results',        path: 'index_Results_4WS_Simu/' }
      ]
    },
    {
      tabLabel: 'Cycloidal Gearbox Project',
      folderName: 'Projet_Cycloidal_Gearbox',
      items: [
        { label: 'Présentation',   path: 'index_Presentation_Cycloidal_Gearbox/' },
        { label: 'Theory',         path: 'Theory/1_Cycloidal_Gearbox_Overview/' },
        { label: 'Implementation', path: 'Implementation/1_Parameters_Materials/' },
        { label: 'Results',        path: 'index_Results_Cycloidal_Gearbox/' }
      ]
    }
  ];

  /* ── Construit le déroulant d'un projet ──────────────────── */
  function buildDropdown(project) {

    /* 1. Retrouver l'onglet correspondant */
    let projectTab = null;
    document.querySelectorAll('.md-tabs__link').forEach(function (tab) {
      if (tab.textContent.trim() === project.tabLabel) projectTab = tab;
    });
    if (!projectTab) return;

    const tabItem = projectTab.closest('.md-tabs__item');

    /* 2. Racine du projet : tout ce qui précède "<folderName>/" inclus */
    const marker = project.folderName + '/';
    const markerIndex = projectTab.href.indexOf(marker);
    if (markerIndex === -1) return;
    const projectRoot = projectTab.href.substring(0, markerIndex + marker.length);

    /* 3. Construire le menu */
    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';

    project.items.forEach(function (item, index) {
      const link = document.createElement('a');
      link.href = projectRoot + item.path;
      link.className = 'nav-dropdown__item';
      link.innerHTML = '<span>' + item.label + '</span>';
      dropdown.appendChild(link);

      if (index < project.items.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'nav-dropdown__divider';
        dropdown.appendChild(divider);
      }
    });

    /* 4. Injecter dans BODY (pas dans la nav) */
    document.body.appendChild(dropdown);

    /* 5. Logique de hover avec délai de grâce */
    let hideTimer = null;

    function show() {
      clearTimeout(hideTimer);
      const bounds = tabItem.getBoundingClientRect();
      dropdown.style.top  = bounds.bottom + 'px';
      dropdown.style.left = (bounds.left + bounds.width / 2) + 'px';
      dropdown.classList.add('is-visible');
    }
    function hide() {
      hideTimer = setTimeout(function () {
        dropdown.classList.remove('is-visible');
      }, 180);
    }

    tabItem.addEventListener('mouseenter', show);
    tabItem.addEventListener('mouseleave', hide);
    dropdown.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    dropdown.addEventListener('mouseleave', hide);

    /* Repositionner si scroll/resize pendant qu'il est ouvert */
    window.addEventListener('scroll', function () {
      if (dropdown.classList.contains('is-visible')) show();
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (dropdown.classList.contains('is-visible')) show();
    });
  }

  PROJECTS.forEach(buildDropdown);
});
