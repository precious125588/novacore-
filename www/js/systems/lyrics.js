// ===== LYRICS ENGINE =====
const NClosyrics = (() => {
  let lines = [], trackName = '', fullscreen = false;

  async function loadForTrack(name, artist) {
    trackName = name;
    lines = [];
    updateDisplay();

    // Try to load lyrics
    try {
      let lyricsText = null;
      // Try Prexzy genlyrics
      try { const d = await PrexzyAPI.genLyrics(`${name} ${artist || ''}`); lyricsText = typeof d === 'string' ? d : d?.lyrics || d?.result || null; } catch {}
      // Try DavidCyril lyrics search
      if (!lyricsText) {
        try { const d = await DavidCyrilAPI.getLyrics(`${name} ${artist || ''}`); lyricsText = typeof d === 'string' ? d : d?.lyrics || d?.result || null; } catch {}
      }
      if (lyricsText) {
        parse(lyricsText);
        updateDisplay();
        // Cache
        NCStorage.put('lyrics', { id: name, text: lyricsText });
      }
    } catch {}
  }

  function parse(text) {
    // Try LRC format [mm:ss.xx]
    const lrcLines = text.split('\n').filter(l => l.match(/\[(\d+):(\d+)\.?(\d*)\]/));
    if (lrcLines.length > 3) {
      lines = lrcLines.map(l => {
        const m = l.match(/\[(\d+):(\d+)\.?(\d*)\](.*)/);
        if (!m) return null;
        const time = parseInt(m[1])*60 + parseFloat(m[2] + '.' + (m[3]||'0'));
        return { time, text: m[4].trim() };
      }).filter(Boolean);
    } else {
      // Plain text lyrics — no timestamps
      lines = text.split('\n').filter(l => l.trim()).map((l, i) => ({ time: -1, text: l.trim() }));
    }
  }

  function sync(currentTime) {
    if (!lines.length) return;
    // Find active line
    const timedLines = lines.filter(l => l.time >= 0);
    if (!timedLines.length) return;
    const activeIdx = timedLines.reduce((best, l, i) => l.time <= currentTime ? i : best, 0);
    highlightLine(activeIdx);
  }

  function highlightLine(idx) {
    const container = document.getElementById('ap-lyrics');
    const fullContainer = document.getElementById('lyrics-full-content');
    document.querySelectorAll('.lyric-line').forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
    // Scroll to active
    const active = document.querySelector('.lyric-line.active');
    if (active && fullContainer) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Mini lyrics in player
    if (container && lines[idx]) container.textContent = lines[idx].text;
  }

  function updateDisplay() {
    const full = document.getElementById('lyrics-full-content');
    if (full) {
      full.innerHTML = lines.length ? lines.map((l, i) => `<div class="lyric-line" data-idx="${i}">${l.text || ''}</div>`).join('') : '<div style="color:var(--text3);margin-top:40px">No lyrics found</div>';
    }
    const mini = document.getElementById('ap-lyrics');
    if (mini) mini.textContent = lines.length ? lines[0]?.text || '' : '';
  }

  function toggleFullscreen() {
    const el = document.getElementById('lyrics-fullscreen');
    fullscreen = !fullscreen;
    el.classList.toggle('hidden', !fullscreen);
    if (fullscreen) updateDisplay();
  }

  return { loadForTrack, parse, sync, updateDisplay, toggleFullscreen };
})();
