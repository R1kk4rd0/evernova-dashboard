# Evernova Dashboard — Contesto progetto

## Identità
- **Riccardo Orizio**, fondatore Evernova SRL, Milano
- Firma informale: Rick

## Obiettivo
Dashboard operativa personale per monitorare contabilità, clienti, fatture, progetti e marginalità di Evernova SRL.

---

## Stack tecnico

| Componente | Dettaglio |
|---|---|
| Frontend | `index.html` — HTML statico deployato su GitHub Pages |
| Backend | Google Apps Script (Web App) |
| Database | Google Sheet ID: `18MyDT_eR66ZUga66JGxNepDoomm9HQhQHZr6JZELT_g` |
| Fonte dati | Qonto API |
| Hosting | GitHub Pages: `https://r1kk4rd0.github.io/evernova-dashboard` |

**URL Apps Script attuale:**
`https://script.google.com/macros/s/AKfycbyYt69mZlnb4E8WSu_vfitohkijiMr2OVAoh3FmERGEE9mMU28zDAIINDJq-0nVJJYIsw/exec`

---

## File nel progetto

- `index.html` — Dashboard HTML completa (v6)
- `evernova_script_v5.js` — Codice Apps Script (da copiare manualmente in Google Apps Script)

---

## Architettura dati

### Google Sheet — fogli e headers

| Foglio | Headers |
|---|---|
| Clienti | id, qontoId, nome, tipo, email, tel, piva, citta, note, createdAt, updatedAt |
| Fatture | id, qontoId, clienteId, clienteNome, descrizione, importo, stato, data, scadenza, fonte, createdAt, updatedAt |
| Progetti | id, nome, clienteId, tipo, stato, dataInizio, dataFine, budget, avanzamento, responsabile, note, createdAt, updatedAt |
| CostiProgetto | id, progettoId, descrizione, categoria, importo, data, createdAt, updatedAt |
| Spese | id, qontoId, descrizione, categoria, categoriaQonto, importo, data, progettoId, fornitoreId, fonte, createdAt, updatedAt |
| Fornitori | id, nome, categoria, email, tel, tariffa, note, createdAt, updatedAt |
| Config | chiave, valore |

### Separazione flussi
- **Qonto (sola lettura):** clienti, fatture, spese — sync automatico
- **Dashboard (scrittura libera):** progetti, costi progetto, fornitori, obiettivi

---

## Qonto API
- Login: `evernova-s-r-l-7827`
- Secret: nel file Apps Script riga 2 (non esporre)
- Base URL: `https://thirdparty.qonto.com/v2`
- Paginazione fatture: numerica &page=N, max 100 pagine
- Paginazione spese: numerica &page=N, entrambi i conti
- Filtro spese: esclude `treasury_and_interco`

---

## Stato attuale dati
- 31 clienti con nomi puliti
- 103 fatture storiche (2023-2026)
- 606 spese da entrambi i conti Qonto
- 34 fornitori importati da beneficiari Qonto
- 86 spese collegate ai fornitori via `fornitoreId`

---

## Funzionalità dashboard (v6)

### Pagine
- **Dashboard** — KPI (saldo, fatturato, da incassare, margine), grafico revenue per cliente, obiettivi, ultime fatture, clienti recenti
- **Fatture** — tabella ordinabile per colonna (click intestazione), filtri stato (pillole), ricerca testo + filtro anno, modal dettaglio fattura
- **Clienti** — griglia card con avatar colorati, ricerca multi-campo
- **Progetti** — lista con KPI marginalità, ricerca + filtro stato
- **Spese** — lista con avatar, ricerca + filtro anno + filtro categoria, totale filtrato
- **Fornitori** — griglia card, ricerca + filtro categoria, modal dettaglio con spese collegate
- **Sync Qonto** — sync manuale + contatori

### Funzionalità trasversali
- Ricerca con x per resettare tutti i filtri
- Filtri persistenti durante la sessione
- Modal fattura: dettaglio completo, sola lettura per Qonto, modificabile per manuali
- getStatoEffettivo(): calcola stato reale confrontando scadenza con oggi
- Ordinamento colonne fatture: click su intestazione alterna asc/desc

---

## Regole di sviluppo importanti

1. **Dashboard HTML** — sempre file completo, mai modifiche manuali a mano
2. **Apps Script** — file .js completo da scaricare e incollare in Google Apps Script
3. **Ogni modifica al frontend** — commit + push, GitHub Pages si aggiorna automaticamente
4. **Non usare trattino em nelle comunicazioni**

---

## Funzioni utility Apps Script

- testSync() — sync completo
- testSetup() — ricrea fogli
- fixJoin() — collega fatture a clienti per nome
- linkSpeseFornitori() — collega spese ai fornitori retroattivamente
- syncBeneficiari() — importa beneficiari Qonto come fornitori
- installTrigger() — installa sync notturno alle 3:00
- debugFattureRecenti() — mostra ultime 5 fatture da Qonto
- debugClienteColonne() — verifica headers foglio Clienti

---

## Pending

1. Credenziali Qonto scadute (401) — rigenerare su Qonto e aggiornare nello script
2. Trigger notturno — eseguire installTrigger() in Apps Script
3. Collegamento spese/fornitori — 86/606 collegate, migliorare il matching
4. Fase 2 SaaS — React + Supabase + Vercel (dopo consolidamento versione personale)

---

## Note stile
- Comunicazione diretta e tecnica
- No validazione gratuita, push back quando necessario
- Risposte concise, no spiegazioni ovvie
- Italiano sempre
