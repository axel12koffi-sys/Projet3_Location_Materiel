// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Validation des données reçues
// Chaque fonction renvoie la valeur nettoyée ou lève une HttpError (400).
// =====================================================================

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function texte(valeur, champ, { max = 100, requis = true } = {}) {
  if (valeur != null && typeof valeur !== 'string') throw new HttpError(400, `${champ} invalide.`);
  const propre = (valeur || '').trim();
  if (!propre) {
    if (requis) throw new HttpError(400, `${champ} est obligatoire.`);
    return null;
  }
  if (propre.length > max) throw new HttpError(400, `${champ} : ${max} caractères maximum.`);
  return propre;
}

function montant(valeur, champ) {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0 || valeur > 999999) {
    throw new HttpError(400, `${champ} doit être un nombre positif.`);
  }
  return arrondir(valeur);
}

function id(valeur, champ = 'Identifiant') {
  const s = String(valeur ?? '');
  if (!/^[1-9]\d*$/.test(s) || !Number.isSafeInteger(Number(s))) throw new HttpError(400, `${champ} invalide.`);
  return Number(s);
}

function date(valeur, champ) {
  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    throw new HttpError(400, `${champ} invalide (format AAAA-MM-JJ).`);
  }
  const d = new Date(`${valeur}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valeur) {
    throw new HttpError(400, `${champ} n'existe pas.`);
  }
  return valeur;
}

function courriel(valeur) {
  const c = texte(valeur, 'Courriel', { max: 150 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new HttpError(400, 'Courriel invalide.');
  return c;
}

function telephone(valeur) {
  const t = texte(valeur, 'Téléphone', { max: 20, requis: false });
  if (t && !/^[0-9+().\s-]{7,20}$/.test(t)) throw new HttpError(400, 'Téléphone invalide.');
  return t;
}

function choix(valeur, champ, permis, defaut) {
  if (valeur == null || valeur === '') return defaut;
  if (!permis.includes(valeur)) throw new HttpError(400, `${champ} invalide.`);
  return valeur;
}

// Date du jour selon le fuseau du serveur, au format AAAA-MM-JJ
function aujourdhui() {
  return new Date().toLocaleDateString('en-CA');
}

function joursEntre(debut, fin) {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000);
}

function arrondir(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { HttpError, texte, montant, id, date, courriel, telephone, choix, aujourdhui, joursEntre, arrondir };
