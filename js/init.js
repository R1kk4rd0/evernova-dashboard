// ─────────────────────────────────────────────────────────────
// INIT — Event listeners & bootstrap
// ─────────────────────────────────────────────────────────────

document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/**
 * Punto d'ingresso dell'app: carica i dati e avvia il render.
 * In caso di errore mostra un pannello con il pulsante "Riprova".
 * @returns {Promise<void>}
 */
async function init() {
  setConn('', 'Connessione...');
  const ok = await loadAll();
  if (ok) {
    const saved = sessionStorage.getItem('evPage');
    if (saved) navTo(saved); else render();
  } else {
    document.getElementById('mainContent').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:14px"><div style="font-size:16px;font-weight:600;color:var(--red)">Errore di connessione</div><button class="btn-primary" style="margin-top:8px" onclick="init()">↺ Riprova</button></div>';
  }
}

init();
