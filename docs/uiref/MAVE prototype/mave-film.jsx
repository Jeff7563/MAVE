const { Easing, CompositionStage, useComposition, useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSlider } = window;

// ── motion helpers (the only easings used) ──
const EZ = { enter: Easing.easeOutQuart, glide: Easing.easeInOutCubic, pop: Easing.easeOutBack };
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
function tw(T, a, b, from = 0, to = 1, ease = EZ.glide) {
  if (T <= a) return from; if (T >= b) return to;
  return from + (to - from) * ease((T - a) / (b - a));
}
const fade = (T, a, b) => tw(T, a, b, 0, 1, EZ.enter);
function mix(a, b, p) {
  if (typeof a === 'number') return a + (b - a) * p;
  const o = {}; for (const k in a) o[k] = b[k] === undefined ? a[k] : a[k] + (b[k] - a[k]) * p; return o;
}
function kf(T, keys, ease = EZ.glide) {
  if (T <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (T < keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return mix(v0, v1, ease((T - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function lerpHex(h1, h2, p) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, p));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

const PALETTES = {
  Indigo: { a1: '#5b84ff', a2: '#9a72ff', a3: '#5fd2ff' },
  Teal: { a1: '#3d9bff', a2: '#38c6b4', a3: '#8be8d8' },
  Dusk: { a1: '#7a6cff', a2: '#e07bd0', a3: '#ffb38a' },
};
const INK = '#eef0fb', DIM = 'rgba(222,226,255,0.56)', FAINT = 'rgba(222,226,255,0.34)';
const UI = "'Manrope', system-ui, sans-serif", WM = "'Jost', sans-serif", MONO = "'JetBrains Mono', monospace";
const glass = (r, extra = {}) => ({
  borderRadius: r,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.018)), rgba(12,14,30,0.58)',
  border: '1px solid rgba(180,190,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 70px -24px rgba(0,0,0,0.7)',
  backdropFilter: 'blur(22px) saturate(140%)', boxSizing: 'border-box', ...extra,
});
const place = (p, extra = {}) => ({
  position: 'absolute', left: p.x, top: p.y, transformOrigin: '0 0',
  transform: `translate(${p.dx || 0}px,${p.dy || 0}px) scale(${p.s == null ? 1 : p.s})`, opacity: p.o == null ? 1 : p.o, ...extra,
});

// ── background ──
function Ambient({ T, pal, glow, voiceAmp, act }) {
  const s = Math.sin, blobs = [
    { x: 260 + 80 * s(T * 0.07), y: 960, r: 950, c: pal.a2, a: 0.34 },
    { x: 1680 + 60 * s(T * 0.05 + 2), y: 980, r: 820, c: pal.a1, a: 0.34 },
    { x: 320, y: 120 + 40 * s(T * 0.06), r: 720, c: pal.a1, a: 0.16 },
    { x: 1620 + 50 * s(T * 0.08), y: 180, r: 620, c: pal.a2, a: 0.1 },
    { x: 960, y: 1180, r: 1100, c: pal.a3, a: 0.1 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#05060d', overflow: 'hidden' }}>
      {blobs.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: b.x - b.r, top: b.y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: '50%',
          background: `radial-gradient(circle, ${rgba(b.c, b.a * glow)} 0%, ${rgba(b.c, 0)} 62%)` }} />
      ))}
      {[0, 1].map(i => (
        <div key={'band' + i} style={{ position: 'absolute', left: -300, top: 820 + i * 110, width: 2600, height: 160 - i * 40, borderRadius: '50%',
          transform: `rotate(${-7 + i * 4}deg) translateX(${120 * s(T * 0.09 + i * 2)}px)`, filter: 'blur(46px)',
          background: `linear-gradient(90deg, transparent 5%, ${rgba(pal.a2, 0.32 * glow)} 30%, ${rgba(pal.a1, 0.36 * glow)} 55%, ${rgba(pal.a3, 0.16 * glow)} 75%, transparent 95%)` }} />
      ))}
      <div style={{ position: 'absolute', left: 960 - 700, top: 540 - 400, width: 1400, height: 800, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${rgba(pal.a1, (0.05 + 0.12 * voiceAmp * act) * glow)} 0%, transparent 65%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(2,3,8,0.75) 100%)' }} />
    </div>
  );
}

