// ===== NOVACORE MAIN APP CONTROLLER v2 =====
const NC = {
  storage: NCStorage,
  ui: NCui,
  videoPlayer: NCvideoPlayer,
  audioPlayer: NCaudioPlayer,
  audioEngine: NCaudioEngine,
  library: NClibrary,
  downloader: NCdownloader,
  subtitles: NCsubtitles,
  lyrics: NClosyrics,
  status: NCstatus,
  vault: NCvault,
  archive: NCarchive,
  fileManager: NCfileManager,
  codeEditor: NCcodeEditor,
  ai: NCai,
  search: NCsearch,
  files: null,
  settings: null,
  backup: null,
  notifications: null,
  _modalActions: [],
};

// ===== SETTINGS =====
NC.settings = {
  set(key, val) { NCStorage.lsSet(key, val); },
  get(key, def) { return NCStorage.lsGet(key, def); },
  toggle(key, val) { NCStorage.lsSet(key, val); this._apply(key, val); },
  _apply(key, val) {
    if (key === 'liteMode') document.body.classList.toggle('lite-mode', val);
    if (key === 'debugMode' && val) NCcodeEditor.interceptConsole && NCcodeEditor.interceptConsole();
    if (key === 'autoLock') NCStorage.lsSet('autoLock', val);
  },
  setTheme(theme) { document.documentElement.setAttribute('data-theme', theme); NCStorage.lsSet('theme', theme); },
  setLanguage(lang) { NCStorage.lsSet('lang', lang); NC.ui.toast('Language changed'); },
};

// ===== FILE PICKER / OPEN-WITH =====
NC.files = {
  pickVideo() { document.getElementById('video-file-input').click(); },
  pickAudio() { document.getElementById('audio-file-input').click(); },
  pickAny() { document.getElementById('any-file-input').click(); },
  // Route a file to the correct module by type
  routeFile(file) {
    if (!file) return;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const url = URL.createObjectURL(file);
    const name = file.name;
    // Video
    if (['mp4','webm','mkv','avi','mov','3gp','flv','wmv','m4v','ts'].includes(ext)) {
      NCvideoPlayer.open(url, name, 'blob');
      return;
    }
    // Audio
    if (['mp3','m4a','ogg','wav','flac','aac','opus','wma'].includes(ext)) {
      NCaudioPlayer.playUrl(url, name, '');
      return;
    }
    // Subtitle
    if (['srt','vtt','ass','ssa'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = e => { NCsubtitles.parseSub && NCsubtitles.parseSub(e.target.result, name); NC.ui.toast('Subtitle loaded: ' + name, 'success'); };
      reader.readAsText(file);
      return;
    }
    // Code / Text → Code Editor
    if (['js','ts','html','css','py','php','json','xml','md','txt','c','cpp','java','rb','go','sh','yaml','toml','rs','vue','jsx','tsx','sql'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = e => {
        NC.ui.showView('view-code');
        setTimeout(() => {
          NCcodeEditor.openFileFromManager({ name, content: e.target.result || '' });
        }, 200);
      };
      reader.readAsText(file);
      return;
    }
    // Archive → Archive Manager
    if (['zip','rar','7z','tar','gz'].includes(ext)) {
      NCarchive.openFile(file);
      return;
    }
    // Image → Preview
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) {
      NC.ui.showModal(name, `<img src="${url}" style="width:100%;border-radius:8px;max-height:60vh;object-fit:contain"/>`, [{ label:'Close', action:()=>NC.ui.closeModal() }]);
      return;
    }
    // Unknown → ask user
    NC.ui.showModal('Open File', `<p style="color:var(--text2)">How do you want to open "<strong>${name}</strong>"?</p>`, [
      { label:'Code Editor', action:()=>{ NC.ui.closeModal(); NC.files.routeFile(Object.assign(file, { name })); } },
      { label:'Download', action:()=>{ NC.ui.closeModal(); const a=document.createElement('a');a.href=url;a.download=name;a.click(); } },
      { label:'Cancel', action:()=>NC.ui.closeModal() },
    ]);
  }
};

// ===== PERMISSIONS SYSTEM =====
NC.permissions = {
  async requestAll() {
    await this.requestStorage();
    await this.requestPersistentStorage();
  },
  async requestStorage() {
    // On WebView, file access is via <input type="file"> — no special permission needed
    // But try to get persistent storage
  },
  async requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const granted = await navigator.storage.persist();
        NCStorage.lsSet('storagePersisted', granted);
        if (granted) console.log('Persistent storage granted');
      }
    } catch {}
  },
  showBanner() {
    const banner = document.getElementById('perm-banner');
    if (banner) banner.classList.remove('hidden');
  },
  hideBanner() {
    const banner = document.getElementById('perm-banner');
    if (banner) banner.classList.add('hidden');
    NCStorage.lsSet('permBannerDismissed', true);
  },
};

