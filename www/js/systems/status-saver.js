// ===== STATUS SAVER SYSTEM =====
const NCstatus = (() => {
  async function init() { await renderSaved(); }

  async function pickStatuses() {
    document.getElementById('status-file-input').click();
  }

  async function saveFiles(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    let saved = 0;
    for (const file of files) {
      try {
        const arrayBuf = await file.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: file.type });
        const blobUrl = URL.createObjectURL(blob);
        const id = 'status_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const ext = file.name.split('.').pop().toLowerCase();
        const type = ['mp4','mov','webm','3gp'].includes(ext) ? 'video' : 'image';
        await NCStorage.put('library', {
          id, name: file.name, type, blobUrl, size: file.size,
          timestamp: Date.now(), source: 'status'
        });
        saved++;
      } catch {}
    }
    NC.ui.toast(`${saved} status${saved > 1 ? 'es' : ''} saved!`, 'success');
    await renderSaved();
    input.value = '';
  }

  async function renderSaved() {
    const container = document.getElementById('saved-statuses');
    if (!container) return;
    const all = (await NCStorage.getAll('library')).filter(i => i.source === 'status').sort((a,b) => b.timestamp - a.timestamp);

    if (!all.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">💾</div><h3>No saved statuses</h3><p>Tap "Browse Status Files" to pick WhatsApp status files and save them here</p></div>';
      return;
    }

    container.innerHTML = all.map(item => `
      <div class="media-item" onclick="NCstatus.openItem('${item.id}')">
        <div class="media-item-thumb">${item.type === 'video' ? '🎬' : '🖼'}</div>
        <div class="media-item-info">
          <div class="media-item-name">${item.name}</div>
          <div class="media-item-meta">${formatDate(item.timestamp)} · ${formatBytes(item.size)}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn-sm" onclick="event.stopPropagation();NCstatus.share('${item.id}')">Share</button>
            <button class="btn-sm btn-danger" onclick="event.stopPropagation();NCstatus.deleteItem('${item.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function openItem(id) {
    const item = await NCStorage.get('library', id);
    if (!item || !item.blobUrl) { NC.ui.toast('File not available', 'error'); return; }
    if (item.type === 'video') NCvideoPlayer.open(item.blobUrl, item.name, 'blob');
    else {
      NC.ui.showModal(item.name, `<img src="${item.blobUrl}" style="width:100%;border-radius:8px;max-height:400px;object-fit:contain"/>`, [{ label: 'Close', action: () => NC.ui.closeModal() }]);
    }
  }

  async function share(id) {
    const item = await NCStorage.get('library', id);
    if (!item || !item.blobUrl) return;
    try {
      const res = await fetch(item.blobUrl);
      const blob = await res.blob();
      const file = new File([blob], item.name, { type: blob.type });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: item.name });
      } else {
        const a = document.createElement('a'); a.href = item.blobUrl; a.download = item.name; a.click();
        NC.ui.toast('File saved to downloads');
      }
    } catch (e) { NC.ui.toast('Share failed: ' + e.message, 'error'); }
  }

  async function deleteItem(id) {
    await NCStorage.remove('library', id);
    NC.ui.toast('Deleted', 'success');
    renderSaved();
  }

  function formatDate(ts) {
    const d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function formatBytes(b) {
    if (!b) return ''; if (b < 1048576) return (b/1024).toFixed(0)+' KB'; return (b/1048576).toFixed(1)+' MB';
  }

  return { init, pickStatuses, saveFiles, openItem, share, deleteItem };
})();
