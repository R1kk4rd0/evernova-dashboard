// ─────────────────────────────────────────────────────────────
// COSTANTI & UTILITY
// ─────────────────────────────────────────────────────────────

const COLORS = [
  ['#EEF2FF','#4F46E5'], ['#FEF3C7','#D97706'], ['#DCFCE7','#16A34A'],
  ['#FEE2E2','#DC2626'], ['#DBEAFE','#2563EB'], ['#F3E8FF','#9333EA'],
  ['#FFF7ED','#EA580C'], ['#ECFDF5','#059669'],
];

const statusBadge = {
  paid:      '<span class="badge b-paid">Pagata</span>',
  pending:   '<span class="badge b-pending">In attesa</span>',
  draft:     '<span class="badge b-draft">Bozza</span>',
  overdue:   '<span class="badge b-overdue">Scaduta</span>',
  annullata: '<span class="badge b-draft">Annullata</span>',
  nota:      '<span class="badge b-nota">Nota di credito</span>',
};

const projBadge = {
  active:   '<span class="badge b-active">Attivo</span>',
  paused:   '<span class="badge b-paused">In pausa</span>',
  done:     '<span class="badge b-done">Completato</span>',
  proposal: '<span class="badge b-proposal">Proposta</span>',
};

const catColors = {
  Software: '#4F46E5', Attrezzatura: '#EA580C', Marketing: '#D97706',
  Trasferta: '#DC2626', trasferta: '#DC2626', noleggio: '#D97706',
  software: '#4F46E5', Formazione: '#2563EB', Collaboratori: '#9333EA',
  Banca: '#6B7280', Tasse: '#DC2626', Ristorazione: '#D97706',
  Varie: '#9CA3AF', Utenze: '#2563EB', Altro: '#9CA3AF',
};

// ── Formatters ──
const fmtEur  = n => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = s => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
const uid     = () => 'ID_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

// ── Avatar ──
function avatarColor(n) { return COLORS[(n || '').charCodeAt(0) % COLORS.length]; }
function initials(n) { return (n || '??').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); }

// ── Client display name ──
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
const clientById       = id => DB.clienti.find(x => String(x.id) === String(id));
const clientName       = id => { const c = clientById(id); return c ? getNome(c) : '—'; };
const clientInvs       = id => DB.fatture.filter(i => String(i.clienteId) === String(id));
const clientProjs      = id => DB.progetti.filter(p => String(p.clienteId) === String(id));
const projCosts        = id => DB.costi.filter(c => String(c.progettoId) === String(id));
const fornSpese        = id => DB.spese.filter(e => String(e.fornitoreId) === String(id));
const projCostTotal    = id => projCosts(id).reduce((s, c) => s + Number(c.importo || 0), 0);
const projMargin       = p  => Number(p.budget || 0) - projCostTotal(p.id);
const fornProgettiByForn = id => DB.fornProgetti.filter(fp => String(fp.fornitoreId) === String(id));
const fornProgettiByProj = id => DB.fornProgetti.filter(fp => String(fp.progettoId) === String(id));

// ── Invoice status ──
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
function getMonthlyClients() { return getMonthlyClientsConfig(); }

function getFixedCosts() {
  const list = getFixedCostsConfig();
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, c) => s + Number(c.importo || 0), 0);
}

function getMonthlyClientsRevenue() {
  const list = getMonthlyClients();
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, c) => s + Number(c.importoMensile || 0), 0);
}
