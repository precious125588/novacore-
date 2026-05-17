// ===== AI ASSISTANT v2 =====
const NCai = (() => {
  let currentModel = 'auto', currentMode = 'chat', isThinking = false;

  // ===== OFFLINE BRAIN =====
  const OFFLINE = {
    greet: ["Hello! I'm NovaCore AI. Internet seems unavailable, but I can still help with code, templates, and quick answers!", "Hey! Offline mode active. Ask me about JavaScript, HTML, CSS, or common coding patterns!"],
    patterns: [
      [/^(hi|hello|hey|sup|yo)$/i, () => OFFLINE.greet[Math.floor(Math.random() * OFFLINE.greet.length)]],
      [/center.*css|css.*center/i, () => 'Center in CSS:\n```css\n/* Flexbox */\n.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n/* Or */\n.el {\n  margin: 0 auto;\n  width: fit-content;\n}\n```'],
      [/fetch|api call|http request/i, () => 'Fetch API:\n```js\nasync function getData(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(`HTTP ${res.status}`);\n    return await res.json();\n  } catch (err) {\n    console.error("Fetch failed:", err);\n    return null;\n  }\n}\n```'],
      [/local.?storage/i, () => 'localStorage:\n```js\n// Save\nlocalStorage.setItem("key", JSON.stringify(data));\n// Load\nconst data = JSON.parse(localStorage.getItem("key") || "null");\n// Remove\nlocalStorage.removeItem("key");\n// Clear all\nlocalStorage.clear();\n```'],
      [/event.?listener|addeventlistener/i, () => 'Event Listeners:\n```js\n// Add\nel.addEventListener("click", (e) => {\n  e.preventDefault();\n  console.log("Clicked:", e.target);\n});\n// Once\nel.addEventListener("click", handler, { once: true });\n// Remove\nel.removeEventListener("click", handler);\n```'],
      [/array.*(sort|filter|map|reduce|find)/i, () => 'Array Methods:\n```js\nconst arr = [3, 1, 2];\narr.sort((a, b) => a - b);          // [1, 2, 3]\narr.filter(x => x > 1);             // [2, 3]\narr.map(x => x * 2);               // [2, 4, 6]\narr.find(x => x === 2);            // 2\narr.reduce((sum, x) => sum + x, 0); // 6\n```'],
      [/async.*await|promise/i, () => 'Async/Await:\n```js\nasync function run() {\n  try {\n    const result = await someAsyncFn();\n    console.log(result);\n  } catch (err) {\n    console.error("Error:", err.message);\n  }\n}\n```'],
      [/null.*check|undefined|optional.?chain/i, () => 'Null Safety:\n```js\n// Optional chaining\nconst val = obj?.nested?.value ?? "default";\n// Nullish coalescing\nconst x = value ?? fallback;\n// Safe check\nif (val != null) { /* not null/undefined */ }\n```'],
      [/class|oop|inheritance/i, () => 'JS Classes:\n```js\nclass Animal {\n  constructor(name) { this.name = name; }\n  speak() { return `${this.name} makes a sound`; }\n}\nclass Dog extends Animal {\n  speak() { return `${this.name} barks!`; }\n}\nconst d = new Dog("Rex");\nd.speak(); // "Rex barks!"\n```'],
      [/regex|regular expression/i, () => 'Common Regex:\n```js\n/^[a-zA-Z]+$/    // only letters\n/^\\d+$/           // only digits\n/^[\\w.-]+@[\\w-]+\\.\\w+$/  // email\n/https?:\\/\\/[^\\s]+/  // URL\n// Usage:\nif (/^\\d+$/.test(str)) { /* is number */ }\nstr.match(/pattern/g);\nstr.replace(/old/g, "new");\n```'],
      [/debug|bug|error|fix/i, () => 'Debug Tips:\n• Check browser console (F12 / DevTools)\n• Add `console.log()` at each step\n• Use `try/catch` to catch errors\n• Check for `null`/`undefined` before accessing properties\n• Verify API responses with `console.log(JSON.stringify(data, null, 2))`'],
      [/what.*(novacore|this app)/i, () => 'NovaCore is your all-in-one app: video player, music player, AI assistant, code editor, downloader, file manager, vault, and more — all offline-first!'],
      [/what.*(can you|can u) do/i, () => "I can help with:\n• Code debugging & explanation\n• HTML/CSS/JS patterns & templates\n• Algorithm help\n• App feature questions\n• General Q&A\n\nConnect to internet for GPT-4, Claude, Gemini and more!"],
    ],
    fallback: "I'm in offline mode — API connection unavailable. I can help with basic coding questions, templates, and debugging tips. For full AI power, connect to the internet and select Auto model!"
  };

  function offline(q) {
    for (const [pat, fn] of OFFLINE.patterns) {
      if (pat.test(q)) return fn();
    }
    return OFFLINE.fallback;
  }

  // ===== API ROUTING =====
  async function queryAI(prompt, model) {
    if (model === 'offline') return offline(prompt);
    if (!navigator.onLine) return offline(prompt);

    const modelFns = {
      dc_gpt4: () => DavidCyrilAPI.gpt4(prompt),
      dc_claude: () => DavidCyrilAPI.claude(prompt),
      dc_gemini: () => DavidCyrilAPI.gemini(prompt),
      dc_deepseek: () => DavidCyrilAPI.deepseekR1(prompt),
      dc_llama3: () => DavidCyrilAPI.llama3(prompt),
      dc_gpt4omini: () => DavidCyrilAPI.gpt4oMini(prompt),
      px_gpt5: () => PrexzyAPI.gpt5(prompt),
      px_copilot: () => PrexzyAPI.copilot(prompt),
      px_claude: () => PrexzyAPI.claude(prompt),
      px_deepseek: () => PrexzyAPI.deepseek(prompt),
    };

    if (model !== 'auto' && modelFns[model]) {
      try { const r = await modelFns[model](); if (r?.length > 2) return r; } catch {}
    }

    // Auto: try in order
    const order = ['px_gpt5', 'dc_gpt4', 'px_copilot', 'dc_claude', 'dc_gemini', 'px_deepseek', 'dc_deepseek', 'dc_llama3', 'dc_gpt4omini'];
    for (const m of order) {
      if (modelFns[m]) {
        try {
          const r = await Promise.race([modelFns[m](), timeout(15000)]);
          if (r && typeof r === 'string' && r.length > 3) return r;
        } catch {}
      }
    }
    return offline(prompt);
  }

  async function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)); }

  async function generateImage(prompt) {
    if (!navigator.onLine) return null;
    const styles = ['realistic', 'anime', 'fantasy', 'cyberpunk'];
    for (const style of styles) {
      try {
        const url = await PrexzyAPI.txt2img(prompt, style);
        if (url) return url;
      } catch {}
    }
    try { return await PrexzyAPI.dalle(prompt); } catch {}
    return null;
  }

  // ===== UI FUNCTIONS =====
  function setModel(v) {
    currentModel = v;
    NCStorage.lsSet('defaultAI', v);
  }

  function setMode(mode, btn) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const placeholders = { chat: 'Ask anything...', code: 'Describe or paste code for help...', search: 'Search anything online...', image: 'Describe the image to generate...' };
    const inp = document.getElementById('ai-input');
    if (inp) inp.placeholder = placeholders[mode] || 'Ask anything...';
  }

  function resize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function send() {
    if (isThinking) return;
    const input = document.getElementById('ai-input');
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';
    if (input.style) input.style.height = 'auto';
    appendMsg('user', text);

    if (currentMode === 'image') { await handleImage(text); return; }

    isThinking = true;
    document.getElementById('ai-send').style.opacity = '0.5';
    const typing = appendTyping();

    try {
      let response;
      if (currentMode === 'code') {
        const code = NC.codeEditor ? NC.codeEditor.getCode() : '';
        const fullPrompt = code ? `${text}\n\n[Current code]:\n\`\`\`\n${code.slice(0, 2000)}\n\`\`\`` : text;
        if (/bug|fix|error|issue/i.test(text)) response = await PrexzyAPI.detectBugs(code || text).catch(() => queryAI(fullPrompt, currentModel));
        else if (/explain|what.*does|how.*work/i.test(text)) response = await PrexzyAPI.explainCode(code || text, '').catch(() => queryAI(fullPrompt, currentModel));
        else response = await queryAI(fullPrompt, currentModel);
      } else if (currentMode === 'search') {
        try { response = await DavidCyrilAPI.searchgpt(text); } catch {}
        if (!response) response = await queryAI('Search and answer: ' + text, currentModel);
      } else {
        response = await queryAI(text, currentModel);
      }
      typing.remove();
      appendMsg('bot', response || offline(text));
    } catch (e) {
      typing.remove();
      appendMsg('bot', offline(text));
    } finally {
      isThinking = false;
      const sendBtn = document.getElementById('ai-send');
      if (sendBtn) sendBtn.style.opacity = '1';
    }
  }

  async function handleImage(prompt) {
    isThinking = true;
    document.getElementById('ai-send').style.opacity = '0.5';
    const typing = appendTyping();
    try {
      const url = await generateImage(prompt);
      typing.remove();
      if (url) {
        appendMsg('bot', `<div class="ai-image-result"><img src="${url}" alt="${prompt}" loading="lazy" onerror="this.parentElement.innerHTML='Image failed to load — try again'"/><div style="font-size:11px;color:var(--text3);margin-top:4px">"${prompt}"</div></div>`);
      } else {
        appendMsg('bot', navigator.onLine ? '⚠ Image generation failed. Try rephrasing or connecting to a different network.' : '⚠ Image generation requires internet connection.', 'error');
      }
    } catch (e) {
      typing.remove();
      appendMsg('bot', '⚠ Image generation error: ' + e.message, 'error');
    } finally {
      isThinking = false;
      const sendBtn = document.getElementById('ai-send');
      if (sendBtn) sendBtn.style.opacity = '1';
    }
  }

  function appendMsg(role, text, cls = '') {
    const container = document.getElementById('ai-messages');
    if (!container) return null;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isHtml = text.includes('<div') || text.includes('<img') || text.includes('<pre');
    const el = document.createElement('div');
    el.className = `msg ${role} fade-in`;
    el.innerHTML = `
      <div class="msg-bubble ${cls}">${isHtml ? text : fmt(text)}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="msg-time">${time}</span>
        ${role === 'bot' ? `<button class="msg-action" onclick="NCai.copyMsg(this)">Copy</button>` : ''}
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function appendTyping() {
    const container = document.getElementById('ai-messages');
    const el = document.createElement('div');
    el.className = 'msg bot fade-in';
    el.innerHTML = `<div class="msg-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function fmt(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  function copyMsg(btn) {
    const bubble = btn.closest('.msg')?.querySelector('.msg-bubble');
    if (!bubble) return;
    navigator.clipboard.writeText(bubble.innerText || bubble.textContent || '').then(() => NC.ui.toast('Copied!', 'success')).catch(() => NC.ui.toast('Copy failed', 'error'));
  }

  function clearChat() {
    const container = document.getElementById('ai-messages');
    if (container) container.innerHTML = '';
    NC.ui.toast('Chat cleared');
  }

  function explainCode() {
    const code = NC.codeEditor?.getCode?.();
    if (!code) { NC.ui.toast('No code in editor'); return; }
    NC.ui.showView('view-ai');
    const inp = document.getElementById('ai-input');
    if (inp) { inp.value = 'Explain this code step by step:\n```\n' + code.slice(0, 2000) + '\n```'; send(); }
  }

  function fixCode() {
    const code = NC.codeEditor?.getCode?.();
    if (!code) { NC.ui.toast('No code in editor'); return; }
    NC.ui.showView('view-ai');
    const inp = document.getElementById('ai-input');
    if (inp) { inp.value = 'Find and fix all bugs in this code:\n```\n' + code.slice(0, 2000) + '\n```'; send(); }
  }

  return { init: () => {}, setModel, setMode, resize, onKey, send, clearChat, copyMsg, explainCode, fixCode };
})();
