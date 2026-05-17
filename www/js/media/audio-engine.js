// ===== WEB AUDIO ENGINE (EQ, Bass Boost, Normalization, Reverb, Visualizer) =====
const NCaudioEngine = (() => {
  let ctx = null, source = null, analyser = null, gainNode = null;
  let bassFilter = null, reverbNode = null, reverbGain = null, dryGain = null;
  let eqFilters = [];
  let connected = false;
  let visualizerRAF = null;
  const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const PRESETS = {
    flat:    [0,0,0,0,0,0,0,0,0,0],
    bass:    [8,6,4,2,0,0,0,0,0,0],
    vocal:   [-2,-2,0,4,6,4,2,0,-2,-2],
    treble:  [0,0,0,0,0,2,4,6,8,8],
    rock:    [5,4,2,0,-2,2,3,4,4,3],
    pop:     [-1,2,4,4,1,-1,0,1,2,2],
    jazz:    [2,3,2,0,-2,-2,0,2,4,4],
    classical:[4,2,0,0,0,0,2,4,4,3],
    hiphop:  [5,5,2,2,-1,-2,1,2,4,4],
  };

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  function connectElement(mediaEl) {
    const c = getCtx();
    if (source) { try { source.disconnect(); } catch {} }
    source = c.createMediaElementSource(mediaEl);
    gainNode = c.createGain();
    analyser = c.createAnalyser();
    analyser.fftSize = 256;

    // EQ chain
    eqFilters = EQ_BANDS.map((freq, i) => {
      const f = c.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value = 1;
      return f;
    });

    // Bass filter
    bassFilter = c.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 0;

    // Reverb setup
    reverbGain = c.createGain(); reverbGain.gain.value = 0;
    dryGain = c.createGain(); dryGain.gain.value = 1;

    // Chain: source → gain → bassFilter → eq chain → analyser → [dry+reverb] → destination
    let chain = source;
    chain.connect(gainNode);
    chain = gainNode;
    chain.connect(bassFilter);
    chain = bassFilter;
    eqFilters.forEach((f, i) => {
      chain.connect(f);
      chain = f;
    });
    chain.connect(analyser);
    analyser.connect(dryGain);
    dryGain.connect(c.destination);
    analyser.connect(reverbGain);

    createReverb().then(buf => {
      if (buf && reverbNode === null) {
        reverbNode = c.createConvolver();
        reverbNode.buffer = buf;
        reverbGain.connect(reverbNode);
        reverbNode.connect(c.destination);
      }
    });

    connected = true;
    loadSavedSettings();
  }

  async function createReverb() {
    try {
      const c = getCtx();
      const sampleRate = c.sampleRate;
      const length = sampleRate * 2.5;
      const buf = c.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
        }
      }
      return buf;
    } catch { return null; }
  }

  function loadSavedSettings() {
    const eq = NCStorage.lsGet('eq_enabled', false);
    const bands = NCStorage.lsGet('eq_bands', new Array(10).fill(0));
    const bass = NCStorage.lsGet('bass_boost', 0);
    const reverb = NCStorage.lsGet('reverb', false);
    if (eq) applyBands(bands);
    setBassBoost(bass);
    if (reverb) setReverb(true);
  }

  function toggleEQ(enabled) {
    NCStorage.lsSet('eq_enabled', enabled);
    const controls = document.getElementById('eq-controls');
    if (controls) controls.classList.toggle('hidden', !enabled);
    if (!enabled) applyBands(new Array(10).fill(0));
    else {
      const bands = NCStorage.lsGet('eq_bands', new Array(10).fill(0));
      applyBands(bands);
    }
  }

  function applyBands(values) {
    eqFilters.forEach((f, i) => { if (f) f.gain.value = values[i] || 0; });
    NCStorage.lsSet('eq_bands', values);
    // Update sliders
    const sliders = document.querySelectorAll('.eq-band-slider');
    sliders.forEach((s, i) => { if (s) s.value = values[i] || 0; });
  }

  function applyPreset(name) {
    const vals = PRESETS[name] || PRESETS.flat;
    applyBands(vals);
    buildEQSliders(vals);
  }

  function setBandGain(index, value) {
    if (eqFilters[index]) eqFilters[index].gain.value = parseFloat(value);
    const bands = NCStorage.lsGet('eq_bands', new Array(10).fill(0));
    bands[index] = parseFloat(value);
    NCStorage.lsSet('eq_bands', bands);
  }

  function setBassBoost(value) {
    const v = parseFloat(value) || 0;
    if (bassFilter) bassFilter.gain.value = v;
    NCStorage.lsSet('bass_boost', v);
    const el = document.getElementById('bass-boost');
    if (el) el.value = v;
  }

  function toggleNorm(enabled) {
    NCStorage.lsSet('vol_norm', enabled);
    if (gainNode) gainNode.gain.value = enabled ? 0.85 : 1.0;
  }

  function toggleReverb(enabled) {
    NCStorage.lsSet('reverb', enabled);
    setReverb(enabled);
  }

  function setReverb(enabled) {
    if (reverbGain) reverbGain.gain.value = enabled ? 0.3 : 0;
    if (dryGain) dryGain.gain.value = enabled ? 0.85 : 1.0;
  }

  function buildEQSliders(vals = new Array(10).fill(0)) {
    const container = document.getElementById('eq-sliders');
    if (!container) return;
    container.innerHTML = EQ_BANDS.map((band, i) => `
      <div class="eq-slider-wrap">
        <input type="range" class="eq-band-slider" min="-12" max="12" value="${vals[i] || 0}"
          oninput="NCaudioEngine.setBandGain(${i}, this.value)" orient="vertical"/>
        <div class="eq-slider-label">${band >= 1000 ? (band/1000)+'k' : band}</div>
      </div>
    `).join('');
  }

  function startVisualizer(canvas) {
    if (!analyser || !canvas) return;
    const ctx2d = canvas.getContext('2d');
    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);

    function draw() {
      visualizerRAF = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArr);
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx2d.clearRect(0, 0, W, H);
      const barW = (W / bufLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const barH = (dataArr[i] / 255) * H;
        const hue = (i / bufLen) * 120 + 240;
        ctx2d.fillStyle = `hsla(${hue},80%,60%,0.8)`;
        ctx2d.fillRect(x, H - barH, barW, barH);
        x += barW + 1;
      }
    }
    draw();
  }

  function stopVisualizer() {
    if (visualizerRAF) { cancelAnimationFrame(visualizerRAF); visualizerRAF = null; }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return {
    connectElement, toggleEQ, applyBands, applyPreset, setBandGain,
    setBassBoost, toggleNorm, toggleReverb, setReverb, buildEQSliders,
    startVisualizer, stopVisualizer, resume, getCtx
  };
})();
