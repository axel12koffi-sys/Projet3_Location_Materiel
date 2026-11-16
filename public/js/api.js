// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Outils partagés par tous les modules
// (requêtes fetch, création d'éléments DOM, formatage, notifications)
// =====================================================================
const App = { modules: {} };

// [KAKK] Appel à l'API : envoie du JSON, lit du JSON, lève une erreur si statut ≠ 2xx
async function requete(url, options = {}) {
  const opts = { ...options };
  if (opts.body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    opts.body = JSON.stringify(opts.body);
  }
  let reponse;
  try {
    reponse = await fetch(url, opts);
  } catch {
    throw new Error('Serveur injoignable. Vérifiez que « npm start » est lancé.');
  }
  let donnees = null;
  try { donnees = await reponse.json(); } catch { /* réponse sans JSON */ }
  if (!reponse.ok) throw new Error(donnees?.erreur || `Erreur ${reponse.status}`);
  return donnees;
}

// [KAKK] Crée un élément : el('td', { class: 'num', text: '12' }, enfant1, enfant2)
// Le texte passe toujours par textContent (protection contre l'injection XSS).
function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur == null || valeur === false) continue;
    if (cle === 'class') noeud.className = valeur;
    else if (cle === 'text') noeud.textContent = valeur;
    else if (cle === 'dataset') Object.assign(noeud.dataset, valeur);
    else noeud.setAttribute(cle, valeur === true ? '' : valeur);
  }
  noeud.append(...enfants.filter(e => e != null && e !== false));
  return noeud;
}

function badge(texte, type) {
  return el('span', { class: `badge ${type}`, text: texte });
}

function ligneVide(tbody, colonnes, texte) {
  tbody.replaceChildren(el('tr', {}, el('td', { class: 'vide', colspan: colonnes, text: texte })));
}

// [KAKK] Notification temporaire en bas à droite
let minuterieToast;
function afficherMessage(texte, type = 'succes') {
  const toast = document.getElementById('toast');
  toast.textContent = texte;
  toast.className = `toast visible ${type}`;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => toast.classList.remove('visible'), 5000);
}

// [KAKK] Formatage
const formatMonnaie = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
function formaterMontant(n) { return formatMonnaie.format(Number(n) || 0); }

function formaterDate(iso) {
  if (!iso) return '—';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

function aujourdhui(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return d.toLocaleDateString('en-CA'); // AAAA-MM-JJ
}

function joursEntre(debut, fin) {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000);
}

// [KAKK] Retarde l'appel pendant la saisie (recherche « en direct »)
function delai(fonction, ms = 300) {
  let minuterie;
  return (...args) => { clearTimeout(minuterie); minuterie = setTimeout(() => fonction(...args), ms); };
}

const LIBELLES_ETAT = { disponible: 'Disponible', loue: 'Loué', maintenance: 'Maintenance' };
