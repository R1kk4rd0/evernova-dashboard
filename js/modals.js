// ─────────────────────────────────────────────────────────────
// MODALS — CRUD: clienti, fatture, progetti, costi
//           CONFIG: obiettivi, clienti ricorrenti, costi fissi
// ─────────────────────────────────────────────────────────────

/** Apre il modal per creare un nuovo cliente. */
function openNewClientModal() {
  openModal('Nuovo cliente', '', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome</label><input id="mf_cname"></div>
      <div class="modal-field"><label>Tipo</label>
        <select id="mf_ctype">
          <option>Retainer video</option><option>AI/CRM</option>
          <option>Video spot</option><option>Altro</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Email</label><input id="mf_cemail"></div>
      <div class="modal-field"><label>Tel</label><input id="mf_ctel"></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>P.IVA</label><input id="mf_cpiva"></div>
      <div class="modal-field"><label>Città</label><input id="mf_ccity"></div>
    </div>`,
    async () => {
      const nome = document.getElementById('mf_cname').value.trim();
      if (!nome) return;
      await save('saveClient', {
        id: uid(), nome,
        tipo:  document.getElementById('mf_ctype').value,
        email: document.getElementById('mf_cemail').value,
        tel:   document.getElementById('mf_ctel').value,
        piva:  document.getElementById('mf_cpiva').value,
        citta: document.getElementById('mf_ccity').value,
        note:  '',
      });
      closeModal(); render();
    }
  );
}

/**
 * Apre il modal per modificare un cliente esistente.
 * @param {string} id - ID del cliente
 */
function openEditClientModal(id) {
  const cl = clientById(id);
  if (!cl) return;
  openModal('Modifica cliente', getNome(cl), `
    <div class="modal-field"><label>Nome</label><input id="mf_cname" value="${getNome(cl)}"></div>
    <div class="modal-row">
      <div class="modal-field"><label>Email</label><input id="mf_cemail" value="${cl.email || ''}"></div>
      <div class="modal-field"><label>Tel</label><input id="mf_ctel" value="${cl.tel || ''}"></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>P.IVA</label><input id="mf_cpiva" value="${cl.piva || ''}"></div>
      <div class="modal-field"><label>Città</label><input id="mf_ccity" value="${cl.citta || ''}"></div>
    </div>`,
    async () => {
      cl.nome  = document.getElementById('mf_cname').value.trim() || cl.nome;
      cl.email = document.getElementById('mf_cemail').value;
      cl.tel   = document.getElementById('mf_ctel').value;
      cl.piva  = document.getElementById('mf_cpiva').value;
      cl.citta = document.getElementById('mf_ccity').value;
      await save('saveClient', cl);
      closeModal(); showDetail('client', id);
    }
  );
}

/** Apre il modal per creare una nuova fattura (con selezione cliente). */
function openNewInvoiceModal() {
  const clientOpts = DB.clienti.map(c => `<option value="${c.id}">${getNome(c)}</option>`).join('');
  openModal('Nuova fattura', '', `
    <div class="modal-field"><label>Cliente</label>
      <select id="mf_iclient">${clientOpts}</select>
    </div>
    <div class="modal-field"><label>Descrizione</label><input id="mf_idesc"></div>
    <div class="modal-row">
      <div class="modal-field"><label>Importo €</label><input id="mf_iamt" type="number"></div>
      <div class="modal-field"><label>Stato</label>
        <select id="mf_istatus">
          <option value="draft">Bozza</option>
          <option value="pending">In attesa</option>
          <option value="paid">Pagata</option>
        </select>
      </div>
    </div>
    <div class="modal-field"><label>Data</label>
      <input id="mf_idate" type="date" value="${new Date().toISOString().split('T')[0]}">
    </div>`,
    async () => {
      const a = parseFloat(document.getElementById('mf_iamt').value);
      const d = document.getElementById('mf_idesc').value.trim();
      if (!a || !d) return;
      const cid = document.getElementById('mf_iclient').value;
      await save('saveInvoice', {
        id: uid(), clienteId: cid, clienteNome: clientName(cid),
        descrizione: d, importo: a,
        stato: document.getElementById('mf_istatus').value,
        data:  document.getElementById('mf_idate').value,
        fonte: 'manuale',
      });
      closeModal(); render();
    }
  );
}

/**
 * Apre il modal per creare una fattura precompilata per un cliente specifico.
 * @param {string} clientId - ID del cliente
 */
function openNewInvoiceForClient(clientId) {
  openModal('Nuova fattura', clientName(clientId), `
    <div class="modal-field"><label>Descrizione</label><input id="mf_idesc"></div>
    <div class="modal-row">
      <div class="modal-field"><label>Importo €</label><input id="mf_iamt" type="number"></div>
      <div class="modal-field"><label>Stato</label>
        <select id="mf_istatus">
          <option value="draft">Bozza</option>
          <option value="pending">In attesa</option>
          <option value="paid">Pagata</option>
        </select>
      </div>
    </div>`,
    async () => {
      const a = parseFloat(document.getElementById('mf_iamt').value);
      const d = document.getElementById('mf_idesc').value.trim();
      if (!a || !d) return;
      await save('saveInvoice', {
        id: uid(), clienteId: clientId, clienteNome: clientName(clientId),
        descrizione: d, importo: a,
        stato: document.getElementById('mf_istatus').value,
        data:  new Date().toISOString().split('T')[0],
        fonte: 'manuale',
      });
      closeModal(); showDetail('client', clientId);
    }
  );
}

/** Apre il modal per creare un nuovo progetto (con selezione cliente). */
function openNewProjectModal() {
  const clientOpts = DB.clienti.map(c => `<option value="${c.id}">${getNome(c)}</option>`).join('');
  openModal('Nuovo progetto', '', `
    <div class="modal-field"><label>Nome</label><input id="mf_pname"></div>
    <div class="modal-row">
      <div class="modal-field"><label>Cliente</label>
        <select id="mf_pclient">${clientOpts}</select>
      </div>
      <div class="modal-field"><label>Tipo</label>
        <select id="mf_ptype">
          <option>Video</option><option>AI/CRM</option>
          <option>Video retainer</option><option>Altro</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Budget €</label><input id="mf_pbudget" type="number"></div>
      <div class="modal-field"><label>Stato</label>
        <select id="mf_pstatus">
          <option value="proposal">Proposta</option>
          <option value="active">Attivo</option>
          <option value="paused">In pausa</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Data inizio</label>
        <input id="mf_pstart" type="date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="modal-field"><label>Data fine</label><input id="mf_pend" type="date"></div>
    </div>
    <div class="modal-field"><label>Note</label><textarea id="mf_pnotes"></textarea></div>`,
    async () => {
      const nome = document.getElementById('mf_pname').value.trim();
      if (!nome) return;
      await save('saveProject', {
        id: uid(), nome,
        clienteId:    document.getElementById('mf_pclient').value,
        tipo:         document.getElementById('mf_ptype').value,
        stato:        document.getElementById('mf_pstatus').value,
        dataInizio:   document.getElementById('mf_pstart').value,
        dataFine:     document.getElementById('mf_pend').value,
        budget:       parseFloat(document.getElementById('mf_pbudget').value) || 0,
        avanzamento:  0,
        responsabile: 'Riccardo',
        note:         document.getElementById('mf_pnotes').value,
      });
      closeModal(); render();
    }
  );
}

/**
 * Apre il modal per modificare budget, stato, avanzamento e data fine di un progetto.
 * @param {string} id - ID del progetto
 */
function openEditProjectModal(id) {
  const p = DB.progetti.find(x => String(x.id) === String(id));
  if (!p) return;
  const clientOpts = DB.clienti.map(c => `<option value="${c.id}" ${String(c.id) === String(p.clienteId) ? 'selected' : ''}>${getNome(c)}</option>`).join('');
  openModal('Modifica progetto', p.nome, `
    <div class="modal-field"><label>Cliente</label>
      <select id="mf_pclient"><option value="">— nessuno —</option>${clientOpts}</select>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Budget €</label>
        <input id="mf_pbudget" type="number" value="${p.budget || 0}">
      </div>
      <div class="modal-field"><label>Stato</label>
        <select id="mf_pstatus">
          <option value="proposal" ${p.stato === 'proposal' ? 'selected' : ''}>Proposta</option>
          <option value="active"   ${p.stato === 'active'   ? 'selected' : ''}>Attivo</option>
          <option value="paused"   ${p.stato === 'paused'   ? 'selected' : ''}>In pausa</option>
          <option value="done"     ${p.stato === 'done'     ? 'selected' : ''}>Completato</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Avanzamento %</label>
        <input id="mf_pprog" type="number" min="0" max="100" value="${p.avanzamento || 0}">
      </div>
      <div class="modal-field"><label>Data fine</label>
        <input id="mf_pend" type="date" value="${p.dataFine || ''}">
      </div>
    </div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <button onclick="deleteProject('${p.id}')" style="background:none;border:1px solid var(--red);color:var(--red);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">Elimina progetto</button>
    </div>`,
    async () => {
      p.clienteId   = document.getElementById('mf_pclient').value;
      p.budget      = parseFloat(document.getElementById('mf_pbudget').value) || p.budget;
      p.stato       = document.getElementById('mf_pstatus').value;
      p.avanzamento = parseInt(document.getElementById('mf_pprog').value) || p.avanzamento;
      p.dataFine    = document.getElementById('mf_pend').value;
      await save('saveProject', p);
      closeModal(); showDetail('project', id);
    }
  );
}

async function deleteProject(id) {
  const p = DB.progetti.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!confirm(`Eliminare "${p.nome}"?\nVerranno rimossi anche i costi associati.`)) return;
  await del('deleteProject', id);
  DB.progetti = DB.progetti.filter(x => String(x.id) !== String(id));
  DB.costi    = DB.costi.filter(x => String(x.progettoId) !== String(id));
  closeModal();
  navTo('projects');
}

/**
 * Apre il modal per aggiungere un costo a un progetto.
 * Se si seleziona un fornitore, precompila descrizione e categoria.
 * Se il fornitore non è già collegato al progetto, crea automaticamente il link FornProg.
 * @param {string} projId - ID del progetto
 */
function openAddCostModal(projId) {
  const fornOpts = DB.fornitori.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(f =>
    `<option value="${f.id}">${f.nome}</option>`
  ).join('');
  openModal('Aggiungi costo', '', `
    <div class="modal-field"><label>Fornitore (opzionale)</label>
      <select id="mf_cforn" onchange="(function(){const f=DB.fornitori.find(x=>String(x.id)===document.getElementById('mf_cforn').value);if(f){document.getElementById('mf_cdesc').value=f.nome;document.getElementById('mf_ccat').value=f.categoria&&['Trasferta','Noleggio','Software','Collaboratori','Altro'].includes(f.categoria)?f.categoria:'Collaboratori';}})()">
        <option value="">— nessuno —</option>${fornOpts}
      </select>
    </div>
    <div class="modal-field"><label>Descrizione</label><input id="mf_cdesc"></div>
    <div class="modal-row">
      <div class="modal-field"><label>Importo €</label><input id="mf_camt" type="number"></div>
      <div class="modal-field"><label>Categoria</label><select id="mf_ccat">
        <option value="Collaboratori">Collaboratori</option>
        <option value="Trasferta">Trasferta</option>
        <option value="Noleggio">Noleggio</option>
        <option value="Software">Software</option>
        <option value="Altro">Altro</option>
      </select></div>
    </div>
    <div class="modal-field"><label>Data</label><input id="mf_cdate" type="date" value="${new Date().toISOString().split('T')[0]}"></div>`,
    async () => {
      const desc   = document.getElementById('mf_cdesc').value.trim();
      const amt    = parseFloat(document.getElementById('mf_camt').value);
      if (!desc || !amt) return;
      const fornId = document.getElementById('mf_cforn').value;
      await save('saveCost', {
        id: uid(), progettoId: projId, descrizione: desc,
        categoria:   document.getElementById('mf_ccat').value,
        importo:     amt,
        data:        document.getElementById('mf_cdate').value,
        fornitoreId: fornId || '',
      });
      if (fornId) {
        const giaCollegato = fornProgettiByProj(projId).some(fp => String(fp.fornitoreId) === String(fornId));
        if (!giaCollegato) {
          try { await save('saveFornProg', { id: uid(), fornitoreId: fornId, progettoId: projId, ruolo: '', note: '' }); } catch (e) {}
        }
      }
      closeModal(); showDetail('project', projId);
    }
  );
}

// ── CLIENTI RICORRENTI ────────────────────────────────────────

/** Apre il modal di gestione clienti ricorrenti (retainer). */
function showMonthlyClientsModal() {
  const clients = getMonthlyClients();
  let body = '<div style="max-height:380px;overflow-y:auto">';
  if (!clients.length) {
    body += '<div style="font-size:13px;color:var(--text3);text-align:center;padding:24px">Nessun cliente ricorrente.</div>';
  } else {
    body += clients.map((c, i) => {
      const [bg, fg] = avatarColor(c.nome);
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
        <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${bg};color:${fg};font-size:11px;font-weight:600;flex-shrink:0">${initials(c.nome)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:var(--text)">${c.nome}</div>
          <div style="font-size:11px;color:var(--accent);cursor:pointer;font-weight:500" onclick="editMonthlyClientPrice('${c.id}','${c.nome}',${c.importoMensile})">${fmtEur(c.importoMensile)}/mese</div>
        </div>
        <button class="btn-danger" style="flex-shrink:0;padding:4px 8px;font-size:11px" onclick="removeMonthlyClient('${c.id}')">Rimuovi</button>
      </div>`;
    }).join('');
  }
  body += `</div><button class="btn-primary" style="width:100%;margin-top:12px" onclick="addMonthlyClientModal()">+ Aggiungi cliente</button>`;
  openModal('Clienti ricorrenti', 'Inserimento manuale', body, () => closeModal(), 'Chiudi');
}