// ── voice ──
function Wave({ T, amp, w, h, pal }) {
  const n = Math.max(0, Math.floor(w / 11));
  if (n < 3) return null;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1), env = Math.pow(Math.sin(Math.PI * x), 1.3);
    const osc = Math.abs(Math.sin(T * 6.1 + i * 0.83) * Math.sin(T * 2.7 + i * 0.41 + 1.3));
    const hh = Math.max(3, h * (0.06 + amp * env * (0.2 + 0.8 * osc)));
    const col = lerpHex(pal.a3, pal.a2, 1 - Math.abs(x - 0.5) * 2);
    bars.push(<div key={i} style={{ width: 3, height: hh, borderRadius: 2, background: col, opacity: 0.3 + 0.7 * env, boxShadow: `0 0 10px ${rgba(pal.a2, 0.35)}` }} />);
  }
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: w, height: h }}>{bars}</div>;
}
const AMP = { off: 0, idle: 0.1, listen: 0.95, think: 0.16, speak: 0.6 };
const LABEL = { off: '', idle: '', listen: 'Listening', think: 'Thinking', speak: 'Speaking' };
function voiceAt(T, sched) {
  let i = -1; for (let k = 0; k < sched.length; k++) if (T >= sched[k][0]) i = k;
  if (i < 0) return { amp: 0, cur: '', prev: '', p: 1 };
  const cur = sched[i][1], prev = i > 0 ? sched[i - 1][1] : 'off', p = clamp01((T - sched[i][0]) / 0.4);
  return { amp: lerp(AMP[prev], AMP[cur], EZ.glide(p)), cur: LABEL[cur], prev: LABEL[prev], p };
}

function Pill({ T, r, act, sc, vs, pal, glow, opacity }) {
  const t01 = clamp01((r.h - 68) / 44);
  const fs = lerp(30, lerp(19, 23, t01), act), textW = 4.8 * fs, pad = lerp(34, 40, t01);
  const wmX = lerp(r.w / 2, pad + textW / 2, act), divX = pad + textW + 22;
  const statusW = lerp(112, 138, t01), waveX = divX + 26, waveW = Math.max(0, r.w - waveX - pad - statusW - 10);
  const sweep = 50 + 30 * Math.sin(T * 0.5);
  const lab = (txt, o) => txt ? (
    <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 9, opacity: o, fontFamily: UI, fontSize: lerp(16, 18, t01), color: DIM, whiteSpace: 'nowrap' }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: pal.a3, opacity: 0.55 + 0.45 * Math.sin(T * 5) }} />{txt}
    </div>) : null;
  return (
    <div style={{ position: 'absolute', left: r.cx - r.w / 2, top: r.cy - r.h / 2, width: r.w, height: r.h, opacity, transform: `scale(${sc})`,
      ...glass(r.h / 2, { boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 ${46 * glow}px ${rgba(pal.a1, 0.18 * glow)}, 0 24px 60px -20px rgba(0,0,0,0.7)`, border: `1px solid ${rgba(pal.a1, 0.32)}` }) }}>
      <div style={{ position: 'absolute', top: -1, left: `${sweep - 30}%`, width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${rgba(pal.a3, 0.85)}, transparent)` }} />
      <div style={{ position: 'absolute', bottom: -1, left: `${100 - sweep - 25}%`, width: '50%', height: 1, background: `linear-gradient(90deg, transparent, ${rgba(pal.a2, 0.5)}, transparent)` }} />
      <div style={{ position: 'absolute', left: wmX, top: '50%', transform: 'translate(-50%,-50%)', fontFamily: WM, fontWeight: 300, fontSize: fs, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#f3f4fc', whiteSpace: 'nowrap', lineHeight: 1 }}>MAVE</div>
      <div style={{ position: 'absolute', left: divX, top: '28%', height: '44%', width: 1, background: 'rgba(255,255,255,0.14)', opacity: act }} />
      <div style={{ position: 'absolute', left: waveX, top: '50%', transform: 'translateY(-50%)', opacity: act }}>
        <Wave T={T} amp={vs.amp} w={waveW} h={r.h * 0.56} pal={pal} />
      </div>
      <div style={{ position: 'absolute', right: pad, top: 0, bottom: 0, width: statusW, opacity: act }}>
        {lab(vs.prev, 1 - vs.p)}{lab(vs.cur, vs.p)}
      </div>
    </div>
  );
}

// an utterance: typed above the pill, then glides to its home
function Utter({ T, text, t0, t1, p, opacity, size = 38, color = INK }) {
  const n = Math.floor(tw(T, t0, t1, 0, text.length, Easing.linear));
  return (
    <div style={{ position: 'absolute', left: p.x, top: p.y, opacity, transformOrigin: '0 0',
      transform: `translate(${-50 * (1 - p.c)}%, ${p.dy || 0}px) scale(${p.s})`, fontFamily: UI, fontWeight: 400, fontSize: size, letterSpacing: '-0.012em', whiteSpace: 'nowrap',
      color: p.c > 0.5 ? lerpHex('#eef0fb', '#9aa0c4', clamp01((p.c - 0.5) * 2)) : color }}>
      <span>“{text.slice(0, n)}</span><span style={{ opacity: 0 }}>{text.slice(n)}</span><span style={{ opacity: n >= text.length ? 1 : 0 }}>”</span>
    </div>
  );
}

function MaveTag({ pal, T, size = 14 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size - 2, height: size - 2, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${pal.a3}, ${pal.a2} 70%)`, boxShadow: `0 0 12px ${rgba(pal.a2, 0.5)}` }} />
      <div style={{ fontFamily: WM, fontSize: size, letterSpacing: '0.32em', color: DIM }}>MAVE</div>
    </div>
  );
}
function Words({ T, text, t0, dt = 0.07, style }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.28em', ...style }}>
      {text.split(' ').map((w, i) => { const o = fade(T, t0 + i * dt, t0 + i * dt + 0.45);
        return <span key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 6}px)`, display: 'inline-block' }}>{w}</span>; })}
    </div>
  );
}

