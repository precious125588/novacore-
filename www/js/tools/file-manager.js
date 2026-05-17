// ===== FILE MANAGER (MT Manager style) =====
const NCfileManager = (() => {
  let currentPath = '/', files = [], selectedItems = new Set();
  let viewMode = 'list', dualPane = false;
  let virtualFS = {}; // In-memory virtual filesystem

  async function init() {
    await loadVirtualFS();
    render();
  }

  async function loadVirtualFS() {
    const saved = NCStorage.lsGet('virtual_fs', {});
    virtualFS = saved || {};
    // Add some default folders
    const defaults = ['Documents', 'Videos', 'Music', 'Downloads', 'Images', 'Code', 'Vault'];
    defaults.forEach(d => { if (!virtualFS[d]) virtualFS[d] = { type: 'folder', name: d, created: Date.now(), children: {} }; });
  }

  function saveVirtualFS() { NCStorage.lsSet('virtual_fs', virtualFS); }

  function getAtPath(path) {
    if (path === '/') return { type: 'root', children: virtualFS };
    const parts = path.split('/').filter(Boolean);
    let node = { children: virtualFS };
    for (const part of parts) {
      if (!node.children || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function render() {
    const node = getAtPath(currentPath);
    const list = document.getElementById('fm-list-left');
    const pathEl = document.getElementById('fm-path');
    const statusEl = document.getElementById('fm-status');
    if (!list || !node) return;

    pathEl.textContent = currentPath;

    const children = node.children || {};
    const items = Object.entries(children).sort(([,a],[,b]) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (b.type === 'folder' && a.type !== 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>Empty folder</p></div>';
    } else {
      list.innerHTML = items.map(([key, item]) => `
        <div class="fm-item ${selectedItems.has(key) ? 'selected' : ''}"
          onclick="NCfileManager.openItem('${key}')"
          oncontextmenu="event.preventDefault();NCfileManager.itemMenu('${key}')">
          <div class="fm-item-icon">${getItemIcon(item)}</div>
          <div class="fm-item-info">
            <div class="fm-item-name">${item.name || key}</div>
            <div class="fm-item-meta">${getItemMeta(item)}</div>
          </div>
          <span class="fm-item-action">›</span>
        </div>
      `).join('');
    }

    statusEl.textContent = `${items.length} item(s) · ${currentPath}`;
    document.getElementById('fm-back').disabled = currentPath === '/';
  }

  function getItemIcon(item) {
    if (item.type === 'folder') return '📁';
    const ext = (item.name || '').split('.').pop().toLowerCase();
    const icons = { mp4:'🎬', mkv:'🎬', avi:'🎬', mov:'🎬', webm:'🎬', mp3:'🎵', m4a:'🎵', ogg:'🎵', wav:'🎵', flac:'🎵', jpg:'🖼', jpeg:'🖼', png:'🖼', gif:'🖼', webp:'🖼', pdf:'📄', doc:'📄', docx:'📄', txt:'📝', js:'📜', ts:'📜', html:'🌐', css:'🎨', json:'⚙', zip:'🗜', rar:'🗜', apk:'📦', py:'🐍', php:'🐘' };
    return icons[ext] || '📄';
  }

  function getItemMeta(item) {
    const parts = [];
    if (item.type === 'folder') {
      const count = Object.keys(item.children || {}).length;
      parts.push(`${count} item${count !== 1 ? 's' : ''}`);
    }
    if (item.size) parts.push(formatBytes(item.size));
    if (item.modified || item.created) parts.push(formatDate(item.modified || item.created));
    return parts.join(' · ') || item.type || 'file';
  }

  function openItem(key) {
    const node = getAtPath(currentPath);
    if (!node || !node.children || !node.children[key]) return;
    const item = node.children[key];
    if (item.type === 'folder') {
      currentPath = (currentPath === '/' ? '' : currentPath) + '/' + key;
      render();
    } else {
      openFile(item);
    }
  }

  function openFile(item) {
    if (!item.blobUrl && !item.url) { NC.ui.toast('File not available'); return; }
    const url = item.blobUrl || item.url;
    const ext = (item.name || '').split('.').pop().toLowerCase();
    if (['mp4','mkv','avi','mov','webm'].includes(ext)) NCvideoPlayer.open(url, item.name, 'blob');
    else if (['mp3','m4a','ogg','wav','flac'].includes(ext)) NCaudioPlayer.playUrl(url, item.name, '');
    else if (['js','ts','html','css','json','py','php','txt','md'].includes(ext)) {
      NC.codeEditor.openFileFromManager(item);
      NC.ui.showView('view-code');
    } else {
      const a = document.createElement('a'); a.href = url; a.download = item.name; a.click();
    }
  }

  function goBack() {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    currentPath = parts.length ? '/' + parts.join('/') : '/';
    render();
  }

  function toggleView() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
    NC.ui.toast('View: ' + viewMode);
    render();
  }

  function showMenu() {
    NC.ui.showModal('File Manager', '', [
      { label:'New Folder', action: () => { NC.ui.closeModal(); createFolder(); } },
      { label:'New File', action: () => { NC.ui.closeModal(); createFile(); } },
      { label:'Open File', action: () => { NC.ui.closeModal(); document.getElementById('fm-open-input').click(); } },
      { label:'Toggle Dual Pane', action: () => { NC.ui.closeModal(); toggleDualPane(); } },
      { label:'Sort by Name', action: () => { NC.ui.closeModal(); render(); } },
    ]);
  }

  function createFolder() {
    NC.ui.showModal('New Folder', '<input type="text" class="input" id="new-folder-name" placeholder="Folder name..."/>', [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Create', action: () => {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) return;
        const node = getAtPath(currentPath);
        if (!node || !node.children) return;
        node.children[name] = { type:'folder', name, created:Date.now(), children:{} };
        saveVirtualFS(); NC.ui.closeModal(); render();
        NC.ui.toast(`Folder "${name}" created`, 'success');
      }}
    ]);
  }

  function createFile() {
    NC.ui.showModal('New File', '<input type="text" class="input" id="new-file-name" placeholder="filename.js"/>', [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Create', action: () => {
        const name = document.getElementById('new-file-name').value.trim();
        if (!name) return;
        const node = getAtPath(currentPath);
        if (!node || !node.children) return;
        node.children[name] = { type:'file', name, created:Date.now(), content:'', size:0 };
        saveVirtualFS(); NC.ui.closeModal();
        NC.codeEditor.openFileFromManager({ name, content:'' });
        NC.ui.showView('view-code');
      }}
    ]);
  }

  function itemMenu(key) {
    const node = getAtPath(currentPath);
    const item = node?.children?.[key];
    if (!item) return;
    NC.ui.showModal(item.name, '', [
      { label:'Open', action:()=>{ NC.ui.closeModal(); openItem(key); } },
      { label:'Rename', action:()=>{ NC.ui.closeModal(); renameItem(key); } },
      { label:'Copy', action:()=>{ NC.ui.closeModal(); copyItem(key); } },
      { label:'Delete', danger:true, action:()=>{ NC.ui.closeModal(); deleteItem(key); } },
    ]);
  }

  function renameItem(key) {
    NC.ui.showModal('Rename', `<input type="text" class="input" id="rename-input" value="${key}"/>`, [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Rename', action: () => {
        const newName = document.getElementById('rename-input').value.trim();
        if (!newName || newName === key) { NC.ui.closeModal(); return; }
        const node = getAtPath(currentPath);
        if (!node?.children) return;
        node.children[newName] = { ...node.children[key], name: newName };
        delete node.children[key];
        saveVirtualFS(); NC.ui.closeModal(); render();
      }}
    ]);
  }

  let clipboard = null;
  function copyItem(key) {
    const node = getAtPath(currentPath);
    clipboard = { item: node?.children?.[key], key };
    NC.ui.toast(`"${key}" copied to clipboard`);
  }

  function deleteItem(key) {
    NC.ui.showModal(`Delete "${key}"?`, 'This action cannot be undone.', [
      { label:'Cancel', action:()=>NC.ui.closeModal() },
      { label:'Delete', danger:true, action:()=>{
        const node = getAtPath(currentPath);
        if (node?.children) { delete node.children[key]; saveVirtualFS(); render(); }
        NC.ui.closeModal(); NC.ui.toast('Deleted', 'success');
      }}
    ]);
  }

  async function handleOpen(input) {
    const files = Array.from(input.files);
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const blob = new Blob([buf], { type: file.type });
      const blobUrl = URL.createObjectURL(blob);
      const node = getAtPath(currentPath);
      if (node?.children) {
        node.children[file.name] = { type:'file', name:file.name, size:file.size, blobUrl, created:Date.now() };
      }
    }
    saveVirtualFS(); render(); NC.ui.toast(`${files.length} file(s) imported`, 'success');
    input.value = '';
  }

  function addFileToFS(file) {
    const node = getAtPath(currentPath);
    if (node?.children) {
      node.children[file.name] = { ...file };
      saveVirtualFS(); render();
    }
  }

  function toggleDualPane() {
    dualPane = !dualPane;
    const right = document.getElementById('fm-pane-right');
    if (right) right.style.display = dualPane ? 'block' : 'none';
    NC.ui.toast(dualPane ? 'Dual pane enabled' : 'Single pane');
  }

  function openPanel() { NC.ui.showView('view-files'); }

  function formatBytes(b) {
    if (!b) return ''; if (b < 1024) return b+' B'; if (b < 1048576) return (b/1024).toFixed(0)+' KB'; return (b/1048576).toFixed(1)+' MB';
  }
  function formatDate(ts) {
    if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString();
  }

  return { init, render, openItem, goBack, toggleView, showMenu, createFolder, createFile, itemMenu, renameItem, copyItem, deleteItem, handleOpen, addFileToFS, toggleDualPane, openPanel };
})();
