import React, { useEffect, useMemo, useRef, useState } from "react";

export default function HackerTyper() {
  const [sourceKey, setSourceKey] = useState("javascript");
  const [charsPerStroke, setCharsPerStroke] = useState(() => {
    const saved = Number(localStorage.getItem("ht_charsPerStroke") || 6);
    return Math.min(Math.max(saved || 6, 1), 40);
  });
  const [variableStep, setVariableStep] = useState(true);
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [autoType, setAutoType] = useState(false);
  const [autoCps, setAutoCps] = useState(18);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("ht_theme") || "terminal");
  const [cursorBlink, setCursorBlink] = useState(true);
  const [backspaceUndoes, setBackspaceUndoes] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const audioCtxRef = useRef(null);
  const baseSnippets = useMemo(() => getBaseSnippets(), []);
  const fullSource = useMemo(() => {
    const base = baseSnippets[sourceKey] || baseSnippets.javascript;
    const filler = generateSyntheticCode(sourceKey);
    return (base + "\n" + filler).repeat(12);
  }, [sourceKey, baseSnippets]);

  useEffect(() => {
    localStorage.setItem("ht_theme", theme);
    localStorage.setItem("ht_charsPerStroke", String(charsPerStroke));
  }, [theme, charsPerStroke]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [text]);

  useEffect(() => {
    if (!autoType) return;
    const interval = Math.max(20, Math.floor(1000 / Math.max(1, autoCps)));
    const id = setInterval(() => {
      const n = variableStep ? randInt(1, Math.max(2, Math.floor(charsPerStroke * 1.5))) : charsPerStroke;
      appendChunk(n);
    }, interval);
    return () => clearInterval(id);
  }, [autoType, autoCps, charsPerStroke, variableStep]);

  function onKeyDown(e) {
    const tag = String(e.target?.tagName || "").toLowerCase();
    if (["input", "select", "textarea", "button"].includes(tag)) return;
    if (e.key === "Escape") { e.preventDefault(); clearAll(); return; }
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); showOverlay("granted"); return; }
    if (e.key === "Backspace" && e.shiftKey) { e.preventDefault(); showOverlay("denied"); return; }
    if ((e.key === "Enter" && e.altKey) || (e.key?.toLowerCase() === "b" && e.ctrlKey)) { e.preventDefault(); showOverlay("breach"); return; }
    if (e.key === "F9") { e.preventDefault(); setAutoType(v => !v); return; }
    if (e.key === "F8") { e.preventDefault(); fakeError(); return; }
    if (e.key === "Backspace" && backspaceUndoes) { e.preventDefault(); undoChunk(); return; }
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key && e.key.length === 1) {
      e.preventDefault();
      const n = variableStep ? randInt(1, charsPerStroke) : charsPerStroke;
      appendChunk(n);
    }
  }

  function playTick() {
    if (!soundEnabled) return;
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        audioCtxRef.current = ctx;
      }
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 680;
      g.gain.value = 0.02;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.03);
    } catch {}
  }

  function appendChunk(n) {
    const end = Math.min(idx + n, fullSource.length);
    const chunk = fullSource.slice(idx, end);
    setText(t => t + chunk);
    setIdx(i => (i + n) % fullSource.length);
    playTick();
  }

  function undoChunk() {
    setText(t => t.slice(0, Math.max(0, t.length - charsPerStroke)));
    setIdx(i => (i - charsPerStroke + fullSource.length) % fullSource.length);
  }

  function clearAll() {
    setText("");
    setIdx(0);
    hideOverlay();
  }

  function copyAll() {
    try { navigator.clipboard.writeText(text); } catch {}
  }

  function showOverlay(type, msg) {
    setOverlay({ type, msg });
    if (type !== "error") setTimeout(() => hideOverlay(), 1500);
  }

  function hideOverlay() { setOverlay(null); }

  function fakeError() {
    const msg = makeFakeError();
    showOverlay("error", msg);
  }

  function runTests() {
    const results = [];
    const add = (name, pass, info) => results.push({ name, pass: !!pass, info: info || "" });
    const themes = ["terminal","matrix","midnight","paper","solarized","unknown"];
    add("themeClass returns string", themes.every(t => typeof themeClass(t) === "string"));
    add("themeClass default fallback", themeClass("unknown").includes("bg-"));
    let rngOk = true; for (let i=0;i<200;i++){ const x = randInt(3,7); if (x<3 || x>7){ rngOk=false; break; } }
    add("randInt inclusive bounds", rngOk);
    const synthPy = generateSyntheticCode("python");
    add("generateSyntheticCode python contains fn_1", synthPy.includes("def fn_1"));
    const base = getBaseSnippets();
    add("base snippets keys present", ["javascript","python","rust","bash","dockerfile"].every(k=>typeof base[k]==="string" && base[k].length>0));
    const err = makeFakeError();
    add("makeFakeError non-empty", typeof err === "string" && err.length>0);
    setTestResults(results);
  }

  const stats = useMemo(() => ({
    lines: text.split("\n").length,
    chars: text.length
  }), [text]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={"min-h-screen w-full flex flex-col " + themeClass(theme)}
    >
      <header className="sticky top-0 z-20 backdrop-blur bg-black/30 text-xs sm:text-sm">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-2 sm:py-3 flex flex-wrap gap-2 items-center">
          <span className="font-mono opacity-80">HackerTyper</span>
          <div className="flex items-center gap-2">
            <label className="opacity-70">Snippet</label>
            <select
              className="bg-transparent border border-white/20 rounded px-2 py-1 font-mono"
              value={sourceKey}
              onChange={(e) => { setSourceKey(e.target.value); setText(""); setIdx(0); }}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="bash">Bash</option>
              <option value="dockerfile">Dockerfile</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="opacity-70 whitespace-nowrap">Chars/Key</label>
            <input type="range" min={1} max={40} value={charsPerStroke} onChange={(e) => setCharsPerStroke(Number(e.target.value))} />
            <span className="w-6 text-right tabular-nums">{charsPerStroke}</span>
            <label className="flex items-center gap-1 ml-2">
              <input type="checkbox" checked={variableStep} onChange={(e)=>setVariableStep(e.target.checked)} />
              <span className="opacity-70">Variable</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="opacity-70">Auto</label>
            <button onClick={()=>setAutoType(v=>!v)} className={"px-2 py-1 rounded border " + (autoType ? "bg-white/10" : "")}>{autoType?"ON":"OFF"}</button>
            <input type="range" min={5} max={60} value={autoCps} onChange={e=>setAutoCps(Number(e.target.value))} />
            <span className="w-10 text-right tabular-nums">{autoCps}c/s</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={soundEnabled} onChange={(e)=>setSoundEnabled(e.target.checked)} />
              <span className="opacity-70">Sound</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={cursorBlink} onChange={(e)=>setCursorBlink(e.target.checked)} />
              <span className="opacity-70">Blink</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={backspaceUndoes} onChange={(e)=>setBackspaceUndoes(e.target.checked)} />
              <span className="opacity-70">Backspace=Undo</span>
            </label>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="opacity-70">Theme</label>
            <select
              className="bg-transparent border border-white/20 rounded px-2 py-1 font-mono"
              value={theme}
              onChange={(e)=>setTheme(e.target.value)}
            >
              <option value="terminal">Terminal</option>
              <option value="matrix">Matrix</option>
              <option value="midnight">Midnight</option>
              <option value="paper">Paper</option>
              <option value="solarized">Solarized</option>
            </select>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button className="btn" onClick={runTests}>Run Tests</button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 pb-2 -mt-1 text-[11px] sm:text-xs opacity-70">
          <div className="flex flex-wrap gap-3">
            <span><kbd className="kbd">Shift+Enter</kbd> Access Granted</span>
            <span><kbd className="kbd">Shift+Backspace</kbd> Access Denied</span>
            <span><kbd className="kbd">Alt+Enter</kbd> Breach</span>
            <span><kbd className="kbd">F8</kbd> Fake Error</span>
            <span><kbd className="kbd">F9</kbd> Toggle Auto</span>
            <span><kbd className="kbd">Esc</kbd> Clear</span>
          </div>
          {Array.isArray(testResults) && (
            <div className="mt-2 border border-white/15 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs font-mono opacity-80 border-b border-white/10">Test Results</div>
              <ul className="max-h-48 overflow-auto">
                {testResults.map((r, i) => (
                  <li key={i} className="px-3 py-2 text-xs font-mono flex items-start gap-2">
                    <span className={"px-1.5 py-0.5 rounded border " + (r.pass ? "border-emerald-400 text-emerald-300" : "border-red-400 text-red-300")}>{r.pass ? "PASS" : "FAIL"}</span>
                    <span className="flex-1">{r.name}{r.info ? ` — ${r.info}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl p-3 sm:p-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 shadow-inner">
            <div className="px-3 sm:px-4 py-2 border-b border-white/10 text-xs flex items-center justify-between opacity-80">
              <span className="font-mono">{sourceKey}.txt</span>
              <span className="font-mono">{stats.lines} lines · {stats.chars} chars</span>
            </div>
            <pre className={"p-3 sm:p-4 font-mono text-[11.5px] sm:text-sm leading-5 whitespace-pre-wrap break-words min-h-[50vh] " + (theme === "paper" ? "text-black" : "")}>
              {text}
              <Cursor blink={cursorBlink} theme={theme} />
            </pre>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button className="btn" onClick={()=>appendChunk(200)}>Blast +200</button>
            <button className="btn" onClick={()=>appendChunk(1000)}>Blast +1000</button>
            <button className="btn" onClick={clearAll}>Clear</button>
            <button className="btn" onClick={copyAll}>Copy</button>
            <button className="btn" onClick={()=>showOverlay("granted")}>Access Granted</button>
            <button className="btn" onClick={()=>showOverlay("denied")}>Access Denied</button>
            <button className="btn" onClick={()=>showOverlay("breach")}>Breach</button>
            <button className="btn" onClick={fakeError}>Fake Error</button>
          </div>
        </div>
      </div>
      {overlay && (
        <Overlay onClose={hideOverlay} type={overlay.type} msg={overlay.msg} />
      )}
      <style>{styles}</style>
    </div>
  );
}

function themeClass(t) {
  switch (t) {
    case "matrix": return "bg-black text-green-400 selection:bg-green-600/40";
    case "midnight": return "bg-[#0b1220] text-[#cde1ff] selection:bg-[#1a2a4a]";
    case "paper": return "bg-[#f1efe6] text-black selection:bg-yellow-300";
    case "solarized": return "bg-[#002b36] text-[#93a1a1] selection:bg-[#586e75]/60";
    default: return "bg-[#0a0a0a] text-[#c9f7c1] selection:bg-emerald-700/40";
  }
}

function Cursor({ blink, theme }) {
  return (
    <span
      className={"inline-block -mb-[2px] align-baseline w-2 h-4 ml-1 " + (theme === "paper" ? "bg-black" : "bg-current") + (blink ? " cursor-blink" : "")}
    />
  );
}

function Overlay({ type, onClose, msg }) {
  const label = type === "granted" ? "ACCESS GRANTED" : type === "denied" ? "ACCESS DENIED" : type === "breach" ? "BREACH COMPLETE" : "FATAL ERROR";
  return (
    <div className="fixed inset-0 z-30 grid place-items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={"relative mx-4 max-w-3xl w-full rounded-2xl border px-6 py-8 text-center shadow-2xl glitch " + (type === "granted" ? "border-emerald-400 text-emerald-300" : type === "denied" ? "border-red-400 text-red-300" : type === "breach" ? "border-cyan-400 text-cyan-300" : "border-yellow-400 text-yellow-300")}>
        <div className="text-2xl sm:text-4xl font-mono font-bold tracking-widest">{label}</div>
        {type === "error" && (
          <pre className="mt-4 text-left text-xs sm:text-sm max-h-[40vh] overflow-auto bg-black/30 rounded-lg p-3 border border-white/10">{msg}</pre>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

function getBaseSnippets() {
  const javascript = `// Fetch and cache with retries\nexport async function getJSON(url, opts = {}) {\n  const { retries = 3, cache = new Map() } = opts;\n  if (cache.has(url)) return cache.get(url);\n  let lastErr;\n  for (let i = 0; i < retries; i++) {\n    try {\n      const res = await fetch(url);\n      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n      const data = await res.json();\n      cache.set(url, data);\n      return data;\n    } catch (err) {\n      lastErr = err;\n      await new Promise(r => setTimeout(r, 2 ** i * 120));\n    }\n  }\n  throw lastErr;\n}\n\n// Tiny event emitter\nexport class Emitter {\n  #m = new Map();\n  on(t, f) { (this.#m.get(t) || this.#m.set(t, new Set()).get(t)).add(f); return () => this.off(t, f); }\n  off(t, f) { this.#m.get(t)?.delete(f); }\n  emit(t, v) { this.#m.get(t)?.forEach(fn => fn(v)); }\n}\n\n// Worker pool\nexport function pool(n = navigator.hardwareConcurrency || 4) {\n  const q = [];\n  let active = 0;\n  const run = async () => {\n    if (active >= n || q.length === 0) return;\n    const job = q.shift(); active++;\n    try { await job(); } finally { active--; run(); }\n  };\n  return (fn) => { q.push(fn); run(); };\n}\n`;

  const python = `# Simple LRU Cache\nfrom collections import OrderedDict\n\nclass LRU:\n    def __init__(self, cap=128):\n        self.cap = cap\n        self._m = OrderedDict()\n    def get(self, k):\n        if k not in self._m: return None\n        v = self._m.pop(k)\n        self._m[k] = v\n        return v\n    def set(self, k, v):\n        if k in self._m: self._m.pop(k)\n        elif len(self._m) >= self.cap: self._m.popitem(last=False)\n        self._m[k] = v\n\n# Async retry decorator\nimport asyncio\n\ndef retry(n=3, delay=0.1):\n    def deco(fn):\n        async def wrap(*a, **kw):\n            last = None\n            for i in range(n):\n                try: return await fn(*a, **kw)\n                except Exception as e:\n                    last = e\n                    await asyncio.sleep(delay * (2 ** i))\n            raise last\n        return wrap\n    return deco\n`;

  const rust = `// Basic ring buffer\npub struct Ring<T> { buf: Vec<Option<T>>, head: usize, tail: usize, cap: usize }\nimpl<T> Ring<T> {\n  pub fn with_capacity(n: usize) -> Self {\n    Self { buf: vec![None; n+1], head: 0, tail: 0, cap: n+1 }\n  }\n  pub fn push(&mut self, v: T) -> Result<(), T> {\n    let next = (self.tail + 1) % self.cap;\n    if next == self.head { return Err(v); }\n    self.buf[self.tail] = Some(v);\n    self.tail = next;\n    Ok(())\n  }\n  pub fn pop(&mut self) -> Option<T> {\n    if self.head == self.tail { return None; }\n    let v = self.buf[self.head].take();\n    self.head = (self.head + 1) % self.cap;\n    v\n  }\n}\n`;

  const bash = `#!/usr/bin/env bash\nset -euo pipefail\nlog(){ printf "[%s] %s\\n" "$(date +%H:%M:%S)" "$*"; }\nretry(){ local n=0; local max=\${1:-5}; shift; until "$@"; do n=$((n+1)); [[ $n -ge $max ]] && return 1; sleep $((2**n/10)); done }\nfor i in {1..5}; do log "tick-$i"; done\n`;

  const dockerfile = `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nENV PORT=8080 NODE_ENV=production\nEXPOSE 8080\nCMD ["node","server.js"]\n`;

  return { javascript, python, rust, bash, dockerfile };
}

function generateSyntheticCode(kind) {
  const L = [];
  for (let i = 1; i <= 220; i++) {
    if (kind === "python") {
      L.push(`def fn_${i}(x):\n    return (x * ${i}) ^ (${i} << 2)\n`);
    } else if (kind === "rust") {
      L.push(`fn fn_${i}(x: i32) -> i32 { (x * ${i}) ^ (${i} << 2) }\n`);
    } else if (kind === "bash") {
      L.push(`echo "line-${i}"; sleep 0.${(i%7)+1}\n`);
    } else if (kind === "dockerfile") {
      L.push(`RUN echo building-layer-${i} && true\n`);
    } else {
      L.push(`function fn_${i}(x){ return (x*${i}) ^ (${i}<<2) }\n`);
    }
  }
  return L.join("\n");
}

function makeFakeError() {
  const errs = [
    "TypeError: Cannot read properties of undefined (reading 'length')",
    "ReferenceError: secretKey is not defined",
    "IOException: Broken pipe while writing payload",
    "Segmentation fault (core dumped)",
    "panic: index out of bounds: the len is 16 but the index is 32",
  ];
  const pick = errs[Math.floor(Math.random()*errs.length)];
  const stack = [
    `at handler (/app/server.js:42:13)`,
    `at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `at async route (/lib/router.ts:118:17)`,
    `at Layer.handle [as handle_request] (/lib/stack.js:87:11)`,
    `at next (/lib/stack.js:101:7)`,
    `at dispatch (/lib/dispatcher.rs:213)`
  ].join("\n");
  return pick + "\n" + stack;
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

const styles = `
  .btn { padding: 0.375rem 0.625rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); transition: background 0.15s ease; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.75rem; }
  .btn:hover { background: rgba(255,255,255,0.1); }
  .kbd { display: inline-flex; align-items: center; padding: 0.125rem 0.375rem; border-radius: 0.375rem; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .cursor-blink { animation: blink 1s steps(1, end) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .glitch { position: relative; }
  .glitch::before, .glitch::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; mix-blend-mode: screen; }
  .glitch::before { transform: translate(-2px, -1px); box-shadow: inset 0 0 0 1px rgba(255,0,0,0.35); }
  .glitch::after { transform: translate(2px, 1px); box-shadow: inset 0 0 0 1px rgba(0,170,255,0.35); }
`;
