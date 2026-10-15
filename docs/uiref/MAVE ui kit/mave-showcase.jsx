const { Easing, CompositionStage, useComposition, useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSlider } = window;

const EZ = { enter: Easing.easeOutQuart, glide: Easing.easeInOutCubic, pop: Easing.easeOutBack };
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
function tw(T, a, b, from = 0, to = 1, ease = EZ.glide) {
  if (T <= a) return from; if (T >= b) return to;
  return from + (to - from) * ease((T - a) / (b - a));
}
const fade = (T, a, b) => tw(T, a, b, 0, 1, EZ.enter);
const win = (T, a, b, f = 0.45) => fade(T, a, a + f) * (1 - tw(T, b - f * 0.8, b));
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
const st = (T, s, d) => T < s ? 'wait' : T < d ? 'run' : 'done';

const PALETTES = {
  Indigo: { a1: '#5b84ff', a2: '#9a72ff', a3: '#5fd2ff' },
  Teal: { a1: '#3d9bff', a2: '#38c6b4', a3: '#8be8d8' },
  Dusk: { a1: '#7a6cff', a2: '#e07bd0', a3: '#ffb38a' },
};
const INK = '#eef0fb', DIM = 'rgba(222,226,255,0.6)', FAINT = 'rgba(222,226,255,0.38)';
const ERR = '#ff7a85', OKC = '#5fe0a8', WARN = '#ffc46b';
const UI = "'Manrope', system-ui, sans-serif", WM = "'Jost', sans-serif", MONO = "'JetBrains Mono', monospace";
const glass = (r, extra = {}) => ({
  borderRadius: r,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.018)), rgba(12,14,30,0.6)',
  border: '1px solid rgba(180,190,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 70px -24px rgba(0,0,0,0.7)',
  backdropFilter: 'blur(22px) saturate(140%)', boxSizing: 'border-box', ...extra,
});
const inner = (extra = {}) => ({ borderRadius: 18, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', ...extra });
const ab = (x, y, extra = {}) => ({ position: 'absolute', left: x, top: y, ...extra });
const Lab = ({ children, style }) => <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em', color: FAINT, whiteSpace: 'nowrap', ...style }}>{children}</div>;

function Layer({ a, x, y, w, h, dx = 0, dy = 10, s = 1, blur = 0, children }) {
  if (a <= 0.002) return null;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: a, transformOrigin: '50% 50%',
    transform: `translate(${dx * (1 - a)}px,${dy * (1 - a)}px) scale(${s})`, filter: blur > 0.05 ? `blur(${blur}px)` : 'none' }}>{children}</div>;
}
function Icon({ s, T, pal, size = 20 }) {
  const base = { width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', position: 'relative' };
  if (s === 'run') return <div style={{ ...base, border: '2px solid rgba(255,255,255,0.14)', borderTopColor: pal.a3, transform: `rotate(${T * 420}deg)` }} />;
  if (s === 'done') return (
    <div style={{ ...base, background: rgba(OKC, 0.16), border: `1.5px solid ${rgba(OKC, 0.85)}` }}>
      <div style={{ position: 'absolute', left: size * 0.34, top: size * 0.17, width: size * 0.2, height: size * 0.4, borderRight: `2px solid ${OKC}`, borderBottom: `2px solid ${OKC}`, transform: 'rotate(45deg)' }} />
    </div>);
  if (s === 'live') return <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: size * 0.45, height: size * 0.45, borderRadius: '50%', background: pal.a3, boxShadow: `0 0 ${8 + 6 * Math.sin(T * 4)}px ${pal.a3}` }} /></div>;
  if (s === 'hold') return <div style={{ ...base, border: `1.5px solid ${rgba(WARN, 0.8)}` }} />;
  return <div style={{ ...base, border: '1.5px solid rgba(255,255,255,0.22)' }} />;
}
function Orb({ pal, size = 14 }) {
  return <div style={{ width: size, height: size, flex: 'none', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${pal.a3}, ${pal.a2} 70%)`, boxShadow: `0 0 12px ${rgba(pal.a2, 0.5)}` }} />;
}
function MaveTag({ pal }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Orb pal={pal} size={12} /><div style={{ fontFamily: WM, fontSize: 14, letterSpacing: '0.32em', color: DIM }}>MAVE</div></div>;
}
function Words({ T, text, t0, dt = 0.06, style }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.28em', ...style }}>
      {text.split(' ').map((w, i) => { const o = fade(T, t0 + i * dt, t0 + i * dt + 0.4);
        return <span key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 6}px)`, display: 'inline-block' }}>{w}</span>; })}
    </div>
  );
}
function Typed({ T, text, t0, t1 }) {
  const n = Math.floor(tw(T, t0, t1, 0, text.length, Easing.linear));
  return <React.Fragment><span>{text.slice(0, n)}</span><span style={{ opacity: 0 }}>{text.slice(n)}</span></React.Fragment>;
}
function Bar({ p, w, pal, h = 4 }) {
  return <div style={{ width: w, height: h, borderRadius: h, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
    <div style={{ width: `${p * 100}%`, height: '100%', background: `linear-gradient(90deg, ${pal.a3}, ${pal.a1}, ${pal.a2})` }} /></div>;
}
function Thumb({ pal, w, h, r = 12, children }) {
  return <div style={{ width: w, height: h, borderRadius: r, flex: 'none', position: 'relative', overflow: 'hidden',
    background: `radial-gradient(circle at 28% 38%, ${rgba(pal.a2, 0.55)}, transparent 58%), radial-gradient(circle at 78% 72%, ${rgba(pal.a1, 0.5)}, transparent 55%), radial-gradient(circle at 60% 20%, ${rgba(pal.a3, 0.28)}, transparent 45%), #0b0d1c` }}>{children}</div>;
}
function Chip({ children, tone, pal, style }) {
  const c = tone === 'ok' ? OKC : tone === 'err' ? ERR : tone === 'warn' ? WARN : null;
  return <div style={{ height: 34, padding: '0 14px', borderRadius: 17, display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 15, whiteSpace: 'nowrap', boxSizing: 'border-box',
    color: c || INK, background: c ? rgba(c, 0.1) : rgba(pal.a1, 0.2), border: `1px solid ${c ? rgba(c, 0.4) : rgba(pal.a1, 0.5)}`, ...style }}>{children}</div>;
}

// ── background ──
function Ambient({ T, pal, glow, amp }) {
  const s = Math.sin, blobs = [
    { x: 260 + 80 * s(T * 0.07), y: 960, r: 950, c: pal.a2, a: 0.34 },
    { x: 1680 + 60 * s(T * 0.05 + 2), y: 980, r: 820, c: pal.a1, a: 0.34 },
    { x: 320, y: 120 + 40 * s(T * 0.06), r: 720, c: pal.a1, a: 0.16 },
    { x: 1620 + 50 * s(T * 0.08), y: 180, r: 620, c: pal.a2, a: 0.1 },
    { x: 960, y: 1180, r: 1100, c: pal.a3, a: 0.1 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#05060d', overflow: 'hidden' }}>
      {blobs.map((b, i) => <div key={i} style={{ position: 'absolute', left: b.x - b.r, top: b.y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(b.c, b.a * glow)} 0%, ${rgba(b.c, 0)} 62%)` }} />)}
      {[0, 1].map(i => <div key={'b' + i} style={{ position: 'absolute', left: -300, top: 840 + i * 110, width: 2600, height: 160 - i * 40, borderRadius: '50%', filter: 'blur(46px)',
        transform: `rotate(${-7 + i * 4}deg) translateX(${120 * s(T * 0.09 + i * 2)}px)`,
        background: `linear-gradient(90deg, transparent 5%, ${rgba(pal.a2, 0.3 * glow)} 30%, ${rgba(pal.a1, (0.34 + 0.12 * amp) * glow)} 55%, ${rgba(pal.a3, 0.16 * glow)} 75%, transparent 95%)` }} />)}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(2,3,8,0.78) 100%)' }} />
    </div>
  );
}

// ── voice pill ──
function Wave({ T, amp, w, h, pal }) {
  const n = Math.max(0, Math.floor(w / 11)); if (n < 3) return null;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1), env = Math.pow(Math.sin(Math.PI * x), 1.3);
    const osc = Math.abs(Math.sin(T * 6.1 + i * 0.83) * Math.sin(T * 2.7 + i * 0.41 + 1.3));
    bars.push(<div key={i} style={{ width: 3, height: Math.max(3, h * (0.06 + amp * env * (0.2 + 0.8 * osc))), borderRadius: 2, background: lerpHex(pal.a3, pal.a2, 1 - Math.abs(x - 0.5) * 2), opacity: 0.3 + 0.7 * env }} />);
  }
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: w, height: h }}>{bars}</div>;
}
const AMP = { off: 0, idle: 0.1, listen: 0.95, think: 0.16, speak: 0.6 };
const LABEL = { off: '', idle: '', listen: 'Listening', think: 'Thinking', speak: 'Speaking' };
function voiceAt(T, sched) {
  let i = -1; for (let k = 0; k < sched.length; k++) if (T >= sched[k][0]) i = k;
  if (i < 0) return { amp: 0, cur: '', prev: '', p: 1 };
  const cur = sched[i][1], prev = i > 0 ? sched[i - 1][1] : 'off', p = clamp01((T - sched[i][0]) / 0.35);
  return { amp: lerp(AMP[prev], AMP[cur], EZ.glide(p)), cur: LABEL[cur], prev: LABEL[prev], p };
}
function Pill({ T, r, act, sc, vs, pal, glow, opacity }) {
  const t01 = clamp01((r.h - 68) / 40);
  const fs = lerp(30, lerp(19, 23, t01), act), textW = 4.8 * fs, pad = lerp(34, 40, t01);
  const wmX = lerp(r.w / 2, pad + textW / 2, act), divX = pad + textW + 22;
  const statusW = lerp(112, 138, t01), waveX = divX + 26, waveW = Math.max(0, r.w - waveX - pad - statusW - 10);
  const sweep = 50 + 30 * Math.sin(T * 0.5);
  const lab = (txt, o) => txt ? <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 9, opacity: o, fontFamily: UI, fontSize: lerp(16, 18, t01), color: DIM, whiteSpace: 'nowrap' }}>
    <div style={{ width: 6, height: 6, borderRadius: 3, background: pal.a3, opacity: 0.55 + 0.45 * Math.sin(T * 5) }} />{txt}</div> : null;
  return (
    <div style={{ position: 'absolute', left: r.cx - r.w / 2, top: r.cy - r.h / 2, width: r.w, height: r.h, opacity, transform: `scale(${sc})`,
      ...glass(r.h / 2, { boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 ${46 * glow}px ${rgba(pal.a1, 0.16 * glow)}, 0 24px 60px -20px rgba(0,0,0,0.7)`, border: `1px solid ${rgba(pal.a1, 0.32)}` }) }}>
      <div style={{ position: 'absolute', top: -1, left: `${sweep - 30}%`, width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${rgba(pal.a3, 0.85)}, transparent)` }} />
      <div style={{ position: 'absolute', left: wmX, top: '50%', transform: 'translate(-50%,-50%)', fontFamily: WM, fontWeight: 300, fontSize: fs, letterSpacing: '0.42em', paddingLeft: '0.42em', color: '#f3f4fc', whiteSpace: 'nowrap', lineHeight: 1 }}>MAVE</div>
      <div style={{ position: 'absolute', left: divX, top: '28%', height: '44%', width: 1, background: 'rgba(255,255,255,0.14)', opacity: act }} />
      <div style={{ position: 'absolute', left: waveX, top: '50%', transform: 'translateY(-50%)', opacity: act }}><Wave T={T} amp={vs.amp} w={waveW} h={r.h * 0.56} pal={pal} /></div>
      <div style={{ position: 'absolute', right: pad, top: 0, bottom: 0, width: statusW, opacity: act }}>{lab(vs.prev, 1 - vs.p)}{lab(vs.cur, vs.p)}</div>
    </div>
  );
}
function Captions({ T, lines, pr }) {
  const y = pr.cy - pr.h / 2 - 56, fs = lerp(30, 38, clamp01((pr.h - 72) / 32));
  return lines.map(([t, d, text], i) => {
    const nx = lines[i + 1], end = Math.min(t + d + 1.5, nx ? nx[0] - 0.15 : 1e9);
    if (T < t || T > end) return null;
    const a = Math.min(fade(T, t, t + 0.2), 1 - tw(T, end - 0.35, end));
    return <div key={i} style={{ position: 'absolute', left: 960, top: y, transform: `translate(-50%,-50%) translateY(${(1 - a) * 6}px)`, opacity: a, fontFamily: UI, fontSize: fs, color: INK, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
      “<Typed T={T} text={text} t0={t} t1={t + d} /><span style={{ opacity: T >= t + d ? 1 : 0 }}>”</span></div>;
  });
}

// ── 01 preview ──
function PreviewView({ T, M, pal, a }) {
  const rows = [['MAVE UI V2', 'Build failed 6 minutes ago', 'err'], ['Design research', 'Ready for review', 'ok'], ['Product review', '14:00', 'cal']];
  return (
    <Layer a={a} x={560} y={612} w={800} h={250}>
      <div style={ab(32, 26, { display: 'flex', alignItems: 'center', gap: 14 })}><Orb pal={pal} size={12} />
        <Words T={T} t0={M + 5.4} text="Three things need your attention." style={{ fontFamily: UI, fontSize: 24, color: INK }} /></div>
      {rows.map(([t, s, k], i) => { const o = fade(T, M + 6.3 + i * 0.25, M + 6.9 + i * 0.25);
        return <div key={t} style={ab(32, 78 + i * 54, { width: 736, height: 54, display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', opacity: o, transform: `translateY(${(1 - o) * 8}px)`, fontFamily: UI })}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: k === 'err' ? ERR : k === 'ok' ? OKC : pal.a3 }} />
          <div style={{ flex: 1, fontSize: 21, color: INK }}>{t}</div>
          <div style={{ fontSize: 18, color: k === 'err' ? ERR : DIM, fontFamily: k === 'cal' ? MONO : UI }}>{s}</div></div>; })}
    </Layer>
  );
}

// ── 02 home ──
function HomeView({ T, H, pal, a, rec }) {
  const r = i => fade(T, H - 0.1 + i * 0.14, H + 0.5 + i * 0.14);
  const rv = (i, st) => ({ opacity: r(i), transform: `translateY(${(1 - r(i)) * 14}px)`, ...st });
  const builds = [1, 1, 1, 1, 1, 1, 0];
  const projects = [['MAVE Core', 'Navigation concept', 0.68], ['Roblox Drone', 'Flight physics', 0.41], ['Affiliate Pipeline', '3 tasks running', 0.82]];
  return (
    <Layer a={a} x={160} y={80} w={1600} h={760} s={1 - 0.05 * rec} blur={rec * 8}>
      <Lab style={ab(48, 40)}>HOME</Lab>
      <Lab style={ab(null, 40, { right: 48 })}>THURSDAY 15 OCTOBER · 13:18</Lab>
      <div style={ab(48, 92, rv(0, { width: 940, height: 330, ...inner({ borderRadius: 24, border: `1px solid ${rgba(ERR, 0.32)}`, boxShadow: `0 0 50px -10px ${rgba(ERR, 0.14)}` }) }))}>
        <div style={ab(36, 32, { display: 'flex', alignItems: 'center', gap: 10 })}><div style={{ width: 8, height: 8, borderRadius: 4, background: ERR, opacity: 0.6 + 0.4 * Math.sin(T * 4) }} /><Lab style={{ color: ERR }}>NOW</Lab></div>
        <div style={ab(36, 68, { fontFamily: UI, fontWeight: 500, fontSize: 44, color: INK, letterSpacing: '-0.02em' })}>MAVE UI V2</div>
        <div style={ab(36, 130, { fontFamily: UI, fontSize: 22, color: ERR })}>Build failed · 6 minutes ago</div>
        <div style={ab(36, 166, { fontFamily: MONO, fontSize: 16, color: DIM })}>2 TypeScript errors · src/components/navigation.tsx</div>
        <div style={ab(36, 222, { display: 'flex', gap: 6 })}>{builds.map((b, i) => <div key={i} style={{ width: 28, height: 6, borderRadius: 3, background: b ? rgba(OKC, 0.55) : ERR }} />)}</div>
        <div style={ab(36, 256, { display: 'flex', gap: 10 })}><Chip pal={pal}>Ask MAVE to fix</Chip><Chip pal={pal} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)' }}>Open logs</Chip></div>
      </div>
      <Lab style={ab(48, 460, rv(3))}>ACTIVE PROJECTS</Lab>
      {projects.map(([n, s, p], i) => (
        <div key={n} style={ab(48 + i * 320, 494, rv(3 + i * 0.5, { width: 300, height: 200, ...inner({ borderRadius: 20 }) }))}>
          <div style={ab(26, 26, { fontFamily: UI, fontSize: 22, color: INK })}>{n}</div>
          <div style={ab(26, 60, { fontFamily: UI, fontSize: 16, color: DIM })}>{s}</div>
          <div style={ab(26, 146)}><Bar p={p * r(4)} w={248} pal={pal} /></div>
          <div style={ab(26, 160, { fontFamily: MONO, fontSize: 13, color: FAINT })}>{Math.round(p * 100)}%</div>
        </div>))}
      <Lab style={ab(1036, 92, rv(1))}>TODAY</Lab>
      {[['14:00', 'Product Review', 'in 42 min'], ['18:00', 'Gym', '']].map(([t, n, s], i) => (
        <div key={n} style={ab(1036, 124 + i * 68, rv(1 + i * 0.4, { width: 516, height: 68, display: 'flex', alignItems: 'center', gap: 22, borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI }))}>
          <div style={{ fontFamily: MONO, fontSize: 19, color: i ? DIM : INK }}>{t}</div>
          <div style={{ flex: 1, fontSize: 21, color: INK }}>{n}</div>
          <div style={{ fontSize: 16, color: pal.a3 }}>{s}</div></div>))}
      <Lab style={ab(1036, 300, rv(2))}>MAVE ACTIVITY</Lab>
      {[['done', 'Research completed'], ['live', '3 tasks running'], ['hold', '1 item needs approval']].map(([s, n], i) => (
        <div key={n} style={ab(1036, 332 + i * 60, rv(2 + i * 0.4, { width: 516, height: 60, display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI, fontSize: 20, color: INK }))}>
          <Icon s={s} T={T} pal={pal} />{n}</div>))}
    </Layer>
  );
}

// ── 03 chat ──
function ChatView({ T, C, pal, a }) {
  const press = tw(T, C + 4.5, C + 4.75, 0, 1, EZ.enter) * (1 - tw(T, C + 4.75, C + 5.2));
  const errs = [['L8', 'TS2322', "Type 'string | undefined' is not assignable to type 'Route'."], ['L13', 'TS2339', "Property 'icon' does not exist on type 'NavItem'."]];
  return (
    <Layer a={a} x={460} y={150} w={1000} h={640}>
      <div style={ab(null, 44, { right: 48, opacity: fade(T, C + 0.2, C + 0.7), fontFamily: UI, fontSize: 22, color: DIM })}>Why did the build fail?</div>
      <div style={ab(48, 110, { opacity: fade(T, C + 0.6, C + 1.0) })}><MaveTag pal={pal} /></div>
      <Words T={T} t0={C + 0.8} text="The latest navigation change introduced two TypeScript errors." style={{ ...ab(48, 146), width: 880, fontFamily: UI, fontSize: 30, lineHeight: 1.32, color: INK }} />
      <div style={ab(48, 270, { width: 904, height: 150, ...inner(), opacity: fade(T, C + 1.8, C + 2.4), transform: `translateY(${(1 - fade(T, C + 1.8, C + 2.4)) * 10}px)` })}>
        <div style={ab(24, 20, { display: 'flex', gap: 14, alignItems: 'center', fontFamily: MONO, fontSize: 15 })}><span style={{ color: INK }}>navigation.tsx</span><span style={{ color: ERR }}>2 errors</span></div>
        {errs.map(([l, c, m], i) => <div key={l} style={ab(24, 62 + i * 36, { display: 'flex', gap: 18, fontFamily: MONO, fontSize: 15, whiteSpace: 'nowrap' })}>
          <span style={{ color: FAINT, width: 32 }}>{l}</span><span style={{ color: ERR }}>{c}</span><span style={{ color: DIM }}>{m}</span></div>)}
      </div>
      <Words T={T} t0={C + 2.6} text="I can fix them." style={{ ...ab(48, 456), fontFamily: UI, fontSize: 30, color: INK }} />
      <div style={ab(48, 516, { display: 'flex', gap: 10, opacity: fade(T, C + 3.0, C + 3.5) })}>
        <Chip pal={pal} style={{ transform: `scale(${1 - 0.06 * press})`, background: rgba(pal.a1, 0.22 + 0.4 * press), boxShadow: `0 0 ${24 * press}px ${rgba(pal.a1, 0.6)}` }}>Fix it</Chip>
        <Chip pal={pal} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)' }}>Show diff</Chip>
      </div>
    </Layer>
  );
}

// ── 04 code ──
const KW = /^(import|from|export|function|const|return|type)$/;
function hl(str) {
  return str.split(/('[^']*'|\b[A-Za-z_]+\b|<\/?[A-Za-z]+|[{}()=>;:,.\[\]?])/g).filter(p => p !== '').map((p, i) => {
    let c = '#c9cde8';
    if (p[0] === "'") c = '#9be3c0';
    else if (KW.test(p)) c = '#b79bff';
    else if (/^<\/?[A-Za-z]/.test(p)) c = '#7fc8ff';
    else if (/^[A-Z]/.test(p)) c = '#ffd29a';
    else if (/^[{}()=>;:,.\[\]?]$/.test(p)) c = 'rgba(200,205,235,0.5)';
    return <span key={i} style={{ color: c }}>{p}</span>;
  });
}
const CODE = ["import { useRouter } from './router';", "import type { NavItem, Route } from './types';", '', 'export function Navigation({ items }: Props) {', '  const router = useRouter();', '',
  '  const go = (item: NavItem) => {', null, '    router.push(target);', '  };', '', '  return items.map((item) => (', null, '  ));', '}'];
const TREE = [[0, 'mave-ui-v2', 'dir'], [1, 'src', 'dir'], [2, 'components', 'dir'], [3, 'navigation.tsx', 'active'], [3, 'sidebar.tsx'], [3, 'panel.tsx'], [2, 'router.ts'], [2, 'types.ts'], [1, 'tests', 'dir'], [2, 'navigation.test.tsx'], [1, 'package.json']];
const TESTS = ['navigation renders items', 'go() falls back to home', 'NavLink receives glyph', 'router.push called once', 'active route highlighted', 'keyboard navigation'];
function CodeView({ T, D, pal, a, out }) {
  const fixed = T > D + 5.3, green = T > D + 7.3;
  const ins = " ?? 'home'", n8 = Math.floor(tw(T, D + 3.4, D + 4.1, 0, ins.length, Easing.linear));
  const neu = 'glyph={item.glyph}', n13 = Math.floor(tw(T, D + 4.7, D + 5.3, 0, neu.length, Easing.linear));
  const errOn = fade(T, D + 1.4, D + 1.8);
  const scan = kf(T, [[D + 0.6, 0], [D + 1.4, 7], [D + 4.2, 7], [D + 4.5, 12], [D + 5.4, 12]]);
  const scanA = win(T, D + 0.6, D + 5.9);
  const LH = 36, EY = 96, EX = 300;
  const rowBg = i => {
    if (i === 7) return T < D + 3.4 ? rgba(ERR, 0.08 * errOn) : rgba(OKC, 0.09 * (1 - tw(T, D + 6.5, D + 7.5)));
    if (i === 12) return T < D + 4.7 ? rgba(ERR, 0.08 * errOn) : rgba(OKC, 0.09 * (1 - tw(T, D + 6.5, D + 7.5)));
    return 'transparent';
  };
  const squig = on => ({ textDecoration: on ? 'underline wavy' : 'none', textDecorationColor: ERR, textUnderlineOffset: 6 });
  const steps = [['Analyzing dependency', D + 1.0, D + 3.0, 'navigation.tsx → types.ts · Route'], ['Editing navigation.tsx', D + 3.0, D + 5.4, '2 changes'], ['Running tests', D + 5.4, D + 7.2, '']];
  const nTests = Math.floor(tw(T, D + 5.5, D + 7.1, 0, 12, Easing.linear));
  return (
    <Layer a={a} x={120} y={70} w={1680} h={780} dx={0} dy={10}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-60 * out}px)` }}>
        <div style={ab(28, 20, { display: 'flex', gap: 10, fontFamily: MONO, fontSize: 15, color: FAINT })}>mave-ui-v2 / src / components / <span style={{ color: INK }}>navigation.tsx</span></div>
        <div style={ab(null, 14, { right: 24, display: 'flex', gap: 10 })}>
          <Chip pal={pal} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: DIM, fontFamily: MONO, fontSize: 13 }}>main</Chip>
          <Chip pal={pal} tone={green ? 'ok' : 'err'}>{green ? 'Build successful' : 'Build failed'}</Chip></div>
        <div style={ab(0, 62, { width: 1680, height: 1, background: 'rgba(255,255,255,0.08)' })} />
        {TREE.map(([d, n, k], i) => {
          const act = k === 'active', sel = act && T > D + 0.7;
          return <div key={i} style={ab(14, 82 + i * 38, { width: 272, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 14 + d * 16, boxSizing: 'border-box',
            background: sel ? rgba(pal.a1, 0.16) : 'transparent', fontFamily: MONO, fontSize: 15, color: k === 'dir' ? FAINT : act ? INK : DIM })}>
            <span>{k === 'dir' ? '▾' : ''}</span><span style={{ flex: 1 }}>{n}</span>
            {act && <div style={{ width: 7, height: 7, borderRadius: 4, marginRight: 12, background: fixed ? OKC : ERR }} />}</div>;
        })}
        <div style={ab(EX, 62, { width: 1, height: 718, background: 'rgba(255,255,255,0.08)' })} />
        <div style={ab(EX + 1, EY + scan * LH - 2, { width: 888, height: LH, background: rgba(pal.a1, 0.1), opacity: scanA, borderTop: `1px solid ${rgba(pal.a1, 0.25)}`, borderBottom: `1px solid ${rgba(pal.a1, 0.25)}`, boxSizing: 'border-box' })} />
        {CODE.map((l, i) => (
          <div key={i} style={ab(EX + 1, EY + i * LH - 2, { width: 888, height: LH, display: 'flex', alignItems: 'center', background: rowBg(i), fontFamily: MONO, fontSize: 17, whiteSpace: 'pre' })}>
            <div style={{ width: 52, textAlign: 'right', paddingRight: 20, color: FAINT, fontSize: 14 }}>{i + 1}</div>
            {i === 7 ? <div>{hl('    const target: Route = ')}<span style={squig(T < D + 3.4 && errOn > 0.5)}>{hl('item.route')}</span><span style={{ background: rgba(OKC, 0.18) }}>{hl(ins.slice(0, n8))}</span>{hl(';')}</div>
              : i === 12 ? <div>{hl('    <NavLink key={item.id} ')}{T < D + 4.7
                ? <span style={{ ...squig(T < D + 4.4 && errOn > 0.5), background: T > D + 4.4 ? rgba(ERR, 0.25) : 'transparent', textDecorationLine: T > D + 4.4 ? 'line-through' : (errOn > 0.5 ? 'underline' : 'none') }}>{hl('icon={item.icon}')}</span>
                : <span style={{ background: rgba(OKC, 0.18) }}>{hl(neu.slice(0, n13))}</span>}{hl(' onSelect={() => go(item)} />')}</div>
              : <div>{hl(l)}</div>}
          </div>))}
        <div style={ab(EX + 380, EY + 8 * LH + 2, { opacity: win(T, D + 1.6, D + 3.3), ...glass(12, { padding: '12px 16px', fontFamily: MONO, fontSize: 14, color: DIM, whiteSpace: 'nowrap', background: 'rgba(20,14,26,0.92)', border: `1px solid ${rgba(ERR, 0.4)}` }) })}>
          <span style={{ color: ERR }}>TS2322</span>  Type 'string | undefined' is not assignable to 'Route'</div>
        <div style={ab(1190, 62, { width: 1, height: 718, background: 'rgba(255,255,255,0.08)' })} />
        <div style={ab(1222, 92)}><MaveTag pal={pal} /></div>
        <div style={ab(1222, 124, { fontFamily: UI, fontSize: 24, color: INK })}>Fixing build</div>
        {steps.map(([n, s, d, sub], i) => { const state = st(T, s, d);
          return <div key={n} style={ab(1222, 186 + i * 62, { width: 430, opacity: 0.35 + 0.65 * fade(T, s - 0.2, s + 0.2) })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: UI, fontSize: 19, color: INK }}><Icon s={state} T={T} pal={pal} size={18} />{n}{state === 'run' ? '…' : ''}</div>
            {sub && <div style={{ marginLeft: 32, marginTop: 6, fontFamily: MONO, fontSize: 13, color: FAINT, opacity: fade(T, s + 0.4, s + 0.8) }}>{sub}</div>}</div>; })}
        <Lab style={ab(1222, 392, { opacity: fade(T, D + 5.4, D + 5.8) })}>TESTS · {nTests}/12</Lab>
        {TESTS.map((n, i) => <div key={n} style={ab(1222, 424 + i * 30, { display: 'flex', gap: 12, fontFamily: MONO, fontSize: 14, color: DIM, opacity: fade(T, D + 5.6 + i * 0.22, D + 5.9 + i * 0.22) })}><span style={{ color: OKC }}>✓</span>{n}</div>)}
        <div style={ab(1222, 620, { opacity: fade(T, D + 7.2, D + 7.6), display: 'flex', gap: 10 })}><Chip pal={pal} tone="ok">12 tests passed</Chip><Chip pal={pal} tone="ok">Build successful</Chip></div>
        <Words T={T} t0={D + 7.6} text="Fixed. The build is green again." style={{ ...ab(1222, 676), width: 430, fontFamily: UI, fontSize: 22, color: INK }} />
      </div>
    </Layer>
  );
}

