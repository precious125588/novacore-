// ===== LIBRARY SYSTEM =====
const NClibrary = (() => {
  let currentTab = 'videos';

  async function init() {
    showTab('videos', document.querySelector('.lib-tab'));
    loadContinueWatching();
    loadRecentlyPlayed();
  }

  function showTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.lib-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadTab(tab);
  }

  async function loadTab(tab) {
    const container = document.getElementById('library-content');
    container.innerHTML = '<div class="empty-state"><div class="spin">⏳</div></div>';

    try {
      let items = [];
      if (tab === 'videos') items = (await NCStorage.getAll('library')).filter(i => i.type === 'video');
      else if (tab === 'music') items = (await NCStorage.getAll('library')).filter(i => i.type === 'audio');
      else if (tab === 'downloads') items = await NCStorage.getAll('downloads');
      else if (tab === 'favorites') items = await NCStorage.getAll('favorites');
      else if (tab === 'history') items = (await NCStorage.getAll('history')).sort((a,b) => b.timestamp - a.timestamp);

      renderItems(container, items, tab);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><p>Error loading: ${e.message}</p></div>`;
    }
  }

  function renderItems(container, items, tab) {
    if (!items.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${tab==='videos'?'🎬':tab==='music'?'🎵':tab==='downloads'?'⬇':tab==='favorites'?'♥':'📜'}</div>
        <h3>No ${tab} yet</h3>
        <p>Your ${tab} will appear here</p>
      </div>`;
      return;
    }

    container.innerHTML = `<div class="card-list" style="padding:16px">
      ${items.map(item => `
        <div class="list-item" onclick="NClibrary.openItem('${item.id}','${tab}')">
          <div class="list-item-thumb">${getIcon(item)}</div>
          <div class="list-item-info">
            <div class="list-item-title">${item.name || item.title || 'Untitled'}</div>
            <div class="list-item-sub">${formatMeta(item, tab)}</div>
          </div>
          <div class="list-item-actions">
            <button class="icon-btn" onclick="event.stopPropagation();NClibrary.itemMenu('${item.id}','${tab}')">⋮</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  function getIcon(item) {
    const t = item.type || '';
    if (t === 'video') return '🎬';
    if (t === 'audio') return '🎵';
    if (t === 'image') return '🖼';
    return '📄';
  }

  function formatMeta(item, tab) {
    const parts = [];
    if (item.timestamp) parts.push(formatDate(item.timestamp));
    if (item.size) parts.push(formatBytes(item.size));
    if (item.artist) parts.push(item.artist);
    if (item.status) parts.push(item.status);
    return parts.join(' · ') || tab;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    return d.toLocaleDateString();
  }

  function formatBytes(b) {
    if (!b) return '';
    if (b < 1048576) return (b/1024).toFixed(0) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
  }

  async function openItem(id, tab) {
    let item;
    if (tab === 'history') item = await NCStorage.get('history', id);
    else if (tab === 'favorites') item = await NCStorage.get('favorites', id);
    else if (tab === 'downloads') item = await NCStorage.get('downloads', id);
    else item = await NCStorage.get('library', id);
    if (!item) return;
    const url = item.url || item.src || item.blobUrl;
    if (!url) { NC.ui.toast('File not available', 'error'); return; }
    if (item.type === 'video') NCvideoPlayer.open(url, item.name || item.title, 'url');
    else if (item.type === 'audio') NCaudioPlayer.playUrl(url, item.name || item.title, item.artist);
    else { const a = document.createElement('a'); a.href = url; a.download = item.name || 'file'; a.click(); }
  }

  function itemMenu(id, tab) {
    NC.ui.showModal('Options', '', [
      { label: 'Open', action: () => { NC.ui.closeModal(); openItem(id, tab); } },
      { label: 'Add to Favorites', action: async () => { NC.ui.closeModal(); const item = await NCStorage.get(tab==='history'?'history':tab==='favorites'?'favorites':'library', id); if (item) addFavorite(item); } },
      { label: 'Delete', danger: true, action: async () => { NC.ui.closeModal(); await NCStorage.remove(tab==='history'?'history':tab==='downloads'?'downloads':tab==='favorites'?'favorites':'library', id); loadTab(tab); NC.ui.toast('Deleted'); } },
    ]);
  }

  async function addHistory(item) {
    item.id = 'hist_' + Date.now();
    await NCStorage.put('history', item);
    loadContinueWatching();
  }

  async function addFavorite(item) {
    const fav = { ...item, id: 'fav_' + Date.now(), favTimestamp: Date.now() };
    await NCStorage.put('favorites', fav);
    NC.ui.toast('Added to favorites ♥', 'success');
  }

  async function addDownload(item) {
    await NCStorage.put('library', item);
    if (currentTab === 'downloads' || currentTab === (item.type === 'video' ? 'videos' : 'music')) loadTab(currentTab);
  }

  async function addToLibrary(item) {
    await NCStorage.put('library', item);
  }

  async function loadContinueWatching() {
    const history = (await NCStorage.getAll('history')).sort((a,b) => b.timestamp - a.timestamp).filter(h => h.type === 'video').slice(0, 10);
    const container = document.getElementById('continue-watching');
    if (!container) return;
    if (!history.length) { container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">No videos watched yet</div>'; return; }
    container.innerHTML = history.map(h => `
      <div class="media-card" onclick="NCvideoPlayer.open('${h.src}','${h.name}')">
        <div class="media-card-thumb">🎬</div>
        <div class="media-card-info">
          <div class="media-card-title">${h.name || 'Video'}</div>
          <div class="media-card-sub">${formatDate(h.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  async function loadRecentlyPlayed() {
    const history = (await NCStorage.getAll('history')).sort((a,b) => b.timestamp - a.timestamp).filter(h => h.type === 'audio').slice(0, 10);
    const container = document.getElementById('recently-played');
    if (!container) return;
    if (!history.length) { container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">No music played yet</div>'; return; }
    container.innerHTML = history.map(h => `
      <div class="media-card" onclick="NCaudioPlayer.playUrl('${h.src}','${h.name}','')">
        <div class="media-card-thumb">🎵</div>
        <div class="media-card-info">
          <div class="media-card-title">${h.name || 'Track'}</div>
          <div class="media-card-sub">${formatDate(h.timestamp)}</div>
        </div>
      </div>
    `).join('');
  }

  async function scanAndCleanup() {
    const items = await NCStorage.getAll('library');
    let removed = 0;
    for (const item of items) {
      if (item.blobUrl) {
        try { await fetch(item.blobUrl, { method: 'HEAD' }); } catch { await NCStorage.remove('library', item.id); removed++; }
      }
    }
    NC.ui.toast(`Cleaned ${removed} broken entries`, removed ? 'success' : undefined);
  }

  return { init, showTab, addHistory, addFavorite, addDownload, addToLibrary, openItem, itemMenu, loadContinueWatching, loadRecentlyPlayed, scanAndCleanup };
})();
