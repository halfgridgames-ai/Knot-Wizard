// Records vertical (1080x1920, 30 fps) gameplay clips of Knot Wizard for TikTok / Reels / Shorts.
// The game runs on a virtual clock, one screenshot per frame, so clips are smooth however slow the machine is.
// A scripted finger drags the pins to a solution; the soundtrack and sound effects are rendered offline
// with the game's own synth code and muxed in, so the audio lines up exactly with the picture.
//
//   node tools/record-clips.js [out-dir] [clip-name ...]     (needs Playwright + Chromium, and ffmpeg)
//   node tools/record-clips.js --dry                          (just checks which levels solve within par)
//   node tools/record-clips.js --soundtrack [out-dir]         (renders each world's music loop to mp3)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');

const GAME = path.resolve(__dirname, '..', 'index.html');
const args = process.argv.slice(2), DRY = args.includes('--dry');
const OUT = path.resolve(args.find(a => !a.startsWith('--') && (a.includes('/') || a.includes('.'))) || 'clips');
const ONLY = args.filter(a => !a.startsWith('--') && !(a.includes('/') || a.includes('.')));
const FPS = 30, DT = 1000 / FPS;

// level numbers run 1-150: Forest 1-30, Castle 31-60, Docks 61-90, Clouds 91-120, Void 121-150
const CLIPS = [
  { name: 'forest-solve', levels: [24], skin: 'classic' },
  { name: 'castle-locked-pins', levels: [52], skin: 'chain' },
  { name: 'docks-stretchy-ropes', levels: [77], skin: 'classic' },
  { name: 'clouds-tied-pins', levels: [108], skin: 'fairy' },
  { name: 'void-spinning-board', levels: [138], skin: 'rainbow' },
  { name: 'void-final-level', levels: [150], skin: 'fairy' },
  { name: 'five-worlds-speedrun', levels: [12, 40, 68, 98, 128], skin: 'classic', quick: true },
  { name: 'satisfying-forest-chain', levels: [8, 14, 19], skin: 'licorice', quick: true },
];

