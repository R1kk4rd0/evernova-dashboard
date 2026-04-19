// ─────────────────────────────────────────────────────────────
// PAGES — renderOverview, renderInvoices, renderClients,
//          renderProjects, renderExpenses, renderSuppliers,
//          renderSync + tutti i helper e modal di pagina
// ─────────────────────────────────────────────────────────────

// ── OVERVIEW ─────────────────────────────────────────────────

/**
 * Renderizza la dashboard principale con KPI, grafico revenue, cashflow,
 * obiettivi, ultime fatture e clienti recenti.
 * @param {HTMLElement} c - Contenitore principale (#mainContent)
 */
function renderOverview(c) {
  const fatturato = DB.fatture.filter(i => i.stato !== 'draft').reduce((s, i) => s + Number(i.importo || 0), 0);
  const incassato = DB.fatture.filter(i => getStatoEffettivo(i) === 'paid').reduce((s, i) => s + Number(i.importo || 0), 0);
  const pending   = DB.fatture.filter(i => getStatoEffettivo(i) === 'pending').reduce((s, i) => s + Number(i.importo || 0), 0);
  const speseTot  = DB.spese.reduce((s, e) => s + Number(e.importo || 0), 0);
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  c.innerHTML = `
  <div style="margin-bottom:24px"><div style="font-size:22px;font-weight:600">Benvenuto, Riccardo</div><div style="font-size:13px;color:var(--text3);margin-top:3px">${dateStr}</div></div>
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Saldo Qonto</div><div class="kpi-icon" style="background:#EEF2FF"><svg viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#4F46E5" stroke-width="1.3"/><line x1="1" y1="7" x2="15" y2="7" stroke="#4F46E5" stroke-width="1.3"/></svg></div></div><div class="kpi-value">${fmtEur(DB.saldo.balance)}</div><div class="kpi-footer"><span class="kpi-delta inf">Conto business</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Fatturato totale</div><div class="kpi-icon" style="background:#DCFCE7"><svg viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-6" stroke="#16A34A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="kpi-value">${fmtEur(fatturato)}</div><div class="kpi-footer"><span class="kpi-delta pos">${DB.fatture.filter(i => i.stato !== 'draft').length} fatture</span><span class="kpi-footer-label">di cui ${fmtEur(incassato)} incassati</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Da incassare</div><div class="kpi-icon" style="background:#FEF3C7"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#D97706" stroke-width="1.3"/><line x1="8" y1="5" x2="8" y2="8.5" stroke="#D97706" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11" r="0.7" fill="#D97706"/></svg></div></div><div class="kpi-value">${fmtEur(pending)}</div><div class="kpi-footer"><span class="kpi-delta neu">${DB.fatture.filter(i => getStatoEffettivo(i) === 'pending').length} aperte</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Margine netto</div><div class="kpi-icon" style="background:#F3E8FF"><svg viewBox="0 0 16 16" fill="none"><path d="M3 13l3-4 3 2 4-6" stroke="#9333EA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div><div class="kpi-value">${fmtEur(incassato - speseTot)}</div><div class="kpi-footer"><span class="kpi-delta ${incassato - speseTot >= 0 ? 'pos' : 'neg'}">${incassato > 0 ? Math.round((incassato - speseTot) / incassato * 100) : 0}%</span><span class="kpi-footer-label">Incassato - Spese</span></div></div>
  </div>
  <div class="charts-row">
    <div class="card"><div class="card-header"><div><div class="card-title">Revenue per cliente</div><div class="card-sub">Fatture pagate · clicca una barra per vedere le fatture</div></div><div style="display:flex;gap:4px;flex-wrap:wrap" id="revYearPills"></div></div><div style="position:relative;height:260px"><canvas id="revChart"></canvas></div></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Obiettivi</div><div class="card-sub">Clicca per aggiornare</div></div></div><div id="goalsEl"></div></div>
  </div>
  <div class="card" style="margin-bottom:24px">
    <div class="card-header"><div><div class="card-title">Cashflow — Storico & Previsione</div><div class="card-sub">Ricavi/costi reali (barre solide) · previsione da scadenze fatture, retainer e costi fissi (barre tratteggiate) · linea = saldo Qonto proiettato</div></div><div style="display:flex;gap:4px;flex-wrap:wrap" id="cashflowYearPills"></div></div>
    <div style="position:relative;height:300px"><canvas id="cashflowChart"></canvas></div>
  </div>
  <div class="two-col">
    <div class="card"><div class="card-header"><div class="card-title">Ultime fatture</div><span style="font-size:12px;color:var(--accent);cursor:pointer;font-weight:500" onclick="navTo('invoices')">Vedi tutte →</span></div><table class="data-table" id="invSmall"></table></div>
    <div class="card"><div class="card-header"><div class="card-title">Clienti recenti</div><span style="font-size:12px;color:var(--accent);cursor:pointer;font-weight:500" onclick="navTo('clients')">Vedi tutti →</span></div><div id="clSmall"></div></div>
  </div>`;

  document.getElementById('goalsEl').innerHTML = (() => {
    let html = '';
    if (DB.goals.length > 0) {
      html = DB.goals.map((g, i) => {
        const normalizedLabel = String(g.label || '').toLowerCase();
        const isFatturato = normalizedLabel.includes('fatturato');
        const isRetainer  = normalizedLabel.includes('retainer');
        const monthlyRevenue = getMonthlyClientsRevenue();
        const monthlyClientsCount = getMonthlyClients().length;
        let currentValue;
        if (isFatturato)    currentValue = monthlyRevenue;
        else if (isRetainer) currentValue = monthlyClientsCount;
        else                 currentValue = Number(g.current || 0);
        const pct = Math.min(100, Math.round(currentValue / Math.max(Number(g.target || 1), 1) * 100));
        const col = pct >= 80 ? '#16A34A' : pct >= 50 ? '#4F46E5' : '#D97706';
        const click = i === 0 ? 'onclick="showMonthlyClientsModal()"' : `onclick="editGoal(${i})"`;
        return `<div class="goal-item" ${click}><div class="goal-header"><span class="goal-label">${g.label}</span><span class="goal-nums">${currentValue}/${g.target} · ${pct}%</span></div><div class="goal-track"><div class="goal-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
      }).join('');
    } else {
      html = '<div style="font-size:13px;color:var(--text3)">Nessun obiettivo.</div>';
    }
    const fixedCosts = getFixedCosts();
    html += `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <div class="goal-item" onclick="editFixedCosts()">
        <div class="goal-header"><span class="goal-label">Costi fissi mensili</span><span class="goal-nums" style="color:var(--red)">${fmtEur(fixedCosts)}</span></div>
        <div style="height:6px;background:var(--surface2);border-radius:3px"></div>
      </div>
    </div>`;
    return html;
  })();

  const lmap = { paid: 'Pagata', pending: 'In attesa', draft: 'Bozza', overdue: 'Scaduta' };
  const bmap = { paid: 'b-paid', pending: 'b-pending', draft: 'b-draft', overdue: 'b-overdue' };
  document.getElementById('invSmall').innerHTML = '<thead><tr><th>Cliente</th><th>Importo</th><th>Stato</th><th>Data</th></tr></thead><tbody>' +
    (DB.fatture.slice(0, 6).map(inv => `<tr onclick="openInvDetail('${inv.id}')"><td><div class="td-name">${inv.clienteNome || clientName(inv.clienteId)}</div></td><td class="td-mono">${fmtEur(inv.importo)}</td><td><span class="badge ${bmap[getStatoEffettivo(inv)] || 'b-draft'}">${lmap[getStatoEffettivo(inv)] || inv.stato}</span></td><td style="color:var(--text3)">${fmtDate(inv.data)}</td></tr>`).join('') ||
      '<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px">Nessuna fattura.</td></tr>') + '</tbody>';

  document.getElementById('clSmall').innerHTML = DB.clienti.slice(0, 5).map(cl => {
    const nome = getNome(cl);
    const [bg, fg] = avatarColor(nome);
    return `<div class="recent-item"><div class="avatar" style="background:${bg};color:${fg}">${initials(nome)}</div><div><div class="recent-name">${nome}</div><div class="recent-sub">${cl.email || cl.citta || 'Cliente Qonto'}</div></div><div class="recent-amt">${fmtEur(clientInvs(cl.id).filter(i => getStatoEffettivo(i) === 'paid').reduce((s, i) => s + Number(i.importo || 0), 0))}</div></div>`;
  }).join('') || '<div style="font-size:13px;color:var(--text3)">Nessun cliente.</div>';

  const revAnni = [...new Set(DB.fatture.filter(i => getStatoEffettivo(i) === 'paid').map(i => (i.data || '').substring(0, 4)).filter(Boolean))].sort().reverse();
  const pillsEl = document.getElementById('revYearPills');
  if (pillsEl) pillsEl.innerHTML = [['', 'Tutti'], ...revAnni.map(y => [y, y])].map(([v, l]) =>
    `<button class="pill ${revYear === v ? 'active' : 'inactive'}" style="font-size:11px;padding:4px 10px" onclick="revYear='${v}';renderRevChart('${v}')">${l}</button>`
  ).join('');
  renderRevChart(revYear);
  renderCashflowChart(cashflowYear);
}

// ── INVOICES ─────────────────────────────────────────────────

/**
 * Renderizza la pagina fatture con KPI, barra di ricerca, filtri per anno/stato e tabella ordinabile.
 * @param {HTMLElement} c
 */
function renderInvoices(c) {
  const all = DB.fatture;
  const allAnni = [...new Set(all.map(i => (i.data || '').substring(0, 4)).filter(Boolean))].sort().reverse();

  function filteredInv() {
    const q     = (filters.invoices.q || '').toLowerCase();
    const annoF = filters.invoices.anno || '';
    let r = invFilter === 'all' ? [...all] : all.filter(i => getStatoEffettivo(i) === invFilter);
    if (q) r = r.filter(i => (i.clienteNome || '').toLowerCase().includes(q) || (i.descrizione || '').toLowerCase().includes(q));
    if (annoF) r = r.filter(i => (i.data || '').startsWith(annoF));
    const col = invSort.col, dir = invSort.dir;
    r.sort((a, b) => {
      let va = col === 'importo' ? Number(a[col] || 0) : String(a[col] || '');
      let vb = col === 'importo' ? Number(b[col] || 0) : String(b[col] || '');
      if (col === 'stato') { va = getStatoEffettivo(a); vb = getStatoEffettivo(b); }
      if (col === 'clienteNome') { va = a.clienteNome || clientName(a.clienteId); vb = b.clienteNome || clientName(b.clienteId); }
      if (typeof va === 'number') return dir === 'asc' ? va - vb : vb - va;
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return r;
  }

  function renderTable() {
    const filtered = filteredInv();
    const cnt = document.getElementById('invCount');
    if (cnt) cnt.textContent = filtered.length + ' / ' + all.length + ' fatture';
    const tbody = document.getElementById('invTbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.length ? filtered.map(inv => `<tr onclick="openInvDetail('${inv.id}')">
      <td><div class="td-name">${inv.clienteNome || clientName(inv.clienteId)}</div></td>
      <td style="color:var(--text2)">${inv.descrizione || ''}</td>
      <td style="color:var(--text3)">${fmtDate(inv.data)}</td>
      <td><span style="font-size:11px;color:var(--text3);background:var(--surface2);padding:2px 8px;border-radius:4px">${inv.fonte === 'qonto' ? 'Qonto' : 'Manuale'}</span></td>
      <td>${statusBadge[getStatoEffettivo(inv)] || ''}</td>
      <td class="td-mono" style="text-align:right">${fmtEur(inv.importo)}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="color:var(--text3);text-align:center;padding:24px">Nessuna fattura trovata.</td></tr>';
  }

  function renderPills() {
    const el = document.getElementById('invPills');
    if (!el) return;
    const labels = { all: 'Tutte', paid: 'Pagate', pending: 'In attesa', draft: 'Bozze', overdue: 'Scadute' };
    el.innerHTML = Object.keys(labels).map(f => `<button class="pill ${invFilter === f ? 'active' : 'inactive'}" onclick="setInvFilter('${f}')">${labels[f]}</button>`).join('');
  }

  function renderYearChart() {
    const canvas = document.getElementById('fattureAnniChart');
    if (!canvas) return;
    if (charts.fattureAnni) { try { charts.fattureAnni.destroy(); } catch(e){} delete charts.fattureAnni; }
    const yearsAsc = [...allAnni].reverse();
    const emesso   = yearsAsc.map(y => all.filter(i => (i.data||'').startsWith(y) && i.stato !== 'draft').reduce((s,i) => s + Number(i.importo||0), 0));
    const incassato = yearsAsc.map(y => all.filter(i => (i.data||'').startsWith(y) && getStatoEffettivo(i) === 'paid').reduce((s,i) => s + Number(i.importo||0), 0));
    charts.fattureAnni = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: yearsAsc,
        datasets: [
          { label: 'Emesso', data: emesso, backgroundColor: 'rgba(99,102,241,0.85)', borderRadius: 6, borderSkipped: false },
          { label: 'Incassato', data: incassato, backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtEur(ctx.raw)}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, callback: v => '€' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) } }
        }
      }
    });
  }

  const annoSel = filters.invoices.anno || '';

  c.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Totale emesso</div></div><div class="kpi-value">${fmtEur(all.filter(i => i.stato !== 'draft').reduce((s, i) => s + Number(i.importo || 0), 0))}</div><div class="kpi-footer"><span class="kpi-delta pos">${all.length} fatture</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Incassato</div></div><div class="kpi-value">${fmtEur(all.filter(i => getStatoEffettivo(i) === 'paid').reduce((s, i) => s + Number(i.importo || 0), 0))}</div><div class="kpi-footer"><span class="kpi-delta pos">${all.filter(i => getStatoEffettivo(i) === 'paid').length} pagate</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Da incassare</div></div><div class="kpi-value">${fmtEur(all.filter(i => getStatoEffettivo(i) === 'pending').reduce((s, i) => s + Number(i.importo || 0), 0))}</div><div class="kpi-footer"><span class="kpi-delta neu">${all.filter(i => getStatoEffettivo(i) === 'pending').length} aperte</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Scadute</div></div><div class="kpi-value">${all.filter(i => getStatoEffettivo(i) === 'overdue').length}</div><div class="kpi-footer"><span class="kpi-delta neg">Da sollecitare</span></div></div>
  </div>
  ${allAnni.length > 1 ? `<div class="card" style="padding:16px 20px 20px">
    <div class="card-title" style="margin-bottom:12px">Fatturato per anno</div>
    <div style="height:180px"><canvas id="fattureAnniChart"></canvas></div>
  </div>` : ''}
  <div class="search-bar">
    <div class="search-wrap"><input class="search-input" id="invSearch" placeholder="Cerca cliente o numero fattura..."><button class="search-clear" id="invClear">×</button></div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      <button class="pill ${!annoSel ? 'active' : 'inactive'}" onclick="setInvAnno('')">Tutti</button>
      ${allAnni.map(y => `<button class="pill ${annoSel === y ? 'active' : 'inactive'}" onclick="setInvAnno('${y}')">${y}</button>`).join('')}
    </div>
    <span class="results-count" id="invCount"></span>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Fatture</div><div style="display:flex;gap:4px" id="invPills"></div></div>
    <table class="data-table"><thead><tr>
      <th class="th-sort" onclick="sortInv('clienteNome')">Cliente <span class="sort-arrow ${invSort.col === 'clienteNome' ? 'active' : ''}">${invSort.col === 'clienteNome' ? (invSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></th>
      <th class="th-sort" onclick="sortInv('descrizione')">Descrizione <span class="sort-arrow ${invSort.col === 'descrizione' ? 'active' : ''}">${invSort.col === 'descrizione' ? (invSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></th>
      <th class="th-sort" onclick="sortInv('data')">Data <span class="sort-arrow ${invSort.col === 'data' ? 'active' : ''}">${invSort.col === 'data' ? (invSort.dir === 'asc' ? '↑' : '↓') : '↓'}</span></th>
      <th>Fonte</th>
      <th class="th-sort" onclick="sortInv('stato')">Stato <span class="sort-arrow ${invSort.col === 'stato' ? 'active' : ''}">${invSort.col === 'stato' ? (invSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></th>
      <th class="th-sort" style="text-align:right" onclick="sortInv('importo')">Importo <span class="sort-arrow ${invSort.col === 'importo' ? 'active' : ''}">${invSort.col === 'importo' ? (invSort.dir === 'asc' ? '↑' : '↓') : '↕'}</span></th>
    </tr></thead><tbody id="invTbody"></tbody></table>
  </div>`;

  renderPills();
  renderTable();
  if (allAnni.length > 1) renderYearChart();

  const invSrch = document.getElementById('invSearch');
  if (invSrch) {
    invSrch.value = filters.invoices.q || '';
    invSrch.addEventListener('input', function () {
      filters.invoices.q = this.value;
      document.getElementById('invClear').classList.toggle('vis', this.value.length > 0);
      renderTable();
    });
  }
  document.getElementById('invClear').addEventListener('click', function () {
    filters.invoices.q = ''; filters.invoices.anno = '';
    document.getElementById('invSearch').value = '';
    this.classList.remove('vis');
    renderInvoices(document.getElementById('mainContent'));
  });
  if (filters.invoices.q) document.getElementById('invClear').classList.add('vis');
}

/**
 * Cambia la colonna di ordinamento della tabella fatture (toggle asc/desc).
 * @param {string} col - Nome colonna ('data'|'importo'|'stato'|'clienteNome'|'descrizione')
 */
function sortInv(col) {
  if (invSort.col === col) { invSort.dir = invSort.dir === 'asc' ? 'desc' : 'asc'; }
  else { invSort.col = col; invSort.dir = col === 'data' || col === 'importo' ? 'desc' : 'asc'; }
  const c = document.getElementById('mainContent');
  if (c) renderInvoices(c);
}

/**
 * Imposta il filtro per stato fattura e re-renderizza la pagina.
 * @param {'all'|'paid'|'pending'|'draft'|'overdue'} f
 */
function setInvFilter(f) {
  invFilter = f;
  const c = document.getElementById('mainContent');
  if (c) renderInvoices(c);
}

function setInvAnno(y) {
  filters.invoices.anno = y;
  const c = document.getElementById('mainContent');
  if (c) renderInvoices(c);
}

// ── INVOICE DETAIL MODAL ─────────────────────────────────────

/**
 * Apre il modal di dettaglio di una fattura.
 * Per fatture manuali mostra i campi editabili (importo, stato).
 * Per fatture Qonto è sola lettura con opzione di rimozione dalla dashboard.
 * @param {string} id - ID fattura
 */
function openInvDetail(id) {
  const inv = DB.fatture.find(x => String(x.id) === String(id));
  if (!inv) return;
  const stato   = getStatoEffettivo(inv);
  const isQonto = inv.fonte === 'qonto';
  document.getElementById('modalTitle').textContent = inv.descrizione || 'Fattura';
  document.getElementById('modalSub').textContent   = (inv.clienteNome || clientName(inv.clienteId)) + ' · ' + fmtDate(inv.data);
  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:var(--surface2);border-radius:8px;padding:14px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Importo</div>
        <div style="font-size:24px;font-weight:700;color:var(--text)">${fmtEur(inv.importo)}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:14px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Stato</div>
        ${statusBadge[stato] || ''}
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Emessa</div>
        <div style="font-size:13px;font-weight:500">${fmtDate(inv.data)}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Scadenza</div>
        <div style="font-size:13px;font-weight:500;color:${stato === 'overdue' ? 'var(--red)' : 'var(--text)'}">${fmtDate(inv.scadenza) || '—'}</div>
      </div>
    </div>
    <div style="background:var(--surface2);border-radius:8px;padding:11px 12px;margin-bottom:8px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Cliente</div>
      <div style="font-size:13px;font-weight:500">${inv.clienteNome || clientName(inv.clienteId)}</div>
    </div>
    ${inv.itemTitolo ? `<div style="background:var(--surface2);border-radius:8px;padding:11px 12px;margin-bottom:8px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">Descrizione</div>
      <div style="font-size:13px;font-weight:500;color:var(--text)">${inv.itemTitolo}</div>
    </div>` : ''}
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <span style="background:var(--surface2);padding:3px 10px;border-radius:4px;font-size:11px;color:var(--text3)">${isQonto ? 'Qonto' : 'Manuale'}</span>
      <span style="background:var(--surface2);padding:3px 10px;border-radius:4px;font-size:11px;color:var(--text3);font-family:monospace">${inv.descrizione || ''}</span>
      ${inv.invoiceUrl ? `<a href="${inv.invoiceUrl}" target="_blank" style="margin-left:auto;font-size:12px;color:var(--accent);font-weight:500;text-decoration:none">Apri su Qonto ↗</a>` : ''}
    </div>
    ${!isQonto ? `<div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:12px;font-weight:500;color:var(--text2);margin-bottom:10px">Modifica</div>
      <div class="modal-row">
        <div class="modal-field"><label>Importo €</label><input id="mf_iamt" type="number" value="${inv.importo || 0}"></div>
        <div class="modal-field"><label>Stato</label><select id="mf_istatus">
          <option value="draft" ${inv.stato === 'draft' ? 'selected' : ''}>Bozza</option>
          <option value="pending" ${inv.stato === 'pending' ? 'selected' : ''}>In attesa</option>
          <option value="paid" ${inv.stato === 'paid' ? 'selected' : ''}>Pagata</option>
          <option value="overdue" ${inv.stato === 'overdue' ? 'selected' : ''}>Scaduta</option>
        </select></div>
      </div>
    </div>` : `<div style="border-top:1px solid var(--border);padding-top:12px;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;color:var(--text3)">Fattura Qonto — sola lettura.</span>
      <button class="btn-danger" style="font-size:12px;padding:5px 10px" onclick="delInvAndClose('${inv.id}')">Rimuovi dalla dashboard</button>
    </div>`}
  `;
  const saveBtn = document.getElementById('modalSaveBtn');
  saveBtn.textContent = isQonto ? 'Chiudi' : 'Salva';
  if (isQonto) { saveBtn.style.cssText = 'background:var(--surface2);color:var(--text2);border:1px solid var(--border)'; }
  modalSaveFn = isQonto ? closeModal : async function () {
    inv.importo = parseFloat(document.getElementById('mf_iamt').value) || inv.importo;
    inv.stato   = document.getElementById('mf_istatus').value;
    await save('saveInvoice', inv); closeModal(); render();
  };
  document.getElementById('modalOverlay').classList.add('open');
}

// ── CLIENTS ──────────────────────────────────────────────────

/**
 * Renderizza la griglia clienti con ricerca testuale e modalità selezione multipla per eliminazione.
 * @param {HTMLElement} c
 */
function renderClients(c) {
  if (!DB.clienti.length) {
    c.innerHTML = '<div style="text-align:center;padding:60px 0"><div style="font-size:15px;font-weight:500;margin-bottom:8px">Nessun cliente</div><button class="btn-primary" onclick="doSync()">↺ Sync Qonto</button></div>';
    return;
  }
  selectedClients = new Set();

  function filtered() {
    const q = (filters.clients.q || '').toLowerCase();
    if (!q) return DB.clienti;
    return DB.clienti.filter(cl =>
      getNome(cl).toLowerCase().includes(q) ||
      String(cl.email || '').toLowerCase().includes(q) ||
      String(cl.citta || '').toLowerCase().includes(q) ||
      String(cl.piva  || '').toLowerCase().includes(q)
    );
  }

  function renderGrid() {
    const lista = filtered();
    const cnt   = document.getElementById('clCount');
    if (cnt) cnt.textContent = lista.length + ' / ' + DB.clienti.length + ' clienti';
    const grid = document.getElementById('clGrid');
    if (!grid) return;
    grid.innerHTML = lista.map(cl => {
      const nome = getNome(cl);
      const [bg, fg] = avatarColor(nome);
      const invs  = clientInvs(cl.id);
      const total = invs.reduce((s, i) => s + Number(i.importo || 0), 0);
      const projs = clientProjs(cl.id);
      return `<div class="client-card" id="cc_${cl.id}" onclick="clientCardClick(event,'${cl.id}')">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div class="avatar" style="background:${bg};color:${fg};width:40px;height:40px;font-size:14px;border-radius:10px;flex-shrink:0">${initials(nome)}</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">${cl.email || cl.citta || ''}</div>
          </div>
          <div style="width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border2);flex-shrink:0;display:none;align-items:center;justify-content:center;background:var(--surface2)" id="chk_${cl.id}"></div>
        </div>
        <div class="client-stats">
          <div class="cstat"><div class="cstat-label">Fatturato</div><div class="cstat-val">${fmtEur(total)}</div></div>
          <div class="cstat"><div class="cstat-label">Fatture</div><div class="cstat-val">${invs.length}</div></div>
          <div class="cstat"><div class="cstat-label">Progetti</div><div class="cstat-val">${projs.length}</div></div>
        </div>
      </div>`;
    }).join('');
  }

  c.innerHTML = `
  <div class="search-bar">
    <div class="search-wrap"><input class="search-input" id="clSearch" placeholder="Cerca per nome, email, città, P.IVA..."><button class="search-clear" id="clClear">×</button></div>
    <span class="results-count" id="clCount"></span>
    <div id="clActions"><button class="btn-ghost" style="font-size:12px" onclick="toggleSelectMode()">Seleziona per eliminare</button></div>
  </div>
  <div class="client-grid" id="clGrid"></div>`;

  renderGrid();

  const inp = document.getElementById('clSearch');
  inp.value = filters.clients.q || '';
  inp.addEventListener('input', function () {
    filters.clients.q = this.value;
    document.getElementById('clClear').classList.toggle('vis', this.value.length > 0);
    renderGrid();
  });
  document.getElementById('clClear').addEventListener('click', function () {
    filters.clients.q = ''; inp.value = ''; this.classList.remove('vis'); renderGrid();
  });
  if (filters.clients.q) document.getElementById('clClear').classList.add('vis');
}

/** Attiva/disattiva la modalità selezione multipla nella griglia clienti. */
function toggleSelectMode() {
  selectMode = !selectMode; selectedClients = new Set();
  document.querySelectorAll('[id^="chk_"]').forEach(el => { el.style.display = selectMode ? 'flex' : 'none'; el.innerHTML = ''; });
  document.querySelectorAll('[id^="cc_"]').forEach(el => el.classList.remove('selected'));
  const actions = document.getElementById('clActions');
  if (actions) actions.innerHTML = selectMode
    ? '<button class="btn-ghost" style="font-size:12px" onclick="toggleSelectMode()">Annulla</button><button class="btn-danger" style="font-size:12px" onclick="deleteSelected()">Elimina selezionati (<span id="selCount">0</span>)</button>'
    : '<button class="btn-ghost" style="font-size:12px" onclick="toggleSelectMode()">Seleziona per eliminare</button>';
}

/**
 * Gestisce il click su una card cliente: navigazione al dettaglio o toggle selezione.
 * @param {MouseEvent} e
 * @param {string} id - ID del cliente
 */
function clientCardClick(e, id) {
  if (!selectMode) { showDetail('client', id); return; }
  e.stopPropagation();
  const chk  = document.getElementById('chk_' + id);
  const card = document.getElementById('cc_' + id);
  if (selectedClients.has(id)) {
    selectedClients.delete(id);
    if (chk)  chk.innerHTML = '';
    if (card) card.classList.remove('selected');
  } else {
    selectedClients.add(id);
    if (chk)  chk.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1,5.5 4,8.5 10,2" stroke="#4F46E5" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
    if (card) card.classList.add('selected');
  }
  const cnt = document.getElementById('selCount');
  if (cnt) cnt.textContent = selectedClients.size;
}

/** Apre il modal di conferma ed elimina tutti i clienti selezionati. */
function deleteSelected() {
  if (!selectedClients.size) return;
  const ids = [...selectedClients];
  openModal('Elimina clienti', ids.length + ' clienti selezionati',
    '<div style="font-size:13px;color:var(--text2)">Verranno eliminati ' + ids.length + ' clienti.</div>',
    async () => {
      closeModal(); showLoading('Eliminazione...');
      for (const id of ids) await apiPost('deleteClient', { id });
      await loadAll(); hideLoading();
      toast(ids.length + ' clienti eliminati', 'success');
      selectMode = false; render();
    }, 'Elimina');
}

// ── CLIENT DETAIL ────────────────────────────────────────────

/**
 * Renderizza la scheda di dettaglio cliente con KPI, dati anagrafici,
 * note, progetti associati e storico fatture.
 * @param {string} id - ID cliente
 * @param {HTMLElement} c
 */
function renderClientDetail(id, c) {
  setBreadcrumb(); setTopActions();
  const cl = clientById(id);
  if (!cl) { c.innerHTML = '<div>Non trovato.</div>'; return; }
  const nome = getNome(cl);
  const [bg, fg] = avatarColor(nome);
  const invs = clientInvs(id), projs = clientProjs(id);
  const totalFatt = invs.reduce((s, i) => s + Number(i.importo || 0), 0);
  const totalPaid = invs.filter(i => getStatoEffettivo(i) === 'paid').reduce((s, i) => s + Number(i.importo || 0), 0);
  c.innerHTML = `
  <div class="detail-back" onclick="backToList()">← Tutti i clienti</div>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:12px">
    <div style="display:flex;align-items:center;gap:16px">
      <div class="avatar" style="background:${bg};color:${fg};width:56px;height:56px;font-size:18px;border-radius:14px;flex-shrink:0">${initials(nome)}</div>
      <div><div class="detail-name">${nome}</div><div class="detail-meta">${cl.citta ? cl.citta + ' · ' : ''}${cl.email || ''}</div></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-danger" onclick="confirmDeleteClient('${id}')">Elimina</button>
      <button class="btn-ghost" onclick="openEditClientModal('${id}')">Modifica</button>
      <button class="btn-primary" onclick="openNewInvoiceForClient('${id}')">+ Fattura</button>
    </div>
  </div>
  <div class="kpi-row kpi-row-3" style="margin-bottom:24px">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Fatturato</div></div><div class="kpi-value">${fmtEur(totalFatt)}</div><div class="kpi-footer"><span class="kpi-delta pos">${invs.length} fatture</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Incassato</div></div><div class="kpi-value">${fmtEur(totalPaid)}</div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Progetti</div></div><div class="kpi-value">${projs.length}</div><div class="kpi-footer"><span class="kpi-delta inf">${projs.filter(p => p.stato === 'active').length} attivi</span></div></div>
  </div>
  <div class="two-col" style="margin-bottom:24px">
    <div>
      <div class="section-divider">Dati anagrafici</div>
      <div class="info-grid">
        <div class="info-field"><div class="info-label">Email</div><div class="info-val">${cl.email || '—'}</div></div>
        <div class="info-field"><div class="info-label">Telefono</div><div class="info-val">${cl.tel || '—'}</div></div>
        <div class="info-field"><div class="info-label">P.IVA</div><div class="info-val">${cl.piva || '—'}</div></div>
        <div class="info-field"><div class="info-label">Città</div><div class="info-val">${cl.citta || '—'}</div></div>
      </div>
      <div class="section-divider" style="margin-top:16px">Note</div>
      <textarea class="notes-area" placeholder="Note sul cliente..." onblur="saveClientNotes('${id}',this.value)">${cl.note || ''}</textarea>
    </div>
    <div>
      <div class="section-divider">Progetti associati</div>
      ${projs.length ? projs.map(p => `<div class="project-row" onclick="showDetail('project','${p.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div><div class="project-name">${p.nome}</div><div class="project-client">${p.tipo || ''}</div></div>
          <div style="display:flex;align-items:center;gap:8px">${projBadge[p.stato] || ''}<span style="font-size:13px;font-weight:600;color:var(--accent)">${fmtEur(p.budget)}</span></div>
        </div>
        <div class="prog-row"><div class="prog-track"><div class="prog-fill" style="width:${p.avanzamento || 0}%"></div></div><div class="prog-pct">${p.avanzamento || 0}%</div></div>
      </div>`).join('') : '<div style="font-size:13px;color:var(--text3)">Nessun progetto.</div>'}
    </div>
  </div>
  <div class="section-divider">Storico fatture</div>
  <div class="card">
    <table class="data-table">
      <thead><tr><th>Descrizione</th><th>Data</th><th>Stato</th><th style="text-align:right">Importo</th></tr></thead>
      <tbody>${invs.length ? invs.map(inv => `<tr onclick="openInvDetail('${inv.id}')"><td><div class="td-name">${inv.descrizione || ''}</div></td><td style="color:var(--text3)">${fmtDate(inv.data)}</td><td>${statusBadge[getStatoEffettivo(inv)] || ''}</td><td class="td-mono" style="text-align:right">${fmtEur(inv.importo)}</td></tr>`).join('') : '<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:16px">Nessuna fattura.</td></tr>'}</tbody>
    </table>
  </div>`;
}

/**
 * Apre il modal di conferma per eliminare un cliente.
 * @param {string} id - ID cliente
 */
function confirmDeleteClient(id) {
  const cl = clientById(id);
  if (!cl) return;
  openModal('Elimina cliente', getNome(cl),
    '<div style="font-size:13px;color:var(--text2)">Sei sicuro? Le fatture non vengono eliminate.</div>',
    async () => { await del('deleteClient', id); closeModal(); backToList(); }, 'Elimina');
}

/**
 * Salva le note di un cliente al blur del textarea.
 * @param {string} id - ID cliente
 * @param {string} val - Contenuto del textarea
 * @returns {Promise<void>}
 */
async function saveClientNotes(id, val) {
  const cl = clientById(id);
  if (cl) { cl.note = val; await save('saveClient', cl); }
}

// ── PROJECTS ─────────────────────────────────────────────────

/**
 * Renderizza la pagina progetti con KPI, ricerca, filtro stato e tabella ordinabile.
 * @param {HTMLElement} c
 */
function renderProjects(c) {
  const projNum = p => { const m = String(p.nome || '').match(/^(\d+)/); return m ? m[1] : ''; };

  function filtered() {
    const q  = (filters.projects.q || '').toLowerCase();
    const sf = filters.projects.stato || '';
    let r = DB.progetti.filter(p => {
      const mQ = !q || p.nome.toLowerCase().includes(q) || clientName(p.clienteId).toLowerCase().includes(q);
      const mS = !sf || p.stato === sf;
      return mQ && mS;
    });
    const col = projSort.col, dir = projSort.dir;
    r.sort((a, b) => {
      let va, vb;
      if (col === 'budget' || col === 'margine' || col === 'costi') {
        va = col === 'margine' ? projMargin(a) : col === 'costi' ? projCostTotal(a.id) : Number(a.budget || 0);
        vb = col === 'margine' ? projMargin(b) : col === 'costi' ? projCostTotal(b.id) : Number(b.budget || 0);
        return dir === 'asc' ? va - vb : vb - va;
      }
      if (col === 'num') { va = projNum(a) || 'zzz'; vb = projNum(b) || 'zzz'; }
      else { va = String(a[col] || ''); vb = String(b[col] || ''); }
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return r;
  }

  function arrow(col) {
    const a = projSort.col === col ? (projSort.dir === 'asc' ? '↑' : '↓') : '↕';
    return '<span class="sort-arrow' + (projSort.col === col ? ' active' : '') + '">' + a + '</span>';
  }

  function updateBulkBar() {
    const bar = document.getElementById('projBulkBar');
    if (!bar) return;
    const n = projSelection.size;
    bar.style.display = n > 0 ? 'flex' : 'none';
    const lbl = document.getElementById('projBulkCount');
    if (lbl) lbl.textContent = n + ' progett' + (n === 1 ? 'o' : 'i') + ' selezionat' + (n === 1 ? 'o' : 'i');
  }

  function renderTable() {
    const lista = filtered();
    const cnt   = document.getElementById('projCount');
    if (cnt) cnt.textContent = lista.length + ' / ' + DB.progetti.length + ' progetti';
    const tbody = document.getElementById('projTbody');
    if (!tbody) return;
    const allIds = lista.map(p => p.id);
    const allChecked = allIds.length > 0 && allIds.every(id => projSelection.has(id));
    tbody.innerHTML = lista.length ? lista.map(p => {
      const costs      = projCostTotal(p.id), margin = projMargin(p);
      const mPct       = Number(p.budget || 0) > 0 ? Math.round(margin / Number(p.budget) * 100) : 0;
      const mc         = mPct >= 60 ? 'var(--green)' : mPct >= 30 ? 'var(--amber)' : 'var(--red)';
      const num        = projNum(p);
      const nomePulito = num ? p.nome.replace(/^\d+\s*-\s*/, '') : p.nome;
      const checked    = projSelection.has(p.id) ? 'checked' : '';
      return '<tr onclick="showDetail(\'project\',\'' + p.id + '\')" style="cursor:pointer" class="' + (projSelection.has(p.id) ? 'row-selected' : '') + '">'
        + '<td onclick="event.stopPropagation()" style="width:32px;text-align:center">'
        + '<input type="checkbox" ' + checked + ' onchange="toggleProjSel(\'' + p.id + '\',this.checked)" style="cursor:pointer;width:15px;height:15px"></td>'
        + '<td style="color:var(--text3);font-size:12px;font-weight:600;width:40px">' + (num || '—') + '</td>'
        + '<td><div style="font-size:13px;font-weight:600;color:var(--text)">' + nomePulito + '</div>'
        + '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + clientName(p.clienteId) + '</div></td>'
        + '<td>' + (projBadge[p.stato] || '') + '</td>'
        + '<td style="font-size:13px;font-weight:600;text-align:right">' + fmtEur(p.budget) + '</td>'
        + '<td style="font-size:13px;font-weight:600;color:var(--red);text-align:right">' + (costs > 0 ? fmtEur(costs) : '—') + '</td>'
        + '<td style="font-size:13px;font-weight:700;color:' + mc + ';text-align:right">' + fmtEur(margin)
        + '<span style="font-size:11px;font-weight:500;margin-left:4px">(' + mPct + '%)</span></td>'
        + '<td style="color:var(--text3);font-size:12px">' + fmtDate(p.dataInizio) + '</td>'
        + '<td onclick="event.stopPropagation()" style="text-align:right">'
        + '<button class="btn-ghost" style="font-size:11px;padding:4px 8px" onclick="openEditProjectModal(\'' + p.id + '\')">✎</button></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:32px">Nessun risultato.</td></tr>';

    const thead = document.getElementById('projThead');
    if (thead) thead.innerHTML = '<tr>'
      + '<th style="width:32px;text-align:center"><input type="checkbox" ' + (allChecked ? 'checked' : '') + ' onchange="toggleAllProjSel(this.checked)" style="cursor:pointer;width:15px;height:15px"></th>'
      + '<th class="th-sort" onclick="sortProj(\'num\')" style="width:40px"># ' + arrow('num') + '</th>'
      + '<th class="th-sort" onclick="sortProj(\'nome\')">Nome ' + arrow('nome') + '</th>'
      + '<th>Stato</th>'
      + '<th class="th-sort" onclick="sortProj(\'budget\')" style="text-align:right">Budget ' + arrow('budget') + '</th>'
      + '<th class="th-sort" onclick="sortProj(\'costi\')" style="text-align:right">Costi ' + arrow('costi') + '</th>'
      + '<th class="th-sort" onclick="sortProj(\'margine\')" style="text-align:right">Margine ' + arrow('margine') + '</th>'
      + '<th class="th-sort" onclick="sortProj(\'dataInizio\')">Data ' + arrow('dataInizio') + '</th>'
      + '<th></th>'
      + '</tr>';
    updateBulkBar();
  }

  projSelection.clear();

  const active       = DB.progetti.filter(p => p.stato === 'active');
  const totalBudget  = DB.progetti.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalMargine = DB.progetti.reduce((s, p) => s + projMargin(p), 0);
  const clientOpts   = DB.clienti.map(cl => `<option value="${cl.id}">${getNome(cl)}</option>`).join('');

  c.innerHTML = `
  <div class="kpi-row" style="margin-bottom:24px">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Budget totale</div></div><div class="kpi-value">${fmtEur(totalBudget)}</div><div class="kpi-footer"><span class="kpi-delta neu">${DB.progetti.length} progetti</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Attivi</div></div><div class="kpi-value">${active.length}</div><div class="kpi-footer"><span class="kpi-delta pos">${fmtEur(active.reduce((s, p) => s + Number(p.budget || 0), 0))} in corso</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Margine totale</div></div><div class="kpi-value">${fmtEur(totalMargine)}</div><div class="kpi-footer"><span class="kpi-delta ${totalBudget > 0 && Math.round(totalMargine / totalBudget * 100) >= 50 ? 'pos' : 'neu'}">${totalBudget > 0 ? Math.round(totalMargine / totalBudget * 100) : 0}% medio</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Completati</div></div><div class="kpi-value">${DB.progetti.filter(p => p.stato === 'done').length}</div></div>
  </div>
  <div class="search-bar">
    <div class="search-wrap"><input class="search-input" id="projSearch" placeholder="Cerca per nome o cliente..."><button class="search-clear" id="projClear">×</button></div>
    <select class="filter-select" id="projStato">
      <option value="">Tutti gli stati</option>
      <option value="active">Attivi</option><option value="proposal">Proposte</option>
      <option value="paused">In pausa</option><option value="done">Completati</option>
    </select>
    <span class="results-count" id="projCount"></span>
  </div>
  <div id="projBulkBar" style="display:none;align-items:center;gap:10px;background:var(--indigo,#6366f1);color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:12px;flex-wrap:wrap">
    <span id="projBulkCount" style="font-size:13px;font-weight:600;flex:1"></span>
    <select id="bulkCliente" style="padding:5px 10px;border-radius:6px;border:none;font-size:13px;min-width:180px">
      <option value="">Assegna cliente...</option>${clientOpts}
    </select>
    <select id="bulkStato" style="padding:5px 10px;border-radius:6px;border:none;font-size:13px">
      <option value="">Cambia stato...</option>
      <option value="proposal">Proposta</option>
      <option value="active">Attivo</option>
      <option value="paused">In pausa</option>
      <option value="done">Completato</option>
    </select>
    <button onclick="applyBulkProj()" style="background:#fff;color:var(--indigo,#6366f1);border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Applica</button>
    <button onclick="projSelection.clear();renderTable()" style="background:none;border:1px solid rgba(255,255,255,0.5);color:#fff;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:13px">Deseleziona</button>
  </div>
  <div class="card">
    <table class="data-table">
      <thead id="projThead"></thead>
      <tbody id="projTbody"></tbody>
    </table>
  </div>`;

  renderTable();
  const ps = document.getElementById('projSearch');
  ps.value = filters.projects.q || '';
  ps.addEventListener('input', function () { filters.projects.q = this.value; document.getElementById('projClear').classList.toggle('vis', this.value.length > 0); renderTable(); });
  const pst = document.getElementById('projStato');
  pst.value = filters.projects.stato || '';
  pst.addEventListener('change', function () { filters.projects.stato = this.value; renderTable(); });
  document.getElementById('projClear').addEventListener('click', function () {
    filters.projects.q = ''; filters.projects.stato = '';
    ps.value = ''; pst.value = '';
    this.classList.remove('vis'); renderTable();
  });
  if (filters.projects.q) document.getElementById('projClear').classList.add('vis');
}

/**
 * Cambia la colonna di ordinamento della tabella progetti.
 * @param {string} col - Nome colonna
 */
function sortProj(col) {
  if (projSort.col === col) { projSort.dir = projSort.dir === 'asc' ? 'desc' : 'asc'; }
  else { projSort.col = col; projSort.dir = col === 'dataInizio' || col === 'budget' || col === 'margine' ? 'desc' : 'asc'; }
  const c = document.getElementById('mainContent');
  if (c) renderProjects(c);
}

function toggleProjSel(id, checked) {
  if (checked) projSelection.add(id); else projSelection.delete(id);
  const bar = document.getElementById('projBulkBar');
  const lbl = document.getElementById('projBulkCount');
  const n   = projSelection.size;
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  if (lbl) lbl.textContent = n + ' progett' + (n === 1 ? 'o' : 'i') + ' selezionat' + (n === 1 ? 'o' : 'i');
  const allCbs = document.querySelectorAll('#projThead input[type=checkbox]');
  const allRowCbs = document.querySelectorAll('#projTbody input[type=checkbox]');
  if (allCbs[0]) allCbs[0].checked = allRowCbs.length > 0 && [...allRowCbs].every(cb => cb.checked);
  const row = document.querySelector(`#projTbody tr input[value="${id}"]`);
  if (row) row.closest('tr').classList.toggle('row-selected', checked);
}

function toggleAllProjSel(checked) {
  document.querySelectorAll('#projTbody input[type=checkbox]').forEach(cb => {
    cb.checked = checked;
    const id = cb.getAttribute('onchange').match(/'([^']+)'/)[1];
    if (checked) projSelection.add(id); else projSelection.delete(id);
    cb.closest('tr').classList.toggle('row-selected', checked);
  });
  const bar = document.getElementById('projBulkBar');
  const lbl = document.getElementById('projBulkCount');
  const n   = projSelection.size;
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  if (lbl) lbl.textContent = n + ' progett' + (n === 1 ? 'o' : 'i') + ' selezionat' + (n === 1 ? 'o' : 'i');
}

async function applyBulkProj() {
  const ids       = [...projSelection];
  if (!ids.length) return;
  const clienteId = document.getElementById('bulkCliente').value;
  const stato     = document.getElementById('bulkStato').value;
  if (!clienteId && !stato) { toast('Seleziona almeno un campo da modificare', 'warn'); return; }
  showLoading('Salvataggio...');
  for (const id of ids) {
    const p = DB.progetti.find(x => String(x.id) === String(id));
    if (!p) continue;
    if (clienteId) p.clienteId = clienteId;
    if (stato)     p.stato     = stato;
    await apiPost('saveProject', p);
  }
  hideLoading();
  projSelection.clear();
  toast(`${ids.length} progetti aggiornati`);
  const c = document.getElementById('mainContent');
  if (c) renderProjects(c);
}

// ── PROJECT DETAIL ───────────────────────────────────────────

/**
 * Renderizza la scheda di dettaglio progetto con KPI, lista costi,
 * conto economico, note e fornitori collegati.
 * @param {string} id - ID progetto
 * @param {HTMLElement} c
 */
function renderProjectDetail(id, c) {
  setBreadcrumb(); setTopActions();
  const p = DB.progetti.find(x => String(x.id) === String(id));
  if (!p) { c.innerHTML = '<div>Non trovato.</div>'; return; }
  const costs = projCosts(id), costsTotal = projCostTotal(id), margin = projMargin(p);
  const mPct  = Number(p.budget || 0) > 0 ? Math.round(margin / Number(p.budget) * 100) : 0;
  const mc    = mPct >= 60 ? 'var(--green)' : mPct >= 30 ? 'var(--amber)' : 'var(--red)';
  c.innerHTML = `
  <div class="detail-back" onclick="backToList()">← Tutti i progetti</div>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:12px">
    <div><div class="detail-name">${p.nome}</div><div class="detail-meta">${clientName(p.clienteId)} · ${p.tipo || ''}</div></div>
    <div style="display:flex;gap:8px;align-items:center">${projBadge[p.stato] || ''}<button class="btn-ghost" onclick="openEditProjectModal('${id}')">Modifica</button></div>
  </div>
  <div class="kpi-row" style="margin-bottom:24px">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Budget</div></div><div class="kpi-value">${fmtEur(p.budget)}</div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Costi</div></div><div class="kpi-value">${fmtEur(costsTotal)}</div><div class="kpi-footer"><span class="kpi-delta neg">${costs.length} voci</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Margine</div></div><div class="kpi-value" style="color:${mc}">${fmtEur(margin)}</div><div class="kpi-footer"><span class="kpi-delta ${mPct >= 60 ? 'pos' : mPct >= 30 ? 'neu' : 'neg'}">${mPct}%</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Avanzamento</div></div><div class="kpi-value">${p.avanzamento || 0}%</div><div class="kpi-footer"><span class="kpi-delta inf">${fmtDate(p.dataInizio)} → ${fmtDate(p.dataFine)}</span></div></div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-header"><div class="card-title">Costi</div><button class="btn-ghost" style="font-size:12px" onclick="openAddCostModal('${id}')">+ Aggiungi</button></div>
      ${costs.length ? costs.map(cost => {
        const forn = cost.fornitoreId ? DB.fornitori.find(f => String(f.id) === String(cost.fornitoreId)) : null;
        return `<div class="proj-cost-row">
          <div style="width:8px;height:8px;border-radius:50%;background:${catColors[cost.categoria] || '#9CA3AF'};flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${forn ? forn.nome : cost.descrizione}</div>
            <div style="font-size:11px;color:var(--text3)">${forn ? cost.descrizione + ' · ' : ''}${cost.categoria} · ${fmtDate(cost.data)}</div>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--red)">${fmtEur(cost.importo)}</div>
          <span onclick="delCost('${cost.id}','${id}')" style="cursor:pointer;color:var(--text3);font-size:16px;padding:0 4px">×</span>
        </div>`;
      }).join('') : '<div style="font-size:13px;color:var(--text3)">Nessun costo.</div>'}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Conto economico</div></div>
      <div class="margin-card">
        <div class="margin-row"><span style="font-size:13px;color:var(--text2)">Budget</span><span style="font-size:14px;font-weight:600;color:var(--green)">${fmtEur(p.budget)}</span></div>
        <div class="margin-divider"></div>
        ${costs.map(cost => `<div class="margin-row"><span style="font-size:12px;color:var(--text3)">${cost.descrizione}</span><span style="font-size:12px;font-weight:500;color:var(--red)">-${fmtEur(cost.importo)}</span></div>`).join('')}
        <div class="margin-divider"></div>
        <div class="margin-row"><span style="font-size:14px;font-weight:600">Margine netto</span><span style="font-size:18px;font-weight:700;color:${mc}">${fmtEur(margin)}</span></div>
        <div class="margin-row"><span style="font-size:12px;color:var(--text3)">Percentuale</span><span style="font-size:13px;font-weight:600;color:${mc}">${mPct}%</span></div>
      </div>
      <div class="section-divider" style="margin-top:16px">Note</div>
      <textarea class="notes-area" placeholder="Obiettivi, deliverable..." onblur="saveProjNotes('${id}',this.value)">${p.note || ''}</textarea>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-header"><div class="card-title">Fornitori collegati</div><button class="btn-ghost" style="font-size:12px" onclick="openLinkFornProgModal('${id}')">+ Collega fornitore</button></div>
    ${(() => {
      const links = fornProgettiByProj(id);
      if (!links.length) return '<div style="font-size:13px;color:var(--text3)">Nessun fornitore collegato a questo progetto.</div>';
      return links.map(fp => {
        const f = DB.fornitori.find(x => String(x.id) === String(fp.fornitoreId));
        if (!f) return '';
        const [bg, fg] = avatarColor(f.nome || '');
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">'
          + '<div class="avatar" style="background:' + bg + ';color:' + fg + ';width:34px;height:34px;font-size:12px;border-radius:8px;flex-shrink:0">' + initials(f.nome || '') + '</div>'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:500">' + f.nome + '</div>'
          + '<div style="font-size:11px;color:var(--text3)">' + (fp.ruolo || f.categoria || '') + '</div></div>'
          + '<span onclick="delFornProg(\'' + fp.id + '\',\'' + id + '\')" style="cursor:pointer;color:var(--text3);font-size:16px;padding:0 4px">×</span>'
          + '</div>';
      }).join('');
    })()}
  </div>`;
}

/**
 * Elimina un costo da un progetto. Se il fornitore associato non ha altri costi
 * su quel progetto, rimuove anche il link FornProg.
 * @param {string} costId
 * @param {string} projId
 * @returns {Promise<void>}
 */
async function delCost(costId, projId) {
  const cost   = DB.costi.find(x => String(x.id) === String(costId));
  const fornId = cost ? String(cost.fornitoreId || '') : '';
  showLoading('Eliminazione...');
  try {
    await apiPost('deleteCost', { id: costId });
    if (fornId) {
      const altriCosti = DB.costi.filter(c => String(c.id) !== String(costId) && String(c.progettoId) === String(projId) && String(c.fornitoreId) === String(fornId));
      if (!altriCosti.length) {
        const fp = DB.fornProgetti.find(x => String(x.fornitoreId) === String(fornId) && String(x.progettoId) === String(projId));
        if (fp) await apiPost('deleteFornProg', { id: fp.id });
      }
    }
    await loadAll();
    toast('Eliminato', 'success');
  } catch (e) {
    toast('Errore: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
  showDetail('project', projId);
}

/**
 * Salva le note di un progetto al blur del textarea.
 * @param {string} id - ID progetto
 * @param {string} val
 * @returns {Promise<void>}
 */
async function saveProjNotes(id, val) {
  const p = DB.progetti.find(x => String(x.id) === String(id));
  if (p) { p.note = val; await save('saveProject', p); }
}

// ── EXPENSES ─────────────────────────────────────────────────

/**
 * Renderizza la pagina spese con KPI, lista filtrata, form aggiunta rapida
 * e grafico a barre per categoria.
 * @param {HTMLElement} c
 */
function renderExpenses(c) {
  const allCat  = [...new Set(DB.spese.map(e => e.categoria).filter(Boolean))].sort();
  const allAnni = [...new Set(DB.spese.map(e => (e.data || '').substring(0, 4)).filter(Boolean))].sort().reverse();

  function filtered() {
    const q  = (filters.expenses.q || '').toLowerCase();
    const af = filters.expenses.anno || '', cf = filters.expenses.cat || '';
    return DB.spese.filter(e => {
      const mQ = !q || (e.descrizione || '').toLowerCase().includes(q) || (e.categoria || '').toLowerCase().includes(q);
      const mA = !af || (e.data || '').startsWith(af);
      const mC = !cf || e.categoria === cf;
      return mQ && mA && mC;
    });
  }

  function renderList() {
    const sf    = filtered();
    const total = sf.reduce((s, e) => s + Number(e.importo || 0), 0);
    const cnt = document.getElementById('expCount'); if (cnt) cnt.textContent = sf.length + ' / ' + DB.spese.length;
    const tot = document.getElementById('expTotal'); if (tot) { tot.textContent = fmtEur(total); tot.style.display = total > 0 ? '' : 'none'; }
    const clr = document.getElementById('expClear'); if (clr) clr.classList.toggle('vis', (filters.expenses.q || '').length > 0);
    const list = document.getElementById('expList'); if (!list) return;
    list.innerHTML = sf.map(e => {
      const forn = e.fornitoreId ? DB.fornitori.find(f => String(f.id) === String(e.fornitoreId)) : null;
      const fornTag = forn
        ? `<span onclick="event.stopPropagation();openLinkFornModal('${e.id}')" style="font-size:10px;color:var(--accent);background:var(--accent-light);padding:2px 8px;border-radius:4px;cursor:pointer">${forn.nome}</span>`
        : `<span onclick="event.stopPropagation();openLinkFornModal('${e.id}')" style="font-size:10px;color:var(--text3);background:var(--surface2);padding:2px 8px;border-radius:4px;cursor:pointer">+ fornitore</span>`;
      return `<div class="exp-row">
        <div class="merchant-avatar" style="background:${avatarColor(e.descrizione || '')[0]};color:${avatarColor(e.descrizione || '')[1]}">${initials(e.descrizione || '??')}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${e.descrizione}</div>
          <div style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;margin-top:2px">${e.categoria} · ${fmtDate(e.data)} ${fornTag}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--red)">${fmtEur(e.importo)}</div>
        ${e.fonte !== 'qonto' ? `<span onclick="delExp('${e.id}')" style="cursor:pointer;color:var(--text3);font-size:16px;padding:0 4px">×</span>` : '<span style="font-size:10px;color:var(--text3);padding:2px 6px;background:var(--surface2);border-radius:4px;margin-left:4px">Q</span>'}
      </div>`;
    }).join('') || '<div style="font-size:13px;color:var(--text3);padding:8px 0">Nessuna spesa.</div>';
  }

  const totalAll  = DB.spese.reduce((s, e) => s + Number(e.importo || 0), 0);
  const incassato = DB.fatture.filter(i => getStatoEffettivo(i) === 'paid').reduce((s, i) => s + Number(i.importo || 0), 0);
  const byCatAll  = {};
  DB.spese.forEach(e => { byCatAll[e.categoria] = (byCatAll[e.categoria] || 0) + Number(e.importo || 0); });

  c.innerHTML = `
  <div class="kpi-row kpi-row-3">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Totale spese</div></div><div class="kpi-value">${fmtEur(totalAll)}</div><div class="kpi-footer"><span class="kpi-delta neg">${DB.spese.length} voci</span></div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Categoria principale</div></div><div class="kpi-value" style="font-size:20px;font-weight:600">${Object.entries(byCatAll).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}</div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Margine stimato</div></div><div class="kpi-value">${fmtEur(incassato - totalAll)}</div><div class="kpi-footer"><span class="kpi-delta ${incassato - totalAll >= 0 ? 'pos' : 'neg'}">Incassato - Spese</span></div></div>
  </div>
  <div class="search-bar">
    <div class="search-wrap"><input class="search-input" id="expSearch" placeholder="Cerca per descrizione..."><button class="search-clear" id="expClear">×</button></div>
    <select class="filter-select" id="expAnno"><option value="">Tutti gli anni</option>${allAnni.map(y => `<option value="${y}">${y}</option>`).join('')}</select>
    <select class="filter-select" id="expCat"><option value="">Tutte le categorie</option>${allCat.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select>
    <span class="results-count" id="expCount"></span>
    <span class="filter-total" id="expTotal" style="display:none"></span>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-header"><div class="card-title">Lista spese</div></div>
      <div id="expList"></div>
      <div class="add-form">
        <input class="fi" id="eDesc" placeholder="Descrizione" style="flex:2">
        <input class="fi" id="eAmt" type="number" placeholder="€" style="flex:0.5;min-width:70px">
        <select class="fi" id="eCat"><option>Software</option><option>Attrezzatura</option><option>Marketing</option><option>Trasferta</option><option>Collaboratori</option><option>Altro</option></select>
        <button class="btn-primary" style="flex:0;white-space:nowrap" onclick="addExpense()">+ Aggiungi</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Per categoria</div></div>
      <div style="position:relative;height:240px"><canvas id="expChart"></canvas></div>
    </div>
  </div>`;

  renderList();
  const es = document.getElementById('expSearch');
  es.value = filters.expenses.q || '';
  es.addEventListener('input', function () { filters.expenses.q = this.value; renderList(); });
  const ea = document.getElementById('expAnno'); ea.value = filters.expenses.anno || '';
  ea.addEventListener('change', function () { filters.expenses.anno = this.value; renderList(); });
  const ec = document.getElementById('expCat'); ec.value = filters.expenses.cat || '';
  ec.addEventListener('change', function () { filters.expenses.cat = this.value; renderList(); });
  document.getElementById('expClear').addEventListener('click', function () {
    filters.expenses.q = ''; filters.expenses.anno = ''; filters.expenses.cat = '';
    es.value = ''; ea.value = ''; ec.value = ''; this.classList.remove('vis'); renderList();
  });
  if (filters.expenses.q) document.getElementById('expClear').classList.add('vis');

  const labs = Object.keys(byCatAll), vals = Object.values(byCatAll), cols = labs.map(l => catColors[l] || '#9CA3AF');
  if (labs.length) {
    charts.exp = new Chart(document.getElementById('expChart'), {
      type: 'bar',
      data: { labels: labs, datasets: [{ data: vals, backgroundColor: cols, borderRadius: 6, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 11 }, color: '#9CA3AF', callback: v => '€' + v }, grid: { color: '#F3F4F6' }, border: { display: false } },
          y: { ticks: { font: { size: 11 }, color: '#6B7280' }, grid: { display: false }, border: { display: false } }
        }
      }
    });
  }
}

/**
 * Apre il modal per collegare (o cambiare) il fornitore di una spesa.
 * @param {string} expId - ID spesa
 */
function openLinkFornModal(expId) {
  const e = DB.spese.find(x => String(x.id) === String(expId));
  if (!e) return;
  const opts = DB.fornitori.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(f =>
    `<option value="${f.id}" ${String(e.fornitoreId) === String(f.id) ? 'selected' : ''}>${f.nome}</option>`
  ).join('');
  openModal('Collega fornitore', e.descrizione + ' · ' + fmtEur(e.importo),
    `<div class="modal-field"><label>Fornitore</label><select id="mf_forn"><option value="">— nessuno —</option>${opts}</select></div>`,
    async function () {
      const fornId = document.getElementById('mf_forn').value;
      await save('saveExpense', { ...e, fornitoreId: fornId });
      closeModal(); render();
    }
  );
}

/**
 * Apre il modal per collegare un fornitore a un progetto (crea record FornProg).
 * Esclude i fornitori già collegati al progetto dalla lista.
 * @param {string} projId - ID progetto
 */
function openLinkFornProgModal(projId) {
  const p = DB.progetti.find(x => String(x.id) === String(projId));
  if (!p) return;
  const already = fornProgettiByProj(projId).map(fp => String(fp.fornitoreId));
  const opts = DB.fornitori.filter(f => !already.includes(String(f.id))).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(f =>
    `<option value="${f.id}">${f.nome}</option>`
  ).join('');
  if (!opts) { toast('Tutti i fornitori sono già collegati a questo progetto.'); return; }
  openModal('Collega fornitore', p.nome,
    `<div class="modal-field"><label>Fornitore</label><select id="mf_fpforn"><option value="">— seleziona —</option>${opts}</select></div>
     <div class="modal-field"><label>Ruolo (opzionale)</label><input id="mf_fpruolo" placeholder="es. Cameraman, Post-produzione..."></div>
     <div class="modal-field"><label>Note</label><textarea id="mf_fpnote" style="min-height:50px"></textarea></div>`,
    async function () {
      const fornId = document.getElementById('mf_fpforn').value;
      if (!fornId) return;
      await save('saveFornProg', { id: uid(), fornitoreId: fornId, progettoId: projId, ruolo: document.getElementById('mf_fpruolo').value, note: document.getElementById('mf_fpnote').value });
      closeModal(); showDetail('project', projId);
    }
  );
}

/**
 * Elimina un link FornProg e torna al dettaglio progetto.
 * @param {string} fpId - ID FornProg
 * @param {string} projId - ID progetto (per il redirect)
 * @returns {Promise<void>}
 */
async function delFornProg(fpId, projId) { await del('deleteFornProg', fpId); showDetail('project', projId); }

/** Aggiunge una spesa manuale con i valori del form in-page. @returns {Promise<void>} */
async function addExpense() {
  const d   = document.getElementById('eDesc')?.value.trim();
  const a   = parseFloat(document.getElementById('eAmt')?.value);
  const cat = document.getElementById('eCat')?.value;
  if (!d || !a) return;
  await save('saveExpense', { id: uid(), descrizione: d, importo: a, categoria: cat, data: new Date().toISOString().split('T')[0], fonte: 'manuale' });
  render();
}

/** @param {string} id @returns {Promise<void>} */
async function delExp(id) { await del('deleteExpense', id); render(); }

/**
 * Chiude il modal e poi elimina la fattura (usato dalle fatture Qonto in sola lettura).
 * @param {string} id - ID fattura
 * @returns {Promise<void>}
 */
async function delInvAndClose(id) { closeModal(); await del('deleteInvoice', id); render(); }

// ── SUPPLIERS ────────────────────────────────────────────────

/** Categorie disponibili per i fornitori. */
const FORN_CATS = ['Cameraman', 'Fotografo', 'Drone', 'Post-produzione', 'Audio', 'Regia', 'Attore/Modello', 'Noleggio attrezzatura', 'Trasporti', 'Location', 'Grafica', 'Altro'];

/**
 * Renderizza la griglia fornitori con ricerca e filtro categoria.
 * @param {HTMLElement} c
 */
function renderSuppliers(c) {
  if (!filters.suppliers) filters.suppliers = { q: '', cat: '' };

  function filtered() {
    const q  = (filters.suppliers?.q || '').toLowerCase();
    const cf = filters.suppliers?.cat || '';
    return DB.fornitori.filter(f => {
      const mQ = !q || String(f.nome || '').toLowerCase().includes(q) || String(f.email || '').toLowerCase().includes(q);
      const mC = !cf || f.categoria === cf;
      return mQ && mC;
    });
  }

  function renderGrid() {
    const lista = filtered();
    const cnt   = document.getElementById('fornCount');
    if (cnt) cnt.textContent = lista.length + ' / ' + DB.fornitori.length + ' fornitori';
    const grid = document.getElementById('fornGrid');
    if (!grid) return;
    grid.innerHTML = lista.length ? lista.map(f => {
      const [bg, fg] = avatarColor(f.nome || '');
      const spese    = fornSpese(f.id);
      const totSpese = spese.reduce((s, e) => s + Number(e.importo || 0), 0);
      return `<div class="client-card" onclick="showFornDetail('${f.id}')">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div class="avatar" style="background:${bg};color:${fg};width:40px;height:40px;font-size:14px;border-radius:10px;flex-shrink:0">${initials(f.nome || '')}</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.nome || ''}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:1px">${f.email || f.categoria || ''}</div>
          </div>
        </div>
        <div class="client-stats">
          <div class="cstat"><div class="cstat-label">Spese</div><div class="cstat-val">${fmtEur(totSpese)}</div></div>
          <div class="cstat"><div class="cstat-label">Transazioni</div><div class="cstat-val">${spese.length}</div></div>
          <div class="cstat"><div class="cstat-label">Categoria</div><div class="cstat-val" style="font-size:11px">${f.categoria || '—'}</div></div>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:40px;color:var(--text3)">Nessun fornitore. Clicca "+ Nuovo fornitore".</div>';
  }

  c.innerHTML = `
  <div class="kpi-row kpi-row-3" style="margin-bottom:24px">
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Fornitori totali</div></div><div class="kpi-value">${DB.fornitori.length}</div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Categorie</div></div><div class="kpi-value">${new Set(DB.fornitori.map(f => f.categoria).filter(Boolean)).size}</div></div>
    <div class="kpi-card"><div class="kpi-top"><div class="kpi-label">Con tariffa</div></div><div class="kpi-value">${DB.fornitori.filter(f => f.tariffa).length}</div><div class="kpi-footer"><span class="kpi-delta inf">Tariffa impostata</span></div></div>
  </div>
  <div class="search-bar">
    <div class="search-wrap"><input class="search-input" id="fornSearch" placeholder="Cerca per nome o email..."><button class="search-clear" id="fornClear">×</button></div>
    <select class="filter-select" id="fornCat">
      <option value="">Tutte le categorie</option>
      ${FORN_CATS.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
    </select>
    <span class="results-count" id="fornCount"></span>
  </div>
  <div class="client-grid" id="fornGrid"></div>`;

  renderGrid();

  const fs = document.getElementById('fornSearch');
  fs.value = filters.suppliers.q || '';
  fs.addEventListener('input', function () { filters.suppliers.q = this.value; document.getElementById('fornClear').classList.toggle('vis', this.value.length > 0); renderGrid(); });
  const fc = document.getElementById('fornCat');
  fc.value = filters.suppliers.cat || '';
  fc.addEventListener('change', function () { filters.suppliers.cat = this.value; renderGrid(); });
  document.getElementById('fornClear').addEventListener('click', function () {
    filters.suppliers.q = ''; filters.suppliers.cat = '';
    fs.value = ''; fc.value = ''; this.classList.remove('vis'); renderGrid();
  });
}

/**
 * Apre il modal dettaglio fornitore con spese, progetti collegati e azioni modifica/elimina.
 * @param {string} id - ID fornitore
 */
function showFornDetail(id) {
  const f = DB.fornitori.find(x => String(x.id) === String(id));
  if (!f) return;
  const spese    = fornSpese(id);
  const totale   = spese.reduce((s, e) => s + Number(e.importo || 0), 0);
  const [bg, fg] = avatarColor(f.nome || '');
  document.getElementById('modalTitle').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div class="avatar" style="background:${bg};color:${fg};width:44px;height:44px;font-size:15px;border-radius:10px;flex-shrink:0">${initials(f.nome || '')}</div>
      <div><div style="font-size:16px;font-weight:600">${f.nome}</div><div style="font-size:12px;color:var(--text3);font-weight:400">${f.categoria || ''}</div></div>
    </div>`;
  document.getElementById('modalSub').textContent = '';
  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Totale pagato</div>
        <div style="font-size:22px;font-weight:700;color:var(--red)">${fmtEur(totale)}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Transazioni</div>
        <div style="font-size:22px;font-weight:700">${spese.length}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Email</div>
        <div style="font-size:13px;font-weight:500">${f.email || '—'}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Tariffa</div>
        <div style="font-size:13px;font-weight:500;color:var(--accent)">${f.tariffa ? fmtEur(f.tariffa) + '/g' : '—'}</div>
      </div>
    </div>
    ${spese.length ? `
    <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Transazioni</div>
    <div style="max-height:240px;overflow-y:auto">
      ${spese.sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(e => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500;color:var(--text)">${e.descrizione || ''}</div>
            <div style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px">${e.categoria || ''} · ${fmtDate(e.data)}${e.fonte === 'qonto' ? '<span style="background:var(--accent-light);color:var(--accent);font-size:10px;padding:1px 6px;border-radius:4px;font-weight:500">Qonto</span>' : ''}</div>
          </div>
          <div style="font-size:13px;font-weight:600;color:var(--red)">${fmtEur(e.importo)}</div>
        </div>`).join('')}
    </div>` : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">Nessuna transazione collegata.<br><span style="font-size:11px">Fai un Sync Qonto per collegare le spese ai fornitori.</span></div>'}
    ${(() => {
      const links = fornProgettiByForn(id);
      if (!links.length) return '<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text3);margin:14px 0 8px">Progetti</div><div style="font-size:13px;color:var(--text3)">Nessun progetto collegato.</div>';
      return '<div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text3);margin:14px 0 8px">Progetti</div>'
        + links.map(fp => {
          const proj = DB.progetti.find(x => String(x.id) === String(fp.progettoId));
          if (!proj) return '';
          return `<div onclick="closeModal();showDetail('project','${proj.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
            <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--accent)">${proj.nome}</div><div style="font-size:11px;color:var(--text3)">${fp.ruolo || ''}</div></div>
            ${projBadge[proj.stato] || ''}
            <span style="font-size:12px;color:var(--text3)">→</span>
          </div>`;
        }).join('');
    })()}
    <div style="display:flex;gap:8px;margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
      <button class="btn-ghost" style="flex:1" onclick="closeModal();openEditFornModal('${id}')">✎ Modifica</button>
      <button class="btn-danger" style="flex:1" onclick="closeModal();deleteForn('${id}')">Elimina</button>
    </div>`;
  document.getElementById('modalSaveBtn').textContent = 'Chiudi';
  document.getElementById('modalSaveBtn').style.cssText = 'background:var(--surface2);color:var(--text2);border:1px solid var(--border)';
  modalSaveFn = closeModal;
  document.getElementById('modalOverlay').classList.add('open');
}

/** Apre il modal per creare un nuovo fornitore. */
function openNewFornModal() {
  openModal('Nuovo fornitore', '', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome</label><input id="mf_fname" placeholder="es. Marco Rossi"></div>
      <div class="modal-field"><label>Categoria</label><select id="mf_fcat">${FORN_CATS.map(c => `<option>${c}</option>`).join('')}</select></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Email</label><input id="mf_femail" type="email"></div>
      <div class="modal-field"><label>Telefono</label><input id="mf_ftel"></div>
    </div>
    <div class="modal-field"><label>Tariffa giornaliera €</label><input id="mf_ftariffa" type="number" placeholder="0"></div>
    <div class="modal-field"><label>Note</label><textarea id="mf_fnote" placeholder="Specializzazioni, attrezzatura, disponibilità..."></textarea></div>`,
    async () => {
      const nome = document.getElementById('mf_fname').value.trim();
      if (!nome) return;
      await save('saveForn', {
        id: uid(), nome,
        categoria: document.getElementById('mf_fcat').value,
        email:     document.getElementById('mf_femail').value,
        tel:       document.getElementById('mf_ftel').value,
        tariffa:   parseFloat(document.getElementById('mf_ftariffa').value) || 0,
        note:      document.getElementById('mf_fnote').value,
      });
      closeModal(); render();
    });
}

/**
 * Apre il modal per modificare un fornitore esistente.
 * @param {string} id - ID fornitore
 */
function openEditFornModal(id) {
  const f = DB.fornitori.find(x => String(x.id) === String(id));
  if (!f) return;
  openModal('Modifica fornitore', f.nome, `
    <div class="modal-row">
      <div class="modal-field"><label>Nome</label><input id="mf_fname" value="${f.nome || ''}"></div>
      <div class="modal-field"><label>Categoria</label><select id="mf_fcat">${FORN_CATS.map(c => `<option ${f.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Email</label><input id="mf_femail" value="${f.email || ''}"></div>
      <div class="modal-field"><label>Telefono</label><input id="mf_ftel" value="${f.tel || ''}"></div>
    </div>
    <div class="modal-field"><label>Tariffa giornaliera €</label><input id="mf_ftariffa" type="number" value="${f.tariffa || 0}"></div>
    <div class="modal-field"><label>Note</label><textarea id="mf_fnote">${f.note || ''}</textarea></div>`,
    async () => {
      f.nome      = document.getElementById('mf_fname').value.trim() || f.nome;
      f.categoria = document.getElementById('mf_fcat').value;
      f.email     = document.getElementById('mf_femail').value;
      f.tel       = document.getElementById('mf_ftel').value;
      f.tariffa   = parseFloat(document.getElementById('mf_ftariffa').value) || 0;
      f.note      = document.getElementById('mf_fnote').value;
      await save('saveForn', f); closeModal(); render();
    });
}

/**
 * Elimina un fornitore dopo conferma nativa.
 * @param {string} id - ID fornitore
 * @returns {Promise<void>}
 */
async function deleteForn(id) {
  if (!confirm('Eliminare questo fornitore?')) return;
  await del('deleteForn', id); render();
}

// ── SYNC ─────────────────────────────────────────────────────

/**
 * Renderizza la pagina Sync Qonto con statistiche e pulsante sync manuale.
 * @param {HTMLElement} c
 */
function renderSync(c) {
  c.innerHTML = `<div class="card" style="max-width:520px">
    <div class="card-header"><div><div class="card-title">Sincronizzazione Qonto</div><div class="card-sub">Sync automatico ogni notte alle 3:00</div></div></div>
    <button class="btn-primary" onclick="doSync()">↺ Sincronizza ora</button>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
      <div class="info-field"><div class="info-label">Clienti</div><div style="font-size:22px;font-weight:700">${DB.clienti.length}</div></div>
      <div class="info-field"><div class="info-label">Fatture</div><div style="font-size:22px;font-weight:700">${DB.fatture.length}</div></div>
      <div class="info-field"><div class="info-label">Spese</div><div style="font-size:22px;font-weight:700">${DB.spese.length}</div></div>
    </div>
  </div>`;
}
