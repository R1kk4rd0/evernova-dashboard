// ─────────────────────────────────────────────────────────────
// CHARTS — Revenue bar chart & Cashflow mixed chart
// ─────────────────────────────────────────────────────────────

function renderRevChart(year) {
  revYear = year;
  const pillsEl = document.getElementById('revYearPills');
  if (pillsEl) {
    const revAnni = [...new Set(DB.fatture.filter(i => getStatoEffettivo(i) === 'paid').map(i => (i.data || '').substring(0, 4)).filter(Boolean))].sort().reverse();
    pillsEl.innerHTML = [['', 'Tutti'], ...revAnni.map(y => [y, y])].map(([v, l]) =>
      `<button class="pill ${revYear === v ? 'active' : 'inactive'}" style="font-size:11px;padding:4px 10px" onclick="revYear='${v}';renderRevChart('${v}')">${l}</button>`
    ).join('');
  }
  if (charts.rev) { try { charts.rev.destroy(); } catch (e) {} delete charts.rev; }
  const fatturePagate = DB.fatture.filter(i => {
    if (getStatoEffettivo(i) !== 'paid') return false;
    if (year && !(i.data || '').startsWith(year)) return false;
    return true;
  });
  const byClient = {};
  fatturePagate.forEach(i => {
    const n = i.clienteNome || clientName(i.clienteId);
    byClient[n] = (byClient[n] || 0) + Number(i.importo || 0);
  });
  const sorted = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const trunc = (s, n = 24) => s.length > n ? s.substring(0, n) + '…' : s;
  if (!sorted.length) return;
  charts.rev = new Chart(document.getElementById('revChart'), {
    type: 'bar',
    data: {
      labels: sorted.map(e => trunc(e[0])),
      datasets: [{ data: sorted.map(e => e[1]), backgroundColor: '#4F46E5', borderRadius: [0, 6, 6, 0], borderSkipped: false, barThickness: 22 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmtEur(ctx.raw) } } },
      onClick: (evt, els) => {
        if (!els.length) return;
        const nome = sorted[els[0].index][0];
        filters.invoices.q = nome;
        filters.invoices.anno = year || '';
        navTo('invoices');
      },
      onHover: (evt, els) => { if (evt.native) evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      scales: {
        x: { ticks: { font: { size: 11 }, color: '#9CA3AF', callback: v => '€' + Number(v).toLocaleString('it-IT') }, grid: { color: '#F3F4F6' }, border: { display: false } },
        y: { ticks: { font: { size: 12, weight: '500' }, color: '#374151' }, grid: { display: false }, border: { display: false } }
      }
    }
  });
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getMonthLabel(key) {
  if (!key) return '';
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
}

function buildMixedCashflowMonths() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return months;
}