// Installed before the game loads: a virtual clock (performance.now, rAF, timers, CSS animations)
// and an on-screen fingertip that follows the pointer.
function shim() {
  window.__kwCapture = { sfx: [] };
  let vt = 0, rafQ = [], timers = [], tid = 1; const cleared = new Set();
  performance.now = () => vt;
  window.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (cb, ms = 0, ...a) => { const id = tid++; timers.push({ id, t: vt + (+ms || 0), cb: () => cb(...a) }); return id; };
  window.clearTimeout = window.clearInterval = id => { cleared.add(id); timers = timers.filter(x => x.id !== id); };
  window.setInterval = (cb, ms) => { const id = tid++; const arm = () => timers.push({ id, t: vt + Math.max(1, +ms || 0), cb: () => { cb(); if (!cleared.has(id)) arm(); } }); arm(); return id; };
  window.__kwStep = ms => {
    const end = vt + ms;
    for (;;) { timers.sort((a, b) => a.t - b.t); const t = timers[0]; if (!t || t.t > end) break; timers.shift(); vt = t.t; try { t.cb(); } catch (e) { console.error(e); } }
    vt = end;
    const q = rafQ; rafQ = []; q.forEach(cb => { try { cb(vt); } catch (e) { console.error(e); } });
    document.getAnimations().forEach(a => { if (a.__t0 == null) a.__t0 = vt; a.pause(); a.currentTime = vt - a.__t0; });
    return vt;
  };
  addEventListener('DOMContentLoaded', () => {
    const f = document.createElement('div'); f.id = 'kwFinger';
    f.style.cssText = 'position:fixed;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;background:rgba(255,255,255,0.55);border:2.5px solid rgba(255,255,255,0.95);box-shadow:0 3px 10px rgba(0,0,0,0.35);z-index:9999;pointer-events:none;display:none;transition:none';
    document.body.appendChild(f);
    const at = (e, down) => { f.style.display = 'block'; f.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(${down ? 0.82 : 1})`; f.style.background = down ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)'; };
    let down = false;
    addEventListener('pointerdown', e => { down = true; at(e, true); }, true);
    addEventListener('pointerup', e => { down = false; at(e, false); }, true);
    addEventListener('pointermove', e => at(e, down), true);
    window.__kwHideFinger = () => { f.style.display = 'none'; };
  });
  // next move for the scripted player: put pins home into the solved layout, the most helpful first.
  // (The hint solver only steps in when it can finish the puzzle in one move.)
  const tried = {};
  window.__kwNext = () => {
    const A = __kwCapture.api, G = A.G, def = G.def, P = G.P.map(p => ({ ...p })), E = def.E, inc = A.incidence(def.n, E);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), cross = () => A.crossings(P, E).length, base = cross();
    if (!base) return null;
    if (G.moves === 0) for (const k in tried) delete tried[k];
    const h = A.bestMove(def, P, E, inc);
    if (h && h.total === 0) return { k: h.k, from: { ...G.P[h.k] }, to: { x: h.x, y: h.y } };
    let best = null;
    for (let k = 0; k < def.n; k++) {
      const tgt = def.solved[k]; if (d(P[k], tgt) < 0.02 || (tried[k] || 0) >= 2) continue;
      if (def.link && def.link[k] >= 0 && d(P[def.link[k]], def.solved[def.link[k]]) < 0.02) continue;
      const mv = A.tryMove(def, P, k, tgt); if (!mv) continue;
      const blocked = mv.some(([g, p]) => P.some((o, j) => !mv.some(m => m[0] === j) && d(o, p) < 0.11));
      const orig = mv.map(([g]) => P[g]); mv.forEach(([g, p]) => P[g] = p); const c = cross(); mv.forEach(([g], i) => P[g] = orig[i]);
      const score = c + (blocked ? 1000 : 0);
      if (!best || score < best.score) best = { k, to: tgt, score };
    }
    if (!best) return h ? { k: h.k, from: { ...G.P[h.k] }, to: { x: h.x, y: h.y } } : null;
    tried[best.k] = (tried[best.k] || 0) + 1;
    return { k: best.k, from: { ...G.P[best.k] }, to: best.to };
  };
  // a short plan worked out up front: each step takes whichever move (hint solver or a pin going home)
  // clears the most crossings. Empty when it can't finish within par, and then __kwNext plays instead.
  window.__kwPlan = () => {
    const A = __kwCapture.api, def = A.G.def, P = A.G.P.map(p => ({ ...p })), E = def.E, inc = A.incidence(def.n, E);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), cross = () => A.crossings(P, E).length, plan = [];
    while (cross() && plan.length < def.par) {
      const base = cross(); let best = null;
      const h = A.bestMove(def, P, E, inc); if (h) best = { k: h.k, to: { x: h.x, y: h.y }, c: h.total };
      for (let k = 0; k < def.n; k++) {
        const tgt = def.solved[k]; if (d(P[k], tgt) < 0.02) continue;
        const mv = A.tryMove(def, P, k, tgt); if (!mv) continue;
        if (mv.some(([g, p]) => P.some((o, j) => !mv.some(m => m[0] === j) && d(o, p) < 0.11))) continue;
        const orig = mv.map(([g]) => P[g]); mv.forEach(([g, p]) => P[g] = p); const c = cross(); mv.forEach(([g], i) => P[g] = orig[i]);
        if (!best || c <= best.c) best = { k, to: tgt, c };
      }
      if (!best || best.c >= base) return [];
      A.tryMove(def, P, best.k, best.to).forEach(([g, p]) => P[g] = p); plan.push(best);
    }
    return cross() ? [] : plan;
  };
  window.__kwPx = p => { const A = __kwCapture.api, r = document.querySelector('#board').getBoundingClientRect(), q = A.toPx(p); return { x: r.left + q.x, y: r.top + q.y }; };
  window.__kwRender = async (segments, dur, t0) => {
    const A = __kwCapture.api, sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const master = oc.createGain(); master.connect(oc.destination);
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(1, 0.3); master.gain.setValueAtTime(1, Math.max(0.4, dur - 1.2)); master.gain.linearRampToValueAtTime(0, dur);
    for (const s of segments) {
      const g = oc.createGain(); g.connect(master);
      g.gain.setValueAtTime(0.0001, 0); g.gain.setValueAtTime(0.0001, Math.max(0, s.from - 0.01)); g.gain.exponentialRampToValueAtTime(1, s.from + (s.from ? 0.6 : 0.05));
      if (s.to < dur) { g.gain.setValueAtTime(1, s.to); g.gain.linearRampToValueAtTime(0, s.to + 0.6); }
      const bus = A.musicBus(oc, g), e8 = 30 / A.SONGS[s.song].bpm;
      for (let st = 0; s.from + st * e8 < Math.min(s.to + 0.6, dur); st++) A.songStep(oc, bus, s.song, st, s.from + st * e8);
    }
    for (const [t, f, dd, type, vol] of __kwCapture.sfx) { const tt = t - t0; if (tt >= 0 && tt < dur) A.toneAt(oc, master, tt, f, dd, type, vol); }
    const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const wav = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, s) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
    wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(wav.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(s);
  };
}

const ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

async function record(browser, clip) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: DRY ? 1 : 3, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  page error:', e.message));
  await page.addInitScript(shim);
  await page.addInitScript(skin => localStorage.setItem('knotwizard.v1', JSON.stringify({ skin, hints: 3 })), clip.skin);
  await page.goto('file://' + GAME);
  await page.evaluate(() => document.fonts.ready);
  let ff = null, frames = 0, t0 = 0, cur = { x: 300, y: 560 };
  const tmp = path.join(OUT, '.' + clip.name + '.video.mp4');
  if (!DRY) {
    fs.mkdirSync(OUT, { recursive: true });
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  const frame = async () => {
    await page.evaluate(ms => __kwStep(ms), DT); frames++;
    if (ff) { const jpg = await page.screenshot({ type: 'jpeg', quality: 93 }); if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r)); }
  };
  const hold = async s => { for (let i = 0; i < Math.round(s * FPS); i++) await frame(); };
  const segments = []; const report = [];
  t0 = await page.evaluate(() => performance.now() / 1000);
  for (let li = 0; li < clip.levels.length; li++) {
    const L = clip.levels[li];
    await page.evaluate(L => { document.querySelector('#win').hidden = true; __kwCapture.api.startPuzzle('level', L); }, L);
    const song = Math.floor((L - 1) / 30), now = frames / FPS;
    if (!segments.length || segments[segments.length - 1].song !== song) { if (segments.length) segments[segments.length - 1].to = now; segments.push({ song, from: now, to: 1e9 }); }
    await hold(li ? 0.5 : 1.1);
    const plan = await page.evaluate(() => __kwPlan());
    let moves = 0;
    for (; moves < 40; moves++) {
      const m = await page.evaluate(pm => { const G = __kwCapture.api.G; return pm ? { k: pm.k, from: { ...G.P[pm.k] }, to: pm.to } : __kwNext(); }, plan[moves] || null); if (!m) break;
      const speed = clip.quick ? 0.75 : 1;
      // finger travels to the pin
      const travel = Math.round(FPS * 0.32 * speed);
      for (let i = 1; i <= travel; i++) {
        const p = await page.evaluate(m => __kwPx(__kwCapture.api.G.P[m.k]), m), u = ease(i / travel);
        await page.mouse.move(cur.x + (p.x - cur.x) * u, cur.y + (p.y - cur.y) * u); await frame();
      }
      let p = await page.evaluate(m => __kwPx(__kwCapture.api.G.P[m.k]), m);
      await page.mouse.move(p.x, p.y); await page.mouse.down(); await frame(); await frame();
      const dlen = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y), n = Math.round(FPS * speed * (0.38 + 0.6 * Math.min(1, dlen / 0.7)));
      for (let i = 1; i <= n; i++) {
        const u = ease(i / n), q = { x: m.from.x + (m.to.x - m.from.x) * u + Math.sin(u * Math.PI) * 0.02, y: m.from.y + (m.to.y - m.from.y) * u };
        p = await page.evaluate(q => __kwPx(q), q); await page.mouse.move(p.x, p.y); await frame();
      }
      await frame(); await page.mouse.up(); cur = p;
      await hold(clip.quick ? 0.12 : 0.22);
      if (await page.evaluate(() => __kwCapture.api.G.solved)) { moves++; break; }
    }
    const st = await page.evaluate(() => { const G = __kwCapture.api.G; return { solved: G.solved, moves: G.moves, par: G.def.par }; });
    report.push(`L${L}: ${st.solved ? 'solved' : 'NOT solved'} in ${st.moves} (par ${st.par})`);
    // finger lifts away, celebration plays out
    await page.mouse.move(cur.x, 700); await page.evaluate(() => __kwHideFinger());
    await hold(li === clip.levels.length - 1 ? 3.4 : 1.7);
  }
  const dur = frames / FPS;
  if (ff) {
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    const b64 = await page.evaluate(([s, d, t]) => __kwRender(s, d, t), [segments, dur, t0]);
    const wav = path.join(OUT, '.' + clip.name + '.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'knot-wizard-' + clip.name + '.mp4')], { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    fs.unlinkSync(tmp); fs.unlinkSync(wav);
  }
  console.log(`${clip.name}: ${dur.toFixed(1)}s · ${report.join(' · ')}`);
  await ctx.close();
}

// Each world's loop, two times round (32 bars), as an mp3 for video editing.
async function soundtrack(browser) {
  const page = await browser.newPage(); await page.addInitScript(shim); await page.goto('file://' + GAME);
  fs.mkdirSync(OUT, { recursive: true });
  const names = await page.evaluate(() => __kwCapture.api.WORLDS.map(w => w.name.toLowerCase()));
  for (let song = 0; song < names.length; song++) {
    const dur = await page.evaluate(s => 32 * 4 * 60 / __kwCapture.api.SONGS[s].bpm + 2.5, song);
    const b64 = await page.evaluate(([s, d]) => __kwRender([{ song: s, from: 0, to: d }], d, 1e9), [song, dur]);
    const wav = path.join(OUT, '.music.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    const out = path.join(OUT, `knot-wizard-music-${song + 1}-${names[song]}.mp3`);
    await new Promise(r => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', out], { stdio: 'inherit' }).on('close', r));
    fs.unlinkSync(wav); console.log(out, dur.toFixed(1) + 's');
  }
}

(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  if (args.includes('--soundtrack')) await soundtrack(browser);
  else for (const c of CLIPS) if (!ONLY.length || ONLY.includes(c.name)) await record(browser, c);
  await browser.close();
})();
