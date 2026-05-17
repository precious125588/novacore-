// ===== CODE EDITOR v2 (Full Screen + Slide Sidebar) =====
const NCcodeEditor = (() => {
  let editor = null, openFiles = [], activeIdx = -1, sidebarOpen = false;

  function init() {
    if (editor) return; // Already initialized
    const wrap = document.getElementById('code-editor-wrap');
    if (!wrap || !window.CodeMirror) { setTimeout(init, 400); return; }

    editor = CodeMirror(wrap, {
      value: '// Welcome to NovaCore Code Editor\n// Use the ☰ button to open files\n',
      mode: 'javascript',
      theme: 'dracula',
      lineNumbers: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      lineWrapping: false,
      scrollbarStyle: 'native',
      extraKeys: {
        'Ctrl-S': () => saveFile(),
        'Cmd-S': () => saveFile(),
        'Ctrl-/': 'toggleComment',
        'Cmd-/': 'toggleComment',
        'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('  '),
      }
    });

    editor.on('change', () => markUnsaved());

    // Load saved files
    const saved = NCStorage.lsGet('open_files_v2', []);
    openFiles = saved;
    if (openFiles.length) setActive(0);
    buildTabs();
    buildTree();
    interceptConsole();
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    const sidebar = document.getElementById('code-sidebar');
    const dimmer = document.getElementById('sidebar-dimmer');
    if (sidebar) sidebar.classList.toggle('open', sidebarOpen);
    if (dimmer) {
      dimmer.classList.toggle('show', sidebarOpen);
      dimmer.onclick = () => toggleSidebar();
    }
  }

  function openSidebar() { if (!sidebarOpen) toggleSidebar(); }
  function closeSidebar() { if (sidebarOpen) toggleSidebar(); }

  function newFile() {
    NC.ui.showModal('New File', '<input class="input" id="nf-name" placeholder="e.g. index.html, script.js" autocomplete="off"/>', [
      { label:'Cancel', action: () => NC.ui.closeModal() },
      { label:'Create', action: () => {
        const name = document.getElementById('nf-name')?.value?.trim();
        if (!name) { NC.ui.toast('Enter a filename', 'error'); return; }
        const f = { id: Date.now().toString(), name, content: getTemplate(name), lang: detectLang(name), unsaved: false };
        openFiles.push(f);
        NC.ui.closeModal();
        setActive(openFiles.length - 1);
        closeSidebar();
      }}
    ]);
  }

  function getTemplate(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'html') return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>';
    if (ext === 'css') return '/* Styles */\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n';
    if (ext === 'js') return '// JavaScript\n\'use strict\';\n\n';
    if (ext === 'py') return '# Python Script\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n';
    if (ext === 'json') return '{\n  \n}\n';
    return '';
  }

  function openFile() { document.getElementById('code-file-input').click(); }

  function loadFromFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const f = { id: Date.now().toString(), name: file.name, content: e.target.result || '', lang: detectLang(file.name), unsaved: false };
      const ex = openFiles.findIndex(f2 => f2.name === f.name);
      if (ex > -1) { openFiles[ex] = f; setActive(ex); }
      else { openFiles.push(f); setActive(openFiles.length - 1); }
      NC.ui.toast('Opened: ' + file.name, 'success');
      closeSidebar();
    };
    reader.readAsText(file);
    input.value = '';
  }

  function openFileFromManager(file) {
    const ex = openFiles.findIndex(f => f.name === file.name);
    if (ex > -1) { setActive(ex); return; }
    const f = { id: Date.now().toString(), name: file.name, content: file.content || '', lang: detectLang(file.name), unsaved: false };
    openFiles.push(f);
    setActive(openFiles.length - 1);
  }

  function setActive(idx) {
    if (idx < 0 || idx >= openFiles.length) return;
    activeIdx = idx;
    const file = openFiles[idx];
    if (editor) {
      editor.setValue(file.content || '');
      setLanguage(file.lang || detectLang(file.name));
      editor.clearHistory();
      editor.refresh();
    }
    buildTabs();
    buildTree();
    saveToStorage();
  }

  function closeTab(idx, e) {
    if (e) e.stopPropagation();
    const file = openFiles[idx];
    if (!file) return;
    if (file.unsaved) {
      NC.ui.showModal('Unsaved Changes', `Save "${file.name}" before closing?`, [
        { label:"Don't Save", action: () => { NC.ui.closeModal(); doClose(idx); } },
        { label:'Save & Close', action: () => { NC.ui.closeModal(); saveFile(); doClose(idx); } },
        { label:'Cancel', action: () => NC.ui.closeModal() },
      ]);
    } else doClose(idx);
  }

  function doClose(idx) {
    openFiles.splice(idx, 1);
    if (activeIdx >= openFiles.length) activeIdx = openFiles.length - 1;
    if (openFiles.length === 0) { activeIdx = -1; editor?.setValue('// Open a file to start coding\n'); }
    else setActive(Math.max(0, activeIdx));
    buildTabs();
    buildTree();
    saveToStorage();
  }

  function saveFile() {
    if (activeIdx < 0 || !editor) return;
    openFiles[activeIdx].content = editor.getValue();
    openFiles[activeIdx].unsaved = false;
    saveToStorage();
    buildTabs();
    buildTree();
    NC.ui.toast('✅ Saved: ' + openFiles[activeIdx].name, 'success');

    // Save to device via download
    const file = openFiles[activeIdx];
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    NCfileManager.addFileToFS({ name: file.name, type: 'file', content: file.content, blobUrl: url, size: blob.size, created: Date.now() });
  }

  function saveToStorage() {
    try {
      NCStorage.lsSet('open_files_v2', openFiles.map(f => ({ id: f.id, name: f.name, content: (f.content || '').slice(0, 50000), lang: f.lang })));
    } catch {}
  }

  function markUnsaved() {
    if (activeIdx >= 0 && openFiles[activeIdx]) {
      openFiles[activeIdx].unsaved = true;
      buildTabs();
    }
  }

  function buildTabs() {
    const container = document.getElementById('code-tabs');
    if (!container) return;
    if (!openFiles.length) {
      container.innerHTML = '<div style="padding:0 12px;color:var(--text3);font-size:11px;line-height:36px">No files</div>';
      return;
    }
    container.innerHTML = openFiles.map((f, i) => `
      <div class="code-tab ${i === activeIdx ? 'active' : ''}" onclick="NCcodeEditor.setActive(${i})">
        <span>${getFileIcon(f.name)}</span>
        <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis">${f.name}</span>
        ${f.unsaved ? '<span style="color:var(--warning);font-size:10px">●</span>' : ''}
        <span class="close-tab" onclick="NCcodeEditor.closeTab(${i}, event)">✕</span>
      </div>
    `).join('');
  }

  function buildTree() {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    if (!openFiles.length) {
      tree.innerHTML = '<div style="padding:10px;color:var(--text3);font-size:11px;text-align:center">No open files.<br/>Tap + to create or 📂 to open.</div>';
      return;
    }
    tree.innerHTML = openFiles.map((f, i) => `
      <div class="tree-item ${i === activeIdx ? 'active' : ''} ${f.unsaved ? 'unsaved' : ''}" onclick="NCcodeEditor.setActive(${i});NCcodeEditor.closeSidebar()">
        <span>${getFileIcon(f.name)}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${f.name}</span>
        ${f.unsaved ? '<span style="color:var(--warning);font-size:9px">●</span>' : ''}
      </div>
    `).join('');
  }

  function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map = { js:'📜', ts:'📘', html:'🌐', css:'🎨', json:'⚙', py:'🐍', php:'🐘', md:'📝', txt:'📄', xml:'📋', sql:'🗄', sh:'⌨', cpp:'⚙', c:'⚙', java:'☕', rb:'💎', go:'🐹', rs:'🦀', vue:'💚', jsx:'⚛', tsx:'⚛' };
    return map[ext] || '📄';
  }

  function setLanguage(lang) {
    if (!editor) return;
    const modeMap = { js:'javascript', javascript:'javascript', ts:'javascript', typescript:'javascript', jsx:'javascript', tsx:'javascript', html:'htmlmixed', css:'css', py:'python', python:'python', php:'php', json:'javascript', xml:'xml', md:'markdown', markdown:'markdown', c:'clike', cpp:'clike', java:'clike', clike:'clike', rb:'ruby', go:'go', rs:'rust', vue:'htmlmixed' };
    const mode = modeMap[lang] || lang || 'javascript';
    try { editor.setOption('mode', mode); } catch {}
    const sel = document.getElementById('lang-select');
    if (sel && sel.querySelector(`option[value="${mode}"]`)) sel.value = mode;
    if (activeIdx >= 0 && openFiles[activeIdx]) { openFiles[activeIdx].lang = lang; saveToStorage(); }
  }

  function detectLang(filename) {
    return (filename || '').split('.').pop().toLowerCase() || 'javascript';
  }

  function getCode() { return editor ? editor.getValue() : ''; }
  function setCode(code) { if (editor) { editor.setValue(code || ''); editor.refresh(); } }

  async function runCode() {
    const code = getCode();
    if (!code.trim()) { NC.ui.toast('No code to run', 'error'); return; }
    const lang = (openFiles[activeIdx]?.lang || 'js').toLowerCase();
    toggleConsole(true);
    clearConsole();
    log('▶ Running ' + (openFiles[activeIdx]?.name || 'code') + '...', 'info');

    if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(lang)) {
      try {
        const logs = [];
        const fakeCons = {
          log: (...a) => { log(a.map(s => typeof s === 'object' ? JSON.stringify(s, null, 2) : String(s)).join(' '), 'log'); },
          error: (...a) => { log('❌ ' + a.join(' '), 'error'); },
          warn: (...a) => { log('⚠ ' + a.join(' '), 'warn'); },
          info: (...a) => { log('ℹ ' + a.join(' '), 'info'); },
        };
        const fn = new Function('console', 'window', `"use strict";\n${code}`);
        const result = fn(fakeCons, undefined);
        if (result !== undefined) log('→ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)), 'info');
        log('✅ Done (no errors)', 'info');
      } catch (e) { log('❌ ' + e.constructor.name + ': ' + e.message, 'error'); }
    } else if (['html', 'htmlmixed'].includes(lang)) {
      const blob = new Blob([code], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.click();
      log('✅ HTML opened in new tab', 'info');
    } else {
      log(`ℹ Direct run not available for ${lang}.\nUse AI → Fix Bugs to get help interpreting this code.`, 'warn');
    }
  }

  function evalConsole(e) {
    if (e.key !== 'Enter') return;
    const input = document.getElementById('console-input');
    if (!input) return;
    const expr = input.value.trim();
    if (!expr) return;
    log('> ' + expr, 'log');
    try {
      const r = eval(expr);
      if (r !== undefined) log('← ' + (typeof r === 'object' ? JSON.stringify(r, null, 2) : String(r)), 'info');
    } catch (err) { log('❌ ' + err.message, 'error'); }
    input.value = '';
  }

  function log(text, type = 'log') {
    const out = document.getElementById('console-output');
    if (!out) return;
    const el = document.createElement('div');
    el.className = 'console-' + type;
    el.textContent = text;
    out.appendChild(el);
    out.scrollTop = out.scrollHeight;
  }

  function clearConsole() {
    const out = document.getElementById('console-output');
    if (out) out.innerHTML = '';
  }

  let consoleVisible = false;
  function toggleConsole(forceShow) {
    consoleVisible = forceShow !== undefined ? forceShow : !consoleVisible;
    const el = document.getElementById('debug-console');
    if (el) el.classList.toggle('hidden', !consoleVisible);
  }

  function interceptConsole() {
    // Only in debug mode
    if (!NCStorage.lsGet('debugMode', false)) return;
    const orig = { log: console.log, error: console.error, warn: console.warn };
    console.log = (...a) => { orig.log(...a); log(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '), 'log'); };
    console.error = (...a) => { orig.error(...a); log(a.join(' '), 'error'); };
    console.warn = (...a) => { orig.warn(...a); log(a.join(' '), 'warn'); };
  }

  function newFolder() { NCfileManager.createFolder(); }

  return {
    init, toggleSidebar, openSidebar, closeSidebar,
    newFile, newFolder, openFile, loadFromFile, openFileFromManager,
    setActive, closeTab, saveFile, setLanguage, getCode, setCode,
    runCode, evalConsole, clearConsole, toggleConsole, buildTabs, buildTree, interceptConsole
  };
})();
