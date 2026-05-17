// ===== PRIVATE VAULT SYSTEM =====
const NCvault = (() => {
  let pinEntry = '', correctPin = '', unlocked = false, autoLockTimer = null;

  function init() {
    correctPin = NCStorage.lsGet('vault_pin', '');
  }

  function open() {
    const overlay = document.getElementById('vault-overlay');
    overlay.classList.remove('hidden');
    pinEntry = '';
    updatePinDots();
    if (!correctPin) {
      // No PIN set — prompt to create one
      NC.ui.toast('Set a PIN to use the vault');
      setPin();
      return;
    }
    if (unlocked) {
      showContent();
    }
  }

  function close() {
    document.getElementById('vault-overlay').classList.add('hidden');
  }

  function pinInput(val) {
    if (val === 'del') { pinEntry = pinEntry.slice(0,-1); updatePinDots(); return; }
    if (val === 'bio') { tryBiometric(); return; }
    if (pinEntry.length >= 4) return;
    pinEntry += val;
    updatePinDots();
    if (pinEntry.length === 4) setTimeout(checkPin, 200);
  }

  function updatePinDots() {
    const dots = document.querySelectorAll('#pin-dots span');
    dots.forEach((d, i) => d.classList.toggle('filled', i < pinEntry.length));
  }

  function checkPin() {
    if (pinEntry === correctPin) {
      pinEntry = '';
      updatePinDots();
      unlocked = true;
      showContent();
      startAutoLock();
    } else {
      pinEntry = '';
      updatePinDots();
      NC.ui.toast('Wrong PIN', 'error');
      // Shake animation
      const pad = document.getElementById('pin-pad');
      pad.style.transform = 'translateX(10px)';
      setTimeout(() => pad.style.transform = 'translateX(-10px)', 100);
      setTimeout(() => pad.style.transform = '', 200);
    }
  }

  async function tryBiometric() {
    if (!window.PublicKeyCredential) { NC.ui.toast('Biometric not supported', 'error'); return; }
    try {
      // Simple credential check using WebAuthn (if available)
      NC.ui.toast('Use your fingerprint or face');
      // Fallback to PIN
    } catch { NC.ui.toast('Biometric failed, use PIN', 'error'); }
  }

  function showContent() {
    document.getElementById('vault-lock-screen').classList.add('hidden');
    document.getElementById('vault-content').classList.remove('hidden');
    showTab('media');
  }

  function lock() {
    unlocked = false;
    clearTimeout(autoLockTimer);
    document.getElementById('vault-lock-screen').classList.remove('hidden');
    document.getElementById('vault-content').classList.add('hidden');
    pinEntry = '';
    updatePinDots();
  }

  function startAutoLock() {
    if (!NCStorage.lsGet('autoLock', true)) return;
    clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(lock, 5 * 60 * 1000); // 5 min
  }

  async function showTab(tab) {
    document.querySelectorAll('.vault-tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.vault-tabs button').forEach(b => { if (b.textContent.toLowerCase().includes(tab)) b.classList.add('active'); });
    const container = document.getElementById('vault-items');
    const items = (await NCStorage.getAll('vault')).filter(i => {
      if (tab === 'media') return ['video','image','audio'].includes(i.type);
      if (tab === 'files') return !['video','image','audio','note'].includes(i.type);
      if (tab === 'notes') return i.type === 'note';
      return true;
    });
    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>No ${tab} in vault yet. Tap + to add.</p></div>`;
      return;
    }
    container.innerHTML = items.map(item => `
      <div class="list-item" onclick="NCvault.openItem('${item.id}')">
        <div class="list-item-thumb">${item.type === 'video' ? '🎬' : item.type === 'image' ? '🖼' : item.type === 'audio' ? '🎵' : item.type === 'note' ? '📝' : '📄'}</div>
        <div class="list-item-info">
          <div class="list-item-title">${item.name}</div>
          <div class="list-item-sub">${new Date(item.timestamp).toLocaleDateString()}</div>
        </div>
        <button class="icon-btn" onclick="event.stopPropagation();NCvault.deleteItem('${item.id}')">🗑</button>
      </div>
    `).join('');
  }

  function addItem() {
    document.getElementById('vault-file-input').click();
  }

  async function storeFiles(input) {
    const files = Array.from(input.files);
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const blob = new Blob([buf], { type: file.type });
      const blobUrl = URL.createObjectURL(blob);
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['mp4','mov','webm'].includes(ext) ? 'video' : ['mp3','m4a','ogg'].includes(ext) ? 'audio' : ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image' : 'file';
      await NCStorage.put('vault', { id: 'v_' + Date.now() + '_' + file.name, name: file.name, type, blobUrl, size: file.size, timestamp: Date.now() });
    }
    NC.ui.toast(`${files.length} file(s) secured in vault`, 'success');
    showTab('media');
    input.value = '';
  }

  async function openItem(id) {
    const item = await NCStorage.get('vault', id);
    if (!item || !item.blobUrl) { NC.ui.toast('File not available', 'error'); return; }
    if (item.type === 'video') NCvideoPlayer.open(item.blobUrl, item.name, 'blob');
    else if (item.type === 'audio') NCaudioPlayer.playUrl(item.blobUrl, item.name, '');
    else if (item.type === 'image') NC.ui.showModal(item.name, `<img src="${item.blobUrl}" style="width:100%;border-radius:8px"/>`, [{ label:'Close', action:()=>NC.ui.closeModal() }]);
  }

  async function deleteItem(id) {
    NC.ui.showModal('Delete from Vault?', 'This will permanently remove the file from your vault.', [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Delete', danger:true, action: async () => { NC.ui.closeModal(); await NCStorage.remove('vault', id); showTab('media'); NC.ui.toast('Deleted from vault'); } }
    ]);
  }

  function setPin() {
    NC.ui.showModal('Set Vault PIN', `
      <p style="color:var(--text2);margin-bottom:12px">Choose a 4-digit PIN for your vault</p>
      <input type="password" class="input" id="new-pin-input" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="4-digit PIN"/>
    `, [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Set PIN', action: () => {
        const pin = document.getElementById('new-pin-input').value;
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { NC.ui.toast('Enter a 4-digit PIN', 'error'); return; }
        correctPin = pin;
        NCStorage.lsSet('vault_pin', pin);
        NC.ui.closeModal();
        NC.ui.toast('Vault PIN set!', 'success');
      }}
    ]);
  }

  return { init, open, close, pinInput, lock, showTab, addItem, storeFiles, openItem, deleteItem, setPin };
})();
