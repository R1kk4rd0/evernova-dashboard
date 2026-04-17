// ============================================================
// EVERNOVA DASHBOARD — Google Apps Script v5
// ============================================================

const QONTO_LOGIN  = 'evernova-s-r-l-7827';
const QONTO_SECRET = 'd362a4469134a57dd08d518fde14768b';

const SHEET_NAMES = {
  clienti:     'Clienti',
  fatture:     'Fatture',
  progetti:    'Progetti',
  costi:       'CostiProgetto',
  spese:       'Spese',
  fornitori:   'Fornitori',
  fornProgetti:'FornitoriProgetti',
  config:      'Config',
};

const QONTO_BASE = 'https://thirdparty.qonto.com/v2';

function doGet(e)  { return handleRequest(e, 'GET');  }
function doPost(e) { return handleRequest(e, 'POST'); }

function handleRequest(e, method) {
  try {
    const action = e.parameter?.action || '';
    const body   = method === 'POST' && e.postData ? JSON.parse(e.postData.contents) : {};
    let result;
    if      (action === 'ping')           result = { ok: true };
    else if (action === 'all')            result = readAll();
    else if (action === 'sync')           result = syncQonto();
    else if (action === 'saveClient')     result = saveRow(SHEET_NAMES.clienti,   body, clientHeaders());
    else if (action === 'deleteClient')   result = deleteRow(SHEET_NAMES.clienti,  body.id);
    else if (action === 'saveInvoice')    result = saveRow(SHEET_NAMES.fatture,   body, invoiceHeaders());
    else if (action === 'deleteInvoice')  result = deleteRow(SHEET_NAMES.fatture,  body.id);
    else if (action === 'saveProject')    result = saveRow(SHEET_NAMES.progetti,  body, projectHeaders());
    else if (action === 'deleteProject')  result = deleteRow(SHEET_NAMES.progetti, body.id);
    else if (action === 'saveCost')       result = saveRow(SHEET_NAMES.costi,     body, costHeaders());
    else if (action === 'deleteCost')     result = deleteRow(SHEET_NAMES.costi,   body.id);
    else if (action === 'saveExpense')    result = saveRow(SHEET_NAMES.spese,     body, expenseHeaders());
    else if (action === 'deleteExpense')  result = deleteRow(SHEET_NAMES.spese,   body.id);
    else if (action === 'saveForn')       result = saveRow(SHEET_NAMES.fornitori, body, fornitoriHeaders());
    else if (action === 'deleteForn')     result = deleteRow(SHEET_NAMES.fornitori, body.id);
    else if (action === 'saveFornProg')   result = saveRow(SHEET_NAMES.fornProgetti, body, fornProgettiHeaders());
    else if (action === 'deleteFornProg') result = deleteRow(SHEET_NAMES.fornProgetti, body.id);
    else if (action === 'saveGoals')      result = saveGoals(body.goals);
    else if (action === 'setConfigValue')  result = setConfigValue(body.chiave, body.valore);
    else if (action === 'assignExpense')  result = assignExpenseToProject(body);
    else result = { error: 'Azione non riconosciuta: ' + action };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function readAll() {
  ensureSheets();
  return {
    clienti:   sheetToObjects(SHEET_NAMES.clienti),
    fatture:   sheetToObjects(SHEET_NAMES.fatture),
    progetti:  sheetToObjects(SHEET_NAMES.progetti),
    costi:     sheetToObjects(SHEET_NAMES.costi),
    spese:     sheetToObjects(SHEET_NAMES.spese),
    fornitori:    sheetToObjects(SHEET_NAMES.fornitori),
    fornProgetti: sheetToObjects(SHEET_NAMES.fornProgetti),
    config:    sheetToObjects(SHEET_NAMES.config),
    goals:        readGoals(),
    saldo:     getSaldo(),
    lastSync:  getConfig('lastQontoSync'),
  };
}

function getSaldo() {
  try {
    const org = qontoFetch('/organizations/' + QONTO_LOGIN);
    const totale = org.organization.bank_accounts.reduce((s, acc) => s + acc.balance_cents, 0);
    return { balance: totale / 100 };
  } catch(e) { return { balance: 0, error: e.message }; }
}

function syncQonto() {
  ensureSheets();
  const results = { clientiImportati:0, fattureImportate:0, speseImportate:0, beneficiariImportati:0, errors:[] };
  try {
    const org = qontoFetch('/organizations/' + QONTO_LOGIN);
    results.clientiImportati = syncClienti();
    results.fattureImportate = syncFatture();
    const ibans = org.organization.bank_accounts.map(acc => acc.iban);
    for (const iban of ibans) {
      results.speseImportate += syncSpese(iban);
    }
    results.beneficiariImportati = syncBeneficiari();
    setConfig('lastQontoSync', new Date().toISOString());
    results.ok = true;
  } catch(err) { results.errors.push(err.message); }
  return results;
}

function syncClienti() {
  let importati = 0;
  const existing  = sheetToObjects(SHEET_NAMES.clienti);
  const byQontoId = new Map(existing.map(r => [String(r.qontoId||''), r]).filter(([k]) => k));
  const byNome    = new Map(existing.map(r => [normalizeNome(r.nome||''), r]).filter(([k]) => k));
  try {
    let nextPage = null, pageCount = 0;
    do {
      const path = '/clients?per_page=50' + (nextPage ? '&after_cursor=' + nextPage : '');
      const data = qontoFetch(path);
      const clients = data.clients || [];
      clients.forEach(cl => {
        const nome = extractNome(cl);
        const nomeKey = normalizeNome(nome);
        if (byQontoId.has(cl.id)) return;
        if (byNome.has(nomeKey)) {
          const ex = byNome.get(nomeKey);
          if (!ex.qontoId) {
            ex.qontoId = cl.id;
            ex.email = ex.email || cl.email || '';
            ex.tel   = ex.tel   || cl.phone_number || '';
            ex.piva  = ex.piva  || cl.vat_number || '';
            ex.citta = ex.citta || cl.city || '';
            saveRow(SHEET_NAMES.clienti, ex, clientHeaders());
          }
          return;
        }
        const row = {
          id: 'Q_' + cl.id, qontoId: cl.id, nome,
          tipo: 'Cliente Qonto',
          email: cl.email || '', tel: cl.phone_number || cl.phone || '',
          piva: cl.vat_number || '', citta: cl.city || '', note: '',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        appendRow(SHEET_NAMES.clienti, row, clientHeaders());
        byQontoId.set(cl.id, row);
        byNome.set(nomeKey, row);
        importati++;
      });
      nextPage = data.meta?.next_cursor || null;
      pageCount++;
    } while (nextPage && pageCount < 10);
  } catch(e) {
    Logger.log('Fallback clienti da fatture: ' + e.message);
    const fatture = qontoFetch('/client_invoices?per_page=50').client_invoices || [];
    fatture.forEach(inv => {
      if (!inv.client) return;
      const nome = extractNome(inv.client);
      const nomeKey = normalizeNome(nome);
      if (byNome.has(nomeKey) || byQontoId.has(inv.client.id||'')) return;
      const row = {
        id: 'Q_' + inv.client.id, qontoId: inv.client.id, nome,
        tipo:'Cliente Qonto', email:inv.client.email||'', tel:'', piva:'', citta:'', note:'',
        createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      };
      appendRow(SHEET_NAMES.clienti, row, clientHeaders());
      byQontoId.set(inv.client.id, row);
      byNome.set(nomeKey, row);
      importati++;
    });
  }
  return importati;
}

function syncFatture() {
  let importate = 0;
  const existingFatture  = sheetToObjects(SHEET_NAMES.fatture);
  const byQontoId        = new Map(existingFatture.map(r => [String(r.qontoId||''), r]).filter(([k]) => k));
  const clienti          = sheetToObjects(SHEET_NAMES.clienti);
  const clienteByNome    = new Map(clienti.map(c => [normalizeNome(c.nome||''), c]));
  const clienteByQontoId = new Map(clienti.map(c => [String(c.qontoId||''), c]).filter(([k]) => k));

  let nextPage = null, pageCount = 0;
  do {
    const path = '/client_invoices?per_page=50&sort_by=issue_date:desc' +
                 (nextPage ? '&page=' + nextPage : '');
    const data = qontoFetch(path);
    const invoices = data.client_invoices || [];
    invoices.forEach(inv => {
      if (byQontoId.has(inv.id)) {
        const ex = byQontoId.get(inv.id);
        const nuovoStato = mapStato(inv.status);
        if (ex.stato !== nuovoStato) {
          ex.stato = nuovoStato;
          ex.updatedAt = new Date().toISOString();
          saveRow(SHEET_NAMES.fatture, ex, invoiceHeaders());
        }
        return;
      }
      let clienteId = '', clienteNome = '';
      if (inv.client) {
        clienteNome = extractNome(inv.client);
        const cl = clienteByQontoId.get(inv.client.id||'')
                || clienteByNome.get(normalizeNome(clienteNome));
        if (cl) clienteId = String(cl.id);
      }
      const row = {
        id: 'Q_' + inv.id, qontoId: inv.id,
        clienteId, clienteNome,
        descrizione: inv.number || 'Fattura Qonto',
        importo: (inv.total_amount_cents || 0) / 100,
        stato: mapStato(inv.status),
        data: inv.issue_date || '', scadenza: inv.due_date || '',
        fonte: 'qonto',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        invoiceUrl: inv.invoice_url || '',
        itemTitolo: (inv.items && inv.items[0]) ? (inv.items[0].title || inv.items[0].description || '') : '',
        tipoFattura: inv.invoice_type || 'standard',
      };
      appendRow(SHEET_NAMES.fatture, row, invoiceHeaders());
      byQontoId.set(inv.id, row);
      importate++;
    });
    Logger.log('Pagina ' + data.meta?.current_page + '/' + data.meta?.total_pages + ' — fatture: ' + invoices.length);
    nextPage = (data.meta?.current_page < data.meta?.total_pages)
               ? (data.meta.current_page + 1) : null;
    pageCount++;
  } while (nextPage && pageCount < 100);
  return importate;
}

function syncSpese(iban) {
  let importate = 0;
  const existing      = sheetToObjects(SHEET_NAMES.spese);
  const existingIds   = new Set(existing.map(r => String(r.qontoId||'')).filter(Boolean));
  const fornitori     = sheetToObjects(SHEET_NAMES.fornitori);
  const fornByNome    = new Map(fornitori.map(f => [normalizeNome(f.nome||''), f]).filter(([k]) => k));
  const progetti      = sheetToObjects(SHEET_NAMES.progetti);
  const progettiAttivi= new Set(progetti.filter(p => p.stato === 'active').map(p => String(p.id)));
  const fornProgs     = sheetToObjects(SHEET_NAMES.fornProgetti);
  // fornitoreId → list of active progettoIds linked to that fornitore
  const fornToProj    = new Map();
  fornProgs.forEach(fp => {
    const fid = String(fp.fornitoreId), pid = String(fp.progettoId);
    if (!progettiAttivi.has(pid)) return;
    if (!fornToProj.has(fid)) fornToProj.set(fid, []);
    fornToProj.get(fid).push(pid);
  });

  let nextPage = null, pageCount = 0;
  do {
    const path = '/transactions?slug=' + QONTO_LOGIN +
                 '&iban=' + iban +
                 '&side=debit&per_page=50&sort_by=emitted_at:desc' +
                 (nextPage ? '&page=' + nextPage : '');
    const data = qontoFetch(path);
    const txs  = data.transactions || [];
    txs.forEach(tx => {
      if (tx.category === 'treasury_and_interco') return;
      if (existingIds.has(tx.id)) return;
      const fornKey = normalizeNome(tx.counterpart_name||tx.label||'');
      const forn = fornByNome.get(fornKey) || matchFornitore(fornKey, fornitori);
      const fornId = forn ? String(forn.id) : '';
      const linkedProjs = fornId ? (fornToProj.get(fornId) || []) : [];
      const autoProj = linkedProjs.length === 1 ? linkedProjs[0] : '';
      appendRow(SHEET_NAMES.spese, {
        id: 'Q_TX_' + tx.id, qontoId: tx.id,
        descrizione: tx.label || tx.reference || 'Transazione',
        categoria: mapCategoria(tx.category),
        categoriaQonto: tx.category || '',
        importo: (tx.amount_cents || 0) / 100,
        data: (tx.settled_at || tx.emitted_at || '').split('T')[0],
        progettoId: autoProj, fornitoreId: fornId,
        fonte: 'qonto',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }, expenseHeaders());
      existingIds.add(tx.id);
      importate++;
    });
    nextPage = (data.meta?.current_page < data.meta?.total_pages)
               ? (data.meta.current_page + 1) : null;
    pageCount++;
  } while (nextPage && pageCount < 100);
  setConfig('lastSpesaSync', new Date().toISOString());
  return importate;
}

function assignExpenseToProject(body) {
  const sheet   = getSheet(SHEET_NAMES.spese);
  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idCol   = headers.indexOf('id');
  const projCol = headers.indexOf('progettoId');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(body.spesaId)) {
      sheet.getRange(i + 1, projCol + 1).setValue(body.progettoId);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Spesa non trovata' };
}

function extractNome(obj) {
  if (!obj) return 'Cliente senza nome';
  if (obj.name && obj.name.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(obj.name.trim())) {
    return obj.name.trim();
  }
  const candidati = [
    obj.company_name, obj.trading_name,
    (obj.first_name && obj.last_name) ? obj.first_name + ' ' + obj.last_name : null,
    obj.first_name, obj.last_name,
    obj.email ? obj.email.split('@')[0] : null,
  ];
  for (const c of candidati) {
    if (c && c.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(c.trim())) return c.trim();
  }
  return 'Cliente ' + (obj.id || '').substring(0, 8).toUpperCase();
}

function normalizeNome(nome) {
  return (nome || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function stripLegalSuffix(nome) {
  return nome
    .replace(/\b(s ?r ?l ?s?|s ?p ?a|s ?n ?c|s ?a ?s|ltd|limited|gmbh|ag|bv|inc|llc|s ?a|nv|plc|oy|ab)\b/g, '')
    .replace(/\s+/g, ' ').trim();
}

function matchFornitore(descNorm, fornitori) {
  const descClean = stripLegalSuffix(descNorm);
  let best = null, bestScore = 0;
  for (const f of fornitori) {
    const fornNorm = normalizeNome(f.nome || '');
    const fornClean = stripLegalSuffix(fornNorm);
    if (!fornClean || fornClean.length < 3) continue;
    // Exact
    if (descNorm === fornNorm) return f;
    // Bidirectional substring (cleaned)
    if (descClean.includes(fornClean) || fornClean.includes(descClean)) {
      const score = fornClean.length;
      if (score > bestScore) { best = f; bestScore = score; }
      continue;
    }
    // Token overlap — any word >3 chars in common
    const descTokens = descClean.split(' ').filter(t => t.length > 3);
    const fornTokens = fornClean.split(' ').filter(t => t.length > 3);
    for (const dt of descTokens) {
      for (const ft of fornTokens) {
        if (dt === ft && dt.length > bestScore) { best = f; bestScore = dt.length; }
      }
    }
  }
  return bestScore >= 4 ? best : null;
}

function mapStato(s) {
  const m = { paid:'paid', draft:'draft', pending:'pending', unpaid:'pending', cancelled:'annullata', canceled:'annullata' };
  return m[s] || s || 'draft';
}

function mapCategoria(cat) {
  const m = {
    'software':'Software','saas':'Software','it_and_electronics':'Software','online_service':'Software',
    'advertising':'Marketing','marketing':'Marketing',
    'travel':'Trasferta','transport':'Trasferta','hotel_and_lodging':'Trasferta',
    'restaurant_and_bar':'Ristorazione','food_and_grocery':'Ristorazione',
    'equipment':'Attrezzatura','office_supplies':'Ufficio',
    'rent':'Affitto','utilities':'Utenze','insurance':'Assicurazioni',
    'bank_fees':'Banca','fees':'Banca',
    'taxes':'Tasse','tax':'Tasse',
    'payroll':'Personale','freelance':'Collaboratori',
    'other_expense':'Varie','other_service':'Varie',
    'training':'Formazione','legal':'Consulenze','accounting':'Consulenze',
  };
  return m[cat] || 'Altro';
}

function saveGoals(goals) { setConfig('goals', JSON.stringify(goals)); return { ok: true }; }
function readGoals() {
  const raw = getConfig('goals');
  if (!raw) return [
    { label:'Fatturato mensile', current:0, target:5000 },
    { label:'Retainer attivi',   current:0, target:5 },
    { label:'Lead qualificati',  current:0, target:5 },
  ];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function setConfigValue(chiave, valore) {
  setConfig(chiave, valore);
  return { ok: true };
}

function saveRow(sheetName, data, headers) {
  ensureSheets();
  if (!data.id) data.id = 'ID_' + Date.now();
  data.updatedAt = new Date().toISOString();
  if (!data.createdAt) data.createdAt = new Date().toISOString();
  const sheet = getSheet(sheetName);
  const rows  = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(data.id)) {
      sheet.getRange(i + 1, 1, 1, headers.length)
           .setValues([headers.map(h => data[h] !== undefined ? data[h] : rows[i][headers.indexOf(h)])]);
      return { ok:true, action:'updated', id:data.id };
    }
  }
  appendRow(sheetName, data, headers);
  return { ok:true, action:'created', id:data.id };
}

function deleteRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const rows  = sheet.getDataRange().getValues();
  const idCol = rows[0].indexOf('id');
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][idCol]) === String(id)) { sheet.deleteRow(i + 1); return { ok:true }; }
  }
  return { ok:false, error:'Non trovato: ' + id };
}

