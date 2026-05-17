// ===== VLC-STYLE VIDEO PLAYER v2 =====
const NCvideoPlayer = (() => {
  let video = null, overlay = null, controls = null, gestureLayer = null;
  let hideTimer = null, currentFile = null;
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let touchStartVol = 1, touchStartBright = 1, brightness = 1;
  let lastTap = 0, lastTapTime = 0, aspectMode = 0;
  let seekDragging = false, seekStartX = 0, seekStartTime = 0;
  let isConnected = false;
  const ASPECT_MODES = ['contain','cover','fill'];

  function init() {
    video = document.getElementById('main-video');
    overlay = document.getElementById('video-player');
    controls = document.getElementById('video-controls');
    gestureLayer = document.getElementById('video-gesture-layer');
    if (!video) return;

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', () => updatePlayBtn(false));
    video.addEventListener('pause', () => updatePlayBtn(true));
    video.addEventListener('progress', updateBuffered);
    video.addEventListener('error', onError);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('waiting', () => showSpinner(true));
    video.addEventListener('canplay', () => showSpinner(false));
    video.addEventListener('playing', () => showSpinner(false));

    // Gesture layer events
    gestureLayer.addEventListener('touchstart', onTouchStart, { passive: false });
    gestureLayer.addEventListener('touchmove', onTouchMove, { passive: false });
    gestureLayer.addEventListener('touchend', onTouchEnd, { passive: false });

    // Also handle clicks on gesture layer for desktop
    gestureLayer.addEventListener('click', onLayerClick);

    // Seek bar
    const seekWrap = document.getElementById('vc-seek-wrap');
    if (seekWrap) {
      seekWrap.addEventListener('touchstart', onSeekTouchStart, { passive: false });
      seekWrap.addEventListener('touchmove', onSeekTouchMove, { passive: false });
      seekWrap.addEventListener('touchend', onSeekTouchEnd, { passive: false });
      seekWrap.addEventListener('click', onSeekClick);
    }

    // PiP
    if ('pictureInPictureEnabled' in document) {
      video.addEventListener('enterpictureinpicture', () => NC.ui.toast('Floating video active'));
      video.addEventListener('leavepictureinpicture', () => {});
    }
  }

  function connectAudio() {
    if (!isConnected && video) {
      try { NCaudioEngine.connectElement(video); isConnected = true; } catch {}
    }
  }

  function open(src, name, type) {
    name = name || 'Video';
    overlay.classList.remove('hidden');
    document.getElementById('vc-title').textContent = name;
    connectAudio();
    NCaudioEngine.resume();

    // Decode URL if needed
    try { src = decodeURIComponent(src); } catch {}

    video.src = src;
    video.load();

    // Resume position
    const posKey = 'vpos_' + hashStr(name);
    const savedPos = NCStorage.lsGet(posKey, 0);
    const savedSpeed = parseFloat(NCStorage.lsGet('vspd_' + hashStr(name), 1));

    video.addEventListener('canplay', function once() {
      video.removeEventListener('canplay', once);
      if (savedPos > 3 && savedPos < (video.duration || 9999) - 5) {
        video.currentTime = savedPos;
        NC.ui.toast('▶ Resuming from ' + fmtTime(savedPos));
      }
      video.playbackRate = savedSpeed;
      document.getElementById('vc-speed').value = savedSpeed;
    }, { once: true });

    video.play().catch(e => {
      NC.ui.toast('Tap ▶ to play');
      updatePlayBtn(true);
    });

    currentFile = { src, name, posKey };
    showControls();
    NC.library.addHistory({ type: 'video', name, src, timestamp: Date.now() });
  }

  function loadFromFile(input) {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    open(url, file.name, 'blob');
    input.value = '';
  }

  function close() {
    video.pause();
    savePosition();
    video.src = '';
    overlay.classList.add('hidden');
    clearTimeout(hideTimer);
  }

  function savePosition() {
    if (!currentFile || !video.duration) return;
    NCStorage.lsSet(currentFile.posKey, video.currentTime);
    NCStorage.lsSet('vspd_' + hashStr(currentFile.name), video.playbackRate);
  }

  function togglePlay() {
    NCaudioEngine.resume();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    showControls();
  }

  function seek(seconds) {
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    showFeedback(seconds > 0 ? `⟩⟩ +${Math.abs(seconds)}s` : `⟨⟨ ${Math.abs(seconds)}s`);
    showControls();
  }

  function setSpeed(v) {
    video.playbackRate = parseFloat(v);
    if (currentFile) NCStorage.lsSet('vspd_' + hashStr(currentFile.name), v);
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const fn = overlay.requestFullscreen || overlay.webkitRequestFullscreen || overlay.mozRequestFullScreen;
        if (fn) fn.call(overlay);
      } else {
        const fn = document.exitFullscreen || document.webkitExitFullscreen;
        if (fn) fn.call(document);
      }
    } catch {}
  }

  async function togglePiP() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
      else NC.ui.toast('PiP not available on this device');
    } catch (e) { NC.ui.toast('PiP: ' + e.message, 'error'); }
  }

  function toggleAspect() {
    aspectMode = (aspectMode + 1) % ASPECT_MODES.length;
    video.style.objectFit = ASPECT_MODES[aspectMode];
    showFeedback(ASPECT_MODES[aspectMode].toUpperCase());
  }

  function toggleRotationLock() {
    if (!screen.orientation?.lock) { NC.ui.toast('Rotation lock not supported'); return; }
    const locked = NCStorage.lsGet('rotLock', false);
    if (locked) { screen.orientation.unlock(); NCStorage.lsSet('rotLock', false); NC.ui.toast('Rotation unlocked'); }
    else { screen.orientation.lock('landscape').catch(() => {}); NCStorage.lsSet('rotLock', true); NC.ui.toast('Locked to landscape'); }
  }

  function addToFavorites() {
    if (!currentFile) return;
    NC.library.addFavorite({ type: 'video', name: currentFile.name, src: currentFile.src });
    const btn = document.getElementById('vc-fav-btn');
    if (btn) btn.textContent = '♥';
    NC.ui.toast('Added to favorites ♥', 'success');
  }

  // TIME UPDATE
  function onTimeUpdate() {
    const cur = video.currentTime, dur = video.duration || 0;
    const ratio = dur ? cur / dur : 0;
    document.getElementById('vc-current').textContent = fmtTime(cur);
    document.getElementById('vc-duration').textContent = fmtTime(dur);
    document.getElementById('vc-seek-fill').style.width = (ratio * 100) + '%';
    document.getElementById('vc-seek-thumb').style.left = (ratio * 100) + '%';
    if (Math.round(cur) % 5 === 0 && currentFile) savePosition();
    NC.subtitles.update(cur);
  }

  function updateBuffered() {
    if (!video.duration || !video.buffered.length) return;
    try {
      const b = video.buffered.end(video.buffered.length - 1) / video.duration * 100;
      document.getElementById('vc-seek-buffered').style.width = b + '%';
    } catch {}
  }

  function onMeta() {
    document.getElementById('vc-duration').textContent = fmtTime(video.duration);
  }

  function onEnded() {
    updatePlayBtn(true);
    showControls(false);
    savePosition();
  }

  function onError() {
    showSpinner(false);
    NC.ui.toast('Cannot play this format — try downloading first', 'error');
  }

  function updatePlayBtn(paused) {
    const el = document.getElementById('vc-play-btn');
    if (el) el.textContent = paused ? '▶' : '⏸';
  }

  function showSpinner(show) {
    const el = document.getElementById('video-spinner');
    if (el) el.classList.toggle('show', show);
  }

  function showControls(autoHide = true) {
    controls.classList.add('visible');
    clearTimeout(hideTimer);
    if (autoHide && !video.paused) {
      hideTimer = setTimeout(() => controls.classList.remove('visible'), 4000);
    }
  }

  function showFeedback(text) {
    const el = document.getElementById('seek-feedback');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 1000);
  }

  // SEEK BAR
  function onSeekTouchStart(e) {
    seekDragging = true;
    e.stopPropagation();
    doSeek(e.touches[0].clientX);
  }
  function onSeekTouchMove(e) {
    if (!seekDragging) return;
    e.preventDefault();
    e.stopPropagation();
    doSeek(e.touches[0].clientX);
  }
  function onSeekTouchEnd(e) { seekDragging = false; e.stopPropagation(); }
  function onSeekClick(e) { e.stopPropagation(); doSeek(e.clientX); }

  function doSeek(clientX) {
    const bar = document.getElementById('vc-seek-wrap');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * (video.duration || 0);
    showFeedback(fmtTime(video.currentTime));
  }

  // GESTURE SYSTEM
  function onLayerClick(e) {
    if (seekDragging) return;
    const now = Date.now();
    if (now - lastTapTime < 280) {
      // Double tap
      clearTimeout(lastTap);
      lastTapTime = 0;
      const x = e.clientX;
      const W = window.innerWidth;
      if (x < W * 0.35) seek(-10);
      else if (x > W * 0.65) seek(10);
      else togglePlay();
    } else {
      lastTapTime = now;
      lastTap = setTimeout(() => {
        // Single tap
        if (controls.classList.contains('visible')) controls.classList.remove('visible');
        else showControls();
      }, 280);
    }
  }

  function onTouchStart(e) {
    if (e.target.closest('.vc-seek-wrap, .vc-btn, .vc-play-btn, .vc-side-btn, .vc-speed, .vc-bottom')) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    touchStartVol = video.volume;
    touchStartBright = brightness;
  }

  function onTouchMove(e) {
    if (e.target.closest('.vc-seek-wrap, .vc-btn, .vc-play-btn, .vc-side-btn, .vc-speed, .vc-bottom')) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const W = window.innerWidth, H = window.innerHeight;

    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // Horizontal seek preview
      const seekPct = dx / W;
      const seekSecs = seekPct * Math.min(video.duration || 60, 60);
      const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekSecs * 0.5));
      showFeedback((seekSecs > 0 ? '⟩⟩ +' : '⟨⟨ ') + Math.abs(seekSecs).toFixed(0) + 's → ' + fmtTime(newTime));
    } else if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      if (t.clientX < W / 2) {
        // Left = brightness
        const delta = -dy / H * 1.5;
        brightness = Math.max(0.1, Math.min(1, touchStartBright + delta));
        video.style.filter = 'brightness(' + brightness + ')';
        showIndicator('bright', brightness);
      } else {
        // Right = volume
        const delta = -dy / H * 1.5;
        video.volume = Math.max(0, Math.min(1, touchStartVol + delta));
        showIndicator('vol', video.volume);
      }
    }
  }

  function onTouchEnd(e) {
    if (e.target.closest('.vc-seek-wrap, .vc-btn, .vc-play-btn, .vc-side-btn, .vc-speed, .vc-bottom')) return;
    const now = Date.now();
    const dur = now - touchStartTime;
    const t = e.changedTouches[0];
    const dx = (t?.clientX || touchStartX) - touchStartX;
    const dy = (t?.clientY || touchStartY) - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    // Long press: 2x speed
    if (dur > 600 && absDx < 15 && absDy < 15) {
      showFeedback('2.0× Speed');
      video.playbackRate = 2;
      const restore = () => {
        video.playbackRate = parseFloat(document.getElementById('vc-speed').value) || 1;
        showFeedback('Normal Speed');
        gestureLayer.removeEventListener('touchstart', restore);
      };
      gestureLayer.addEventListener('touchstart', restore, { once: true });
      return;
    }

    // Horizontal swipe seek
    if (absDx > 40 && absDx > absDy * 1.5 && dur < 500) {
      const seekSecs = (dx / window.innerWidth) * 60;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seekSecs));
      showFeedback((seekSecs > 0 ? '⟩⟩ +' : '⟨⟨ ') + Math.abs(seekSecs).toFixed(0) + 's');
    }

    hideIndicators();
  }

  function showIndicator(type, value) {
    const bright = document.getElementById('vc-bright-indicator');
    const vol = document.getElementById('vc-vol-indicator');
    if (type === 'bright' && bright) {
      bright.classList.add('show');
      const fill = bright.querySelector('.vc-indicator-fill');
      const icon = bright.querySelector('.vc-indicator-icon');
      if (fill) fill.style.height = (value * 100) + '%';
      if (icon) icon.textContent = value < 0.3 ? '🌑' : value < 0.7 ? '🌤' : '☀️';
    }
    if (type === 'vol' && vol) {
      vol.classList.add('show');
      const fill = vol.querySelector('.vc-indicator-fill');
      const icon = vol.querySelector('.vc-indicator-icon');
      if (fill) fill.style.height = (value * 100) + '%';
      if (icon) icon.textContent = value === 0 ? '🔇' : value < 0.5 ? '🔉' : '🔊';
    }
  }

  function hideIndicators() {
    document.querySelectorAll('.vc-indicator').forEach(el => el.classList.remove('show'));
  }

  function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < Math.min(s.length, 40); i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h.toString(36);
  }

  return {
    init, open, loadFromFile, close, togglePlay, seek, setSpeed,
    toggleFullscreen, togglePiP, toggleAspect, toggleRotationLock,
    addToFavorites, showControls
  };
})();