const TASKS = [
  { t: 'Draft the Aurora launch brief', m: 'Due Fri' },
  { t: 'Reply to Lena — pricing deck', m: '2 messages' },
  { t: 'Review onboarding research', m: '4 notes' },
];
function TaskRow({ task, p, ws, done, pal }) {
  return (
    <div style={place(p, { width: p.w, height: 56, display: 'flex', alignItems: 'center', gap: 14 * ws, borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI })}>
      <div style={{ width: 22 * ws, height: 22, flex: 'none', opacity: ws, borderRadius: 11, boxSizing: 'border-box', position: 'relative',
        border: `1.5px solid ${done > 0 ? rgba(pal.a1, 1) : 'rgba(255,255,255,0.28)'}`, background: rgba(pal.a1, done) }}>
        <div style={{ position: 'absolute', left: 7, top: 3, width: 5, height: 10, borderRight: '2px solid #fff', borderBottom: '2px solid #fff', transform: `rotate(45deg) scale(${done})`, opacity: done }} />
      </div>
      <div style={{ flex: 1, fontSize: 22, color: INK, opacity: 1 - 0.45 * done, whiteSpace: 'nowrap', overflow: 'hidden' }}>{task.t}</div>
      <div style={{ fontSize: 17, color: FAINT, whiteSpace: 'nowrap' }}>{task.m}</div>
    </div>
  );
}

function Thumb({ pal, w, h, r = 12, children }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, flex: 'none', position: 'relative', overflow: 'hidden',
      background: `radial-gradient(circle at 28% 38%, ${rgba(pal.a2, 0.6)}, transparent 58%), radial-gradient(circle at 78% 72%, ${rgba(pal.a1, 0.55)}, transparent 55%), radial-gradient(circle at 60% 20%, ${rgba(pal.a3, 0.3)}, transparent 45%), #0b0d1c` }}>{children}</div>
  );
}
function VideoCard({ pal, p }) {
  return (
    <div style={place(p, { width: 600, height: 196, padding: 16, display: 'flex', gap: 20, ...glass(22) })}>
      <Thumb pal={pal} w={290} h={164}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 52, height: 52, marginLeft: -26, marginTop: -26, ...glass(26, { display: 'flex', alignItems: 'center', justifyContent: 'center' }) }}>
          <div style={{ width: 0, height: 0, marginLeft: 4, borderLeft: '15px solid #fff', borderTop: '9px solid transparent', borderBottom: '9px solid transparent' }} />
        </div>
        <div style={{ position: 'absolute', right: 10, bottom: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.55)', fontFamily: MONO, fontSize: 13, color: INK }}>6:12</div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: '43%', height: 3, background: pal.a3 }} />
      </Thumb>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, fontFamily: UI, minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: FAINT }}>VIDEO</div>
        <div style={{ fontSize: 21, lineHeight: 1.3, color: INK, textWrap: 'pretty' }}>How great launches find their one sentence</div>
        <div style={{ fontSize: 15, color: DIM }}>Conference talk · 6 min</div>
        <div style={{ fontSize: 15, color: pal.a3 }}>Starts at 2:40 — the part you need</div>
      </div>
    </div>
  );
}
function RefCard({ p, tag, title, meta }) {
  return (
    <div style={place(p, { width: 600, height: 92, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 18, fontFamily: UI, ...glass(18) })}>
      <div style={{ width: 52, height: 52, flex: 'none', borderRadius: 13, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, color: DIM, letterSpacing: '0.08em' }}>{tag}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <div style={{ fontSize: 20, color: INK, whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 15, color: DIM, whiteSpace: 'nowrap' }}>{meta}</div>
      </div>
    </div>
  );
}
function KeyCard({ p, pal }) {
  return (
    <div style={place(p, { width: 600, height: 128, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: UI, ...glass(18) })}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: pal.a3 }}>KEY IDEA</div>
      <div style={{ fontSize: 22, lineHeight: 1.35, color: INK, textWrap: 'pretty' }}>Lead with the job people hire Aurora for — not the feature list.</div>
    </div>
  );
}

