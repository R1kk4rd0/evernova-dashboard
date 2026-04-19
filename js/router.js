// ─────────────────────────────────────────────────────────────
// UI UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Aggiorna il pallino e il testo di connessione nella sidebar.
 * @param {'live'|'error'|''} t - Tipo di stato
 * @param {string} tx - Testo da mostrare
 */
function setConn(t, tx) {
  document.getElementById('connDot').className = 'conn-dot' + (t === 'live' ? ' live' : t === 'error' ? ' error' : '');
  document.getElementById('connText').textContent = tx;
}

/**
 * Mostra l'overlay di caricamento con un messaggio opzionale.
 * @param {string} [t=''] - Testo da mostrare sotto lo spinner
 */
function showLoading(t = '') {
  document.getElementById('loadingText').textContent = t;
  document.getElementById('loadingOverlay').classList.add('show');
}

/** Nasconde l'overlay di caricamento. */
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('show'); }

/**
 * Mostra un toast temporaneo (3.5 s).
 * @param {string} msg - Testo del messaggio
 * @param {'success'|'error'|''} [type=''] - Variante colore
 */
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => el.className = 'toast', 3500);
}

/**
 * Apre il modal generico con titolo, sottotitolo, body HTML e callback di salvataggio.
 * @param {string} title - Titolo del modal
 * @param {string} sub - Sottotitolo (può essere stringa vuota)
 * @param {string} body - HTML del corpo
 * @param {Function} saveFn - Callback eseguita al click "Salva"
 * @param {string} [saveLabel='Salva'] - Etichetta del pulsante di conferma
 */
function openModal(title, sub, body, saveFn, saveLabel = 'Salva') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalSub').textContent   = sub || '';
  document.getElementById('modalBody').innerHTML    = body;
  document.getElementById('modalSaveBtn').textContent  = saveLabel;
  document.getElementById('modalSaveBtn').style.cssText = '';
  modalSaveFn = saveFn;
  document.getElementById('modalOverlay').classList.add('open');
}

/** Chiude il modal e resetta la callback. */
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); modalSaveFn = null; }

/** Esegue la callback di salvataggio registrata al momento di openModal. */
function execModalSave() { if (modalSaveFn) modalSaveFn(); }

/** Distrugge tutti i chart Chart.js attivi e svuota il registro `charts`. */
function destroyCharts() { Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) {} }); charts = {}; }

// ─────────────────────────────────────────────────────────────
// ROUTING & RENDER
// ─────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item[data-page]').forEach(el =>
  el.addEventListener('click', () => navTo(el.dataset.page))
);

/**
 * Naviga a una pagina di primo livello, resettando il detailCtx e la selezione.
 * @param {string} page - Nome pagina ('overview'|'invoices'|'clients'|'projects'|'expenses'|'suppliers'|'sync')
 */
function navTo(page) {
  currentPage = page;
  detailCtx   = { type: null, id: null };
  selectMode  = false;
  selectedClients = new Set();
  sessionStorage.setItem('evPage', page);
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  render();
}

/**
 * Naviga a una vista di dettaglio (client o project) senza cambiare pagina nav.
 * @param {'client'|'project'} type
 * @param {string} id
 */
function showDetail(type, id) { detailCtx = { type, id }; render(); }

/** Torna alla lista dalla vista di dettaglio. */
function backToList() { detailCtx = { type: null, id: null }; render(); }

/**
 * Punto d'ingresso del rendering: distrugge i chart, decide se mostrare
 * una vista dettaglio o una pagina, e delega alla funzione render specifica.
 */
function render() {
  destroyCharts();
  const c = document.getElementById('mainContent');
  if (detailCtx.type === 'client')  { renderClientDetail(detailCtx.id, c); return; }
  if (detailCtx.type === 'project') { renderProjectDetail(detailCtx.id, c); return; }
  setBreadcrumb();
  setTopActions();
  if      (currentPage === 'overview')  renderOverview(c);
  else if (currentPage === 'invoices')  renderInvoices(c);
  else if (currentPage === 'clients')   renderClients(c);
  else if (currentPage === 'projects')  renderProjects(c);
  else if (currentPage === 'expenses')  renderExpenses(c);
  else if (currentPage === 'suppliers') renderSuppliers(c);
  else if (currentPage === 'sync')      renderSync(c);
}

/** Aggiorna il breadcrumb e il sottotitolo nella topbar in base a currentPage e detailCtx. */
function setBreadcrumb() {
  const titles = { overview: 'Dashboard', invoices: 'Fatture', clients: 'Clienti', projects: 'Progetti', expenses: 'Spese', suppliers: 'Fornitori', sync: 'Sync Qonto' };
  const subs   = { overview: 'Panoramica del tuo business', invoices: 'Gestione fatturazione', clients: 'Anagrafica clienti', projects: 'Progetti e marginalita\'', expenses: 'Costi e spese', suppliers: 'Rubrica fornitori', sync: 'Sincronizzazione Qonto' };
  const el  = document.getElementById('breadcrumbEl');
  const sub = document.getElementById('topbarSub');
  if (detailCtx.type === 'client') {
    const cl = clientById(detailCtx.id);
    el.innerHTML = `<span class="breadcrumb" onclick="backToList()">Clienti</span><span class="sep">/</span><span style="font-size:15px;font-weight:600;color:var(--text)">${cl ? getNome(cl) : ''}</span>`;
    if (sub) sub.textContent = 'Scheda cliente';
  } else if (detailCtx.type === 'project') {
    const p = DB.progetti.find(x => String(x.id) === String(detailCtx.id));
    el.innerHTML = `<span class="breadcrumb" onclick="backToList()">Progetti</span><span class="sep">/</span><span style="font-size:15px;font-weight:600;color:var(--text)">${p?.nome || ''}</span>`;
    if (sub) sub.textContent = 'Dettaglio progetto';
  } else {
    el.innerHTML = `<span style="font-size:18px;font-weight:600;color:var(--text)">${titles[currentPage] || ''}</span>`;
    if (sub) sub.textContent = subs[currentPage] || '';
  }
}

/** Popola i pulsanti d'azione nella topbar in base alla pagina corrente. */
function setTopActions() {
  const el = document.getElementById('topbarActions');
  if (detailCtx.type) { el.innerHTML = ''; return; }
  if      (currentPage === 'suppliers') el.innerHTML = '<button class="btn-primary" onclick="openNewFornModal()">+ Nuovo fornitore</button>';
  else if (currentPage === 'clients')   el.innerHTML = '<button class="btn-primary" onclick="openNewClientModal()">+ Nuovo cliente</button>';
  else if (currentPage === 'projects')  el.innerHTML = '<button class="btn-primary" onclick="openNewProjectModal()">+ Nuovo progetto</button>';
  else if (currentPage === 'invoices')  el.innerHTML = '<button class="btn-ghost" style="margin-right:4px" onclick="doSync()">↺ Sync</button><button class="btn-primary" onclick="openNewInvoiceModal()">+ Nuova fattura</button>';
  else el.innerHTML = '<button class="btn-ghost" onclick="init()">↺ Aggiorna</button>';
}
