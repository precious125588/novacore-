// ===== SMART DOWNLOAD MANAGER v2 =====
const NCdownloader = (() => {
  let downloads = [];
  let activeControllers = {};

  async function init() {
    const saved = await NCStorage.getAll('downloads');
    downloads = saved || [];
    render();
  }

  function onPaste(e) {
    setTimeout(() => {
      const v = document.getElementById('dl-url').value.trim();
      if (v.startsWith('http')) startFromUrl();
    }, 80);
  }

  async function startFromUrl() {
    const url = document.getElementById('dl-url').value.trim();
    if (!url || !url.startsWith('http')) { NC.ui.toast('Enter a valid URL starting with https://', 'error'); return; }
    const result = document.getElementById('dl-result');
    result.classList.remove('hidden');
    result.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text2)"><span class="spin">⏳</span> Analyzing link...</div>`;
    try {
      const data = await analyze(url);
      renderResult(data, url);
    } catch (e) {
      result.innerHTML = `<div class="card" style="border-color:rgba(239,68,68,.3)">
        <div style="color:var(--danger);font-weight:600;margin-bottom:6px">⚠ Could not analyze this URL</div>
        <div style="font-size:12px;color:var(--text2)">${e.message}</div>
        <div style="margin-top:10px;font-size:12px;color:var(--text2)">Try: TikTok, Instagram, YouTube, Facebook, Twitter links</div>
      </div>`;
    }
  }

  async function analyze(url) {
    let domain = '';
    try { domain = new URL(url).hostname.toLowerCase(); } catch {}

    let data = null;
    const tryList = [];

    // Build priority order based on domain
    if (domain.includes('tiktok') || domain.includes('vm.tiktok') || domain.includes('vt.tiktok')) {
      tryList.push(() => PrexzyAPI.tiktokV2(url), () => PrexzyAPI.tiktok(url), () => PrexzyAPI.aio(url), () => DavidCyrilAPI.tiktokDl(url));
    } else if (domain.includes('youtube') || domain.includes('youtu.be')) {
      tryList.push(() => PrexzyAPI.youtubeInfo(url), () => DavidCyrilAPI.ytInfo(url));
    } else if (domain.includes('instagram')) {
      tryList.push(() => PrexzyAPI.instagram(url), () => DavidCyrilAPI.instagramDl(url), () => PrexzyAPI.aio(url));
    } else if (domain.includes('facebook') || domain.includes('fb.watch')) {
      tryList.push(() => PrexzyAPI.facebook(url), () => DavidCyrilAPI.facebookDl(url), () => PrexzyAPI.aio(url));
    } else if (domain.includes('twitter') || domain.includes('x.com')) {
      tryList.push(() => PrexzyAPI.twitter(url), () => DavidCyrilAPI.twitterDl(url), () => PrexzyAPI.aio(url));
    } else if (domain.includes('soundcloud')) {
      tryList.push(() => PrexzyAPI.soundcloud(url), () => DavidCyrilAPI.soundcloudDl(url));
    } else if (domain.includes('spotify')) {
      tryList.push(() => PrexzyAPI.spotify(url), () => DavidCyrilAPI.spotifyDl(url));
    } else if (domain.includes('capcut')) {
      tryList.push(() => PrexzyAPI.capcut(url));
    } else if (domain.includes('pinterest')) {
      tryList.push(() => PrexzyAPI.pinterest(url));
    } else if (domain.includes('threads')) {
      tryList.push(() => PrexzyAPI.threads(url));
    } else if (domain.includes('mediafire')) {
      tryList.push(() => PrexzyAPI.mediafire(url));
    } else {
      // Generic AIO
      tryList.push(() => PrexzyAPI.aio(url), () => DavidCyrilAPI.aioDownload(url));
    }

    for (const fn of tryList) {
      try {
        const res = await fn();
        if (res) { data = res; break; }
      } catch {}
    }

    if (!data) throw new Error('All download APIs failed. Check the URL and try again.');
    return { raw: data, url };
  }

  function renderResult({ raw, url }) {
    const result = document.getElementById('dl-result');
    const opts = extractOptions(raw, url);
    const meta = extractMeta(raw);

    let html = '';
    if (meta.title || meta.thumb) {
      html += `<div class="dl-media-preview">
        <div class="dl-media-thumb">${meta.thumb ? `<img src="${meta.thumb}" style="width:80px;height:60px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` : '🎬'}</div>
        <div class="dl-media-info">
          <div class="dl-media-title">${meta.title || 'Media'}</div>
          <div class="dl-media-meta">${meta.author || meta.duration || ''}</div>
        </div>
      </div>`;
    }

    if (!opts.length) {
      html += '<div style="color:var(--warning);font-size:13px">⚠ No direct download links found. The content may be private or protected.</div>';
      result.innerHTML = html;
      return;
    }

    html += `<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">${opts.length} format(s) available:</div>`;
    html += `<div class="dl-options">` + opts.slice(0, 8).map(opt => `
      <div class="dl-option">
        <div class="dl-option-info">
          <div class="dl-option-title">${opt.label}</div>
          <div class="dl-option-meta">${[opt.ext, opt.size, opt.quality].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="dl-option-btns">
          ${opt.type !== 'audio' ? `<button class="btn-sm" onclick="NCdownloader.playDirect('${encodeURIComponent(opt.url)}','${encodeURIComponent(opt.label)}','video')">▶</button>` : `<button class="btn-sm" onclick="NCdownloader.playDirect('${encodeURIComponent(opt.url)}','${encodeURIComponent(opt.label)}','audio')">▶</button>`}
          <button class="btn-primary" style="padding:6px 10px;font-size:12px" onclick="NCdownloader.startDownload('${encodeURIComponent(opt.url)}','${encodeURIComponent(opt.filename || opt.label + '.' + (opt.ext || 'mp4'))}')">⬇</button>
        </div>
      </div>
    `).join('') + `</div>`;

    result.innerHTML = html;
  }

  function extractMeta(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const check = (obj) => ({
      title: obj.title || obj.name || obj.caption || obj.desc,
      thumb: obj.thumbnail || obj.cover || obj.thumb || obj.image || obj.avatar,
      author: obj.author || obj.uploader || obj.creator || obj.nickname,
      duration: obj.duration ? fmtDuration(obj.duration) : null
    });
    const res = check(raw);
    if (raw.data && typeof raw.data === 'object') {
      const d = check(raw.data);
      return { title: res.title || d.title, thumb: res.thumb || d.thumb, author: res.author || d.author, duration: res.duration || d.duration };
    }
    return res;
  }

  function extractOptions(raw, sourceUrl) {
    const opts = [];
    const add = (url, label, type, ext, size, quality) => {
      if (!url) return;
      try { if (!url.startsWith('http') && !url.startsWith('blob:')) return; } catch { return; }
      opts.push({ url, label: label || 'Download', type: type || 'video', ext: ext || 'mp4', size: size || '', quality: quality || '' });
    };
    const filename = ext => {
      const title = extractMeta(raw).title || 'media';
      return title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 40) + '.' + (ext || 'mp4');
    };

    if (!raw) { add(sourceUrl, 'Original URL', 'video', 'mp4'); return opts; }

    if (typeof raw === 'string' && raw.startsWith('http')) { add(raw, 'Download', 'video', 'mp4'); return opts; }

    if (typeof raw === 'object') {
      // TikTok v2 format
      if (raw.data?.play) add(raw.data.play, 'Video (No Watermark)', 'video', 'mp4', null, 'HD');
      if (raw.data?.wmplay) add(raw.data.wmplay, 'Video (Watermark)', 'video', 'mp4', null, 'HD');
      if (raw.data?.music) add(raw.data.music, 'Audio (MP3)', 'audio', 'mp3');
      if (raw.data?.hdplay) add(raw.data.hdplay, 'Video (HD)', 'video', 'mp4', null, 'HD');

      // Prexzy TikTok format
      if (raw.result?.video) add(raw.result.video, 'Video', 'video', 'mp4');
      if (raw.result?.audio) add(raw.result.audio, 'Audio', 'audio', 'mp3');
      if (raw.result?.nowm) add(raw.result.nowm, 'No Watermark', 'video', 'mp4');
      if (raw.result?.wm) add(raw.result.wm, 'With Watermark', 'video', 'mp4');
      if (raw.result?.music) add(raw.result.music, 'Music', 'audio', 'mp3');
      if (raw.result?.play) add(raw.result.play, 'Video', 'video', 'mp4');

      // Direct fields
      if (raw.url) add(raw.url, raw.title || 'Video', 'video', raw.ext || 'mp4', raw.size || '', raw.quality || '');
      if (raw.download) add(raw.download, 'Download', 'video', 'mp4');
      if (raw.video_url) add(raw.video_url, 'Video', 'video', 'mp4');
      if (raw.audio_url) add(raw.audio_url, 'Audio', 'audio', 'mp3');
      if (raw.mp4) add(raw.mp4, 'Video MP4', 'video', 'mp4');
      if (raw.mp3) add(raw.mp3, 'Audio MP3', 'audio', 'mp3');

      // YouTube/generic formats array
      const arrFields = ['formats', 'links', 'downloads', 'medias', 'streams', 'qualities', 'videos'];
      for (const f of arrFields) {
        if (Array.isArray(raw[f])) {
          raw[f].forEach((item, i) => {
            const url2 = item.url || item.link || item.download || item.src;
            const isAudio = (item.vcodec === 'none') || (item.type === 'audio') || ((item.ext || '') === 'mp3') || (item.format_id||'').includes('audio');
            add(url2, item.quality || item.format || item.label || item.resolution || `Option ${i+1}`,
              isAudio ? 'audio' : 'video',
              item.ext || (isAudio ? 'mp3' : 'mp4'),
              item.size || item.filesize ? fmtBytes(item.filesize || item.size) : '',
              item.quality || item.resolution || '');
          });
        }
      }

      // Array of data
      if (Array.isArray(raw)) {
        raw.forEach((item, i) => {
          const url2 = item.url || item.link || item.download || item.src;
          add(url2, item.quality || item.label || item.format || `Option ${i+1}`, item.type || 'video', item.ext || 'mp4', fmtBytes(item.filesize || item.size), item.quality);
        });
      }

      // Nested data/result
      const nested = raw.data || raw.result;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        if (!opts.length) {
          if (nested.url) add(nested.url, 'Video', 'video', 'mp4');
          if (nested.download) add(nested.download, 'Download', 'video', 'mp4');
          if (nested.video) add(nested.video, 'Video', 'video', 'mp4');
          if (nested.audio || nested.music) add(nested.audio || nested.music, 'Audio', 'audio', 'mp3');
        }
        if (Array.isArray(nested)) {
          nested.forEach((item, i) => {
            add(item.url || item.link, item.quality || `Option ${i+1}`, item.type || 'video', item.ext || 'mp4', fmtBytes(item.size), item.quality);
          });
        }
      }
    }

    // Fallback
    if (!opts.length) add(sourceUrl, 'Try Direct URL', 'video', 'mp4');
    return opts;
  }

  function playDirect(encodedUrl, encodedName, type) {
    let url = ''; let name = '';
    try { url = decodeURIComponent(encodedUrl); } catch { url = encodedUrl; }
    try { name = decodeURIComponent(encodedName); } catch { name = encodedName; }
    if (type === 'audio') NCaudioPlayer.playUrl(url, name, '');
    else NCvideoPlayer.open(url, name, 'url');
  }

  async function startDownload(encodedUrl, encodedName) {
    let url = '', name = '';
    try { url = decodeURIComponent(encodedUrl); } catch { url = encodedUrl; }
    try { name = decodeURIComponent(encodedName); } catch { name = encodedName; }
    if (!name) name = 'download_' + Date.now() + '.mp4';

    const id = Date.now().toString() + Math.random().toString(36).slice(2, 5);
    const controller = new AbortController();
    activeControllers[id] = controller;

    const dlItem = { id, name, url, status: 'downloading', progress: 0, speed: '', size: 0, downloaded: 0, timestamp: Date.now() };
    downloads.unshift(dlItem);
    await NCStorage.put('downloads', dlItem);
    render();
    NC.ui.toast(`⬇ Downloading "${name}"...`);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = parseInt(res.headers.get('content-length') || '0');
      dlItem.size = total;

      const reader = res.body.getReader();
      const chunks = [];
      let received = 0, lastTime = Date.now(), lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        dlItem.downloaded = received;
        const now = Date.now();
        if (now - lastTime > 600) {
          const speed = (received - lastBytes) / ((now - lastTime) / 1000);
          dlItem.speed = fmtBytes(speed) + '/s';
          dlItem.progress = total ? (received / total * 100) : Math.min(received / 1048576 * 5, 95);
          lastTime = now; lastBytes = received;
          updateDlItem(dlItem);
        }
      }

      const blob = new Blob(chunks);
      dlItem.status = 'complete'; dlItem.progress = 100; dlItem.size = blob.size;
      const blobUrl = URL.createObjectURL(blob);
      dlItem.blobUrl = blobUrl;
      await NCStorage.put('downloads', dlItem);

      // Trigger device download
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);

      // Add to library
      const ext = name.split('.').pop().toLowerCase();
      const mediaType = ['mp4','webm','mkv','avi','mov','3gp'].includes(ext) ? 'video' : ['mp3','m4a','ogg','flac','wav','aac'].includes(ext) ? 'audio' : 'file';
      NC.library.addDownload({ id, name, url: blobUrl, type: mediaType, size: blob.size, timestamp: Date.now() });

      NC.ui.toast(`✅ "${name}" saved!`, 'success');
    } catch (e) {
      if (e.name === 'AbortError') { dlItem.status = 'paused'; NC.ui.toast('Download paused'); }
      else {
        dlItem.status = 'error'; dlItem.error = e.message;
        NC.ui.toast('Download failed: ' + e.message, 'error');
        console.error('Download error:', e);
      }
      await NCStorage.put('downloads', dlItem);
    } finally {
      delete activeControllers[id];
      render();
    }
  }

  function pauseDownload(id) {
    if (activeControllers[id]) { activeControllers[id].abort(); delete activeControllers[id]; }
    const dl = downloads.find(d => d.id === id);
    if (dl) { dl.status = 'paused'; NCStorage.put('downloads', dl); render(); }
  }

  function resumeDownload(id) {
    const dl = downloads.find(d => d.id === id);
    if (dl) startDownload(encodeURIComponent(dl.url), encodeURIComponent(dl.name));
  }

  async function deleteDownload(id) {
    const idx = downloads.findIndex(d => d.id === id);
    if (idx > -1) downloads.splice(idx, 1);
    await NCStorage.remove('downloads', id);
    render();
  }

  function updateDlItem(dl) {
    const el = document.getElementById('dlitem_' + dl.id);
    if (!el) return;
    const fill = el.querySelector('.dl-progress-fill');
    const speed = el.querySelector('.dl-speed');
    if (fill) fill.style.width = dl.progress.toFixed(0) + '%';
    if (speed) speed.textContent = dl.speed + (dl.size ? ' · ' + fmtBytes(dl.downloaded) + '/' + fmtBytes(dl.size) : ' · ' + fmtBytes(dl.downloaded));
  }

  function render() {
    const active = document.getElementById('dl-active');
    const complete = document.getElementById('dl-complete');
    if (!active || !complete) return;

    const activeDls = downloads.filter(d => d.status === 'downloading' || d.status === 'paused');
    const doneDls = downloads.filter(d => d.status === 'complete' || d.status === 'error');

    active.innerHTML = activeDls.length ? activeDls.map(dl => `
      <div class="dl-item" id="dlitem_${dl.id}">
        <div class="dl-item-top">
          <span class="dl-item-icon">${dl.status==='paused'?'⏸':'⬇'}</span>
          <div class="dl-item-info">
            <div class="dl-item-name">${dl.name}</div>
            <div class="dl-item-meta">${fmtBytes(dl.downloaded)}${dl.size ? ' / ' + fmtBytes(dl.size) : ''}</div>
          </div>
          <div class="dl-item-actions">
            ${dl.status==='downloading'
              ? `<button class="btn-sm" onclick="NCdownloader.pauseDownload('${dl.id}')">⏸</button>`
              : `<button class="btn-sm" onclick="NCdownloader.resumeDownload('${dl.id}')">▶</button>`}
            <button class="btn-sm btn-danger" onclick="NCdownloader.deleteDownload('${dl.id}')">✕</button>
          </div>
        </div>
        <div class="dl-progress"><div class="dl-progress-fill" style="width:${dl.progress.toFixed(0)}%"></div></div>
        <div class="dl-speed">${dl.speed || (dl.status==='paused'?'Paused':'Starting...')}</div>
      </div>
    `).join('') : '<div class="empty-state"><span class="empty-icon">⬇</span><p>No active downloads</p></div>';

    complete.innerHTML = doneDls.length ? doneDls.slice(0, 25).map(dl => `
      <div class="dl-item">
        <div class="dl-item-top">
          <span class="dl-item-icon">${dl.status==='error'?'❌':dl.name?.match(/\.(mp3|m4a|ogg|wav|flac|aac)/i)?'🎵':'🎬'}</span>
          <div class="dl-item-info">
            <div class="dl-item-name">${dl.name}</div>
            <div class="dl-item-meta">${dl.status==='error'?'Failed: '+(dl.error||''):'✅ '+fmtBytes(dl.size)}</div>
          </div>
          <div class="dl-item-actions">
            ${dl.blobUrl ? `<button class="btn-sm" onclick="NCdownloader.openMedia('${dl.id}')">▶</button>` : ''}
            <button class="btn-sm btn-danger" onclick="NCdownloader.deleteDownload('${dl.id}')">✕</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="empty-state"><p>No completed downloads</p></div>';
  }

  function openMedia(id) {
    const dl = downloads.find(d => d.id === id);
    if (!dl || !dl.blobUrl) { NC.ui.toast('File not available', 'error'); return; }
    const ext = dl.name.split('.').pop().toLowerCase();
    if (['mp4','webm','mkv','avi','mov','3gp'].includes(ext)) NCvideoPlayer.open(dl.blobUrl, dl.name, 'blob');
    else NCaudioPlayer.playUrl(dl.blobUrl, dl.name, '');
  }

  function fmtBytes(b) {
    if (!b || b === 0) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
    return (b/1073741824).toFixed(2) + ' GB';
  }

  function fmtDuration(s) {
    if (!s) return '';
    const m = Math.floor(s/60), sec = Math.floor(s%60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  return { init, onPaste, startFromUrl, startDownload, playDirect, pauseDownload, resumeDownload, deleteDownload, openMedia, render };
})();
