// ─────────────────────────────────────────────────────────────
// API & DATA LOADING
// ─────────────────────────────────────────────────────────────

async function apiGet(action, params = {}) {
  const qs  = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function apiPost(action, data) {
  const res = await fetch(`${API}?action=${action}`, { method: 'POST', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function normalizeClient(cl) {
  const raw  = String(cl.nome || '').trim();
  const tipo = String(cl.tipo || '').trim();
  const isGeneric = !raw || raw === 'Cliente Qonto' || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(raw);
  if (isGeneric && tipo && tipo !== 'Cliente Qonto' && !/^[0-9a-f]{8}/.test(tipo)) {
    cl.nome = tipo;
  }
  return cl;
}

async function loadAll() {
  try {
    const data = await apiGet('all');
    DB.clienti     = (data.clienti || []).map(normalizeClient);
    DB.fatture     = (data.fatture || []).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    DB.progetti    = data.progetti    || [];
    DB.costi       = data.costi       || [];
    DB.spese       = data.spese       || [];
    DB.fornitori   = data.fornitori   || [];
    DB.fornProgetti = data.fornProgetti || [];
    DB.goals       = data.goals       || [];
    DB.saldo       = data.saldo       || { balance: 0 };

    DB.configCache = {};
    (data.config || []).forEach(c => {
      try   { DB.configCache[c.chiave] = JSON.parse(c.valore); }
      catch { DB.configCache[c.chiave] = c.valore; }
    });

    // localStorage override (priorita' su Sheet per evitare race condition al salvataggio)
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

async function doSync() {
  showLoading('Sincronizzazione Qonto...');
  try {
    const res = await apiGet('sync');
    await loadAll();
    toast(`Sync OK — clienti:${res.clientiImportati} fatture:${res.fattureImportate} spese:${res.speseImportate}`, 'success');
    render();
  } catch (e) {
    toast('Errore sync: ' + e.message, 'error');
  } finally { hideLoading(); }
}
