// ===== AUDIO / MUSIC PLAYER v2 (Dope Design) =====
const NCaudioPlayer = (() => {
  let audio = null, queue = [], currentIndex = 0;
  let shuffle = false, repeatMode = 0; // 0=none,1=all,2=one
  let expanded = false, seekDragging = false, isConnected = false;
  let rotationAnim = null;

  function init() {
    audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', () => { updatePlayBtns(false); startRotation(); });
    audio.addEventListener('pause', () => { updatePlayBtns(true); stopRotation(); });
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', () => {});

    // Seek bar drag
    const seekBar = document.getElementById('ap-seek-bar');
    if (seekBar) {
      seekBar.addEventListener('touchstart', seekTouchStart, { passive: false });
      seekBar.addEventListener('touchmove', seekTouchMove, { passive: false });
      seekBar.addEventListener('touchend', seekTouchEnd);
      seekBar.addEventListener('click', seekClick);
    }

    // MediaSession API
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) audio.currentTime = d.seekTime; });
      navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    }
  }

  function connectAudio() {
    if (!isConnected && audio) {
      try { NCaudioEngine.connectElement(audio); isConnected = true; } catch {}
    }
  }

  function loadFromFiles(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    queue = files.map((f, i) => ({
      id: i, name: f.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(f),
      artist: '', album: '', art: null, duration: 0
    }));
    currentIndex = 0;
    loadTrack(0);
    expand();
    input.value = '';
  }

  function loadTrack(index) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    const track = queue[index];

    connectAudio();
    NCaudioEngine.resume();
    audio.src = track.src;
    audio.load();
    audio.play().catch(() => updatePlayBtns(true));

    // Update UI
    updateTrackUI(track);
    setMiniPlayer(track);
    setMediaSession(track);

    // Load lyrics async
    NC.lyrics.loadForTrack(track.name, track.artist);

    // History
    NC.library.addHistory({ type: 'audio', name: track.name, src: track.src, artist: track.artist, timestamp: Date.now() });

    // Queue display
    renderQueueHighlight();
  }

  function updateTrackUI(track) {
    const t = el => document.getElementById(el);
    if (t('ap-title')) t('ap-title').textContent = track.name || 'Unknown';
    if (t('ap-artist')) t('ap-artist').textContent = track.artist || 'Unknown Artist';
    const artEl = t('ap-art');
    if (artEl) {
      if (track.art) artEl.innerHTML = `<img src="${track.art}" alt="art"/>`;
      else artEl.textContent = '🎵';
    }
  }

  function setMiniPlayer(track) {
    const mp = document.getElementById('mini-player');
    if (mp) mp.classList.remove('hidden');
    const t = el => document.getElementById(el);
    if (t('mini-title')) t('mini-title').textContent = track.name || 'Unknown';
    if (t('mini-artist')) t('mini-artist').textContent = track.artist || '';
  }

  function setMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || 'Unknown',
      artist: track.artist || '',
      album: track.album || 'NovaCore',
      artwork: track.art ? [{ src: track.art }] : []
    });
  }

  function togglePlay() {
    if (!audio.src && queue.length) { loadTrack(currentIndex); return; }
    NCaudioEngine.resume();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    loadTrack((currentIndex - 1 + queue.length) % queue.length);
  }

  function next() {
    if (shuffle) loadTrack(Math.floor(Math.random() * queue.length));
    else loadTrack((currentIndex + 1) % queue.length);
  }

  function onEnded() {
    if (repeatMode === 2) { audio.currentTime = 0; audio.play().catch(() => {}); }
    else if (repeatMode === 1 || currentIndex < queue.length - 1) next();
    else updatePlayBtns(true);
  }

  function toggleShuffle() {
    shuffle = !shuffle;
    const btn = document.getElementById('shuffle-btn');
    if (btn) btn.style.color = shuffle ? 'var(--primary2)' : '';
    NC.ui.toast(shuffle ? '🔀 Shuffle on' : 'Shuffle off');
  }

  function cycleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('repeat-btn');
    const icons = ['↺', '🔁', '🔂'];
    const tips = ['Repeat off', 'Repeat all', 'Repeat one'];
    if (btn) { btn.textContent = icons[repeatMode]; btn.style.color = repeatMode > 0 ? 'var(--primary2)' : ''; }
    NC.ui.toast(tips[repeatMode]);
  }

  // SEEK
  function seekTouchStart(e) { seekDragging = true; e.preventDefault(); doSeek(e.touches[0].clientX); }
  function seekTouchMove(e) { if (!seekDragging) return; e.preventDefault(); doSeek(e.touches[0].clientX); }
  function seekTouchEnd() { seekDragging = false; }
  function seekClick(e) { doSeek(e.clientX); }
  function doSeek(clientX) {
    const bar = document.getElementById('ap-seek-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * (audio.duration || 0);
  }

  function onTimeUpdate() {
    const cur = audio.currentTime, dur = audio.duration || 0;
    const ratio = dur ? cur / dur : 0;
    const fmt = t => { if (!t || isNaN(t)) return '0:00'; const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
    const t = id => document.getElementById(id);
    if (t('ap-current')) t('ap-current').textContent = fmt(cur);
    if (t('ap-duration')) t('ap-duration').textContent = fmt(dur);
    if (t('ap-seek-fill')) t('ap-seek-fill').style.width = (ratio * 100) + '%';
    if (t('ap-seek-thumb')) t('ap-seek-thumb').style.left = (ratio * 100) + '%';
    if ('mediaSession' in navigator && dur > 0) {
      try { navigator.mediaSession.setPositionState({ duration: dur, playbackRate: audio.playbackRate, position: cur }); } catch {}
    }
    NC.lyrics.sync(cur);
  }

  function onMeta() {
    const fmt = t => { const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
    const el = document.getElementById('ap-duration');
    if (el) el.textContent = fmt(audio.duration || 0);
    if (queue[currentIndex]) queue[currentIndex].duration = audio.duration;
  }

  function onError() {
    NC.ui.toast('Audio error — check file format', 'error');
    updatePlayBtns(true);
  }

  function updatePlayBtns(paused) {
    const icon = paused ? '▶' : '⏸';
    const el = id => document.getElementById(id);
    if (el('ap-play-btn')) el('ap-play-btn').textContent = icon;
    if (el('mini-play-wrap')) el('mini-play-wrap').textContent = icon;
    const wave = document.getElementById('mini-wave');
    if (wave) wave.classList.toggle('paused', paused);
  }

  function startRotation() {
    const art = document.getElementById('ap-art');
    if (art) art.classList.add('spinning');
    const canvas = document.getElementById('visualizer');
    if (canvas && expanded) NCaudioEngine.startVisualizer(canvas);
  }

  function stopRotation() {
    const art = document.getElementById('ap-art');
    if (art) art.classList.remove('spinning');
  }

  function expand() {
    document.getElementById('audio-player').classList.remove('hidden');
    expanded = true;
    if (!audio.paused) startRotation();
    const canvas = document.getElementById('visualizer');
    if (canvas) NCaudioEngine.startVisualizer(canvas);
  }

  function collapse() {
    document.getElementById('audio-player').classList.add('hidden');
    expanded = false;
    stopRotation();
  }

  function close() {
    audio.pause();
    audio.src = '';
    const mp = document.getElementById('mini-player');
    if (mp) mp.classList.add('hidden');
    collapse();
    queue = [];
  }

  function showQueue() {
    const panel = document.getElementById('queue-panel');
    panel.classList.remove('hidden');
    renderQueueList();
  }

  function closeQueue() { document.getElementById('queue-panel').classList.add('hidden'); }

  function renderQueueList() {
    const list = document.getElementById('queue-list');
    if (!list) return;
    list.innerHTML = queue.map((t, i) => `
      <div class="queue-item ${i === currentIndex ? 'playing' : ''}" onclick="NCaudioPlayer.loadTrack(${i})">
        <span style="color:var(--text3);font-size:11px;width:24px;flex-shrink:0">${i+1}</span>
        <div class="queue-item-info">${t.name || 'Unknown'}</div>
        ${i === currentIndex ? '<span style="color:var(--primary2);font-size:12px">▶</span>' : `<button class="mini-btn" onclick="event.stopPropagation();NCaudioPlayer.removeFromQueue(${i})">✕</button>`}
      </div>
    `).join('') || '<div class="empty-state"><p>Queue is empty</p></div>';
  }

  function renderQueueHighlight() {
    document.querySelectorAll('.queue-item').forEach((el, i) => {
      el.classList.toggle('playing', i === currentIndex);
    });
  }

  function removeFromQueue(i) {
    queue.splice(i, 1);
    if (currentIndex >= queue.length) currentIndex = Math.max(0, queue.length - 1);
    renderQueueList();
  }

  function addToQueue(track) {
    queue.push(track);
    NC.ui.toast(`"${track.name}" added to queue`, 'success');
    renderQueueList();
  }

  function playUrl(url, name, artist) {
    try { url = decodeURIComponent(url); } catch {}
    name = name || 'Track';
    try { name = decodeURIComponent(name); } catch {}
    queue = [{ id: 0, name, artist: artist || '', src: url }];
    currentIndex = 0;
    loadTrack(0);
    expand();
  }

  function toggleFavorite() {
    if (!queue[currentIndex]) return;
    const track = queue[currentIndex];
    NC.library.addFavorite({ type: 'audio', name: track.name, src: track.src, artist: track.artist });
    NC.ui.toast('Added to favorites ♥', 'success');
    const btn = document.getElementById('ap-fav-btn');
    if (btn) btn.classList.toggle('active', true);
  }

  return {
    init, loadFromFiles, loadTrack, togglePlay, prev, next,
    toggleShuffle, cycleRepeat, expand, collapse, close,
    showQueue, closeQueue, removeFromQueue, addToQueue, playUrl, toggleFavorite,
    getAudio: () => audio, getQueue: () => queue
  };
})();