/** Apre il modal per aggiungere un cliente ricorrente (selezione da lista o nome libero). */
function addMonthlyClientModal() {
  closeModal();
  const clientOptions = DB.clienti.map(c => `<option value="${c.id}">${getNome(c)}</option>`).join('');
  openModal('Aggiungi cliente ricorrente', 'Scegli da elenco o scrivi il nome', `
    <div class="modal-field"><label>Cliente</label><select id="mf_mcsel" onchange="(function(){const cid=document.getElementById('mf_mcsel').value;if(cid){const c=DB.clienti.find(x=>String(x.id)===cid);if(c)document.getElementById('mf_mcname').value=getNome(c);}})()"><option value="">— scegli un cliente —</option>${clientOptions}</select></div>
    <div class="modal-field"><label>Nome (o modifica sopra)</label><input id="mf_mcname" placeholder="es. Acme Corp"></div>
    <div class="modal-field"><label>Importo mensile €</label><input id="mf_mcamt" type="number" placeholder="es. 2500"></div>
  `, async () => {
    const nome = document.getElementById('mf_mcname').value.trim();
    const amt  = parseFloat(document.getElementById('mf_mcamt').value) || 0;
    if (!nome || !amt) { toast('Compila nome e importo', 'error'); return; }
    const list = getMonthlyClientsConfig();
    list.push({ id: uid(), nome, importoMensile: amt, isManuale: true });
    await setMonthlyClientsConfig(list);
    closeModal(); render(); showMonthlyClientsModal();
  }, 'Aggiungi');
}

