// ===== PREXZY API WRAPPERS v2 =====
const PrexzyAPI = (() => {
  const BASE = 'https://apis.prexzyvilla.site';
  const TIMEOUT = 18000;

  async function call(path, params = {}) {
    const url = new URL(BASE + path);
    Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json, text/plain, */*' },
        mode: 'cors', credentials: 'omit',
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ct = res.headers.get('content-type') || '';
      if (ct.startsWith('image/') || ct.startsWith('video/') || ct.startsWith('audio/')) return res.blob();
      if (ct.includes('json')) return res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch { return text; }
    } catch (e) { clearTimeout(timer); if (e.name === 'AbortError') throw new Error('Timeout'); throw e; }
  }

  async function extractText(data) {
    if (!data) return null;
    if (typeof data === 'string') return data.length > 1 ? data : null;
    const fields = ['result','response','answer','text','message','content','output','reply','completion'];
    for (const f of fields) {
      const v = data[f];
      if (typeof v === 'string' && v.length > 1) return v;
      if (v && typeof v === 'object') {
        if (typeof v.content === 'string') return v.content;
        if (typeof v.text === 'string') return v.text;
      }
    }
    if (data.data && typeof data.data === 'string') return data.data;
    return JSON.stringify(data);
  }

  // ---- AI (all try/catch) ----
  async function gpt5(text) { try { return await extractText(await call('/ai/gpt-5', { text })); } catch { return null; } }
  async function gpt4(text) { try { return await extractText(await call('/ai/gpt4', { text })); } catch { return null; } }
  async function copilot(text) { try { return await extractText(await call('/ai/copilot', { text })); } catch { return null; } }
  async function copilotThink(text) { try { return await extractText(await call('/ai/copilot-think', { text })); } catch { return null; } }
  async function claude(text) { try { return await extractText(await call('/ai/talkclaude', { text })); } catch { return null; } }
  async function deepseek(prompt) { try { return await extractText(await call('/ai/deepseekchat', { prompt })); } catch { return null; } }
  async function deepseekReason(prompt) { try { return await extractText(await call('/ai/deepseekreasoner', { prompt })); } catch { return null; } }
  async function aichat(prompt) { try { return await extractText(await call('/ai/aichat', { prompt })); } catch { return null; } }
  async function ai4chat(prompt) { try { return await extractText(await call('/ai/ai4chat', { prompt })); } catch { return null; } }
  async function zai(text) { try { return await extractText(await call('/ai/zai', { text })); } catch { return null; } }
  async function lumo(q) { try { return await extractText(await call('/ai/lumo', { q })); } catch { return null; } }
  async function talkgpt(text) { try { return await extractText(await call('/ai/talkgpt', { text })); } catch { return null; } }
  async function chatbot(text, search) { try { return await extractText(await call('/ai/chatbot', { text, search })); } catch { return null; } }
  async function logical(text) { try { return await extractText(await call('/ai/logical', { text })); } catch { return null; } }
  async function summarize(text) { try { return await extractText(await call('/ai/summarize', { text })); } catch { return null; } }
  async function codeBeginner(text) { try { return await extractText(await call('/ai/code-beginner', { text })); } catch { return null; } }
  async function codeAdvanced(text) { try { return await extractText(await call('/ai/code-advanced', { text })); } catch { return null; } }
  async function promptToCode(prompt, language) { try { return await extractText(await call('/ai/prompttocode', { prompt, language })); } catch { return null; } }
  async function detectBugs(code) { try { return await extractText(await call('/ai/detectbugs', { code })); } catch { return null; } }
  async function convertCode(code, target, source) { try { return await extractText(await call('/ai/convertcode', { code, target, source })); } catch { return null; } }
  async function explainCode(code, lang) { try { return await extractText(await call('/ai/explaincode', { code, lang })); } catch { return null; } }
  async function genLyrics(prompt) { try { return await extractText(await call('/ai/genlyrics', { prompt })); } catch { return null; } }

  // ---- IMAGE GENERATION ----
  async function txt2img(prompt, style) {
    const ep = { realistic:'/ai/realistic', anime:'/ai/anime', fantasy:'/ai/fantasy', cyberpunk:'/ai/cyberpunk', watercolor:'/ai/watercolor', sketch:'/ai/sketch', cartoon:'/ai/cartoon', abstract:'/ai/abstract', vintage:'/ai/vintage', scifi:'/ai/sci-fi' };
    try {
      const data = await call(ep[style]||'/ai/realistic', { prompt });
      if (data instanceof Blob) return URL.createObjectURL(data);
      if (typeof data === 'string' && data.startsWith('http')) return data;
      if (data?.url) return data.url; if (data?.image) return data.image;
      return null;
    } catch { return null; }
  }
  async function dalle(prompt) {
    try {
      const data = await call('/ai/dalle', { prompt });
      if (data instanceof Blob) return URL.createObjectURL(data);
      if (typeof data === 'string' && data.startsWith('http')) return data;
      if (data?.url) return data.url;
      return null;
    } catch { return null; }
  }

  // ---- DOWNLOAD (all try/catch) ----
  async function aio(url) { try { return await call('/download/aio', { url }); } catch { return null; } }
  async function tiktok(url) { try { return await call('/download/tiktok', { url }); } catch { return null; } }
  async function tiktokV2(url) { try { return await call('/download/tiktokV2', { url }); } catch { return null; } }
  async function instagram(url) { try { return await call('/download/instagram', { url }); } catch { return null; } }
  async function facebook(url) { try { return await call('/download/facebook', { url }); } catch { return null; } }
  async function twitter(url) { try { return await call('/download/twitter', { url }); } catch { return null; } }
  async function youtube(url, type, format, quality, bitrate) { try { return await call('/download/ytdownload', { url, type, format, quality, bitrate }); } catch { return null; } }
  async function youtubeInfo(url) { try { return await call('/download/ytinfo', { url }); } catch { return null; } }
  async function soundcloud(url) { try { return await call('/download/soundcloud', { url }); } catch { return null; } }
  async function spotify(url) { try { return await call('/download/spotify', { url }); } catch { return null; } }
  async function capcut(url) { try { return await call('/download/capcut', { url }); } catch { return null; } }
  async function threads(url) { try { return await call('/download/threads', { url }); } catch { return null; } }
  async function pinterest(url) { try { return await call('/download/pinterest', { url }); } catch { return null; } }
  async function mediafire(url) { try { return await call('/download/mediafire', { url }); } catch { return null; } }

  // ---- SEARCH ----
  async function search(q, page) { try { return await call('/search', { q, page: page||1 }); } catch { return null; } }
  async function suggest(q) { try { return await call('/suggest', { q }); } catch { return null; } }
  async function trending(tabId) { try { return await call('/trending', tabId ? { tabId } : {}); } catch { return null; } }
  async function movieSearch(query) { try { return await call('/moviesearch', { query }); } catch { return null; } }
  async function detail(id) { try { return await call('/detail', { id }); } catch { return null; } }

  return {
    gpt5, gpt4, copilot, copilotThink, claude, deepseek, deepseekReason,
    aichat, ai4chat, zai, lumo, talkgpt, chatbot, logical, summarize,
    codeBeginner, codeAdvanced, promptToCode, detectBugs, convertCode, explainCode, genLyrics,
    txt2img, dalle,
    aio, tiktok, tiktokV2, instagram, facebook, twitter,
    youtube, youtubeInfo, soundcloud, spotify, capcut, threads, pinterest, mediafire,
    search, suggest, trending, movieSearch, detail, call
  };
})();
