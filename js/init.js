// ─────────────────────────────────────────────────────────────
// INIT — Event listeners & bootstrap
// ─────────────────────────────────────────────────────────────

document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

async function init() {
  setConn('', 'Connessione...');
  const ok = await loadAll();
  if (ok) {
    render();
  } else {
    document.getElementById('mainContent').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:14px"><div style="font-size:16px;font-weight:600;color:var(--red)">Errore di connessione</div><button class="btn-primary" style="margin-top:8px" onclick="init()">↺ Riprova</button></div>';
  }
}

init();
