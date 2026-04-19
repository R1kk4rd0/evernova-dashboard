// ─────────────────────────────────────────────────────────────
// API & DATA LOADING
// ─────────────────────────────────────────────────────────────

/**
 * GET verso il backend GAS.
 * @param {string} action - Nome dell'azione (es. 'all', 'sync')
 * @param {Object} [params={}] - Parametri query aggiuntivi
 * @returns {Promise<Object>} Risposta JSON
 */
async function apiGet(action, params = {}) {
  const qs  = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/**
 * POST verso il backend GAS.
 * @param {string} action - Nome dell'azione (es. 'saveClient')
 * @param {Object} data - Payload JSON
 * @returns {Promise<Object>} Risposta JSON
 */
async function apiPost(action, data) {
  const res = await fetch(`${API}?action=${action}`, { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/**
 * Normalizza il nome di un cliente Qonto, usando `tipo` come fallback
 * quando `nome` è un UUID o il placeholder "Cliente Qonto".
 * @param {Object} cl - Oggetto cliente grezzo
 * @returns {Object} Cliente con nome normalizzato (mutazione in-place + return)
 */
function normalizeClient(cl) {
  const raw  = String(cl.nome || '').trim();
  const tipo = String(cl.tipo || '').trim();
  const isGeneric = !raw || raw === 'Cliente Qonto' || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(raw);
  if (isGeneric && tipo && tipo !== 'Cliente Qonto' && !/^[0-9a-f]{8}/.test(tipo)) {
    cl.nome = tipo;
  }
  return cl;
}

/**
 * Carica tutti i dati dal backend e popola DB.
 * Priorità localStorage su Sheet per evitare race condition al salvataggio.
 * @returns {Promise<boolean>} true se successo, false se errore di rete
 */
async function loadAll() {
  try {
    const data = await apiGet('all');
    DB.clienti      = (data.clienti || []).map(normalizeClient);
    DB.fatture      = (data.fatture || []).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    DB.progetti     = data.progetti    || [];
    DB.costi        = data.costi       || [];
    DB.spese        = data.spese       || [];
    DB.fornitori    = data.fornitori   || [];
    DB.fornProgetti = data.fornProgetti || [];
    DB.goals        = data.goals       || [];
    DB.saldo        = data.saldo       || { balance: 0 };

    DB.configCache = {};
    (data.config || []).forEach(c => {
      try   { DB.configCache[c.chiave] = JSON.parse(c.valore); }
      catch { DB.configCache[c.chiave] = c.valore; }
    });

    ['fixedCosts', 'monthlyClients', 'monthlyClientsExcluded', 'goals'].forEach(key => {
      const local = loadConfigFromLocal(key);
      if (local !== null) DB.configCache[key] = local;
    });

    if (Array.isArray(DB.configCache.goals)) DB.goals = DB.configCache.goals;

    setConn('live', 'Qonto connesso');
    return true;
  } catch (e) {
    setConn('error', 'Errore connessione');
    toast('Errore: ' + e.message, 'error');
    return false;
  }
}

/**
 * Salva un record sul backend, ricarica i dati e mostra un toast.
 * @param {string} action - Azione GAS (es. 'saveClient', 'saveInvoice')
 * @param {Object} data - Payload da inviare
 * @returns {Promise<Object>} Risposta backend
 * @throws {Error} Se il backend restituisce un errore
 */
async function save(action, data) {
  showLoading('Salvataggio...');
  try {
    if (action === 'saveGoals' && data?.goals) saveConfigToLocal('goals', data.goals);
    const res = await apiPost(action, data);
    if (res.error) throw new Error(res.error);
    await loadAll();
    toast('Salvato ✓', 'success');
    return res;
  } catch (e) {
    toast('Errore: ' + e.message, 'error');
    throw e;
  } finally { hideLoading(); }
}

/**
 * Elimina un record per ID, ricarica i dati e mostra un toast.
 * @param {string} action - Azione GAS (es. 'deleteClient')
 * @param {string} id - ID del record da eliminare
 * @returns {Promise<void>}
 */
async function del(action, id) {
  showLoading('Eliminazione...');
  try {
    const res = await apiPost(action, { id });
    if (res.error) throw new Error(res.error);
    await loadAll();
    toast('Eliminato', 'success');
  } catch (e) {
    toast('Errore: ' + e.message, 'error');
  } finally { hideLoading(); }
}

/**
 * Avvia un sync manuale con Qonto, ricarica i dati e aggiorna la view.
 * @returns {Promise<void>}
 */
async function doSync() {
  showLoading('Sincronizzazione Qonto...');
  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 180000); // 3 min max
  try {
    const qs  = new URLSearchParams({ action: 'sync' }).toString();
    const res = await fetch(`${API}?${qs}`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await loadAll();
    toast(`Sync OK — clienti:${data.clientiImportati} fatture:${data.fattureImportate} spese:${data.speseImportate}`, 'success');
    render();
  } catch (e) {
    clearTimeout(timeout);
    toast('Errore sync: ' + (e.name === 'AbortError' ? 'timeout (>3 min), riprova' : e.message), 'error');
  } finally { hideLoading(); }
}