/**
 * Apre il modal per modificare l'importo mensile di un cliente ricorrente.
 * @param {string} id - ID del cliente ricorrente
 * @param {string} nome - Nome del cliente (usato come label)
 * @param {number} currentAmt - Importo mensile corrente
 */
function editMonthlyClientPrice(id, nome, currentAmt) {
  closeModal();
  openModal('Modifica prezzo', `Cliente: ${nome}`, `
    <div class="modal-field"><label>Importo mensile €</label><input id="mf_eprice" type="number" value="${currentAmt}" placeholder="es. 2500"></div>
  `, async () => {
    const newAmt = parseFloat(document.getElementById('mf_eprice').value) || 0;
    if (!newAmt) { toast('Compila importo', 'error'); return; }
    const list = getMonthlyClientsConfig();
    const idx  = list.findIndex(c => String(c.id) === String(id));
    if (idx >= 0) {
      list[idx].importoMensile = newAmt;
      await setMonthlyClientsConfig(list);
      closeModal(); render(); showMonthlyClientsModal();
    }
  }, 'Salva');
}

/**
 * Rimuove un cliente dalla lista dei ricorrenti e aggiorna la config.
 * @param {string} id - ID del cliente ricorrente da rimuovere
 */
function removeMonthlyClient(id) {
  const list = getMonthlyClientsConfig().filter(c => String(c.id) !== String(id));
  setMonthlyClientsConfig(list).then(() => { render(); showMonthlyClientsModal(); }).catch(e => { console.error(e); showMonthlyClientsModal(); });
}

