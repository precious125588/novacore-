// ===== SUBTITLE ENGINE =====
const NCsubtitles = (() => {
  let cues = [], currentLang = 'en', syncOffset = 0;
  let fontSize = 18, fontColor = '#ffffff', enabled = true;

  function openPanel() { document.getElementById('subtitle-panel').classList.remove('hidden'); }
  function closePanel() { document.getElementById('subtitle-panel').classList.add('hidden'); }

  function loadFromFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { parseSub(e.target.result, file.name); NC.ui.toast('Subtitles loaded', 'success'); closePanel(); };
    reader.readAsText(file);
    input.value = '';
  }

  function parseSub(text, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'srt') cues = parseSRT(text);
    else if (ext === 'ass' || ext === 'ssa') cues = parseASS(text);
    else if (ext === 'vtt') cues = parseVTT(text);
    else cues = parseSRT(text);
  }

  function parseSRT(text) {
    const result = [];
    const blocks = text.trim().split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      if (!timeMatch) continue;
      const toSec = (h,m,s,ms) => parseInt(h)*3600 + parseInt(m)*60 + parseInt(s) + parseInt(ms)/1000;
      result.push({
        start: toSec(timeMatch[1],timeMatch[2],timeMatch[3],timeMatch[4]),
        end: toSec(timeMatch[5],timeMatch[6],timeMatch[7],timeMatch[8]),
        text: lines.slice(2).join('\n').replace(/<[^>]+>/g,'')
      });
    }
    return result;
  }

  function parseVTT(text) {
    const result = [];
    const blocks = text.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const timeLine = lines.find(l => l.includes('-->'));
      if (!timeLine) continue;
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (!timeMatch) continue;
      const toSec = (h,m,s,ms) => parseInt(h)*3600+parseInt(m)*60+parseInt(s)+parseInt(ms)/1000;
      const textLines = lines.slice(lines.indexOf(timeLine)+1).filter(l=>l.trim());
      result.push({ start: toSec(...timeMatch.slice(1,5)), end: toSec(...timeMatch.slice(5,9)), text: textLines.join('\n') });
    }
    return result;
  }

  function parseASS(text) {
    const result = [];
    const events = text.split('\n').filter(l => l.startsWith('Dialogue:'));
    for (const line of events) {
      const parts = line.split(',');
      if (parts.length < 10) continue;
      const toSec = t => { const [h,m,s] = t.trim().split(':'); return parseFloat(h)*3600+parseFloat(m)*60+parseFloat(s); };
      const subText = parts.slice(9).join(',').replace(/\{[^}]+\}/g,'').trim();
      result.push({ start: toSec(parts[1]), end: toSec(parts[2]), text: subText });
    }
    return result;
  }

  function update(time) {
    const overlay = document.getElementById('vc-subtitle-overlay');
    if (!overlay || !enabled || !cues.length) { if (overlay) overlay.textContent = ''; return; }
    const t = time + syncOffset / 1000;
    const active = cues.find(c => t >= c.start && t <= c.end);
    overlay.textContent = active ? active.text : '';
    overlay.style.fontSize = fontSize + 'px';
    overlay.style.color = fontColor;
  }

  async function search() {
    const q = document.getElementById('sub-search-input').value.trim();
    if (!q) return;
    const results = document.getElementById('sub-search-results');
    results.innerHTML = '<div class="spin">⏳ Searching...</div>';
    try {
      let data;
      try { data = await DavidCyrilAPI.getSubtitle(q); } catch { data = null; }
      if (!data || !data.length) { results.innerHTML = '<p style="color:var(--text2)">No subtitles found. Try OpenSubtitles.org manually.</p>'; return; }
      results.innerHTML = data.slice(0,5).map((s,i) => `
        <div class="sub-result" onclick="NCsubtitles.loadRemote('${encodeURIComponent(s.url||s.download||'')}','${encodeURIComponent(s.title||s.name||'subtitle')}.srt')">
          ${s.title || s.name || `Subtitle ${i+1}`} — ${s.lang || ''} ${s.downloads ? `(${s.downloads} dl)` : ''}
        </div>
      `).join('');
    } catch { results.innerHTML = '<p style="color:var(--danger)">Search failed. Check connection.</p>'; }
  }

  async function loadRemote(encodedUrl, name) {
    try {
      const url = decodeURIComponent(encodedUrl);
      const res = await fetch(url);
      const text = await res.text();
      parseSub(text, decodeURIComponent(name));
      NC.ui.toast('Subtitles loaded!', 'success');
      closePanel();
    } catch { NC.ui.toast('Failed to load subtitle', 'error'); }
  }

  function setSize(v) { fontSize = parseInt(v); }
  function setColor(v) { fontColor = v; }
  function setSync(v) { syncOffset = parseInt(v) || 0; }
  function setLang(v) { currentLang = v; }
  function toggle() { enabled = !enabled; if (!enabled) document.getElementById('vc-subtitle-overlay').textContent = ''; }

  return { openPanel, closePanel, loadFromFile, loadRemote, update, search, setSize, setColor, setSync, setLang, toggle };
})();