function getConfig(key) {
  const sheet = getSheet(SHEET_NAMES.config);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { if (data[i][0] === key) return data[i][1]; }
  return null;
}
function setConfig(key, value) {
  const sheet = getSheet(SHEET_NAMES.config);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) { sheet.getRange(i + 1, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
}

function qontoFetch(path) {
  const res = UrlFetchApp.fetch(QONTO_BASE + path, {
    method: 'get',
    headers: { 'Authorization': QONTO_LOGIN + ':' + QONTO_SECRET },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Qonto HTTP ' + code + ': ' + res.getContentText().substring(0, 300));
  return JSON.parse(res.getContentText());
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function appendRow(sheetName, data, headers) {
  getSheet(sheetName).appendRow(headers.map(h => data[h] !== undefined ? data[h] : ''));
}
function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => { const obj = {}; headers.forEach((h, i) => { obj[h] = row[i]; }); return obj; });
}
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function ensureSheets() {
  setupSheet(SHEET_NAMES.clienti,   clientHeaders());
  setupSheet(SHEET_NAMES.fatture,   invoiceHeaders());
  setupSheet(SHEET_NAMES.progetti,  projectHeaders());
  setupSheet(SHEET_NAMES.costi,     costHeaders());
  setupSheet(SHEET_NAMES.spese,     expenseHeaders());
  setupSheet(SHEET_NAMES.fornitori,    fornitoriHeaders());
  setupSheet(SHEET_NAMES.fornProgetti, fornProgettiHeaders());
  setupSheet(SHEET_NAMES.config,       ['chiave', 'valore']);
}
function setupSheet(name, headers) {
  const sheet = getSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function clientHeaders()    { return ['id','qontoId','nome','tipo','email','tel','piva','citta','note','createdAt','updatedAt']; }
function invoiceHeaders()   { return ['id','qontoId','clienteId','clienteNome','descrizione','importo','stato','data','scadenza','fonte','createdAt','updatedAt','invoiceUrl','itemTitolo','tipoFattura']; }
function projectHeaders()   { return ['id','nome','clienteId','tipo','stato','dataInizio','dataFine','budget','avanzamento','responsabile','note','createdAt','updatedAt']; }
function costHeaders()      { return ['id','progettoId','descrizione','categoria','importo','data','createdAt','updatedAt','fornitoreId']; }
function expenseHeaders()   { return ['id','qontoId','descrizione','categoria','categoriaQonto','importo','data','progettoId','fonte','createdAt','updatedAt','fornitoreId']; }
function fornitoriHeaders()   { return ['id','nome','categoria','email','tel','tariffa','note','createdAt','updatedAt']; }
function fornProgettiHeaders(){ return ['id','fornitoreId','progettoId','ruolo','note','createdAt','updatedAt']; }

function syncBeneficiari() {
  const existing = sheetToObjects(SHEET_NAMES.fornitori);
  const byNome = new Map(existing.map(f => [normalizeNome(f.nome||''), f]));
  let importati = 0;
  let nextPage = null, pageCount = 0;
  do {
    const path = '/beneficiaries?per_page=50' + (nextPage ? '&page=' + nextPage : '');
    const data = qontoFetch(path);
    (data.beneficiaries || []).forEach(b => {
      const nomeKey = normalizeNome(b.name||'');
      if (byNome.has(nomeKey)) return;
      appendRow(SHEET_NAMES.fornitori, {
        id: 'Q_BENE_' + b.id,
        nome: b.name || '',
        categoria: 'Altro',
        email: '', tel: '',
        tariffa: 0, note: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, fornitoriHeaders());
      importati++;
    });
    nextPage = (data.meta?.current_page < data.meta?.total_pages)
               ? (data.meta.current_page + 1) : null;
    pageCount++;
  } while (nextPage && pageCount < 10);
  Logger.log('Beneficiari importati: ' + importati);
  return importati;
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncQonto').timeBased().atHour(3).everyDays(1).create();
  Logger.log('Trigger installato: sync ogni notte alle 3:00');
}

function testSetup() {
  ensureSheets();
  Logger.log('Fogli OK · Saldo: ' + JSON.stringify(getSaldo()));
}

function testSync() {
  const result = syncQonto();
  Logger.log('Sync: ' + JSON.stringify(result));
}

function fixJoin() {
  const clienti = sheetToObjects(SHEET_NAMES.clienti);
  const byNome  = new Map(clienti.map(c => [normalizeNome(c.nome||''), c]));
  const sheet   = getSheet(SHEET_NAMES.fatture);
  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const cIdCol  = headers.indexOf('clienteId');
  const cNmCol  = headers.indexOf('clienteNome');
  const updCol  = headers.indexOf('updatedAt');
  let fixed = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cIdCol]||'').trim()) continue;
    const nome = String(rows[i][cNmCol]||'').trim();
    if (!nome) continue;
    const cl = byNome.get(normalizeNome(nome));
    if (cl) {
      sheet.getRange(i+1, cIdCol+1).setValue(cl.id);
      sheet.getRange(i+1, updCol+1).setValue(new Date().toISOString());
      fixed++;
    }
  }
  Logger.log('Fix join: ' + fixed + ' fatture collegate');
}

