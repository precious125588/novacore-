// ===== DAVIDCYRIL API WRAPPERS v2 =====
const DavidCyrilAPI = (() => {
  const BASE = 'https://apis.davidcyril.name.ng';
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
    const fields = ['result','response','answer','text','message','content','output','reply','completion','data'];
    for (const f of fields) {
      const v = data[f];
      if (typeof v === 'string' && v.length > 1) return v;
      if (v && typeof v === 'object') {
        if (typeof v.content === 'string') return v.content;
        if (typeof v.text === 'string') return v.text;
      }
    }
    return JSON.stringify(data);
  }

  // ---- AI (all wrapped in try/catch) ----
  async function gpt4(text) { try { return await extractText(await call('/ai/gpt4', { text })); } catch { return null; } }
  async function gpt4oMini(text) { try { return await extractText(await call('/ai/gpt4omini', { text })); } catch { try { return await extractText(await call('/ai/gpt', { text })); } catch { return null; } } }
  async function gpt3(text) { try { return await extractText(await call('/ai/gpt3', { text })); } catch { return null; } }
  async function claude(text) { try { return await extractText(await call('/ai/claude', { text })); } catch { try { return await extractText(await call('/ai/claudeSonnet', { text })); } catch { return null; } } }
  async function claudeSonnet(text) { try { return await extractText(await call('/ai/claudeSonnet', { text })); } catch { return null; } }
  async function gemini(text) { try { return await extractText(await call('/ai/gemini', { text })); } catch { try { return await extractText(await call('/ai/gemini-proxy', { prompt: text })); } catch { return null; } } }
  async function deepseekR1(text) { try { return await extractText(await call('/ai/deepseek-r1', { text })); } catch { try { return await extractText(await call('/ai/deepseek-v3', { text })); } catch { return null; } } }
  async function deepseekV3(text) { try { return await extractText(await call('/ai/deepseek-v3', { text })); } catch { return null; } }
  async function llama3(text) { try { return await extractText(await call('/ai/llama3', { text })); } catch { try { return await extractText(await call('/ai/g4f-groq', { prompt: text })); } catch { return null; } } }
  async function copilot(text) { try { return await extractText(await call('/ai/copilot', { text })); } catch { return null; } }
  async function mathgpt(text) { try { return await extractText(await call('/ai/mathgpt', { text, think: 'true' })); } catch { return null; } }
  async function searchgpt(text) { try { return await extractText(await call('/ai/searchgpt', { text })); } catch { try { return await extractText(await call('/ai/turboseek', { text })); } catch { return null; } } }
  async function g4fGroq(prompt, model) { try { return await extractText(await call('/ai/g4f-groq', { prompt, model: model || 'llama-3.3-70b-versatile' })); } catch { return null; } }

  // ---- DOWNLOAD (all try/catch) ----
  async function tiktokDl(url) { try { return await call('/download/tiktokV2', { url }); } catch { try { return await call('/download/tiktok', { url }); } catch { return null; } } }
  async function ytInfo(url) { try { return await call('/download/ytinfo', { url }); } catch { return null; } }
  async function ytDownload(url, type, format, quality) { try { return await call('/download/ytdownload', { url, type: type||'video', format: format||'mp4', quality: quality||'720' }); } catch { return null; } }
  async function instagramDl(url) { try { return await call('/download/instagram', { url }); } catch { return null; } }
  async function facebookDl(url) { try { return await call('/download/facebook', { url }); } catch { return null; } }
  async function twitterDl(url) { try { return await call('/download/twitter', { url }); } catch { return null; } }
  async function soundcloudDl(url) { try { return await call('/download/soundcloud', { url }); } catch { return null; } }
  async function spotifyDl(url) { try { return await call('/download/spotify', { url }); } catch { return null; } }
  async function aioDownload(url) { try { return await call('/download/aio', { url }); } catch { return null; } }

  // ---- SEARCH + UTILS ----
  async function search(q) { try { return await call('/search', { q }); } catch { return null; } }
  async function suggest(q) { try { return await call('/suggest', { q }); } catch { return null; } }
  async function trending() { try { return await call('/trending', {}); } catch { return null; } }
  async function movieSearch(query) { try { return await call('/movies/search', { query }); } catch { return null; } }
  async function generateImage(prompt, style) { try { const m={realistic:'/canvas/realistic',anime:'/canvas/anime',fantasy:'/canvas/fantasy'}; return await call(m[style]||'/canvas/realistic', { prompt }); } catch { return null; } }
  async function getLyrics(title) { try { return await call('/search/lyrics', { q: title }); } catch { return null; } }
  async function getSubtitle(q) { try { return await call('/search/subtitle', { q }); } catch { return null; } }

  return {
    gpt4, gpt4oMini, gpt3, claude, claudeSonnet, gemini, deepseekR1, deepseekV3,
    llama3, copilot, mathgpt, searchgpt, g4fGroq,
    tiktokDl, ytInfo, ytDownload, instagramDl, facebookDl, twitterDl, soundcloudDl, spotifyDl, aioDownload,
    search, suggest, trending, movieSearch, generateImage, getLyrics, getSubtitle, call
  };
})();