const CHIPS = [
  ['Files', 560, 30, 'top'], ['Documents', 960, 30, 'top'], ['Calendar', 1360, 30, 'top'],
  ['Messages', 1960, 380, 'right'], ['Web', 1960, 700, 'right'],
  ['Images', 1360, 1050, 'bottom'], ['Video', 960, 1050, 'bottom'], ['Code', 560, 1050, 'bottom'],
  ['Tasks', -40, 540, 'left'],
];
const SURF = { x: 140, y: 110, w: 1640, h: 860 };
function Chip({ T, i, c, X, K, pal }) {
  const [label, cx, cy, side] = c, t = X + 1.0 + i * 0.32;
  const out = tw(T, K + 0.1, K + 0.9);
  const o = fade(T, t, t + 0.5) * (1 - out);
  const dir = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side];
  const off = (1 - fade(T, t, t + 0.6)) * 24 - out * 40;
  const col = [pal.a1, pal.a2, pal.a3][i % 3];
  const hw = side === 'left' || side === 'right' ? 82 : 0, hh = side === 'top' || side === 'bottom' ? 27 : 0;
  const a = [cx + dir[0] * -hw * -1 * -1, cy];
  const start = side === 'top' ? [cx, cy + hh] : side === 'bottom' ? [cx, cy - hh] : side === 'left' ? [cx + hw, cy] : [cx - hw, cy];
  const end = side === 'top' ? [cx, SURF.y] : side === 'bottom' ? [cx, SURF.y + SURF.h] : side === 'left' ? [SURF.x, cy] : [SURF.x + SURF.w, cy];
  const len = Math.hypot(end[0] - start[0], end[1] - start[1]), ang = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
  const draw = tw(T, t + 0.2, t + 0.7, 0, 1, EZ.enter), lineO = draw * (1 - tw(T, t + 1.0, t + 1.8));
  const hit = fade(T, t + 0.55, t + 0.8) * (1 - tw(T, t + 0.8, t + 1.8));
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', left: start[0], top: start[1], width: len * draw, height: 1.5, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, opacity: lineO,
        background: `linear-gradient(90deg, ${rgba(col, 0.1)}, ${rgba(col, 0.9)})` }} />
      <div style={{ position: 'absolute', left: end[0] - 90, top: end[1] - 90, width: 180, height: 180, borderRadius: '50%', opacity: hit, background: `radial-gradient(circle, ${rgba(col, 0.45)}, transparent 60%)` }} />
      <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%,-50%) translate(${dir[0] * off}px,${dir[1] * off}px)`, opacity: o,
        height: 54, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 26, color: INK, whiteSpace: 'nowrap', ...glass(27) }}>
        <div style={{ width: 9, height: 9, borderRadius: 5, background: col, boxShadow: `0 0 10px ${col}` }} />{label}
      </div>
    </React.Fragment>
  );
}

function OutputPanel({ T, K, pal, o }) {
  const P = { x: 700, y: 300 };
  const tabX = kf(T, [[K + 2.9, 1], [K + 3.5, 0]]);
  const res = fade(T, K + 3.8, K + 4.6), gen = fade(T, K + 4.9, K + 5.9);
  const scanning = T > K + 3.3 && T < K + 5.9;
  const n = Math.max(0, Math.min(6, Math.floor((T - (K + 3.8)) / 0.5) + 1));
  const ready = T >= K + 6.9;
  const prog = tw(T, K + 3.8, K + 6.9, 0, 1, Easing.linear);
  const enter = fade(T, K + 2.2, K + 3.0);
  return (
    <div style={{ position: 'absolute', left: P.x, top: P.y, width: 1020, height: 516, opacity: o * enter, transform: `translateY(${(1 - enter) * 24}px) scale(${0.98 + 0.02 * enter})`, transformOrigin: '50% 0',
      ...glass(26, { background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)), rgba(14,16,34,0.7)' }) }}>
      <div style={{ position: 'absolute', left: 32, top: 24, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em', color: FAINT }}>OUTPUT</div>
        <div style={{ position: 'relative', display: 'flex', gap: 4, padding: 4, borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ position: 'absolute', left: 4 + tabX * 114, top: 4, width: 110, height: 36, borderRadius: 18, background: rgba(pal.a1, 0.28), border: `1px solid ${rgba(pal.a1, 0.6)}`, boxSizing: 'border-box' }} />
          {['Deck', 'Document', 'Visual', 'Video'].map(t => (
            <div key={t} style={{ position: 'relative', width: 110, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, fontSize: 16, color: INK }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 32, top: 88, width: 704, height: 396, borderRadius: 16, overflow: 'hidden', background: '#0a0c19', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ position: 'absolute', left: 44, top: 40, fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: FAINT }}>LAUNCH NARRATIVE · 01</div>
        <div style={{ position: 'absolute', left: 44, top: 128, opacity: 1 - res }}>
          <div style={{ width: 230, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ width: 300, height: 14, borderRadius: 7, marginTop: 22, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ width: 220, height: 14, borderRadius: 7, marginTop: 12, background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div style={{ position: 'absolute', left: 44, top: 112, width: 320, opacity: res, transform: `translateY(${(1 - res) * 10}px)` }}>
          <div style={{ fontFamily: WM, fontWeight: 300, fontSize: 68, color: INK, letterSpacing: '0.02em', lineHeight: 1 }}>Aurora</div>
          <div style={{ fontFamily: UI, fontSize: 22, color: DIM, marginTop: 18, lineHeight: 1.35 }}>The one job people hire it for.</div>
        </div>
        <div style={{ position: 'absolute', left: 404, top: 40, width: 260, height: 316, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 8px, transparent 8px 16px)' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, color: FAINT, letterSpacing: '0.1em' }}>generating visual</div>
          <div style={{ position: 'absolute', inset: 0, opacity: gen }}><Thumb pal={pal} w={260} h={316} r={0} /></div>
          {scanning && <div style={{ position: 'absolute', left: 0, right: 0, top: ((T - (K + 3.3)) * 150) % 330 - 20, height: 40, background: `linear-gradient(180deg, transparent, ${rgba(pal.a3, 0.35)}, transparent)` }} />}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 764, top: 88, display: 'grid', gridTemplateColumns: '108px 108px', gap: 12 }}>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const f = fade(T, K + 3.8 + i * 0.5, K + 4.3 + i * 0.5), active = n === i + 1 && !ready;
          return (
            <div key={i} style={{ width: 108, height: 61, borderRadius: 8, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', background: '#0a0c19',
              border: `1px solid ${active ? rgba(pal.a3, 0.8) : 'rgba(255,255,255,0.09)'}` }}>
              <div style={{ position: 'absolute', left: 10, top: 14, width: 44 * f, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.55)' }} />
              <div style={{ position: 'absolute', left: 10, top: 28, width: 32 * f, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }} />
              <div style={{ position: 'absolute', right: 8, top: 10, width: 34, height: 41, borderRadius: 4, opacity: f * (i % 2 ? 1 : 0.6), background: `linear-gradient(160deg, ${rgba(pal.a2, 0.7)}, ${rgba(pal.a1, 0.5)})` }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 764, top: 316, width: 228, fontFamily: UI }}>
        <div style={{ fontSize: 17, color: INK }}>{ready ? 'Deck ready · 6 slides' : n > 0 ? `Drafting slide ${n} of 6` : 'Choosing a format'}</div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ width: `${prog * 100}%`, height: '100%', background: `linear-gradient(90deg, ${pal.a3}, ${pal.a2})` }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', color: FAINT, marginTop: 30 }}>BUILT FROM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {['Launch brief', '2 notes', '3 references'].map((s, i) => (
            <div key={s} style={{ fontSize: 16, color: DIM, opacity: fade(T, K + 3.4 + i * 0.25, K + 3.9 + i * 0.25) }}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Piece({ tk }) {
  const { T, CUES, authoredTotal } = useComposition();
  const pal = PALETTES[tk.palette] || PALETTES.Indigo, glow = tk.glow == null ? 1 : tk.glow;
  const V = CUES.Voice, C = CUES.Chat, N = CUES.Info, W = CUES.Workspace, X = CUES.Connected, K = CUES.Create, Z = CUES.End, END = authoredTotal;

  const vs = voiceAt(T, [
    [V + 0.9, 'listen'], [V + 3.7, 'think'], [V + 4.5, 'speak'], [C + 3.8, 'idle'],
    [N + 0.2, 'listen'], [N + 1.6, 'think'], [N + 2.2, 'speak'], [N + 5.0, 'idle'],
    [W + 0.2, 'listen'], [W + 1.5, 'think'], [W + 2.0, 'speak'], [W + 5.6, 'idle'],
    [K + 0.8, 'listen'], [K + 2.1, 'think'], [K + 2.6, 'speak'], [K + 6.4, 'idle'], [Z + 0.6, 'off'],
  ]);

  const cam = kf(T, [
    [0, { s: 1, x: 0, y: 0 }], [V, { s: 1.04, x: 0, y: 0 }], [V + 1.4, { s: 1.16, x: 0, y: 0 }], [C, { s: 1.19, x: 0, y: 0 }],
    [C + 1.2, { s: 1.02, x: 0, y: -16 }], [N, { s: 1, x: 0, y: 0 }], [N + 2.6, { s: 1, x: 0, y: 0 }], [N + 5, { s: 1.05, x: -50, y: 0 }],
    [W + 1.6, { s: 1.06, x: -50, y: 0 }], [W + 3.0, { s: 0.96, x: 0, y: 0 }], [X, { s: 0.99, x: 0, y: 0 }], [X + 1.3, { s: 0.8, x: 0, y: 0 }],
    [K, { s: 0.78, x: 0, y: 0 }], [K + 1.0, { s: 1, x: 0, y: 0 }], [K + 2.6, { s: 1, x: 0, y: 0 }], [K + 4.2, { s: 1.1, x: -130, y: -10 }],
    [Z, { s: 1.12, x: -150, y: -10 }], [Z + 1.4, { s: 1, x: 0, y: 0 }], [END, { s: 1.035, x: 0, y: 0 }],
  ]);

  const P0 = { cx: 960, cy: 540, w: 300, h: 96 }, PV = { cx: 960, cy: 540, w: 800, h: 112 }, PD = { cx: 960, cy: 930, w: 660, h: 76 }, PW = { cx: 960, cy: 912, w: 620, h: 68 };
  const pr = kf(T, [[0, P0], [V + 0.6, P0], [V + 1.4, PV], [C + 0.1, PV], [C + 1.1, PD], [W + 1.8, PD], [W + 3.0, PW], [Z + 0.6, PW], [Z + 1.8, P0]]);
  const act = T < Z ? tw(T, V + 0.6, V + 1.4) : tw(T, Z + 0.7, Z + 1.7, 1, 0);
  const press = T < V + 0.45 ? tw(T, V + 0.2, V + 0.45, 1, 0.955, EZ.enter) : tw(T, V + 0.45, V + 1.0, 0.955, 1, EZ.pop);
  const breathe = 1 + 0.006 * Math.sin(T * 1.3) * (1 - act);
  const ring = tw(T, V + 0.4, V + 1.6, 0, 1, EZ.enter);

  const dis = 1 - tw(T, Z, Z + 0.9);
  const outC = tw(T, K + 2.0, K + 2.8);
  const leaveW = 1 - tw(T, W + 1.6, W + 2.2);

  const U1 = kf(T, [[C + 0.1, { x: 960, y: 418, s: 1, c: 0 }], [C + 1.1, { x: 580, y: 214, s: 0.6, c: 1 }], [N + 1.9, { x: 580, y: 214, s: 0.6, c: 1 }], [N + 2.9, { x: 260, y: 214, s: 0.6, c: 1 }]]);
  const U2 = kf(T, [[N + 1.6, { x: 960, y: 818, s: 1, c: 0 }], [N + 2.6, { x: 260, y: 636, s: 0.6, c: 1 }]]);
  const U3 = kf(T, [[W + 1.6, { x: 960, y: 818, s: 1, c: 0, dy: 0 }], [W + 2.8, { x: 200, y: 170, s: 1.1, c: 1, dy: 0 }]]);
  const U4 = kf(T, [[K + 2.1, { x: 960, y: 800, s: 1, c: 0, dy: 0 }], [K + 2.9, { x: 960, y: 760, s: 0.9, c: 0, dy: -10 }]]);

  const R = kf(T, [[N + 1.9, { x: 580, y: 280, s: 1 }], [N + 2.9, { x: 260, y: 280, s: 1 }], [W + 2.0, { x: 260, y: 280, s: 1 }], [W + 3.2, { x: 700, y: 362, s: 0.62 }]]);
  const rows = TASKS.map((_, i) => kf(T, [[N + 1.9, { x: 580, y: 420 + 60 * i, w: 760 }], [N + 2.9, { x: 260, y: 420 + 60 * i, w: 760 }],
    [W + 2.1 + 0.12 * i, { x: 260, y: 420 + 60 * i, w: 760 }], [W + 3.3 + 0.12 * i, { x: 200, y: 360 + 64 * i, w: 460 }]]));
  const card = (y, tgt, i, a0) => {
    const p = kf(T, [[W + 2.0 + i * 0.1, { x: 1060, y, s: 1 }], [W + 3.2 + i * 0.1, tgt]]);
    const a = fade(T, a0, a0 + 0.7);
    return { ...p, dx: (1 - a) * 90 + outC * 60, o: a * (1 - outC) };
  };
  const doneAt = [null, X + 2.7, W + 5.0];
  const progress = kf(T, [[W + 3.0, 0], [W + 4.0, 32], [W + 5.0, 32], [W + 5.6, 48], [X + 2.7, 48], [X + 3.3, 64], [K + 4, 64], [K + 7, 80]], EZ.enter);
  const wsO = fade(T, W + 2.6, W + 3.4);
  const black = Math.max(1 - tw(T, 0, 1.4, 0, 1, EZ.enter), tw(T, Z + 4.8, END));

  return (
    <div data-screen-label={`t=${Math.floor(T)}s`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#05060d' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + (cam.s - 1) * 0.3})` }}>
        <Ambient T={T} pal={pal} glow={glow} voiceAmp={vs.amp} act={act} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `scale(${cam.s}) translate(${cam.x}px,${cam.y}px)` }}>

        {/* surface: the conversation becomes a workspace */}
        {(() => { const s = kf(T, [[W + 1.8, { x: 230, y: 190, w: 1460, h: 700, o: 0, r: 36 }], [W + 3.0, { ...SURF, o: 1, r: 36 }], [Z + 0.3, { ...SURF, o: 1, r: 36 }], [Z + 1.6, { x: 810, y: 492, w: 300, h: 96, o: 0, r: 48 }]]);
          return s.o > 0.001 && <div style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h, opacity: s.o, ...glass(s.r, { background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012)), rgba(9,11,24,0.55)' }) }} />; })()}

        <div style={{ position: 'absolute', inset: 0, opacity: dis, filter: dis < 1 ? `blur(${(1 - dis) * 8}px)` : 'none' }}>
          {/* project header */}
          <div style={{ position: 'absolute', left: 200, top: 146, opacity: wsO * (T < W + 2.9 ? 0 : 1), fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', color: FAINT }}>PROJECT</div>
          <div style={{ position: 'absolute', left: 200, top: 170, opacity: fade(T, W + 2.5, W + 3.1), fontFamily: WM, fontWeight: 300, fontSize: 48, color: INK, letterSpacing: '0.01em' }}>Aurora Launch</div>
          <div style={{ position: 'absolute', left: 200, top: 238, opacity: fade(T, W + 3.0, W + 3.6), fontFamily: UI, fontSize: 17, color: DIM }}>Built from this conversation · just now</div>
          <div style={{ position: 'absolute', left: 1400, top: 168, width: 320, opacity: wsO, fontFamily: UI }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 16, color: DIM }}>Progress</div>
              <div style={{ fontFamily: WM, fontSize: 34, fontWeight: 300, color: INK }}>{Math.round(progress)}%</div>
            </div>
            <div style={{ height: 4, borderRadius: 2, marginTop: 14, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${pal.a3}, ${pal.a1}, ${pal.a2})` }} />
            </div>
          </div>
          {[['Tasks', 200, 1 - 0.55 * outC], ['Notes', 700, 1 - outC], ['References', 1220, 1 - outC]].map(([l, x, o]) => (
            <div key={l} style={{ position: 'absolute', left: x, top: 312, opacity: fade(T, W + 2.9, W + 3.5) * o, fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', color: FAINT }}>{l.toUpperCase()}</div>
          ))}

          {/* conversation → notes */}
          <div style={place({ ...R, dx: outC * 60, o: (T >= C + 0.9 ? 1 : 0) * (1 - outC) }, { width: 760 })}>
            <div style={{ opacity: fade(T, C + 0.9, C + 1.4) }}><MaveTag pal={pal} T={T} /></div>
            <Words T={T} t0={C + 1.2} text="Morning. Aurora's launch brief is due Friday — I'd start there." style={{ marginTop: 16, fontFamily: UI, fontSize: 29, lineHeight: 1.32, color: INK }} />
          </div>
          {TASKS.map((task, i) => {
            const a = fade(T, C + 2.4 + 0.25 * i, C + 3.0 + 0.25 * i);
            const ws = tw(T, W + 2.6 + 0.12 * i, W + 3.4 + 0.12 * i);
            const done = doneAt[i] ? fade(T, doneAt[i], doneAt[i] + 0.4) : 0;
            return <TaskRow key={i} task={task} ws={ws} done={done} pal={pal} p={{ ...rows[i], dy: (1 - a) * 12, o: a * (1 - 0.55 * outC) }} />;
          })}
          <div style={{ position: 'absolute', left: 260, top: 690, width: 760, opacity: fade(T, N + 2.5, N + 3.1) * leaveW }}>
            <MaveTag pal={pal} T={T} />
            <Words T={T} t0={N + 2.6} text="Three sources, clearest first. The talk is six minutes." style={{ marginTop: 14, fontFamily: UI, fontSize: 24, color: INK }} />
          </div>

          {/* information comes to the user */}
          <VideoCard pal={pal} p={card(214, { x: 1220, y: 362, s: 0.833 }, 0, N + 2.9)} />
          <RefCard p={card(430, { x: 1220, y: 542, s: 0.833 }, 1, N + 3.4)} tag="WEB" title="The positioning canvas, explained" meta="strategyreview.com · 8 min read" />
          <RefCard p={card(538, { x: 1220, y: 632, s: 0.833 }, 2, N + 3.8)} tag="PDF" title="Aurora_Research_Q3.pdf" meta="From your files · p. 12 highlighted" />
          <KeyCard pal={pal} p={card(646, { x: 700, y: 470, s: 0.767 }, 3, N + 4.4)} />

          <OutputPanel T={T} K={K} pal={pal} o={1} />
        </div>

        {/* connected world */}
        {T > X && T < K + 1 && CHIPS.map((c, i) => <Chip key={c[0]} T={T} i={i} c={c} X={X} K={K} pal={pal} />)}

        {/* wake ring */}
        {ring > 0 && ring < 1 && <div style={{ position: 'absolute', left: P0.cx - P0.w / 2, top: P0.cy - P0.h / 2, width: P0.w, height: P0.h, borderRadius: 48,
          border: `1px solid ${rgba(pal.a3, 0.6)}`, opacity: 1 - ring, transform: `scale(${1 + ring * 0.5}, ${1 + ring * 0.9})` }} />}

        <Pill T={T} r={pr} act={act} sc={press * breathe} vs={vs} pal={pal} glow={glow} opacity={fade(T, 0.3, 1.6)} />

        {/* utterances */}
        <Utter T={T} text="What should I work on today?" t0={V + 1.8} t1={V + 3.6} p={U1} opacity={(T >= V + 1.8 ? 1 : 0) * leaveW} />
        <Utter T={T} text="Find something that explains this." t0={N + 0.4} t1={N + 1.5} p={U2} opacity={(T >= N + 0.4 ? 1 : 0) * leaveW} />
        <Utter T={T} text="Turn this into a project." t0={W + 0.4} t1={W + 1.4} p={U3} opacity={(T >= W + 0.4 ? 1 : 0) * (1 - tw(T, W + 1.9, W + 2.4))} />
        <Utter T={T} text="Create something from this." t0={K + 1.0} t1={K + 2.0} p={U4} opacity={(T >= K + 1.0 ? 1 : 0) * (1 - tw(T, K + 2.2, K + 2.9))} />
      </div>

      {/* end line */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, fontFamily: UI, fontWeight: 300, fontSize: 32, color: INK, letterSpacing: '0.01em' }}>
        {['Your AI.', 'Your context.', 'Your world.'].map((l, i) => { const o = fade(T, Z + 2.2 + i * 0.55, Z + 3.0 + i * 0.55);
          return <div key={l} style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>{l}</div>; })}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: black, pointerEvents: 'none' }} />
    </div>
  );
}

function MaveFilm() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS || { motionEditor: true, palette: 'Indigo', glow: 1 });
  return (
    <React.Fragment>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#05060d">
        <Piece tk={t} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Playback" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
        <TweakSection label="Look" />
        <TweakRadio label="Accent" value={t.palette} options={['Indigo', 'Teal', 'Dusk']} onChange={v => setTweak('palette', v)} />
        <TweakSlider label="Ambient glow" value={t.glow} min={0} max={1.6} step={0.1} onChange={v => setTweak('glow', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
window.MaveFilm = MaveFilm;