// ── COSTI FISSI ───────────────────────────────────────────────

/** Apre il modal di gestione costi fissi mensili (visualizza lista + totale + azioni). */
function editFixedCosts() {
  const list  = getFixedCostsConfig();
  const total = getFixedCosts();
  let body = '<div style="max-height:320px;overflow-y:auto">';
  if (list.length > 0) {
    body += list.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:var(--text)">${c.descrizione}</div>
          <div style="font-size:11px;color:var(--text3)">${c.tipo === 'expense' ? 'Da spesa' : 'Manuale'}</div>
        </div>
        <div style="text-align:right;margin-right:10px">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${fmtEur(c.importo)}</div>
        </div>
        <button class="btn-danger" style="padding:4px 8px;font-size:11px;flex-shrink:0" onclick="removeFixedCost('${c.id}')">×</button>
      </div>
    `).join('');
  } else {
    body += '<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px">Nessun costo fisso.</div>';
  }
  body += `</div>
  <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-top:12px;font-size:13px;font-weight:600">
    Totale: ${fmtEur(total)}
  </div>
  <div style="display:flex;gap:8px;margin-top:12px">
    <button class="btn-primary" style="flex:1" onclick="addExpenseFixedCostModal()">+ Da storico spese</button>
    <button class="btn-primary" style="flex:1" onclick="addManualFixedCostModal()">+ Manuale</button>
  </div>`;
  openModal('Costi fissi mensili', 'Transazioni + manuali', body, () => closeModal(), 'Chiudi');
}

/**
 * Apre il modal per aggiungere un costo fisso prelevandolo dallo storico spese Qonto.
 * Supporta ricerca testuale per filtrare le opzioni nel select.
 */
function addExpenseFixedCostModal() {
  closeModal();
  const allExpenses = DB.spese.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  if (!allExpenses.length) { toast('Nessuna spesa trovata', 'error'); return; }
  openModal('Seleziona spesa ricorrente', 'Scrivi per cercare', `
    <div class="modal-field"><label>Cerca</label><input id="mf_exp_search" placeholder="es. affitto, software..." oninput="(function(){const q=document.getElementById('mf_exp_search').value.toLowerCase();const opts=document.querySelectorAll('#mf_exp option:not(:first-child)');opts.forEach(o=>{o.style.display=q&&!o.textContent.toLowerCase().includes(q)?'none':''});})()" style="margin-bottom:8px"></div>
    <div class="modal-field"><label>Spesa</label><select id="mf_exp">
      <option value="">— scegli una spesa —</option>
      ${allExpenses.map(e => `<option value="${e.id}">${e.descrizione || '—'} (${fmtEur(e.importo)} · ${fmtDate(e.data)})</option>`).join('')}
    </select></div>
  `, async () => {
    const expId = document.getElementById('mf_exp').value;
    if (!expId) { toast('Seleziona una spesa', 'error'); return; }
    const exp = DB.spese.find(e => String(e.id) === String(expId));
    if (!exp) { toast('Spesa non trovata', 'error'); return; }
    const list = getFixedCostsConfig();
    list.push({ id: uid(), tipo: 'expense', spesaId: exp.id, importo: Number(exp.importo || 0), descrizione: exp.descrizione || 'Spesa' });
    await setFixedCostsConfig(list);
    closeModal(); render(); editFixedCosts();
  }, 'Aggiungi');
}

/** Apre il modal per aggiungere un costo fisso inserito manualmente (descrizione + importo). */
function addManualFixedCostModal() {
  closeModal();
  openModal('Costo fisso manuale', '', `
    <div class="modal-field"><label>Descrizione</label><input id="mf_mdesc" placeholder="es. Affitto ufficio"></div>
    <div class="modal-field"><label>Importo mensile €</label><input id="mf_mamt" type="number" placeholder="es. 1200"></div>
  `, async () => {
    const desc = document.getElementById('mf_mdesc').value.trim();
    const amt  = parseFloat(document.getElementById('mf_mamt').value) || 0;
    if (!desc || !amt) { toast('Compila descrizione e importo', 'error'); return; }
    const list = getFixedCostsConfig();
    list.push({ id: uid(), tipo: 'manual', importo: amt, descrizione: desc });
    await setFixedCostsConfig(list);
    closeModal(); render(); editFixedCosts();
  }, 'Aggiungi');
}

/**
 * Rimuove un costo fisso dalla lista e aggiorna la config.
 * @param {string} id - ID del costo fisso da rimuovere
 */
function removeFixedCost(id) {
  const list = getFixedCostsConfig().filter(c => String(c.id) !== String(id));
  setFixedCostsConfig(list).then(() => { render(); editFixedCosts(); }).catch(e => { console.error(e); editFixedCosts(); });
}

// ── OBIETTIVI ─────────────────────────────────────────────────

/**
 * Apre il modal per modificare target e valore corrente di un obiettivo.
 * Per obiettivi di tipo "retainer" il valore corrente è calcolato automaticamente
 * dal numero di clienti ricorrenti e non è editabile.
 * @param {number} i - Indice dell'obiettivo in DB.goals
 */
function editGoal(i) {
  const g = DB.goals[i];
  const isRetainer = String(g.label || '').toLowerCase().includes('retainer');
  const currentClientsCount = getMonthlyClients().length;
  const curInputField = isRetainer
    ? `<div class="modal-field"><label>Clienti ricorrenti (auto)</label><input type="number" value="${currentClientsCount}" readonly style="background:var(--surface2);cursor:not-allowed"></div>`
    : `<div class="modal-field"><label>Valore attuale</label><input id="mf_gcur" type="number" value="${g.current}"></div>`;
  openModal('Aggiorna obiettivo', g.label,
    `<div class="modal-row">${curInputField}<div class="modal-field"><label>Target</label><input id="mf_gtgt" type="number" value="${g.target}"></div></div>`,
    async () => {
      if (!isRetainer) g.current = parseFloat(document.getElementById('mf_gcur').value) || g.current;
      g.target = parseFloat(document.getElementById('mf_gtgt').value) || g.target;
      await save('saveGoals', { goals: DB.goals });
      closeModal(); render();
    }
  );
}
