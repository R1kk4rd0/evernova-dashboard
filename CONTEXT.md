# Evernova Dashboard — Contesto progetto

## Identità
- **Riccardo Orizio**, fondatore Evernova SRL, Milano
- Firma informale: Rick
- Comunicazione: diretta, tecnica, italiana, concisa. No spiegazioni ovvie. No trattino em.

## Obiettivo
Dashboard operativa personale per monitorare contabilità, clienti, fatture, progetti e marginalità di Evernova SRL.

---

## Stack tecnico

| Componente | Dettaglio |
|---|---|
| Frontend | `index.html` — HTML statico deployato su GitHub Pages |
| Backend | Google Apps Script (Web App) |
| Database | Google Sheet ID: `18MyDT_eR66ZUga66JGxNepDoomm9HQhQHZr6JZELT_g` |
| Fonte dati | Qonto API `https://thirdparty.qonto.com/v2` |
| Hosting | GitHub Pages: `https://r1kk4rd0.github.io/evernova-dashboard` |
| Libreria grafici | Chart.js 4.4.1 (CDN) |

**URL Apps Script attuale (in index.html riga 233):**
`https://script.google.com/macros/s/AKfycbzFy7yJLdwoFEeLPPspAIR3p-8_ScFzPML9X-xNSbs-duEd-IZGG122cuIN0-Li-e6Xbg/exec`

---

## Regole di sviluppo

1. **Dashboard HTML** — sempre file completo, mai patch parziali
2. **Apps Script** — file .js completo da copiare manualmente in Google Apps Script
3. **Ogni modifica al frontend** — commit + push attiva GitHub Pages automaticamente
4. **Non usare trattino em nelle comunicazioni**

---

## File nel progetto

- `index.html` — Dashboard HTML completa (v6, ~1960 righe)
- `evernova_script_v5.js` — Google Apps Script (~712 righe)
- `CONTEXT.md` — questo file

---

## Architettura dati — Google Sheet

### Fogli e headers

| Foglio | Headers |
|---|---|
| Clienti | id, qontoId, nome, tipo, email, tel, piva, citta, note, createdAt, updatedAt |
| Fatture | id, qontoId, clienteId, clienteNome, descrizione, importo, stato, data, scadenza, fonte, createdAt, updatedAt, invoiceUrl, itemTitolo, tipoFattura |
| Progetti | id, nome, clienteId, tipo, stato, dataInizio, dataFine, budget, avanzamento, responsabile, note, createdAt, updatedAt |
| CostiProgetto | id, progettoId, descrizione, categoria, importo, data, createdAt, updatedAt, fornitoreId |
| Spese | id, qontoId, descrizione, categoria, categoriaQonto, importo, data, progettoId, fonte, createdAt, updatedAt, fornitoreId |
| Fornitori | id, nome, categoria, email, tel, tariffa, note, createdAt, updatedAt |
| FornitoriProgetti | id, fornitoreId, progettoId, ruolo, note, createdAt, updatedAt |
| Config | chiave, valore |

### Separazione flussi
- **Qonto (sola lettura):** clienti, fatture, spese, beneficiari — sync automatico
- **Dashboard (scrittura libera):** progetti, costi progetto, fornitori, obiettivi, config

---

## Config storage (dual-layer)

Chiavi usate: `fixedCosts`, `monthlyClients`, `monthlyClientsExcluded`, `goals`

- `setConfigAsync(key, val)` — scrive su localStorage + Google Sheet backend
- `getConfig(key)` — legge da `DB.configCache` (popolato da Sheet al caricamento)
- localStorage come fallback immediato se Sheet non risponde
- Le 4 chiavi vengono sempre lette da localStorage al boot come override

---

## Struttura frontend (index.html)

### Oggetto DB globale
```
DB = {
  clienti, fatture, progetti, costi, spese,
  fornitori, fornProgetti,
  goals, saldo: { balance }, configCache: {}
}
```
Ricaricato completamente ad ogni `loadAll()`.

### Pagine (var `currentPage`)
- `overview` — KPI, grafico revenue per cliente, grafico cashflow, ultime fatture
- `invoices` — tabella ordinabile, filtri pillole per stato, ricerca + filtro anno
- `clients` — grid card con avatar, detail view con fatture/progetti associati
- `projects` — tabella marginalità, detail con costi e conto economico, fornitori collegati
- `expenses` — lista + grafico a barre per categoria
- `suppliers` — grid card, detail con transazioni e progetti
- `sync` — pulsante sync + contatori