// ===== BACKUP SYSTEM =====
NC.backup = {
  async export() {
    NC.ui.toast('Preparing backup...');
    try {
      const zip = new JSZip();
      const settings = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nc_')) settings[k] = localStorage.getItem(k);
      }
      zip.file('settings.json', JSON.stringify(settings, null, 2));
      const history = await NCStorage.getAll('history');
      zip.file('history.json', JSON.stringify(history));
      const favorites = await NCStorage.getAll('favorites');
      zip.file('favorites.json', JSON.stringify(favorites));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'novacore_backup_' + Date.now() + '.zip'; a.click();
      URL.revokeObjectURL(url);
      NC.ui.toast('Backup exported!', 'success');
    } catch (e) { NC.ui.toast('Backup failed: ' + e.message, 'error'); }
  },
  import() { document.getElementById('backup-file-input').click(); },
  async importFile(input) {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.name.endsWith('.zip')) {
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        if (zip.files['settings.json']) {
          const s = JSON.parse(await zip.files['settings.json'].async('text'));
          Object.entries(s).forEach(([k,v]) => localStorage.setItem(k, v));
        }
        if (zip.files['history.json']) {
          const h = JSON.parse(await zip.files['history.json'].async('text'));
          for (const item of h) await NCStorage.put('history', item);
        }
        NC.ui.toast('Backup restored!', 'success');
      }
    } catch (e) { NC.ui.toast('Restore failed: ' + e.message, 'error'); }
    input.value = '';
  },
};

NC.notifications = { show() { NC.ui.notifications(); } };

// ===== NETWORK MONITOR =====
const NCnetwork = {
  init() {
    const dot = document.getElementById('online-dot');
    const setOnline = (online) => {
      if (dot) dot.classList.toggle('offline', !online);
    };
    setOnline(navigator.onLine);
    window.addEventListener('online', () => { setOnline(true); NC.ui.toast('🌐 Back online', 'success'); });
    window.addEventListener('offline', () => { setOnline(false); NC.ui.toast('📴 Offline — using local data'); });
  }
};

// ===== BOOT SEQUENCE =====
async function bootNovaCore() {
  const statusEl = document.getElementById('splash-status');
  const steps = [
    ['Initializing storage...', () => NCStorage.init()],
    ['Loading media systems...', () => { NCvideoPlayer.init(); NCaudioPlayer.init(); }],
    ['Loading library...', () => NClibrary.init()],
    ['Loading downloads...', () => NCdownloader.init()],
    ['Loading file manager...', () => NCfileManager.init()],
    ['Loading vault...', () => NCvault.init()],
    ['Loading status saver...', () => NCstatus.init()],
    ['Applying settings...', () => applySettings()],
    ['Starting network monitor...', () => NCnetwork.init()],
    ['Requesting permissions...', () => NC.permissions.requestAll()],
    ['Ready!', () => {}],
  ];

  for (const [msg, fn] of steps) {
    if (statusEl) statusEl.textContent = msg;
    try { await fn(); } catch (e) { console.warn('Boot step failed:', msg, e); }
    await new Promise(r => setTimeout(r, 120));
  }

  // Hide splash, show app
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  splash.style.opacity = '0';
  setTimeout(() => { splash.classList.add('hidden'); app.classList.remove('hidden'); }, 500);

  // Modal close on backdrop
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) NC.ui.closeModal(); });

  // Permission banner
  if (!NCStorage.lsGet('permBannerDismissed', false)) NC.permissions.showBanner();

  NC.ui.showView('view-home');
}

function applySettings() {
  const theme = NCStorage.lsGet('theme', 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  const themeSel = document.getElementById('theme-select');
  if (themeSel) themeSel.value = theme;

  const liteMode = NCStorage.lsGet('liteMode', false);
  if (liteMode) document.body.classList.add('lite-mode');
  const liteModeEl = document.getElementById('lite-mode');
  if (liteModeEl) liteModeEl.checked = liteMode;

  const bgPlayEl = document.getElementById('bg-play');
  if (bgPlayEl) bgPlayEl.checked = NCStorage.lsGet('bgPlay', true);

  const hwAccelEl = document.getElementById('hw-accel');
  if (hwAccelEl) hwAccelEl.checked = NCStorage.lsGet('hwAccel', true);

  const defAiEl = document.getElementById('def-ai');
  const defaultAI = NCStorage.lsGet('defaultAI', 'auto');
  if (defAiEl) defAiEl.value = defaultAI;
  NC.ai.setModel(defaultAI);

  const eqEnabled = NCStorage.lsGet('eq_enabled', false);
  const eqEl = document.getElementById('eq-enabled');
  if (eqEl) eqEl.checked = eqEnabled;
  const eqControls = document.getElementById('eq-controls');
  if (eqControls) eqControls.classList.toggle('hidden', !eqEnabled);
  if (eqEnabled) NCaudioEngine.buildEQSliders && NCaudioEngine.buildEQSliders(NCStorage.lsGet('eq_bands', new Array(10).fill(0)));
}

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', bootNovaCore);
