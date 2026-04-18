// ─────────────────────────────────────────────────────────────
// COSTANTI & UTILITY
// ─────────────────────────────────────────────────────────────

/** Coppie [bg, fg] per gli avatar, indicizzate per charCode. */
const COLORS = [
  ['#EEF2FF','#4F46E5'], ['#FEF3C7','#D97706'], ['#DCFCE7','#16A34A'],
  ['#FEE2E2','#DC2626'], ['#DBEAFE','#2563EB'], ['#F3E8FF','#9333EA'],
  ['#FFF7ED','#EA580C'], ['#ECFDF5','#059669'],
];

/** HTML badge per stato fattura. */
const statusBadge = {
  paid:      '<span class="badge b-paid">Pagata</span>',
  pending:   '<span class="badge b-pending">In attesa</span>',
  draft:     '<span class="badge b-draft">Bozza</span>',
  overdue:   '<span class="badge b-overdue">Scaduta</span>',
  annullata: '<span class="badge b-draft">Annullata</span>',
  nota:      '<span class="badge b-nota">Nota di credito</span>',
};

/** HTML badge per stato progetto. */
const projBadge = {
  active:   '<span class="badge b-active">Attivo</span>',
  paused:   '<span class="badge b-paused">In pausa</span>',
  done:     '<span class="badge b-done">Completato</span>',
  proposal: '<span class="badge b-proposal">Proposta</span>',
};

/** Colore esadecimale per categoria spesa. */
const catColors = {
  Software: '#4F46E5', Attrezzatura: '#EA580C', Marketing: '#D97706',
  Trasferta: '#DC2626', trasferta: '#DC2626', noleggio: '#D97706',
  software: '#4F46E5', Formazione: '#2563EB', Collaboratori: '#9333EA',
  Banca: '#6B7280', Tasse: '#DC2626', Ristorazione: '#D97706',
  Varie: '#9CA3AF', Utenze: '#2563EB', Altro: '#9CA3AF',
};

// ── Formatters ──

/**
 * Formatta un numero come valuta EUR (es. €1.234).
 * @param {number|string} n
 * @returns {string}
 */
const fmtEur = n => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Formatta una stringa ISO date in formato leggibile (es. "15 mar 25").
 * @param {string} s - Data ISO (YYYY-MM-DD)
 * @returns {string}
 */
const fmtDate = s => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

/**
 * Genera un ID univoco con prefisso timestamp.
 * @returns {string}
 */
const uid = () => 'ID_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

// ── Avatar ──

/**
 * Restituisce la coppia [bg, fg] dell'avatar per una stringa.
 * @param {string} n - Nome o stringa qualsiasi
 * @returns {[string, string]} [colore sfondo, colore testo]
 */
function avatarColor(n) { return COLORS[(n || '').charCodeAt(0) % COLORS.length]; }

/**
 * Calcola le iniziali (max 2 lettere) di un nome.
 * @param {string} n
 * @returns {string}
 */
function initials(n) { return (n || '??').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); }

// ── Client display name ──

/**
 * Restituisce il nome visualizzabile di un cliente, gestendo i placeholder Qonto (UUID, "Cliente Qonto").
 * @param {Object} cl - Oggetto cliente da DB.clienti
 * @returns {string}
 */
function getNome(cl) {
  if (!cl) return '—';
  const n = String(cl.nome || '').trim();
  if (!n || n === 'Cliente Qonto' || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(n)) {
    const t = String(cl.tipo || '').trim();
    if (t && t !== 'Cliente Qonto' && !/^[0-9a-f]{8}/.test(t)) return t;
    return n || 'Cliente';
  }
  return n;
}

// ── DB lookups ──

/** @param {string} id @returns {Object|undefined} */
const clientById = id => DB.clienti.find(x => String(x.id) === String(id));

/** @param {string} id @returns {string} */
const clientName = id => { const c = clientById(id); return c ? getNome(c) : '—'; };

/** @param {string} id @returns {Array} Fatture del cliente */
const clientInvs = id => DB.fatture.filter(i => String(i.clienteId) === String(id));

/** @param {string} id @returns {Array} Progetti del cliente */
const clientProjs = id => DB.progetti.filter(p => String(p.clienteId) === String(id));

/** @param {string} id @returns {Array} Costi del progetto */
const projCosts = id => DB.costi.filter(c => String(c.progettoId) === String(id));

/** @param {string} id @returns {Array} Spese collegate al fornitore */
const fornSpese = id => DB.spese.filter(e => String(e.fornitoreId) === String(id));

/** @param {string} id @returns {number} Somma importi costi progetto */
const projCostTotal = id => projCosts(id).reduce((s, c) => s + Number(c.importo || 0), 0);

/**
 * @param {Object} p - Progetto
 * @returns {number} budget - costi
 */
const projMargin = p => Number(p.budget || 0) - projCostTotal(p.id);

/** @param {string} id @returns {Array} FornProgetti del fornitore */
const fornProgettiByForn = id => DB.fornProgetti.filter(fp => String(fp.fornitoreId) === String(id));

/** @param {string} id @returns {Array} FornProgetti del progetto */
const fornProgettiByProj = id => DB.fornProgetti.filter(fp => String(fp.progettoId) === String(id));

// ── Invoice status ──

/**
 * Calcola lo stato effettivo di una fattura, considerando la scadenza e il tipo.
 * Restituisce 'overdue' se pending e data scadenza passata; 'nota' se credit note.
 * @param {Object} inv - Fattura
 * @returns {'paid'|'pending'|'draft'|'overdue'|'annullata'|'nota'}
 */
function getStatoEffettivo(inv) {
  if (!inv) return 'draft';
  if (String(inv.tipoFattura || '') === 'credit_note') return 'nota';
  const s = String(inv.stato || 'draft');
  if (s === 'paid' || s === 'draft' || s === 'annullata') return s;
  if (inv.scadenza) {
    const sc = new Date(inv.scadenza);
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    if (sc < oggi) return 'overdue';
  }
  return 'pending';
}

// ── Config helpers ──

/** @returns {Array} Lista clienti ricorrenti */
function getMonthlyClients() { return getMonthlyClientsConfig(); }

/**
 * @returns {number} Somma importi costi fissi mensili
 */
function getFixedCosts() {
  const list = getFixedCostsConfig();
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, c) => s + Number(c.importo || 0), 0);
}

/**
 * @returns {number} Somma importoMensile di tutti i clienti ricorrenti
 */
function getMonthlyClientsRevenue() {
  const list = getMonthlyClients();
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, c) => s + Number(c.importoMensile || 0), 0);
}