Routing: `navTo(page)`, `showDetail(type, id)`, `backToList()` — re-render completo ad ogni cambio.

### Charts (Chart.js 4.4.1)
- `charts.rev` — bar orizzontale revenue per cliente
- `charts.cashflow` — mixed bar+line, dual Y-axis (`yBars` left, `ySaldo` right)
- `charts.exp` — bar orizzontale spese per categoria
- Tutti distrutti in `destroyCharts()` prima di ogni re-render

**BUG NOTO Chart.js 4.4.1:** su mixed chart, `fill: true` su un dataset `line` con `yAxisID` custom causa canvas bianco silenzioso. Usare sempre `fill: false`. Assegnare esplicitamente `yAxisID` a tutti i dataset incluse le barre.

---

## Logica di business

### Stato fattura effettivo (`getStatoEffettivo(inv)`)
- `paid` / `draft` / `annullata` — dal campo `stato`
- `nota` — se `tipoFattura === 'credit_note'`
- `overdue` — se scadenza passata e stato non è paid/draft/annullata
- `pending` — altrimenti

### Margine progetto
`projMargin(p) = p.budget - projCostTotal(p.id)` — usa CostiProgetto, non Spese

### Cashflow "Storico + Previsione" (view 'mixed')
- 17 mesi: 5 passati + mese corrente + 11 futuri
- Mesi passati: ricavi = fatture PAID per data emissione; costi = spese reali per data
- Mesi futuri: ricavi = fatture pending/overdue per scadenza + retainer mensile; costi = costi fissi config
- Saldo Qonto: ancorato a `DB.saldo.balance` al mese corrente, propagato avanti (+net) e indietro (-net)
- Barre solide = passato/corrente; barre a righe diagonali (CanvasPattern 8x8) = futuro

### Clienti retainer (`getMonthlyClients()`)
Solo da config `monthlyClients` — inserimento manuale, nessun auto-detect.
`getMonthlyClientsRevenue()` = somma `importoMensile`.

### Costi fissi (`getFixedCosts()`)
Da config `fixedCosts` — array `{id, tipo, importo, descrizione}`.
`tipo: 'expense'` = collegato a spesa; `tipo: 'manual'` = inserito a mano.

---

## Qonto API

- Login: `evernova-s-r-l-7827`
- Secret: riga 6 di `evernova_script_v5.js` (non esporre)
- Paginazione fatture: numerica `&page=N`, max 100 pagine
- Paginazione spese: numerica `&page=N`, per ogni IBAN
- Filtro spese: esclude categoria `treasury_and_interco`

---

## Azioni Web App (Apps Script)

GET: `ping`, `all`, `sync`

POST: `saveClient/deleteClient`, `saveInvoice/deleteInvoice`, `saveProject/deleteProject`,
`saveCost/deleteCost`, `saveExpense/deleteExpense`, `saveForn/deleteForn`,
`saveFornProg/deleteFornProg`, `saveGoals`, `setConfigValue`, `assignExpense`

---

## Funzioni manutenzione Apps Script (eseguire nell'editor GAS)

- `installTrigger()` — sync notturno alle 3:00
- `fixJoin()` — collega clienteId alle fatture Qonto orfane
- `linkSpeseFornitori()` — collegamento bulk spese-fornitori
- `migrateCostColumns()` / `migrateInvoiceColumns()` — migrazione schema
- `importProjects2026()` — import batch progetti hardcoded
- `testSync()` / `testSetup()` / `debugFattureRecenti()` — debug

---

## Stato attuale dati (aprile 2026)

- 31 clienti con nomi puliti
- 103 fatture storiche (2023-2026)
- 606 spese da entrambi i conti Qonto
- 34 fornitori importati da beneficiari Qonto
- 86 spese collegate ai fornitori via `fornitoreId`

---

## Pending

1. Credenziali Qonto scadute (401) — rigenerare su Qonto, aggiornare `QONTO_SECRET` riga 6 script
2. Trigger notturno — eseguire `installTrigger()` in Apps Script
3. Collegamento spese/fornitori — 86/606 collegate; `matchFornitore()` ha score minimo 4 chars
4. Fase 2 SaaS — React + Supabase + Vercel (dopo consolidamento versione personale)
