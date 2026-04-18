// ─────────────────────────────────────────────────────────────
// UI UTILITIES
// ─────────────────────────────────────────────────────────────

function setConn(t, tx) {
  document.getElementById('connDot').className = 'conn-dot' + (t === 'live' ? ' live' : t === 'error' ? ' error' : '');
  document.getElementById('connText').textContent = tx;
}
function showLoading(t = '') {
  document.getElementById('loadingText').textContent = t;
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('show'); }
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => el.className = 'toast', 3500);
}
function openModal(title, sub, body, saveFn, saveLabel = 'Salva') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalSub').textContent   = sub || '';
  document.getElementById('modalBody').innerHTML    = body;
  document.getElementById('modalSaveBtn').textContent  = saveLabel;
  document.getElementById('modalSaveBtn').style.cssText = '';
  modalSaveFn = saveFn;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); modalSaveFn = null; }
function execModalSave() { if (modalSaveFn) modalSaveFn(); }
function destroyCharts() { Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) {} }); charts = {}; }

// ─────────────────────────────────────────────────────────────
// ROUTING & RENDER
// ─────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-item[data-page]').forEach(el =>
  el.addEventListener('click', () => navTo(el.dataset.page))
);

function navTo(page) {
  currentPage = page;
  detailCtx   = { type: null, id: null };
  selectMode  = false;
  selectedClients = new Set();
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  render();
}

function showDetail(type, id) { detailCtx = { type, id }; render(); }
function backToList()         { detailCtx = { type: null, id: null }; render(); }

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

function setBreadcrumb() {
  const titles = { overview:'Dashboard', invoices:'Fatture', clients:'Clienti', projects:'Progetti', expenses:'Spese', suppliers:'Fornitori', sync:'Sync Qonto' };
  const subs   = { overview:'Panoramica del tuo business', invoices:'Gestione fatturazione', clients:'Anagrafica clienti', projects:'Progetti e marginalita\'', expenses:'Costi e spese', suppliers:'Rubrica fornitori', sync:'Sincronizzazione Qonto' };
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

function setTopActions() {
  const el = document.getElementById('topbarActions');
  if (detailCtx.type) { el.innerHTML = ''; return; }
  if      (currentPage === 'suppliers') el.innerHTML = '<button class="btn-primary" onclick="openNewFornModal()">+ Nuovo fornitore</button>';
  else if (currentPage === 'clients')   el.innerHTML = '<button class="btn-primary" onclick="openNewClientModal()">+ Nuovo cliente</button>';
  else if (currentPage === 'projects')  el.innerHTML = '<button class="btn-primary" onclick="openNewProjectModal()">+ Nuovo progetto</button>';
  else if (currentPage === 'invoices')  el.innerHTML = '<button class="btn-ghost" style="margin-right:4px" onclick="doSync()">↺ Sync</button><button class="btn-primary" onclick="openNewInvoiceModal()">+ Nuova fattura</button>';
  else el.innerHTML = '<button class="btn-ghost" onclick="init()">↺ Aggiorna</button>';
}
