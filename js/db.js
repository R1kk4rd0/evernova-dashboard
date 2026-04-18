// ─────────────────────────────────────────────────────────────
// STATO GLOBALE
// ─────────────────────────────────────────────────────────────

const API = 'https://script.google.com/macros/s/AKfycbzFy7yJLdwoFEeLPPspAIR3p-8_ScFzPML9X-xNSbs-duEd-IZGG122cuIN0-Li-e6Xbg/exec';

let DB = {
  clienti: [], fatture: [], progetti: [], costi: [],
  spese: [], fornitori: [], fornProgetti: [],
  goals: [], saldo: { balance: 0 }, configCache: {},
};

let currentPage    = 'overview';
let detailCtx      = { type: null, id: null };
let invFilter      = 'all';
let selectMode     = false;
let selectedClients = new Set();
let filters = {
  clients:  { q: '' },
  invoices: { q: '', anno: '' },
  expenses: { q: '', anno: '', cat: '' },
  projects: { q: '', stato: '' },
};
let charts       = {};
let modalSaveFn  = null;
let invSort      = { col: 'data', dir: 'desc' };
let projSort     = { col: 'dataInizio', dir: 'desc' };
let cashflowYear = 'mixed';
let revYear      = '';

// ─────────────────────────────────────────────────────────────
// CONFIG STORAGE  (Google Sheet + localStorage fallback)
// ─────────────────────────────────────────────────────────────

const CONFIG_LOCAL_KEYS = {
  fixedCosts:              'evernova_fixedCosts',
  monthlyClients:          'evernova_monthlyClients',
  monthlyClientsExcluded:  'evernova_monthlyClientsExcluded',
  goals:                   'evernova_goals',
};

function saveConfigToLocal(key, val) {
  try { localStorage.setItem(CONFIG_LOCAL_KEYS[key] || `evernova_${key}`, JSON.stringify(val)); }
  catch (e) { console.warn('Unable to save config to localStorage', key, e); }
}

function loadConfigFromLocal(key) {
  try {
    const raw = localStorage.getItem(CONFIG_LOCAL_KEYS[key] || `evernova_${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { console.warn('Unable to load config from localStorage', key, e); return null; }
}

function getConfig(key) {
  return DB.configCache[key] || null;
}

async function setConfigAsync(key, val) {
  DB.configCache[key] = val;
  saveConfigToLocal(key, val);
  try {
    return await apiPost('setConfigValue', { chiave: key, valore: JSON.stringify(val) });
  } catch (e) {
    console.warn('setConfigAsync backend failed, kept local only', key, e);
    return { ok: false, error: String(e.message || e) };
  }
}

function getMonthlyClientsConfig() {
  const raw = getConfig('monthlyClients');
  const val = raw == null ? loadConfigFromLocal('monthlyClients') || [] : raw;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch (e) { return []; } }
  return val;
}
async function setMonthlyClientsConfig(list) { await setConfigAsync('monthlyClients', list); }

function getMonthlyClientsExcluded() {
  const raw = getConfig('monthlyClientsExcluded');
  const val = raw == null ? loadConfigFromLocal('monthlyClientsExcluded') || [] : raw;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch (e) { return []; } }
  return val;
}
async function setMonthlyClientsExcluded(list) { await setConfigAsync('monthlyClientsExcluded', list); }

function getFixedCostsConfig() {
  const raw = getConfig('fixedCosts');
  const val = raw == null ? loadConfigFromLocal('fixedCosts') || [] : raw;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch (e) { return []; } }
  return val;
}
async function setFixedCostsConfig(list) { await setConfigAsync('fixedCosts', list); }