// ── 05 web ──
const SOURCES = [
  { d: 'interfacenotes.io', slug: 'assistants-context', t: 'Designing assistants that know where you are', m: 'Interface Notes · 7 min read', hi: 1, p: [
    'Most assistants still open on a blank prompt. The user has to explain where they are, what they were doing and what they need before anything useful happens.',
    "The strongest systems begin from the user's current context, not from an empty input.",
    'In testing, assistants that surfaced the active document or project first cut setup turns by more than half.'] },
  { d: 'hci.review', slug: 'progressive-disclosure-conversation', t: 'Progressive disclosure in conversational systems', m: 'HCI Review · 11 min read', hi: 1, p: [
    'Conversational interfaces tend to fail in one of two ways: they hide everything behind language, or they bring back every menu at once.',
    "Reveal controls only when the task calls for them, and let them recede the moment it doesn't.",
    'Participants described the best prototypes as quiet — present, but rarely in the way.'] },
  { d: 'productfield.co', slug: 'keep-the-thread', t: 'Why the thread should never disappear', m: 'Product Field · 6 min read', hi: 1, p: [
    'When an assistant switches into a tool, users often lose the conversation that brought them there.',
    'People trust systems that keep one persistent conversation across every surface they open.',
    'Switching apps resets attention. Switching modes inside one layer does not.'] },
];
function WebView({ T, W, pal, a }) {
  const win3 = [[W + 0.3, W + 2.3], [W + 2.3, W + 4.3], [W + 4.3, W + 6.4]];
  const ai = T < W + 2.3 ? 0 : T < W + 4.3 ? 1 : 2;
  const tabX = kf(T, [[W + 2.1, 0], [W + 2.5, 1], [W + 4.1, 1], [W + 4.5, 2]]);
  const n = 1 + Math.floor(tw(T, W + 0.4, W + 6.3, 0, 13, Easing.linear));
  const done = T > W + 6.4, sum = fade(T, W + 6.4, W + 7.0);
  return (
    <Layer a={a} x={120} y={70} w={1680} h={780} dx={60} dy={0}>
      <div style={ab(28, 16, { display: 'flex', alignItems: 'center', gap: 14, fontFamily: UI, fontSize: 19, color: INK, height: 32 })}>
        <Icon s={done ? 'done' : 'run'} T={T} pal={pal} size={18} />Researching contextual AI interfaces</div>
      <div style={ab(null, 20, { right: 28, fontFamily: MONO, fontSize: 15, color: DIM })}>{n} sources reviewed</div>
      <div style={ab(0, 62, { width: 1680, height: 1, background: 'rgba(255,255,255,0.08)' })} />
      <div style={ab(24, 82, { display: 'flex', gap: 8 })}>
        <div style={ab(tabX * 258, 0, { width: 250, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box' })} />
        {SOURCES.map((s, i) => <div key={s.d} style={{ position: 'relative', width: 250, height: 40, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', boxSizing: 'border-box', fontFamily: UI, fontSize: 15, color: i === ai ? INK : FAINT }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: [pal.a1, pal.a2, pal.a3][i], opacity: 0.8 }} />{s.d}</div>)}
        <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 14px', fontFamily: MONO, fontSize: 14, color: FAINT }}>+{Math.max(0, n - 3)}</div>
      </div>
      <div style={ab(24, 130, { width: 1060, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 20px', boxSizing: 'border-box', fontFamily: MONO, fontSize: 14, color: DIM })}>
        https://{SOURCES[ai].d}/{SOURCES[ai].slug}</div>
      <div style={ab(24, 184, { width: 1060, height: 572, borderRadius: 16, overflow: 'hidden', background: '#0a0c18', border: '1px solid rgba(255,255,255,0.08)' })}>
        {SOURCES.map((s, i) => { const [t0, t1] = win3[i]; const pa = i === 2 ? fade(T, t0, t0 + 0.3) : win(T, t0, t1 + 0.15, 0.3); if (pa <= 0.01) return null;
          const sy = tw(T, t0 + 0.2, t0 + 1.6, 0, -250), hp = tw(T, t0 + 0.9, t0 + 1.5, 0, 1, Easing.linear);
          return <div key={s.d} style={{ position: 'absolute', left: 64, top: 48 + sy, width: 800, opacity: pa, fontFamily: UI }}>
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.12em', color: FAINT }}>{s.d.toUpperCase()}</div>
            <div style={{ fontSize: 36, fontWeight: 500, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 14 }}>{s.t}</div>
            <div style={{ fontSize: 15, color: FAINT, marginTop: 12 }}>{s.m}</div>
            <div style={{ marginTop: 26 }}><Thumb pal={pal} w={800} h={190} r={12} /></div>
            {s.p.map((p, j) => <p key={j} style={{ fontSize: 20, lineHeight: 1.65, color: j === s.hi ? INK : DIM, margin: '24px 0 0', textWrap: 'pretty' }}>
              {j === s.hi ? <span style={{ backgroundImage: `linear-gradient(${rgba(pal.a1, 0.4)}, ${rgba(pal.a1, 0.4)})`, backgroundSize: `${hp * 100}% 100%`, backgroundRepeat: 'no-repeat', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '2px 0' }}>{p}</span> : p}</p>)}
          </div>; })}
        <div style={{ position: 'absolute', left: 0, right: 0, top: ((T - W) * 220) % 640 - 60, height: 60, background: `linear-gradient(180deg, transparent, ${rgba(pal.a3, 0.06)}, transparent)`, opacity: done ? 0 : 1 }} />
      </div>
      <div style={ab(1108, 82, { width: 548, height: 674, opacity: 1 - sum })}>
        <Lab>FINDINGS</Lab>
        {SOURCES.map((s, i) => { const o = fade(T, win3[i][0] + 1.5, win3[i][0] + 2.0);
          return <div key={s.d} style={{ ...inner({ width: 548, padding: '18px 22px', marginTop: i ? 12 : 22 }), opacity: o, transform: `translateX(${(1 - o) * -30}px)` }}>
            <div style={{ fontFamily: UI, fontSize: 18, lineHeight: 1.45, color: INK, textWrap: 'pretty' }}>{s.p[s.hi]}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: FAINT, marginTop: 10 }}>{s.d}</div></div>; })}
      </div>
      <div style={ab(1108, 82, { width: 548, opacity: sum, transform: `translateY(${(1 - sum) * 12}px)` })}>
        <MaveTag pal={pal} />
        <div style={{ fontFamily: UI, fontSize: 28, color: INK, marginTop: 22, lineHeight: 1.3 }}>3 patterns appear consistently</div>
        {['Context first', 'Progressive disclosure', 'Persistent conversation'].map((t, i) => { const o = fade(T, W + 6.8 + i * 0.25, W + 7.3 + i * 0.25);
          return <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 18, height: 72, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: i ? 0 : 28, opacity: o, fontFamily: UI, fontSize: 24, color: INK }}>
            <span style={{ fontFamily: MONO, fontSize: 15, color: pal.a3 }}>0{i + 1}</span>{t}</div>; })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 30, opacity: fade(T, W + 7.6, W + 8.0) }}>
          <div style={{ display: 'flex' }}>{[0, 1, 2, 3, 4].map(i => <div key={i} style={{ width: 22, height: 22, borderRadius: 7, marginLeft: i ? -6 : 0, border: '2px solid #10121f', background: [pal.a1, pal.a2, pal.a3, '#8a90b8', '#5a6090'][i] }} />)}</div>
          <div style={{ fontFamily: UI, fontSize: 17, color: DIM }}>Sources · 14</div></div>
      </div>
    </Layer>
  );
}

// ── 06 agent ──
function AgentView({ T, A, pal, a }) {
  const rows = [['Researching references', A + 0.4, A + 1.0], ['Reviewing current UI', A + 1.0, A + 2.0], ['Updating navigation', A + 2.0, 1e9], ['Preparing comparison', 1e9, 1e9]];
  return (
    <Layer a={a} x={610} y={240} w={700} h={470}>
      <div style={ab(36, 34, { display: 'flex', alignItems: 'center', gap: 14, fontFamily: UI, fontSize: 26, color: INK })}><Icon s="run" T={T} pal={pal} size={20} />MAVE is working</div>
      <div style={ab(36, 80, { fontFamily: UI, fontSize: 16, color: DIM })}>Navigation concept · using 14 sources and MAVE UI V2</div>
      {rows.map(([n, s, d], i) => { const state = st(T, s, d);
        return <div key={n} style={ab(36, 130 + i * 64, { width: 628, height: 64, display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI, fontSize: 21, color: state === 'wait' ? FAINT : INK })}>
          <div style={{ flex: 1 }}>{n}</div><Icon s={state} T={T} pal={pal} /></div>; })}
      <div style={ab(36, 404)}><Bar p={tw(T, A + 0.4, A + 3.0, 0.08, 0.55)} w={628} pal={pal} /></div>
      <div style={ab(36, 424, { fontFamily: UI, fontSize: 15, color: FAINT, opacity: fade(T, A + 2.6, A + 3.0) })}>Keep going — I'll let you know when it's ready.</div>
    </Layer>
  );
}

// ── 07 calendar + message ──
function CalView({ T, Ca, pal, a, sx }) {
  const RH = 62, GY = 104, row = h => GY + (h - 12) * RH;
  const gymH = kf(T, [[Ca + 4.6, 18], [Ca + 5.4, 19]], EZ.pop);
  const moved = T > Ca + 4.6, upd = fade(T, Ca + 5.4, Ca + 5.8);
  const hiR = fade(T, Ca + 1.0, Ca + 1.5);
  return (
    <Layer a={a} x={sx} y={150} w={680} h={680}>
      <div style={ab(36, 34, { fontFamily: UI, fontSize: 28, color: INK })}>Today</div>
      <Lab style={ab(null, 44, { right: 36 })}>THU 15 OCT</Lab>
      {[12, 13, 14, 15, 16, 17, 18, 19, 20].map(h => <React.Fragment key={h}>
        <div style={ab(36, row(h) - 8, { fontFamily: MONO, fontSize: 13, color: FAINT })}>{h}:00</div>
        <div style={ab(104, row(h), { width: 540, height: 1, background: 'rgba(255,255,255,0.07)' })} /></React.Fragment>)}
      <div style={ab(96, row(13.3), { width: 548, height: 2, background: ERR, opacity: 0.7 })}><div style={ab(-4, -3, { width: 8, height: 8, borderRadius: 4, background: ERR })} /></div>
      <div style={ab(112, row(14) + 3, { width: 532, height: RH - 6, borderRadius: 12, boxSizing: 'border-box', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: rgba(pal.a1, 0.2 + 0.1 * hiR), border: `1px solid ${rgba(pal.a1, 0.35 + 0.4 * hiR)}`, boxShadow: `0 0 ${30 * hiR}px ${rgba(pal.a1, 0.3)}` })}>
        <div style={{ fontFamily: UI }}><div style={{ fontSize: 18, color: INK }}>MAVE Product Review</div><div style={{ fontSize: 13, color: DIM, marginTop: 3 }}>14:00 – 15:00 · Studio 2</div></div>
        <div style={{ opacity: hiR, fontFamily: UI, fontSize: 15, color: pal.a3 }}>Starts in 42 minutes</div></div>
      <div style={ab(112, row(gymH) + 3, { width: 532, height: RH - 6, borderRadius: 12, boxSizing: 'border-box', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: rgba(OKC, 0.1), border: `1px solid ${rgba(OKC, 0.3 + 0.3 * upd)}` })}>
        <div style={{ fontFamily: UI }}><div style={{ fontSize: 18, color: INK }}>Gym</div><div style={{ fontSize: 13, color: DIM, marginTop: 3 }}>{moved ? '19:00 – 20:00' : '18:00 – 19:00'}</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 14, opacity: fade(T, Ca + 4.4, Ca + 4.8) }}>
          <span style={{ color: FAINT, textDecoration: 'line-through' }}>18:00</span><span style={{ color: DIM }}>→</span><span style={{ color: INK }}>19:00</span>
          <span style={{ opacity: upd, display: 'flex', alignItems: 'center', gap: 6, color: OKC, fontFamily: UI, fontSize: 14, marginLeft: 6 }}><Icon s="done" T={T} pal={pal} size={16} />Updated</span></div></div>
    </Layer>
  );
}
function MsgView({ T, Ca, pal, a }) {
  const press = tw(T, Ca + 9.8, Ca + 10.0, 0, 1, EZ.enter) * (1 - tw(T, Ca + 10.0, Ca + 10.3)), sent = T > Ca + 10.0;
  return (
    <Layer a={a} x={1110} y={300} w={460} h={330} dx={40} dy={0}>
      <div style={{ position: 'absolute', inset: 0, ...glass(26) }} />
      <div style={ab(28, 26, { display: 'flex', alignItems: 'center', gap: 14 })}>
        <div style={{ width: 42, height: 42, borderRadius: 21, background: `linear-gradient(135deg, ${pal.a1}, ${pal.a2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, fontSize: 15, fontWeight: 600, color: '#fff' }}>JC</div>
        <div style={{ fontFamily: UI }}><div style={{ fontSize: 19, color: INK }}>James Carter</div><div style={{ fontSize: 14, color: FAINT, marginTop: 2 }}>Messages</div></div></div>
      <div style={ab(28, 96, { width: 404, minHeight: 100, ...inner({ borderRadius: 16, padding: '16px 18px' }), fontFamily: UI, fontSize: 21, lineHeight: 1.45, color: INK })}>
        <Typed T={T} text="Hey James, I'll send the MAVE prototype tonight." t0={Ca + 7.8} t1={Ca + 9.3} /></div>
      <div style={ab(28, 258, { fontFamily: UI, fontSize: 14, color: FAINT })}>Drafted by MAVE</div>
      <div style={ab(null, 246, { right: 28, height: 44, padding: '0 22px', borderRadius: 22, display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 17, fontWeight: 500, boxSizing: 'border-box',
        color: sent ? OKC : '#fff', background: sent ? rgba(OKC, 0.12) : pal.a1, border: sent ? `1px solid ${rgba(OKC, 0.4)}` : '1px solid transparent', transform: `scale(${1 - 0.07 * press})` })}>
        {sent ? <React.Fragment><Icon s="done" T={T} pal={pal} size={16} />Sent</React.Fragment> : 'Send'}</div>
    </Layer>
  );
}

// ── 08 files ──
const FILES = [['MAVE_Architecture_v4.pdf', 'Drive · edited yesterday', true], ['MAVE_Architecture_v3.pdf', 'Drive · 3 weeks ago'], ['architecture-notes.md', 'MAVE Core · 2 days ago'], ['Context_Router_RFC.docx', 'Shared · last month']];
function FilesView({ T, F, pal, a }) {
  const q = 'MAVE architecture', searching = T < F + 2.4, sel = fade(T, F + 2.8, F + 3.1), open = fade(T, F + 3.0, F + 3.6);
  const cmp = fade(T, F + 5.8, F + 6.3), gen = fade(T, F + 8.3, F + 8.8);
  const secs = [['1', 'Overview', 3], ['2', 'Memory architecture', 3, '+4 pages'], ['3', 'Tool execution layer', 2, 'Rewritten'], ['4', 'Context router', 2, 'New']];
  const nSl = Math.min(8, 1 + Math.floor(tw(T, F + 8.4, F + 9.8, 0, 4, Easing.linear)));
  return (
    <Layer a={a} x={160} y={80} w={1600} h={770}>
      <div style={ab(40, 36, { width: 540, height: 56, ...inner({ borderRadius: 28 }), display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', fontFamily: UI, fontSize: 20, color: INK })}>
        <div style={{ width: 14, height: 14, borderRadius: 8, border: `2px solid ${DIM}`, boxSizing: 'border-box', position: 'relative' }}><div style={ab(11, 12, { width: 7, height: 2, background: DIM, transform: 'rotate(45deg)' })} /></div>
        <Typed T={T} text={q} t0={F + 1.6} t1={F + 2.2} /></div>
      <div style={ab(40, 1, { width: 540, height: 700, opacity: 1 - gen })}>
        <div style={ab(4, 118, { display: 'flex', alignItems: 'center', gap: 10, fontFamily: UI, fontSize: 15, color: FAINT, opacity: fade(T, F + 1.7, F + 2.0) })}>
          {searching && <Icon s="run" T={T} pal={pal} size={14} />}{searching ? 'Searching 2,418 files' : '4 results · newest first'}</div>
        {FILES.map(([n, m, l], i) => { const o = fade(T, F + 2.4 + i * 0.12, F + 2.9 + i * 0.12);
          return <div key={n} style={ab(0, 156 + i * 86, { width: 540, height: 76, borderRadius: 16, padding: '0 20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 16, opacity: o, transform: `translateY(${(1 - o) * 10}px)`,
            background: l ? rgba(pal.a1, 0.14 * sel) : 'transparent', border: `1px solid ${l ? rgba(pal.a1, 0.4 * sel) : 'transparent'}` })}>
            <div style={{ width: 36, height: 44, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5, boxSizing: 'border-box', fontFamily: MONO, fontSize: 9, color: DIM }}>{n.split('.').pop().toUpperCase()}</div>
            <div style={{ flex: 1, fontFamily: UI }}><div style={{ fontSize: 18, color: INK }}>{n}</div><div style={{ fontSize: 14, color: FAINT, marginTop: 4 }}>{m}</div></div>
            {l && <Lab style={{ color: pal.a3, letterSpacing: '0.12em', fontSize: 12 }}>LATEST</Lab>}</div>; })}
      </div>
      <div style={ab(40, 120, { width: 540, opacity: gen, transform: `translateY(${(1 - gen) * 12}px)` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 19, color: INK }}><Icon s="run" T={T} pal={pal} size={16} />Generating presentation</div>
        <div style={{ fontFamily: UI, fontSize: 15, color: FAINT, marginTop: 8 }}>Architecture v4 — what changed · {nSl} of 8 slides</div>
        <div style={{ display: 'grid', gridTemplateColumns: '262px 262px', gap: 16, marginTop: 24 }}>
          {[0, 1, 2, 3].map(i => { const o = fade(T, F + 8.4 + i * 0.35, F + 8.8 + i * 0.35);
            return <div key={i} style={{ height: 148, borderRadius: 12, position: 'relative', overflow: 'hidden', background: '#0a0c18', border: `1px solid ${o > 0.5 && i === nSl - 1 ? rgba(pal.a3, 0.7) : 'rgba(255,255,255,0.09)'}` }}>
              <div style={ab(18, 22, { width: 120 * o, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.6)' })} />
              <div style={ab(18, 44, { width: 90 * o, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.22)' })} />
              {i === 0 ? <div style={ab(18, 74, { fontFamily: WM, fontSize: 26, fontWeight: 300, color: INK, opacity: o })}>What changed</div>
                : <div style={ab(150, 22, { width: 92, height: 104, borderRadius: 8, opacity: o, background: `linear-gradient(160deg, ${rgba(pal.a2, 0.6)}, ${rgba(pal.a1, 0.4)})` })} />}
            </div>; })}
        </div>
      </div>
      <div style={ab(620, 36, { width: 940, height: 700, ...inner({ borderRadius: 20 }), opacity: open, transform: `translateY(${(1 - open) * 16}px)` })}>
        <div style={ab(36, 28, { fontFamily: MONO, fontSize: 14, color: FAINT })}>MAVE_Architecture_v4.pdf · 24 pages</div>
        <div style={ab(null, 20, { right: 28, opacity: cmp })}><Chip pal={pal}>Compared with v3</Chip></div>
        <div style={ab(36, 76, { fontFamily: UI, fontWeight: 500, fontSize: 38, color: INK, letterSpacing: '-0.02em' })}>MAVE Architecture</div>
        {secs.map(([n, t, k, ch], i) => { const c = ch ? fade(T, F + 5.9 + i * 0.25, F + 6.4 + i * 0.25) : 0;
          return <div key={t} style={ab(24, 160 + i * 128, { width: 520, height: 112, borderRadius: 14, padding: '14px 12px', boxSizing: 'border-box', background: rgba(pal.a1, 0.12 * c) })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 20, color: INK }}><span style={{ fontFamily: MONO, fontSize: 14, color: FAINT }}>{n}</span>{t}</div>
            {Array.from({ length: k }).map((_, j) => <div key={j} style={{ width: [440, 400, 300][j], height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.1)', marginTop: 14 }} />)}</div>; })}
        <div style={ab(580, 160, { width: 324, ...glass(18, { padding: '22px 24px' }), opacity: cmp, transform: `translateX(${(1 - cmp) * 20}px)` })}>
          <div style={{ fontFamily: UI, fontSize: 24, color: INK }}>3 major changes</div>
          {secs.slice(1).map(([n, t, k, ch], i) => <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '14px 0 0', marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', opacity: fade(T, F + 6.1 + i * 0.25, F + 6.5 + i * 0.25) }}>
            <span style={{ fontFamily: UI, fontSize: 17, color: INK }}>{t}</span><span style={{ fontFamily: MONO, fontSize: 12, color: pal.a3, whiteSpace: 'nowrap' }}>{ch}</span></div>)}
        </div>
      </div>
    </Layer>
  );
}

// ── 09 activity ──
function ActivityView({ T, Ac, pal, a, r }) {
  const rows = [['done', 'Fixed navigation build', '12 tests passed'], ['done', 'Completed interface research', '14 sources'], ['done', 'Updated calendar', 'Gym → 19:00'],
    ['live', 'Updating navigation concept', 'bar', 0.68], ['live', 'Generating presentation', '5 of 8 slides'], ['hold', 'Waiting for approval', 'Navigation v3']];
  return (
    <Layer a={a} x={r.x} y={r.y} w={600} h={640} dy={0}>
      <div style={ab(36, 36, { display: 'flex', alignItems: 'center', gap: 14 })}><Orb pal={pal} size={14} /><div style={{ fontFamily: WM, fontSize: 20, letterSpacing: '0.36em', color: INK }}>MAVE</div></div>
      <Lab style={ab(null, 42, { right: 36 })}>6 JOBS</Lab>
      {rows.map(([s, n, sub, p], i) => { const o = fade(T, Ac + 0.6 + i * 0.16, Ac + 1.1 + i * 0.16);
        return <div key={n} style={ab(36, 104 + i * 84, { width: 528, height: 84, display: 'flex', alignItems: 'center', gap: 18, borderTop: '1px solid rgba(255,255,255,0.08)', opacity: o, transform: `translateY(${(1 - o) * 10}px)`, fontFamily: UI })}>
          <Icon s={s} T={T} pal={pal} size={22} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 21, color: INK }}>{n}</div>
            {sub === 'bar' ? <div style={{ marginTop: 10 }}><Bar p={p + 0.06 * tw(T, Ac + 1, Ac + 5)} w={300} pal={pal} /></div> : <div style={{ fontSize: 15, color: DIM, marginTop: 4 }}>{sub}</div>}</div>
          {s === 'hold' && <Chip pal={pal} tone="warn">Review</Chip>}</div>; })}
    </Layer>
  );
}
function IndicatorMini({ T, F, pal, a, r }) {
  return <Layer a={a} x={r.x} y={r.y} w={r.w} h={r.h} dy={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: r.h, padding: '0 18px', fontFamily: UI, fontSize: 15, color: INK, whiteSpace: 'nowrap' }}>
      <Icon s="run" T={T} pal={pal} size={16} />{T > F + 8.6 ? '2 tasks running' : 'Updating navigation'}</div></Layer>;
}

// ── 10 montage ──
const MLAB = ['CHAT', 'WEB', 'CODE', 'FILES', 'CALENDAR', 'DOCUMENT', 'PROJECT'];
function Beat({ i, T, b, pal, a, r }) {
  const L = <Lab style={ab(28, 24, { color: pal.a3 })}>{MLAB[i]}</Lab>;
  let body = null;
  if (i === 0) body = <React.Fragment>
    <div style={ab(null, 64, { right: 32, fontFamily: UI, fontSize: 20, color: DIM })}>Summarize my week.</div>
    <div style={ab(28, 118)}><MaveTag pal={pal} /></div>
    <Words T={T} t0={b + 0.35} dt={0.04} text="Four launches shipped. One blocker cleared. Two reviews need you." style={{ ...ab(28, 150), width: 540, fontFamily: UI, fontSize: 24, lineHeight: 1.35, color: INK }} /></React.Fragment>;
  if (i === 1) body = <React.Fragment>{[0, 1, 2].map(k => { const hp = tw(T, b + 0.3 + k * 0.15, b + 0.8 + k * 0.15, 0, 1, Easing.linear);
    return <div key={k} style={ab(28 + k * 452, 72, { width: 428, height: 460, ...inner({ borderRadius: 16 }), overflow: 'hidden' })}>
      <Lab style={ab(24, 24, { letterSpacing: '0.1em', fontSize: 12 })}>{['ARXIV.ORG', 'UXJOURNAL.NET', 'DESIGNLAB.IO'][k]}</Lab>
      <div style={ab(24, 54, { width: 300, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.5)' })} />
      <div style={ab(24, 80, { width: 220, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.5)' })} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(j => <div key={j} style={ab(24, 130 + j * 34, { width: [370, 340, 380, 300, 360, 320, 370, 240][j], height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.12)' })} />)}
      <div style={ab(20, 222, { width: 370 * hp, height: 20, borderRadius: 4, background: rgba(pal.a1, 0.4) })} /></div>; })}
    <div style={ab(null, 22, { right: 28, fontFamily: MONO, fontSize: 14, color: DIM })}>Sources · {6 + Math.floor(tw(T, b, b + 1, 0, 3))}</div></React.Fragment>;
  if (i === 2) { const sw = T > b + 0.55; body = <React.Fragment>{['export async function sync(user) {', '  const ctx = await loadContext(user);', '  const tools = route(ctx.intent);', sw ? '  return run(tools, { safe: true });' : '  return run(tools);', '}'].map((l, j) =>
    <div key={j} style={ab(28, 80 + j * 40, { width: 944, height: 40, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 19, whiteSpace: 'pre', background: j === 3 ? rgba(sw ? OKC : ERR, 0.1) : 'transparent', borderRadius: 6 })}>
      <span style={{ width: 44, color: FAINT, fontSize: 14 }}>{j + 1}</span>{hl(l)}</div>)}
    <div style={ab(28, 420, { opacity: fade(T, b + 0.75, b + 1.0) })}><Chip pal={pal} tone="ok">Tests passed</Chip></div></React.Fragment>; }
  if (i === 3) body = <React.Fragment>
    <div style={ab(40, 70, { width: 400, height: 530, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' })}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => <div key={j} style={ab(32, 40 + j * 46, { width: j % 4 === 0 ? 200 : 330, height: j % 4 === 0 ? 12 : 7, borderRadius: 4, background: j === 5 && T > b + 0.6 ? rgba(pal.a3, 0.7) : 'rgba(255,255,255,0.14)' })} />)}
      <div style={ab(0, 40 + ((T - b) * 420) % 500, { width: 400, height: 40, background: `linear-gradient(180deg, transparent, ${rgba(pal.a3, 0.2)}, transparent)` })} /></div>
    {['Q3_Report.pdf', '18 pages analyzed', '4 key figures extracted'].map((t, j) => <div key={t} style={ab(476, 110 + j * 52, { fontFamily: j ? UI : MONO, fontSize: j ? 21 : 15, color: j ? INK : FAINT, opacity: fade(T, b + 0.25 + j * 0.2, b + 0.5 + j * 0.2) })}>{t}</div>)}</React.Fragment>;
  if (i === 4) { const y = kf(T, [[b + 0.4, 0], [b + 0.75, 1]], EZ.pop); body = <React.Fragment>
    {[9, 10, 11, 12].map((h, j) => <React.Fragment key={h}><div style={ab(32, 90 + j * 84, { fontFamily: MONO, fontSize: 14, color: FAINT })}>{h}:00</div><div style={ab(100, 98 + j * 84, { width: 570, height: 1, background: 'rgba(255,255,255,0.08)' })} /></React.Fragment>)}
    <div style={ab(110, 102 + (1 + y) * 84, { width: 550, height: 76, borderRadius: 12, padding: '0 20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: rgba(pal.a1, 0.22), border: `1px solid ${rgba(pal.a1, 0.55)}`, fontFamily: UI, fontSize: 19, color: INK })}>
      Design sync<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: OKC, opacity: fade(T, b + 0.75, b + 0.95) }}><Icon s="done" T={T} pal={pal} size={16} />Updated</span></div></React.Fragment>; }
  if (i === 5) body = <div style={ab(28, 72, { display: 'grid', gridTemplateColumns: 'repeat(3, 400px)', gap: 22 })}>
    {[0, 1, 2, 3, 4, 5].map(k => { const o = fade(T, b + 0.2 + k * 0.12, b + 0.45 + k * 0.12);
      return <div key={k} style={{ height: 210, borderRadius: 12, position: 'relative', overflow: 'hidden', background: '#0a0c18', border: '1px solid rgba(255,255,255,0.09)', opacity: 0.3 + 0.7 * o }}>
        <div style={ab(24, 28, { width: 180 * o, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.6)' })} />
        <div style={ab(24, 54, { width: 130 * o, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.22)' })} />
        <div style={ab(230, 28, { width: 146, height: 154, borderRadius: 8, opacity: o, background: `linear-gradient(160deg, ${rgba([pal.a2, pal.a1, pal.a3][k % 3], 0.6)}, ${rgba(pal.a1, 0.3)})` })} /></div>; })}</div>;
  if (i === 6) { const d = fade(T, b + 0.4, b + 0.6); body = <React.Fragment>
    <div style={ab(28, 66, { fontFamily: UI, fontSize: 28, color: INK })}>Affiliate Pipeline</div>
    <div style={ab(28, 126, { width: 544, height: 60, display: 'flex', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI, fontSize: 20, color: INK })}>
      <Icon s={d > 0.5 ? 'done' : 'run'} T={T} pal={pal} size={22} />Launch partner dashboard</div>
    <div style={ab(28, 214)}><Bar p={tw(T, b + 0.4, b + 0.9, 0.82, 1)} w={544} pal={pal} /></div>
    <div style={ab(28, 234, { fontFamily: UI, fontSize: 17, color: OKC, opacity: fade(T, b + 0.8, b + 1.0) })}>Project complete</div></React.Fragment>; }
  return <Layer a={a} x={r.x} y={r.y} w={r.w} h={r.h} dy={8}>{L}{body}</Layer>;
}

function Show({ tk }) {
  const { T, CUES, authoredTotal } = useComposition();
  const pal = PALETTES[tk.palette] || PALETTES.Indigo, glow = tk.glow == null ? 1.4 : tk.glow;
  const M = CUES.Mave, H = CUES.Home, C = CUES.Chat, D = CUES.Code, Wb = CUES.Web, A = CUES.Agent, Ca = CUES.Calendar, F = CUES.Files, Ac = CUES.Activity, Mo = CUES.Montage, Fi = CUES.Final, END = authoredTotal;
  const B = 1.25;
  const USER = [[M + 2.0, 0.5, 'MAVE.'], [M + 3.4, 1.4, "What's going on today?"], [M + 9.8, 0.6, 'Show me.'], [H + 4.0, 1.3, 'Why did the build fail?'], [C + 4.2, 0.5, 'Fix it.'],
    [D + 8.4, 1.8, 'Check how other AI assistants handle contextual navigation.'], [Wb + 8.0, 1.8, 'Use this research and update our navigation concept.'], [A + 5.0, 1.2, 'When is my next meeting?'],
    [Ca + 3.0, 1.3, 'Move my gym session to seven.'], [Ca + 6.3, 1.6, "Tell James I'll send the prototype tonight."], [F + 0.0, 1.6, 'Find the latest MAVE architecture document.'],
    [F + 4.2, 1.4, 'What changed from the previous version?'], [F + 7.2, 1.1, 'Turn this into a presentation.']];
  const SPEAK = [[M + 5.4, 1.6], [C + 0.8, 2.4], [D + 7.6, 1.2], [Wb + 6.4, 1.4], [A + 0.4, 0.9], [Ca + 0.8, 1.4], [Ca + 4.8, 0.8], [Ca + 8.0, 1.0], [F + 2.4, 0.8], [F + 5.8, 1.2], [F + 8.4, 0.8], [Ac + 0.6, 1.2]];
  const sched = [];
  USER.forEach(([t, d]) => { sched.push([t - 0.1, 'listen'], [t + d + 0.15, 'think']); if (!SPEAK.some(([s]) => s > t + d && s < t + d + 1.6)) sched.push([t + d + 0.8, 'idle']); });
  SPEAK.forEach(([t, d]) => sched.push([t, 'speak'], [t + d, 'idle']));
  sched.push([Fi + 0.4, 'off']);
  sched.sort((a, b) => a[0] - b[0]);
  const vs = voiceAt(T, sched);

  const hidC = { x: 810, y: 492, w: 300, h: 96, o: 0, r: 48 };
  const prev = { x: 560, y: 612, w: 800, h: 250, o: 1, r: 28 }, home = { x: 160, y: 80, w: 1600, h: 760, o: 1, r: 32 };
  const chat = { x: 460, y: 150, w: 1000, h: 640, o: 1, r: 30 }, code = { x: 120, y: 70, w: 1680, h: 780, o: 1, r: 30 };
  const task = { x: 610, y: 240, w: 700, h: 470, o: 1, r: 28 }, ind = { x: 1630, y: 36, w: 250, h: 52, o: 1, r: 26 };
  const cal = { x: 620, y: 150, w: 680, h: 680, o: 1, r: 30 }, calL = { ...cal, x: 400 }, files = { x: 160, y: 80, w: 1600, h: 770, o: 1, r: 32 };
  const act = { x: 660, y: 170, w: 600, h: 640, o: 1, r: 30 };
  const MB = [{ x: 660, y: 360, w: 600, h: 260 }, { x: 260, y: 200, w: 1400, h: 560 }, { x: 460, y: 240, w: 1000, h: 500 }, { x: 560, y: 150, w: 800, h: 640 }, { x: 610, y: 250, w: 700, h: 460 }, { x: 310, y: 200, w: 1300, h: 560 }, { x: 660, y: 350, w: 600, h: 300 }].map(r => ({ ...r, o: 1, r: 28 }));
  const SK = [[0, hidC], [M + 5.0, { ...prev, y: 640, o: 0 }], [M + 5.6, prev], [M + 10.4, prev], [H - 0.1, home], [C - 0.5, home], [C + 0.5, chat], [C + 5.2, chat], [D - 0.1, code], [A - 0.4, code], [A + 0.6, task], [A + 4.0, task], [A + 4.9, ind], [A + 5.0, { ...ind, o: 0 }],
    [Ca - 0.6, { x: 810, y: 950, w: 300, h: 72, o: 0, r: 36 }], [Ca + 0.5, cal], [Ca + 6.6, cal], [Ca + 7.4, calL], [F + 0.6, calL], [F + 1.6, files], [Ac - 0.4, files], [Ac + 0.3, { x: 760, y: 340, w: 400, h: 300, o: 0, r: 30 }],
    [Mo - 0.2, { ...MB[0], o: 0 }], [Mo + 0.3, MB[0]]];
  for (let i = 1; i < 7; i++) SK.push([Mo + i * B, MB[i - 1]], [Mo + i * B + 0.35, MB[i]]);
  SK.push([Fi + 0.1, MB[6]], [Fi + 1.0, hidC]);
  const S = kf(T, SK);
  const IR = kf(T, [[A + 4.8, { ...ind, o: 0 }], [A + 5.0, ind], [Ac - 0.2, ind], [Ac + 0.6, act], [Mo - 0.5, act], [Mo + 0.1, { ...act, y: act.y + 20, o: 0 }]]);

  const P0 = { cx: 960, cy: 540, w: 300, h: 96 }, PV = { cx: 960, cy: 540, w: 760, h: 104 }, PB = { cx: 960, cy: 985, w: 600, h: 72 };
  const pr = kf(T, [[0, P0], [M + 2.3, P0], [M + 3.1, PV], [M + 10.6, PV], [H - 0.1, PB], [Fi + 0.2, PB], [Fi + 1.4, P0]]);
  const pact = T < Fi ? tw(T, M + 2.3, M + 3.1) : tw(T, Fi + 0.6, Fi + 1.6, 1, 0);
  const press = T < M + 2.45 ? tw(T, M + 2.2, M + 2.45, 1, 0.955, EZ.enter) : tw(T, M + 2.45, M + 3.0, 0.955, 1, EZ.pop);
  const breathe = 1 + 0.006 * Math.sin(T * 1.3) * (1 - pact);
  const cam = kf(T, [[0, 1], [M + 3.2, 1.1], [M + 6.0, 1.03], [H, 1], [Fi + 1.4, 1], [END, 1.04]]) * (1 + 0.008 * Math.sin(T * 0.13));
  const black = Math.max(1 - tw(T, 0, 1.4, 0, 1, EZ.enter), tw(T, Fi + 5.4, END));
  const rec = tw(T, C - 0.6, C + 0.2);
  const codeOut = tw(T, Wb - 0.6, Wb);

  const MODES = [[H - 0.2, C - 0.3, 'Home'], [C + 0.1, D - 0.4, 'Conversation'], [D, Wb - 0.3, 'Code'], [Wb, A - 0.3, 'Research'], [A + 0.3, A + 4.4, 'Agent'], [Ca + 0.3, Ca + 7.0, 'Calendar'], [Ca + 7.2, F + 0.5, 'Messages'], [F + 1, Ac - 0.2, 'Files'], [Ac + 0.3, Mo - 0.2, 'Activity']];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#05060d' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + (cam - 1) * 0.3})` }}><Ambient T={T} pal={pal} glow={glow} amp={vs.amp * pact} /></div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `scale(${cam})` }}>
        {MODES.map(([a0, a1, n]) => { const o = win(T, a0, a1, 0.35); return o > 0.01 && <div key={n} style={ab(64, 34, { opacity: o, display: 'flex', alignItems: 'center', gap: 10 })}><div style={{ width: 6, height: 6, borderRadius: 3, background: pal.a3 }} /><Lab>{n.toUpperCase()}</Lab></div>; })}
        {S.o > 0.002 && <div style={{ position: 'absolute', left: S.x, top: S.y, width: S.w, height: S.h, opacity: S.o, ...glass(S.r) }} />}
        {IR.o > 0.002 && <div style={{ position: 'absolute', left: IR.x, top: IR.y, width: IR.w, height: IR.h, opacity: IR.o, ...glass(IR.r, { border: `1px solid ${rgba(pal.a1, 0.3)}` }) }} />}

        <PreviewView T={T} M={M} pal={pal} a={win(T, M + 5.4, M + 10.8)} />
        <HomeView T={T} H={H} pal={pal} a={win(T, H - 0.1, C + 0.2) * (1 - rec)} rec={rec} />
        <ChatView T={T} C={C} pal={pal} a={win(T, C + 0.3, C + 5.5)} />
        <CodeView T={T} D={D} pal={pal} a={win(T, D - 0.1, Wb - 0.1)} out={codeOut} />
        <WebView T={T} W={Wb} pal={pal} a={win(T, Wb - 0.2, A - 0.2)} />
        <AgentView T={T} A={A} pal={pal} a={win(T, A + 0.5, A + 4.1)} />
        <IndicatorMini T={T} F={F} pal={pal} a={win(T, A + 4.9, Ac + 0.1, 0.3)} r={ind} />
        <CalView T={T} Ca={Ca} pal={pal} a={win(T, Ca + 0.4, F + 0.7)} sx={S.x} />
        <MsgView T={T} Ca={Ca} pal={pal} a={win(T, Ca + 7.3, F + 0.7)} />
        <FilesView T={T} F={F} pal={pal} a={win(T, F + 1.4, Ac - 0.1)} />
        <ActivityView T={T} Ac={Ac} pal={pal} a={win(T, Ac + 0.4, Mo - 0.4)} r={act} />
        {MLAB.map((_, i) => { const b = Mo + i * B; return <Beat key={i} i={i} T={T} b={b} pal={pal} r={MB[i]} a={win(T, b + 0.3, b + B + 0.05, 0.22)} />; })}

        <Pill T={T} r={pr} act={pact} sc={press * breathe} vs={vs} pal={pal} glow={glow} opacity={fade(T, 0.3, 1.6)} />
        <Captions T={T} lines={USER} pr={pr} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, fontFamily: UI, fontWeight: 300, fontSize: 34, color: INK }}>
        {['Just ask.', 'MAVE handles the rest.'].map((l, i) => { const o = fade(T, Fi + 2.2 + i * 0.7, Fi + 3.0 + i * 0.7);
          return <div key={l} style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)`, color: i ? DIM : INK }}>{l}</div>; })}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: black, pointerEvents: 'none' }} />
    </div>
  );
}

function MaveShowcase() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS || { motionEditor: true, palette: 'Indigo', glow: 1.4 });
  return (
    <React.Fragment>
      <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#05060d">
        <Show tk={t} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Playback" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
        <TweakSection label="Look" />
        <TweakRadio label="Accent" value={t.palette} options={['Indigo', 'Teal', 'Dusk']} onChange={v => setTweak('palette', v)} />
        <TweakSlider label="Ambient glow" value={t.glow} min={0} max={1.8} step={0.1} onChange={v => setTweak('glow', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
window.MaveShowcase = MaveShowcase;

window.MV = { EZ, clamp01, lerp, tw, fade, win, kf, rgba, st, PALETTES, INK, DIM, FAINT, ERR, OKC, WARN, UI, WM, MONO, glass, inner, ab, Lab, Layer, Icon, Orb, MaveTag, Words, Typed, Bar, Thumb, Chip, Ambient, voiceAt, Pill, hl, CODE, TREE, SOURCES };
