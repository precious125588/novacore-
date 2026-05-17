// ===== SMART SEARCH SYSTEM =====
const NCsearch = (() => {
  let searchTimer = null;
  const SUGGESTIONS = ['TikTok download', 'YouTube video', 'Instagram reel', 'Facebook video', 'MP3 music', 'WhatsApp status', 'Trending videos', 'Movies 2025', 'Action films', 'Anime episodes'];

  function open() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('hidden');
    setTimeout(() => document.getElementById('global-search').focus(), 100);
    showSuggestions();
  }

  function close() {
    document.getElementById('search-overlay').classList.add('hidden');
    document.getElementById('global-search').value = '';
    document.getElementById('search-results').innerHTML = '';
  }

  function clear() {
    document.getElementById('search-results').innerHTML = '';
    showSuggestions();
  }

  function showSuggestions() {
    const container = document.getElementById('search-suggestions');
    container.innerHTML = SUGGESTIONS.map(s =>
      `<div class="search-suggestion" onclick="document.getElementById('global-search').value='${s}';NCsearch.query('${s}')">${s}</div>`
    ).join('');
  }

  function query(q) {
    clearTimeout(searchTimer);
    if (!q.trim()) { clear(); return; }
    searchTimer = setTimeout(() => doSearch(q), 400);
  }

  async function doSearch(q) {
    const results = document.getElementById('search-results');
    results.innerHTML = '<div style="color:var(--text2);padding:16px;text-align:center"><span class="spin">⏳</span> Searching...</div>';

    const allResults = { library: [], history: [], ai: null, web: null };

    // Search local library
    const libItems = await NCStorage.getAll('library');
    allResults.library = libItems.filter(i => (i.name||'').toLowerCase().includes(q.toLowerCase())).slice(0, 5);
    const histItems = await NCStorage.getAll('history');
    allResults.history = histItems.filter(i => (i.name||'').toLowerCase().includes(q.toLowerCase())).slice(0, 5);

    // Search online if connected
    if (navigator.onLine) {
      try { allResults.web = await PrexzyAPI.search(q); } catch {}
      if (!allResults.web) { try { allResults.web = await DavidCyrilAPI.search(q); } catch {} }
    }

    renderResults(q, allResults);
  }

  function renderResults(q, { library, history, web }) {
    const results = document.getElementById('search-results');
    let html = '';

    if (library.length) {
      html += `<div class="search-group-title">My Library</div>`;
      html += library.map(i => `
        <div class="search-item" onclick="NClibrary.openItem('${i.id}','${i.type === 'video' ? 'videos' : 'music'}')">
          <div class="search-item-icon">${i.type === 'video' ? '🎬' : '🎵'}</div>
          <div class="search-item-info">
            <div class="search-item-title">${highlight(i.name || '', q)}</div>
            <div class="search-item-sub">In library · ${i.type}</div>
          </div>
        </div>
      `).join('');
    }

    if (history.length) {
      html += `<div class="search-group-title">History</div>`;
      html += history.map(i => `
        <div class="search-item" onclick="NCsearch.close()">
          <div class="search-item-icon">📜</div>
          <div class="search-item-info">
            <div class="search-item-title">${highlight(i.name || '', q)}</div>
            <div class="search-item-sub">Recent</div>
          </div>
        </div>
      `).join('');
    }

    if (web) {
      const items = extractWebResults(web);
      if (items.length) {
        html += `<div class="search-group-title">Web Results</div>`;
        html += items.slice(0, 8).map(item => `
          <div class="search-item" onclick="NCsearch.openWebResult('${encodeURIComponent(item.url||'')}','${encodeURIComponent(item.title||'')}')">
            <div class="search-item-icon">${item.thumb ? `<img src="${item.thumb}" style="width:36px;height:36px;object-fit:cover;border-radius:6px">` : '🌐'}</div>
            <div class="search-item-info">
              <div class="search-item-title">${item.title || 'Result'}</div>
              <div class="search-item-sub">${item.desc || item.url || ''}</div>
            </div>
          </div>
        `).join('');
      }
    }

    // Ask AI option
    html += `
      <div class="search-group-title">AI</div>
      <div class="search-item" onclick="NCsearch.searchWithAI('${encodeURIComponent(q)}')">
        <div class="search-item-icon">🤖</div>
        <div class="search-item-info">
          <div class="search-item-title">Ask AI: "${q}"</div>
          <div class="search-item-sub">Get an AI-powered answer</div>
        </div>
      </div>
      <div class="search-item" onclick="NCsearch.downloadSearch('${encodeURIComponent(q)}')">
        <div class="search-item-icon">⬇</div>
        <div class="search-item-info">
          <div class="search-item-title">Download: "${q}"</div>
          <div class="search-item-sub">Try to download this content</div>
        </div>
      </div>
    `;

    if (!library.length && !history.length && !web) html = '<div class="empty-state"><p>No results found. Check your connection.</p></div>';
    results.innerHTML = html;
  }

  function extractWebResults(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(i => ({ title: i.title||i.name, url: i.url||i.link, desc: i.description||i.desc||i.snippet, thumb: i.thumbnail||i.image }));
    if (data.results) return extractWebResults(data.results);
    if (data.data) return extractWebResults(data.data);
    if (data.items) return extractWebResults(data.items);
    return [];
  }

  function highlight(text, q) {
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    return text.replace(re, '<mark style="background:rgba(124,58,237,0.3);color:inherit;border-radius:2px">$1</mark>');
  }

  function searchWithAI(encodedQ) {
    const q = decodeURIComponent(encodedQ);
    close();
    NC.ui.showView('view-ai');
    document.getElementById('ai-input').value = q;
    NCai.send();
  }

  function downloadSearch(encodedQ) {
    const q = decodeURIComponent(encodedQ);
    close();
    NC.ui.showView('view-downloader');
    document.getElementById('dl-url').value = q;
  }

  function openWebResult(encodedUrl, encodedTitle) {
    const url = decodeURIComponent(encodedUrl);
    const title = decodeURIComponent(encodedTitle);
    if (!url) return;
    close();
    NC.ui.showView('view-downloader');
    document.getElementById('dl-url').value = url;
    NCdownloader.startFromUrl();
  }

  return { open, close, clear, query };
})();