function linkSpeseFornitori() {
  const fornitori = sheetToObjects(SHEET_NAMES.fornitori);
  const sheet     = getSheet(SHEET_NAMES.spese);
  const rows      = sheet.getDataRange().getValues();
  const headers   = rows[0];
  const fornIdCol = headers.indexOf('fornitoreId');
  const descCol   = headers.indexOf('descrizione');
  let linked = 0, skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][fornIdCol] || '').trim()) { skipped++; continue; }
    const desc = normalizeNome(String(rows[i][descCol] || ''));
    if (!desc) continue;
    const forn = matchFornitore(desc, fornitori);
    if (forn) {
      sheet.getRange(i + 1, fornIdCol + 1).setValue(forn.id);
      linked++;
    }
  }
  Logger.log('linkSpeseFornitori — collegate: ' + linked + ' | già collegate: ' + skipped + ' | totale: ' + (rows.length - 1));
  return { linked, skipped };
}

function migrateCostColumns() {
  const sheet = getSheet(SHEET_NAMES.costi);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.includes('fornitoreId')) {
    Logger.log('fornitoreId già presente in CostiProgetto');
    return;
  }
  const newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue('fornitoreId').setFontWeight('bold');
  Logger.log('Aggiunta colonna fornitoreId a CostiProgetto');
}

