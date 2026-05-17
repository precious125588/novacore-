// ===== NAVIGATION + UI SYSTEM =====
const NCui = (() => {
  let toastTimer = null, currentView = 'view-home';

  function showView(viewId, btn) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
    currentView = viewId;

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else {
      const matching = document.querySelector(`[data-view="${viewId}"]`);
      if (matching) matching.classList.add('active');
    }

    // Lazy init for views
    if (viewId === 'view-library') NClibrary.showTab('videos', document.querySelector('.lib-tab'));
    if (viewId === 'view-code') setTimeout(() => NCcodeEditor.init(), 100);
    if (viewId === 'view-files') NCfileManager.render();
    if (viewId === 'view-settings') updateStorageInfo();
  }

  function openSettings() { showView('view-settings'); }

  function toast(message, type = '', duration = 2500) {
    clearTimeout(toastTimer);
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  function showModal(title, bodyHtml, actions = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const actionsEl = document.getElementById('modal-actions');
    actionsEl.innerHTML = actions.map((a, i) =>
      `<button class="${a.danger ? 'btn-sm btn-danger' : 'btn-primary'}" onclick="NC._modalActions[${i}]()">${a.label}</button>`
    ).join('');
    NC._modalActions = actions.map(a => a.action);
    document.getElementById('modal-overlay').classList.remove('hidden');
    // Focus first input if present
    setTimeout(() => { const inp = document.querySelector('#modal-body input'); if (inp) inp.focus(); }, 100);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    NC._modalActions = [];
  }

  function updateStorageInfo() {
    NCStorage.getStorageUsed().then(({ used, quota }) => {
      const el = document.getElementById('storage-used');
      if (el) el.textContent = `${NCStorage.formatBytes(used)} / ${NCStorage.formatBytes(quota)}`;
    });
  }

  function notifications() {
    showModal('Notifications', '<div style="color:var(--text2);padding:16px 0">No new notifications</div>', [{ label:'OK', action:()=>closeModal() }]);
  }

  return { showView, openSettings, toast, showModal, closeModal, notifications };
})();
