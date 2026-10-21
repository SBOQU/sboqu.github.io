/**
 * Animations_Implementation.js
 * ─────────────────────────────────────────────────────────────
 * Fonctionnalités :
 *   1. Injection d'un bouton ⬇ Download dans chaque admonition
 *      scilab dont le titre contient un nom de fichier .sce
 *   2. Copier dans le presse-papier au clic sur un bloc <pre>
 *      (double-clic) + toast de confirmation
 * ─────────────────────────────────────────────────────────────
 * Autonome — aucune dépendance externe.
 * Compatible : MkDocs Material + admonition custom "scilab"
 */

document.addEventListener('DOMContentLoaded', function () {

  /* ─── 1. TOAST ──────────────────────────────────────────── */
  const toast = document.createElement('div');
  toast.className = 'impl-toast';
  toast.textContent = '✓ Copié dans le presse-papier';
  document.body.appendChild(toast);

  let toastTimer = null;
  function showToast() {
    clearTimeout(toastTimer);
    toast.classList.add('visible');
    toastTimer = setTimeout(function () {
      toast.classList.remove('visible');
    }, 2000);
  }


  /* ─── 2. BOUTONS DOWNLOAD ───────────────────────────────── */

  /**
   * Pour chaque admonition scilab dont le titre contient
   * un nom de fichier (.sce / .sci / .m), on injecte un bouton
   * download href pointant vers le fichier dans assets/code/.
   *
   * Convention de nommage :
   *   Titre de l'admonition = nom exact du fichier
   *   Ex : "Closest_Point.sce"  →  assets/code/Closest_Point.sce
   *
   * Modifie assetBase si tes fichiers sont ailleurs.
   */
  const assetBase = 'assets/code/';

  const admonitions = document.querySelectorAll(
    '.md-typeset .admonition.scilab, .md-typeset details.scilab, '
    + '.md-typeset .admonition.python, .md-typeset details.python'
  );

  admonitions.forEach(function (adm) {
    const titleEl = adm.querySelector('.admonition-title, summary');
    if (!titleEl) return;

    /* Extrait le texte brut du titre (hors icône svg) */
    const rawText = Array.from(titleEl.childNodes)
      .filter(function (n) { return n.nodeType === Node.TEXT_NODE; })
      .map(function (n) { return n.textContent.trim(); })
      .join('');

    const fileMatch = rawText.match(/[\w.-]+\.(sce|sci|m)\b/i);
    if (!fileMatch) return;

    const filename = fileMatch[0];
    const href = assetBase + filename;

    const btn = document.createElement('a');
    btn.className = 'impl-dl-btn';
    btn.href = href;
    btn.download = filename;
    btn.setAttribute('aria-label', 'Télécharger ' + filename);
    btn.innerHTML = '⬇ Download';

    btn.addEventListener('click', function () {
      btn.classList.add('clicked');
      setTimeout(function () { btn.classList.remove('clicked'); }, 600);
    });

    titleEl.appendChild(btn);
  });


  /* ─── 3. COPIE AU DOUBLE-CLIC SUR UN BLOC <pre> ─────────── */
  const codeBlocks = document.querySelectorAll(
    '.md-typeset .scilab pre, .md-typeset .python pre, .md-typeset pre'
  );

  codeBlocks.forEach(function (pre) {
    pre.style.cursor = 'copy';
    pre.title = 'Double-clic pour copier';

    pre.addEventListener('dblclick', function () {
      const text = pre.innerText || pre.textContent || '';
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        showToast();
        pre.style.transition = 'box-shadow 0.15s ease';
        pre.style.boxShadow = '0 0 24px rgba(0, 210, 255, 0.45)';
        setTimeout(function () {
          pre.style.boxShadow = '';
        }, 600);
      });
    });
  });

});