function migrateInvoiceColumns() {
  const sheet = getSheet(SHEET_NAMES.fatture);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  ['invoiceUrl', 'itemTitolo', 'tipoFattura'].forEach(col => {
    if (!headers.includes(col)) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(col).setFontWeight('bold');
      Logger.log('Aggiunta colonna: ' + col);
    } else {
      Logger.log('Colonna già presente: ' + col);
    }
  });
}

function debugFatturaRaw() {
  const data = qontoFetch('/client_invoices?per_page=1&sort_by=issue_date:desc');
  Logger.log(JSON.stringify(data.client_invoices[0], null, 2));
}

function debugFattureRecenti() {
  const data = qontoFetch('/client_invoices?per_page=5&sort_by=issue_date:desc');
  Logger.log('Meta: ' + JSON.stringify(data.meta));
  data.client_invoices.forEach(inv => {
    Logger.log(inv.issue_date + ' | ' + (inv.client?.name||'?') + ' | €' + (inv.total_amount_cents/100) + ' | status: ' + inv.status + ' | id: ' + inv.id.substring(0,8));
  });
}

function importProjects2026() {
  ensureSheets();
  const clienti   = sheetToObjects(SHEET_NAMES.clienti);
  const byNome    = new Map(clienti.map(c => [normalizeNome(c.nome||''), c]));
  const existing  = sheetToObjects(SHEET_NAMES.progetti);
  const existNomi = new Set(existing.map(p => normalizeNome(p.nome||'')));

  const dati = [
    // num, data,         cliente,                              note,                            imponibile, pagato, fatturato, costi
    ['078','2026-01-06','Lungoparma',                          'Cena Milano',                        200,  true,  true,     0],
    ['079','2026-01-06','Lungoparma',                          'Video Parma castello + rimborso',    1000, true,  true,     0],
    ['080','2026-01-06','Mapei',                               'Video Sassuolo',                     2200, false, true,     0],
    ['081','2026-01-06','Montanari',                           'Video evento + rimborsi',            1200, true,  true,     0],
    ['082','2026-01-06','Mapei',                               'Video Natale',                       6000, false, true,  1758.48],
    ['',   '2026-02-09','NoSparo',                             'Contenuti set-ott-nov 2025',         1500, true,  true,     0],
    ['083','2026-01-06','Mapei',                               'Foto Cafiero gocce',                  600, false, true,     0],
    ['084','2026-01-06','Fitness and Beauty',                  'Video Macchinari',                   1100, true,  true,     0],
    ['085','2026-01-06','Fresh Ramen',                         'Reels ristorante Ramen',              600, true,  true,     0],
    ['086','2026-01-06','Advertor',                            'Editing reels dicembre',              950, true,  true,     0],
    ['087','2026-01-31','Sant&Santi',                          'Video in studio',                     600, true,  true,     0],
    ['088','2026-04-15','Intervista Matteo Della Valle Filippo','Intervista Filippo',                 1100, false, true,    0],
    ['089','2026-02-09','Advertor',                            'Editing Gennaio',                     950, true,  true,     0],
    ['090','2026-02-13','Fresh Ramen',                         'Reels ristorante Ramen feb',          850, true,  true,     0],
    ['091','2026-03-02','Advertor',                            'Editing Febbraio',                    950, true,  true,     0],
    ['092','2026-03-10','Cigierre',                            'Video e Foto Smashie',               1200, true,  true,     0],
    ['093','2026-03-27','Mapei Roma',                          '3000 ambulacri',                     3000, false, true,   450],
    ['094','2026-04-15','NoSparo',                             'Contenuti Marzo',                     500, true,  true,     0],
    ['095','2026-04-15','Advertor',                            'Editing Marzo',                       950, true,  true,     0],
    ['096','2026-04-15','Milena Fitness',                      'Video Fitness Credaro 1500',          1500, false, true,    0],
    ['097','2026-04-15','MD Accademy',                         'Video MD Accademy Milano',            1500, false, true,    0],
    ['098','2026-04-17','Gioele',                              'ADV Locale Gallarate',                 650, false, false,   0],
  ];

  let inseriti = 0, saltati = 0;
  const progettiConCosti = [];

  dati.forEach(([num, data, cliente, note, imponibile, pagato, fatturato, costi]) => {
    const nome = num ? (num + ' - ' + note) : note;
    if (existNomi.has(normalizeNome(nome))) { saltati++; return; }
    const cl    = byNome.get(normalizeNome(cliente)) || null;
    const stato = pagato ? 'done' : 'active';
    const prog  = pagato ? 100 : (fatturato ? 80 : 40);
    const id    = 'P26_' + (num || Date.now() + '_' + inseriti);
    appendRow(SHEET_NAMES.progetti, {
      id, nome,
      clienteId:    cl ? String(cl.id) : '',
      tipo:         'Video',
      stato,
      dataInizio:   data,
      dataFine:     pagato ? data : '',
      budget:       imponibile,
      avanzamento:  prog,
      responsabile: 'Riccardo',
      note:         num ? 'Prog. ' + num : '',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }, projectHeaders());
    if (costi > 0) progettiConCosti.push({ id, costi });
    inseriti++;
  });

  progettiConCosti.forEach(p => {
    appendRow(SHEET_NAMES.costi, {
      id:          'C26_' + p.id,
      progettoId:  p.id,
      descrizione: 'Costi produzione',
      categoria:   'Collaboratori',
      importo:     p.costi,
      data:        new Date().toISOString().split('T')[0],
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    }, costHeaders());
  });

  Logger.log('importProjects2026 — inseriti: ' + inseriti + ' | saltati (già presenti): ' + saltati + ' | costi inseriti: ' + progettiConCosti.length);
}