function buildCashflowMonths(year) {
  const months = [];
  if (year) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(Number(year), m, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return months;
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return months;
}

function getInvoiceForecastByMonth(year) {
  const months = buildCashflowMonths(year);
  const result = Object.fromEntries(months.map(month => [month, 0]));
  DB.fatture.forEach(inv => {
    const status = getStatoEffettivo(inv);
    if (['paid', 'draft', 'annullata', 'nota'].includes(status)) return;
    const key = getMonthKey(inv.scadenza || inv.data || '');
    if (result[key] !== undefined) result[key] += Number(inv.importo || 0);
  });
  return result;
}

function getExpensesByMonth(year) {
  const months = buildCashflowMonths(year);
  const result = Object.fromEntries(months.map(month => [month, 0]));
  DB.spese.forEach(exp => {
    const key = getMonthKey(exp.data || '');
    if (result[key] !== undefined) result[key] += Number(exp.importo || 0);
  });
  return result;
}

function renderCashflowChart(year) {
  cashflowYear = year;
  const pillsEl = document.getElementById('cashflowYearPills');
  if (pillsEl) {
    const now = new Date();
    const years = [
      ['mixed', 'Storico + Prev.'],
      ['', 'Prossimi 12m'],
      [String(now.getFullYear()), String(now.getFullYear())],
      [String(now.getFullYear() + 1), String(now.getFullYear() + 1)],
    ];
    pillsEl.innerHTML = years.map(([value, label]) =>
      `<button class="pill ${cashflowYear === value ? 'active' : 'inactive'}" style="font-size:11px;padding:4px 10px" onclick="cashflowYear='${value}';renderCashflowChart('${value}')">${label}</button>`
    ).join('');
  }
  if (charts.cashflow) { try { charts.cashflow.destroy(); } catch (e) {} delete charts.cashflow; }

  const canvasEl = document.getElementById('cashflowChart');
  const chartCtx = canvasEl.getContext('2d');
  const currentMonthKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');

  function stripePattern(color) {
    const sz = 8;
    const c = document.createElement('canvas');
    c.width = sz; c.height = sz;
    const cx = c.getContext('2d');
    cx.clearRect(0, 0, sz, sz);
    cx.strokeStyle = color;
    cx.lineWidth = 1.8;
    cx.globalAlpha = 0.55;
    cx.beginPath(); cx.moveTo(0, sz); cx.lineTo(sz, 0); cx.stroke();
    cx.beginPath(); cx.moveTo(-sz, sz); cx.lineTo(0, 0); cx.stroke();
    cx.beginPath(); cx.moveTo(sz, sz * 2); cx.lineTo(sz * 2, sz); cx.stroke();
    return chartCtx.createPattern(c, 'repeat');
  }

  let months, revenueData, costData, greenBg, redBg, barThickness;

  if (year === 'mixed') {
    months = buildMixedCashflowMonths();
    barThickness = 11;

    const actualRevByMonth = Object.fromEntries(months.map(m => [m, 0]));
    DB.fatture.forEach(inv => {
      if (getStatoEffettivo(inv) !== 'paid') return;
      const key = getMonthKey(inv.data || '');
      if (actualRevByMonth[key] !== undefined) actualRevByMonth[key] += Number(inv.importo || 0);
    });

    const forecastRevByMonth = Object.fromEntries(months.map(m => [m, 0]));
    DB.fatture.forEach(inv => {
      const status = getStatoEffettivo(inv);
      if (['paid', 'draft', 'annullata', 'nota'].includes(status)) return;
      const key = getMonthKey(inv.scadenza || inv.data || '');
      if (forecastRevByMonth[key] !== undefined) forecastRevByMonth[key] += Number(inv.importo || 0);
    });

    const actualExpByMonth = Object.fromEntries(months.map(m => [m, 0]));
    DB.spese.forEach(exp => {
      const key = getMonthKey(exp.data || '');
      if (actualExpByMonth[key] !== undefined) actualExpByMonth[key] += Number(exp.importo || 0);
    });

    const monthlyRetainer = getMonthlyClientsRevenue();
    const fixedCost = getFixedCosts();

    revenueData = months.map(key =>
      key < currentMonthKey ? actualRevByMonth[key] : (forecastRevByMonth[key] || 0) + monthlyRetainer
    );
    costData = months.map(key =>
      key < currentMonthKey ? actualExpByMonth[key] : fixedCost
    );

    const gStripe = stripePattern('#16A34A');
    const rStripe = stripePattern('#DC2626');
    greenBg = months.map(key => key <= currentMonthKey ? '#16A34A' : gStripe);
    redBg   = months.map(key => key <= currentMonthKey ? '#DC2626' : rStripe);

  } else {
    months = buildCashflowMonths(year);
    barThickness = 16;
    const invoiceForecast = getInvoiceForecastByMonth(year);
    const expenseByMonth  = getExpensesByMonth(year);
    const monthlyRevenue  = getMonthlyClientsRevenue();
    const fixedCost       = getFixedCosts();
    revenueData = months.map(key => invoiceForecast[key] + monthlyRevenue);
    costData    = months.map(key => fixedCost + (expenseByMonth[key] || 0));
    greenBg = '#16A34A';
    redBg   = '#DC2626';
  }

  const currentIdx = months.findIndex(m => m === currentMonthKey);
  const anchorIdx  = currentIdx >= 0 ? currentIdx : 0;
  const netMonthly = revenueData.map((v, i) => v - costData[i]);
  const saldoData  = new Array(months.length);
  saldoData[anchorIdx] = DB.saldo.balance;
  for (let i = anchorIdx + 1; i < months.length; i++)
    saldoData[i] = saldoData[i - 1] + netMonthly[i];
  for (let i = anchorIdx - 1; i >= 0; i--)
    saldoData[i] = saldoData[i + 1] - netMonthly[i + 1];

  charts.cashflow = new Chart(canvasEl, {
    type: 'bar',
    data: {
      labels: months.map(getMonthLabel),
      datasets: [
        {
          label: 'Ricavi',
          data: revenueData,
          backgroundColor: greenBg,
          borderRadius: 4,
          barThickness: barThickness,
          order: 2,
          yAxisID: 'yBars'
        },
        {
          label: 'Costi',
          data: costData,
          backgroundColor: redBg,
          borderRadius: 4,
          barThickness: barThickness,
          order: 2,
          yAxisID: 'yBars'
        },
        {
          label: 'Saldo Qonto',
          data: saldoData,
          type: 'line',
          borderColor: '#4F46E5',
          backgroundColor: 'rgba(79,70,229,0.08)',
          fill: false,
          tension: 0.38,
          pointRadius: months.map(key => key === currentMonthKey ? 5 : 2.5),
          pointBackgroundColor: months.map(key => key === currentMonthKey ? '#4F46E5' : '#fff'),
          pointBorderColor: '#4F46E5',
          pointBorderWidth: 2,
          borderWidth: 2.5,
          order: 1,
          yAxisID: 'ySaldo'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + fmtEur(Math.abs(ctx.raw || 0))
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: ctx => months[ctx.index] === currentMonthKey ? '#4F46E5' : '#6B7280',
            font: { size: 11 }
          }
        },
        yBars: {
          position: 'left',
          grid: { color: '#F3F4F6' },
          ticks: { callback: v => '€' + Number(v / 1000).toLocaleString('it-IT') + 'K', color: '#6B7280', font: { size: 10 } }
        },
        ySaldo: {
          position: 'right',
          grid: { display: false },
          ticks: { callback: v => '€' + Number(v / 1000).toLocaleString('it-IT') + 'K', color: '#9CA3AF', font: { size: 10 } }
        }
      }
    }
  });
}
