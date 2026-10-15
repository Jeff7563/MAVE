(() => {
const { EZ, clamp01, lerp, tw, fade, win, kf, rgba, st, PALETTES, INK, DIM, FAINT, ERR, OKC, WARN, UI, WM, MONO, glass, inner, ab, Lab, Layer, Icon, Orb, MaveTag, Words, Typed, Bar, Thumb, Chip, Ambient, voiceAt, Pill, hl, CODE, TREE, SOURCES } = window.MV;
const { Easing, CompositionStage, useComposition, useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSlider } = window;
const ghost = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: DIM };
const line = (x, y, w) => <div style={ab(x, y, { width: w, height: 1, background: 'rgba(255,255,255,0.08)' })} />;

function Captions({ T, lines, pr }) {
  const y = pr.cy - pr.h / 2 - 26, fs = lerp(30, 36, clamp01((pr.h - 72) / 32));
  return lines.map(([t, d, text], i) => {
    const nx = lines[i + 1], end = Math.min(t + d + 1.2, nx ? nx[0] - 0.15 : 1e9);
    if (T < t || T > end) return null;
    const a = Math.min(fade(T, t, t + 0.2), 1 - tw(T, end - 0.35, end));
    return <div key={i} style={{ position: 'absolute', left: 310, top: y, width: 1300, transform: `translateY(-100%) translateY(${(1 - a) * 6}px)`, opacity: a, textAlign: 'center', fontFamily: UI, fontSize: fs, lineHeight: 1.3, color: INK, textWrap: 'balance', letterSpacing: '-0.01em' }}>
      “<Typed T={T} text={text} t0={t} t1={t + d} /><span style={{ opacity: T >= t + d ? 1 : 0 }}>”</span></div>;
  });
}

// persistent conversation — one thread for the whole session
function Thread({ T, msgs, p, pal }) {
  if (p.o <= 0.002) return null;
  const mask = 'linear-gradient(180deg, transparent 0, #000 160px)';
  return (
    <div style={{ position: 'absolute', left: p.x, top: p.y, width: 760, height: p.h, transform: `scale(${p.s})`, transformOrigin: '0 0', opacity: p.o, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }}>
      {msgs.filter(m => T >= m[0]).map(([t, who, text, att], i) => { const g = tw(T, t, t + 0.6, 0, 1, EZ.enter);
        return <div key={i} style={{ flex: 'none', maxHeight: g * 420, opacity: g, overflow: 'hidden', paddingTop: 34 }}>
          {who === 'u' ? <Lab>YOU</Lab> : <MaveTag pal={pal} />}
          {who === 'u' ? <div style={{ marginTop: 10, fontFamily: UI, fontSize: 24, lineHeight: 1.4, color: DIM }}>{text}</div>
            : <Words T={T} t0={t + 0.1} dt={0.035} text={text} style={{ marginTop: 10, fontFamily: UI, fontSize: 26, lineHeight: 1.38, color: INK }} />}
          {att && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, opacity: fade(T, t + 0.8, t + 1.2) }}>
            {att.map(([l, tone]) => <Chip key={l} pal={pal} style={{ ...ghost, color: tone === 'err' ? ERR : DIM, fontFamily: /\.\w+$/.test(l) ? MONO : UI, fontSize: 14 }}>{l}</Chip>)}</div>}
        </div>; })}
    </div>
  );
}

// ── 01 minimal response ──
function Glance({ T, M, pal, a }) {
  const items = [['MAVE UI V2', 'Build failed', ERR], ['Product Review', '14:00', pal.a3], ['Navigation research', 'Ready', OKC]];
  return <Layer a={a} x={0} y={612} w={1920} h={200}>
    <Words T={T} t0={M + 3.6} text="2 things need you." style={{ justifyContent: 'center', fontFamily: UI, fontSize: 26, color: INK }} />
    <Words T={T} t0={M + 4.0} text="3 tasks are still running." style={{ justifyContent: 'center', fontFamily: UI, fontSize: 26, color: DIM, marginTop: 6 }} />
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 30 }}>
      {items.map(([t, s, c], i) => { const o = fade(T, M + 4.5 + i * 0.18, M + 5.0 + i * 0.18);
        return <div key={t} style={{ height: 48, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, opacity: o, transform: `translateY(${(1 - o) * 10}px)`, fontFamily: UI, fontSize: 17, whiteSpace: 'nowrap', ...glass(24) }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: c }} /><span style={{ color: INK }}>{t}</span><span style={{ color: DIM }}>{s}</span></div>; })}
    </div>
  </Layer>;
}

// ── 02 home: typography, not cards ──
function HomeV({ T, H, pal, a, rec = 0, done = false }) {
  if (a <= 0.002) return null;
  const r = i => fade(T, H - 0.3 + i * 0.12, H + 0.3 + i * 0.12);
  const rv = i => ({ opacity: r(i), transform: `translateY(${(1 - r(i)) * 14}px)` });
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${1180 * rec}px, ${250 * rec}px) scale(${1 - 0.6 * rec})`, opacity: a * (1 - 0.6 * rec), filter: rec > 0.05 ? `blur(${rec * 1.5}px)` : 'none' }}>
      <div style={ab(200, 140, { ...rv(0), fontFamily: UI, fontWeight: 300, fontSize: 64, color: INK, letterSpacing: '-0.02em' })}>Good afternoon.</div>
      <div style={ab(200, 236, { ...rv(1), fontFamily: UI, fontSize: 28, lineHeight: 1.45, color: INK })}>{done ? 'Nothing needs you.' : '2 things need you.'}<br /><span style={{ color: DIM }}>{done ? 'MAVE is finishing 2 tasks.' : '3 tasks are running.'}</span></div>
      <div style={ab(200, 380, { ...rv(2), width: 1520, height: 1, background: 'rgba(255,255,255,0.08)' })} />
      <Lab style={ab(200, 418, rv(2))}>NEEDS YOU</Lab>
      {[['MAVE UI V2', 'Build failed · 6 min ago', ERR], ['Approve MAVE navigation', 'Waiting on you', WARN]].map(([t, s, c], i) => (
        <div key={t} style={ab(200, 456 + i * 100, { ...rv(3 + i * 0.5), fontFamily: UI })}>
          <div style={{ fontSize: 27, color: done ? DIM : INK, display: 'flex', alignItems: 'center', gap: 14 }}>{done && <Icon s="done" T={T} pal={pal} size={20} />}{t}</div>
          <div style={{ fontSize: 17, color: done ? FAINT : c, marginTop: 8 }}>{done ? 'Resolved' : s}</div></div>))}
      <Lab style={ab(780, 418, rv(3))}>MAVE IS DOING</Lab>
      {[['Contextual UI research', 0.82], ['Presentation generation', 0.46]].map(([t, p], i) => (
        <div key={t} style={ab(780, 456 + i * 100, { ...rv(4 + i * 0.5), fontFamily: UI })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: INK }}><Icon s="live" T={T} pal={pal} size={16} />{t}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, marginLeft: 28 }}><Bar p={p + 0.03 * Math.sin(T * 0.8 + i)} w={300} pal={pal} /><span style={{ fontFamily: MONO, fontSize: 14, color: DIM }}>{Math.round(p * 100)}%</span></div></div>))}
      <Lab style={ab(1340, 418, rv(4))}>NEXT</Lab>
      <div style={ab(1340, 456, { ...rv(5), fontFamily: UI })}>
        <div style={{ fontSize: 27, color: INK }}>Product Review</div>
        <div style={{ fontFamily: WM, fontWeight: 300, fontSize: 72, color: INK, marginTop: 6, lineHeight: 1 }}>14:00</div>
        <div style={{ fontSize: 17, color: pal.a3, marginTop: 12 }}>in 42 minutes</div></div>
      <Lab style={ab(200, 726, rv(6))}>CONTINUE</Lab>
      <div style={ab(200, 760, { ...rv(6.5), display: 'flex', gap: 56, fontFamily: UI, fontSize: 24, color: DIM })}>{['MAVE Core', 'Drone Game', 'Affiliate Pipeline'].map(n => <span key={n}>{n}</span>)}</div>
    </div>
  );
}

// ── 04 code ──
const OPS_T = ['Analyzing dependency', 'Editing navigation.tsx', 'Updating route state', 'Running tests'];
function CodeV({ T, D, pal, a, out }) {
  const LH = 34, EY = 92, EX = 230, EW = 740, OX = 998;
  const fixed = T > D + 3.6, green = T > D + 5.8;
  const ins = " ?? 'home'", n8 = Math.floor(tw(T, D + 2.4, D + 2.9, 0, ins.length, Easing.linear));
  const neu = 'glyph={item.glyph}', n13 = Math.floor(tw(T, D + 3.1, D + 3.6, 0, neu.length, Easing.linear));
  const errOn = fade(T, D + 0.9, D + 1.3);
  const scan = kf(T, [[D + 0.5, 0], [D + 1.2, 7], [D + 2.9, 7], [D + 3.1, 12], [D + 3.8, 12]]), scanA = win(T, D + 0.5, D + 4.2);
  const okFade = 1 - tw(T, D + 5.0, D + 6.0);
  const rowBg = i => i === 7 ? (T < D + 2.4 ? rgba(ERR, 0.08 * errOn) : rgba(OKC, 0.09 * okFade)) : i === 12 ? (T < D + 3.1 ? rgba(ERR, 0.08 * errOn) : rgba(OKC, 0.09 * okFade)) : 'transparent';
  const squig = on => ({ textDecoration: on ? 'underline wavy' : 'none', textDecorationColor: ERR, textUnderlineOffset: 6 });
  const MOD = { 'navigation.tsx': D + 2.4, 'router.ts': D + 3.9, 'types.ts': D + 4.2 };
  const ops = [[D + 0.9, D + 2.2], [D + 2.2, D + 3.7], [D + 3.7, D + 4.5], [D + 4.5, D + 5.7]];
  const ship = [['Creating commit', D + 7.3, D + 7.8], ['Pushing branch', D + 7.8, D + 8.3], ['Opening pull request', D + 8.3, D + 8.8]];
  const nT = Math.floor(tw(T, D + 4.6, D + 5.6, 0, 12, Easing.linear)), res = fade(T, D + 5.8, D + 6.2);
  return (
    <Layer a={a} x={500} y={60} w={1380} h={800}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-50 * out}px)`, opacity: 1 - out }}>
        <div style={ab(24, 20, { fontFamily: MONO, fontSize: 14, color: FAINT })}>mave-ui-v2 / src / components / <span style={{ color: INK }}>navigation.tsx</span></div>
        <div style={ab(null, 14, { right: 20, display: 'flex', gap: 10 })}>
          <Chip pal={pal} style={{ ...ghost, fontFamily: MONO, fontSize: 13 }}>fix/navigation-types</Chip>
          <Chip pal={pal} tone={green ? 'ok' : 'err'}>{green ? 'Build successful' : 'Build failed'}</Chip></div>
        {line(0, 62, 1380)}
        {TREE.map(([d, n, k], i) => { const act = k === 'active', m = MOD[n] && T > MOD[n];
          return <div key={i} style={ab(10, 78 + i * 36, { width: 210, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 + d * 14, boxSizing: 'border-box',
            background: act && T > D + 0.6 ? rgba(pal.a1, 0.16) : 'transparent', fontFamily: MONO, fontSize: 13, color: k === 'dir' ? FAINT : act ? INK : DIM })}>
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{k === 'dir' ? '▾ ' : ''}{n}</span>
            {act && !fixed ? <div style={{ width: 7, height: 7, borderRadius: 4, marginRight: 10, background: ERR }} /> : m ? <span style={{ marginRight: 10, color: pal.a3, fontSize: 12 }}>M</span> : null}</div>; })}
        <div style={ab(EX, 62, { width: 1, height: 738, background: 'rgba(255,255,255,0.08)' })} />
        <div style={ab(EX + 1, EY + scan * LH - 2, { width: EW, height: LH, background: rgba(pal.a1, 0.1), opacity: scanA, boxSizing: 'border-box', borderTop: `1px solid ${rgba(pal.a1, 0.25)}`, borderBottom: `1px solid ${rgba(pal.a1, 0.25)}` })} />
        {CODE.map((l, i) => (
          <div key={i} style={ab(EX + 1, EY + i * LH - 2, { width: EW, height: LH, display: 'flex', alignItems: 'center', background: rowBg(i), fontFamily: MONO, fontSize: 15, whiteSpace: 'pre' })}>
            <div style={{ width: 44, textAlign: 'right', paddingRight: 16, color: FAINT, fontSize: 13 }}>{i + 1}</div>
            {i === 7 ? <div>{hl('    const target: Route = ')}<span style={squig(T < D + 2.4 && errOn > 0.5)}>{hl('item.route')}</span><span style={{ background: rgba(OKC, 0.18) }}>{hl(ins.slice(0, n8))}</span>{hl(';')}</div>
              : i === 12 ? <div>{hl('    <NavLink key={item.id} ')}{T < D + 3.1
                ? <span style={{ ...squig(T < D + 2.9 && errOn > 0.5), background: T > D + 2.9 ? rgba(ERR, 0.25) : 'transparent', textDecorationLine: T > D + 2.9 ? 'line-through' : (errOn > 0.5 ? 'underline' : 'none') }}>{hl('icon={item.icon}')}</span>
                : <span style={{ background: rgba(OKC, 0.18) }}>{hl(neu.slice(0, n13))}</span>}{hl(' onSelect={() => go(item)} />')}</div>
              : <div>{hl(l)}</div>}
          </div>))}
        <div style={ab(EX + 290, EY + 8 * LH + 2, { opacity: win(T, D + 1.0, D + 2.4), ...glass(12, { padding: '10px 14px', fontFamily: MONO, fontSize: 13, color: DIM, whiteSpace: 'nowrap', background: 'rgba(20,14,26,0.94)', border: `1px solid ${rgba(ERR, 0.4)}` }) })}>
          <span style={{ color: ERR }}>TS2322</span>  'string | undefined' is not assignable to 'Route'</div>
        <div style={ab(970, 62, { width: 1, height: 738, background: 'rgba(255,255,255,0.08)' })} />
        <div style={ab(OX, 88)}><MaveTag pal={pal} /></div>
        <div style={ab(OX, 116, { fontFamily: UI, fontSize: 22, color: INK })}>{T > D + 7.1 ? 'Shipping the fix' : 'Fixing the build'}</div>
        <div style={ab(OX, 160, { opacity: 1 - 0.5 * fade(T, D + 7.1, D + 7.4) })}>
          {OPS_T.map((n, i) => { const s = st(T, ops[i][0], ops[i][1]);
            return <div key={n} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 17, color: s === 'wait' ? FAINT : INK }}><Icon s={s} T={T} pal={pal} size={16} />{n}{s === 'run' ? '…' : ''}</div>; })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, width: 354, opacity: fade(T, D + 4.5, D + 4.8) }}><Lab>TESTS</Lab><span style={{ fontFamily: MONO, fontSize: 13, color: nT === 12 ? OKC : DIM }}>{nT} / 12</span></div>
          <div style={{ marginTop: 10, opacity: fade(T, D + 4.5, D + 4.8) }}><Bar p={nT / 12} w={354} pal={pal} /></div>
        </div>
        <div style={ab(OX, 410, { width: 354, opacity: res, transform: `translateY(${(1 - res) * 8}px)` })}>
          {[['TESTS', <span>12 / 12 passed</span>], ['BUILD', <span style={{ color: OKC }}>Successful</span>], ['CHANGED', <span>3 files  <span style={{ fontFamily: MONO, fontSize: 15, color: OKC }}>+42</span> <span style={{ fontFamily: MONO, fontSize: 15, color: ERR }}>−18</span></span>]].map(([k, v]) => (
            <div key={k} style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: UI, fontSize: 19, color: INK }}><Lab>{k}</Lab>{v}</div>))}
        </div>
        <div style={ab(OX, 576, { opacity: fade(T, D + 7.2, D + 7.5) })}>
          {ship.map(([n, s0, d0]) => { const s = st(T, s0, d0);
            return <div key={n} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 17, color: s === 'wait' ? FAINT : INK }}><Icon s={s} T={T} pal={pal} size={16} />{n}{s === 'run' ? '…' : ''}</div>; })}
        </div>
        <div style={ab(OX, 712, { display: 'flex', alignItems: 'center', gap: 14, opacity: fade(T, D + 8.9, D + 9.2) })}>
          <span style={{ fontFamily: UI, fontSize: 22, color: INK }}>Done.</span><Chip pal={pal} tone="ok">PR #128 open</Chip></div>
      </div>
    </Layer>
  );
}

// ── 05 web: actually browsing ──
function Page({ s, pal, sy, hp }) {
  return <div style={{ position: 'absolute', left: 0, top: 44 + sy, width: 800, fontFamily: UI }}>
    <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.12em', color: FAINT }}>{s.d.toUpperCase()}</div>
    <div style={{ fontSize: 36, fontWeight: 500, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 14 }}>{s.t}</div>
    <div style={{ fontSize: 15, color: FAINT, marginTop: 12 }}>{s.m}</div>
    <div style={{ marginTop: 26 }}><Thumb pal={pal} w={800} h={190} r={12} /></div>
    {s.p.map((p, j) => <p key={j} style={{ fontSize: 20, lineHeight: 1.65, color: j === s.hi ? INK : DIM, margin: '24px 0 0', textWrap: 'pretty' }}>
      {j === s.hi ? <span style={{ backgroundImage: `linear-gradient(${rgba(pal.a1, 0.42)}, ${rgba(pal.a1, 0.42)})`, backgroundSize: `${hp * 100}% 100%`, backgroundRepeat: 'no-repeat', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '2px 0' }}>{p}</span> : p}</p>)}
  </div>;
}
const NOTES = ["Start from the user's current context", 'Reveal controls only when the task needs them', 'Keep one persistent conversation'];
function WebV({ T, W0, pal, a }) {
  const p1 = [W0 + 0.3, W0 + 2.0], p2 = [W0 + 2.0, W0 + 3.5], cp = W0 + 3.5, sm = W0 + 5.5;
  const sum = fade(T, sm, sm + 0.6), n = 1 + Math.floor(tw(T, W0 + 0.3, W0 + 5.4, 0, 13, Easing.linear));
  const mode = T < p2[0] ? 0 : T < cp ? 1 : 2;
  const tabOn = i => mode === 0 ? i === 0 : mode === 1 ? i === 1 : i === 1 || i === 2;
  const ripple = (t0, i) => { const p = tw(T, t0 - 0.15, t0 + 0.45, 0, 1, EZ.enter); return p > 0 && p < 1 && <div key={'r' + i} style={ab(24 + i * 238 + 115 - 30, 96 - 30, { width: 60, height: 60, borderRadius: 30, border: `1.5px solid ${rgba(pal.a3, 0.8)}`, opacity: 1 - p, transform: `scale(${0.3 + p})` })} />; };
  const url = mode === 2 ? 'Comparing  hci.review  ↔  productfield.co' : `https://${SOURCES[mode].d}/${SOURCES[mode].slug}`;
  return (
    <Layer a={a} x={500} y={60} w={1380} h={800} dx={50} dy={0}>
      <div style={ab(24, 16, { display: 'flex', alignItems: 'center', gap: 12, height: 32, fontFamily: UI, fontSize: 18, color: INK })}><Icon s={T > sm ? 'done' : 'run'} T={T} pal={pal} size={16} />Researching contextual AI interfaces</div>
      <div style={ab(null, 22, { right: 24, fontFamily: MONO, fontSize: 14, color: DIM })}>{T > sm ? '14 sources reviewed' : `Source ${n} / 14`}</div>
      {line(0, 62, 1380)}
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - 0.78 * sum, filter: sum > 0.02 ? `blur(${sum * 4}px)` : 'none' }}>
        <div style={ab(24, 76, { display: 'flex', gap: 8 })}>
          {[...SOURCES, { d: 'designsystems.wk' }].map((s, i) => <div key={s.d} style={{ width: 230, height: 40, borderRadius: 12, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontFamily: UI, fontSize: 14,
            color: tabOn(i) ? INK : FAINT, background: tabOn(i) ? 'rgba(255,255,255,0.07)' : 'transparent', border: `1px solid ${tabOn(i) ? 'rgba(255,255,255,0.1)' : 'transparent'}` }}>
            <div style={{ width: 13, height: 13, borderRadius: 4, background: [pal.a1, pal.a2, pal.a3, '#8a90b8'][i] }} />{s.d}</div>)}
          <div style={{ height: 40, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 13, color: FAINT, paddingLeft: 6 }}>+{Math.max(0, n - 4)}</div>
        </div>
        {ripple(p2[0], 1)}{ripple(cp, 2)}
        <div style={ab(24, 124, { width: 986, height: 38, borderRadius: 19, boxSizing: 'border-box', padding: '0 18px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: MONO, fontSize: 13, color: DIM, whiteSpace: 'pre' })}>{url}</div>
        <div style={ab(24, 174, { width: 986, height: 602, borderRadius: 16, overflow: 'hidden', background: '#0a0c18', border: '1px solid rgba(255,255,255,0.08)' })}>
          {win(T, p1[0], p1[1] + 0.15, 0.3) > 0.01 && <div style={{ position: 'absolute', left: 64, top: 0, opacity: win(T, p1[0], p1[1] + 0.15, 0.3) }}>
            <Page s={SOURCES[0]} pal={pal} sy={tw(T, p1[0] + 0.1, p1[0] + 1.1, 0, -250)} hp={tw(T, p1[0] + 0.6, p1[0] + 1.2, 0, 1, Easing.linear)} /></div>}
          {win(T, p2[0], cp + 0.2, 0.3) > 0.01 && <div style={{ position: 'absolute', left: 64, top: 0, opacity: win(T, p2[0], cp + 0.2, 0.3) }}>
            <Page s={SOURCES[1]} pal={pal} sy={tw(T, p2[0] + 0.1, p2[0] + 1.0, 0, -250)} hp={tw(T, p2[0] + 0.5, p2[0] + 1.1, 0, 1, Easing.linear)} /></div>}
          {T > cp && <div style={{ position: 'absolute', inset: 0, opacity: fade(T, cp, cp + 0.4) }}>
            {[[SOURCES[1], -250, 1], [SOURCES[2], tw(T, cp + 0.3, cp + 1.2, 0, -250), tw(T, cp + 1.0, cp + 1.6, 0, 1, Easing.linear)]].map(([s, sy, hp], i) => (
              <div key={i} style={{ position: 'absolute', left: 24 + i * 488, top: 30, width: 448, height: 560, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: 800, transform: 'scale(0.56)', transformOrigin: '0 0' }}><Page s={s} pal={pal} sy={sy} hp={hp} /></div></div>))}
            <div style={ab(492, 0, { width: 1, height: 602, background: 'rgba(255,255,255,0.1)' })} />
            <div style={ab(393, 16, { ...glass(16, { height: 32, padding: '0 14px', display: 'flex', alignItems: 'center', fontFamily: UI, fontSize: 14, color: INK }) })}>Comparing 2 sources</div>
          </div>}
          {T < sm && <div style={{ position: 'absolute', left: 0, right: 0, top: ((T - W0) * 240) % 660 - 60, height: 60, background: `linear-gradient(180deg, transparent, ${rgba(pal.a3, 0.06)}, transparent)` }} />}
        </div>
        <Lab style={ab(1034, 88)}>NOTES</Lab>
        {NOTES.map((t, i) => { const o = fade(T, [W0 + 1.5, W0 + 3.0, W0 + 4.9][i], [W0 + 1.9, W0 + 3.4, W0 + 5.3][i]);
          return <div key={t} style={ab(1034, 122 + i * 116, { width: 322, ...inner({ padding: '16px 18px' }), opacity: o, transform: `translateX(${(1 - o) * -40}px)` })}>
            <div style={{ fontFamily: UI, fontSize: 17, lineHeight: 1.4, color: INK }}>{t}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: FAINT, marginTop: 8 }}>{SOURCES[i].d}</div></div>; })}
      </div>
      {sum > 0.01 && <div style={ab(330, 170, { width: 720, opacity: sum, transform: `translateY(${(1 - sum) * 14}px) scale(${0.97 + 0.03 * sum})`, ...glass(26, { padding: '36px 40px', background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(14,16,34,0.82)' }) })}>
        <Lab>14 SOURCES REVIEWED</Lab>
        <div style={{ fontFamily: UI, fontSize: 30, color: INK, marginTop: 14 }}>3 patterns appear consistently</div>
        {['Context first', 'Progressive disclosure', 'Persistent conversation'].map((t, i) => { const o = fade(T, sm + 0.4 + i * 0.2, sm + 0.8 + i * 0.2);
          return <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 66, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: i ? 0 : 24, opacity: o, fontFamily: UI, fontSize: 24, color: INK }}>
            <span style={{ fontFamily: MONO, fontSize: 15, color: pal.a3 }}>0{i + 1}</span>{t}</div>; })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, opacity: fade(T, sm + 1.1, sm + 1.4) }}>
          <div style={{ display: 'flex' }}>{[0, 1, 2, 3, 4].map(i => <div key={i} style={{ width: 22, height: 22, borderRadius: 7, marginLeft: i ? -6 : 0, border: '2px solid #10121f', background: [pal.a1, pal.a2, pal.a3, '#8a90b8', '#5a6090'][i] }} />)}</div>
          <span style={{ fontFamily: UI, fontSize: 16, color: DIM }}>Sources · 14</span></div>
      </div>}
    </Layer>
  );
}

// ── 07 agent ──
function AgentV({ T, Ag, pal, a }) {
  const secs = 134 + Math.floor(Math.max(0, T - (Ag + 0.9)));
  const rows = [['Reviewed current implementation', st(T, Ag + 0.9, Ag + 1.2)], ['Researched 14 references', st(T, Ag + 0.9, Ag + 1.5)], ['Updating prototype', T > Ag + 1.5 ? 'run' : 'wait', 'Editing navigation behavior'], ['Run usability checks', 'wait'], ['Prepare comparison', 'wait']];
  return <Layer a={a} x={1140} y={150} w={680} h={700} dx={40} dy={0}>
    <div style={ab(40, 40, { display: 'flex', alignItems: 'center', gap: 12 })}><Icon s="run" T={T} pal={pal} size={16} /><Lab style={{ color: pal.a3 }}>MAVE IS WORKING</Lab></div>
    <div style={ab(null, 40, { right: 40, fontFamily: MONO, fontSize: 15, color: DIM })}>{Math.floor(secs / 60)}m {String(secs % 60).padStart(2, '0')}s</div>
    <div style={ab(40, 76, { fontFamily: UI, fontWeight: 500, fontSize: 36, color: INK, letterSpacing: '-0.02em' })}>Navigation Redesign</div>
    {rows.map(([n, s, sub], i) => (
      <div key={n} style={ab(40, 158 + i * 78, { width: 600, height: 78, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 18, fontFamily: UI, opacity: fade(T, Ag + 0.9 + i * 0.1, Ag + 1.3 + i * 0.1) })}>
        <Icon s={s === 'run' ? 'live' : s} T={T} pal={pal} size={20} />
        <div><div style={{ fontSize: 21, color: s === 'wait' ? FAINT : INK }}>{n}</div>{sub && s === 'run' && <div style={{ fontSize: 15, color: DIM, marginTop: 4 }}>{sub}…</div>}</div></div>))}
    <div style={ab(40, 576)}><Bar p={tw(T, Ag + 1.0, Ag + 3.8, 0.3, 0.48)} w={600} pal={pal} /></div>
    <div style={ab(40, 600, { fontFamily: UI, fontSize: 15, color: FAINT, opacity: fade(T, Ag + 2.6, Ag + 3.0) })}>Runs in the background — you can keep going.</div>
  </Layer>;
}
function IndV({ T, pal, a, r, O }) {
  return <Layer a={a} x={r.x} y={r.y} w={r.w} h={r.h} dy={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: r.h, padding: '0 22px', whiteSpace: 'nowrap' }}>
      <Icon s="run" T={T} pal={pal} size={18} />
      <div style={{ fontFamily: UI }}><div style={{ fontSize: 15, color: INK }}>Navigation redesign</div><div style={{ fontSize: 13, color: DIM, marginTop: 2 }}>{T > O + 5.2 ? 'Preparing comparison' : 'Working · 3 of 5'}</div></div></div>
  </Layer>;
}

// ── 08 daily — small inline surfaces only ──
function Card({ a, x, y, w, h, children }) {
  return <Layer a={a} x={x} y={y} w={w} h={h} dy={18}><div style={{ position: 'absolute', inset: 0, ...glass(24) }} />{children}</Layer>;
}
function DailyV({ T, Dy, pal, out }) {
  const dim = t => 1 - 0.4 * fade(T, t, t + 0.4);
  const moved = fade(T, Dy + 3.6, Dy + 3.9), upd = fade(T, Dy + 3.9, Dy + 4.2);
  const press = tw(T, Dy + 6.8, Dy + 6.95, 0, 1, EZ.enter) * (1 - tw(T, Dy + 6.95, Dy + 7.2)), sent = T > Dy + 6.95;
  return <React.Fragment>
    <Card a={win(T, Dy + 1.1, out) * dim(Dy + 3.2)} x={200} y={640} w={380} h={220}>
      <Lab style={ab(28, 26)}>NEXT MEETING</Lab>
      <div style={ab(28, 54, { fontFamily: WM, fontWeight: 300, fontSize: 52, color: INK, lineHeight: 1 })}>14:00</div>
      <div style={ab(28, 122, { fontFamily: UI, fontSize: 20, color: INK })}>MAVE Product Review</div>
      <div style={ab(28, 156, { fontFamily: UI, fontSize: 16, color: pal.a3 })}>Starts in 42 minutes</div>
    </Card>
    <Card a={win(T, Dy + 3.2, out) * dim(Dy + 5.6)} x={610} y={700} w={360} h={160}>
      <Lab style={ab(28, 26)}>CALENDAR</Lab>
      <div style={ab(28, 54, { fontFamily: UI, fontSize: 22, color: INK })}>Gym</div>
      <div style={ab(28, 102, { display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: 22 })}>
        <span style={{ color: moved > 0.5 ? FAINT : INK, textDecoration: moved > 0.5 ? 'line-through' : 'none' }}>18:00</span>
        <span style={{ color: FAINT, opacity: moved }}>→</span>
        <span style={{ color: INK, opacity: moved, transform: `translateX(${(1 - moved) * 16}px)` }}>19:00</span></div>
      <div style={ab(null, 98, { right: 24, opacity: upd, display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 15, color: OKC })}><Icon s="done" T={T} pal={pal} size={16} />Updated</div>
    </Card>
    <Card a={win(T, Dy + 5.7, out)} x={1000} y={620} w={460} h={240}>
      <div style={ab(26, 22, { display: 'flex', alignItems: 'center', gap: 12 })}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: `linear-gradient(135deg, ${pal.a1}, ${pal.a2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI, fontSize: 14, fontWeight: 600, color: '#fff' }}>JC</div>
        <div style={{ fontFamily: UI }}><div style={{ fontSize: 18, color: INK }}>James</div><div style={{ fontSize: 13, color: FAINT }}>Messages</div></div></div>
      <div style={ab(26, 80, { width: 408, height: 92, ...inner({ borderRadius: 14, padding: '12px 16px' }), fontFamily: UI, fontSize: 19, lineHeight: 1.45, color: INK })}>
        <Typed T={T} text="Hey James, I'll send the MAVE prototype tonight." t0={Dy + 5.9} t1={Dy + 6.6} /></div>
      <div style={ab(26, 194, { fontFamily: UI, fontSize: 13, color: FAINT })}>Drafted by MAVE</div>
      <div style={ab(null, 184, { right: 26, height: 38, padding: '0 20px', borderRadius: 19, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 16, fontWeight: 500,
        color: sent ? OKC : '#fff', background: sent ? rgba(OKC, 0.12) : pal.a1, border: sent ? `1px solid ${rgba(OKC, 0.4)}` : '1px solid transparent', transform: `scale(${1 - 0.08 * press})` })}>
        {sent ? <React.Fragment><Icon s="done" T={T} pal={pal} size={15} />Sent</React.Fragment> : 'Send'}</div>
    </Card>
  </React.Fragment>;
}

// ── 09 files ──
const FILES = [['MAVE_Architecture_v4.pdf', 'Drive · edited yesterday', true], ['MAVE_Architecture_v3.pdf', 'Drive · 3 weeks ago'], ['architecture-notes.md', 'MAVE Core · 2 days ago'], ['Context_Router_RFC.docx', 'Shared · last month']];
const SECS = [['1', 'Overview'], ['2', 'Memory Architecture', '+4 pages'], ['3', 'Tool Execution Layer', 'Rewritten'], ['4', 'Context Router', 'New']];
function FilesV({ T, F, pal, a }) {
  const searching = T < F + 1.5, sel = fade(T, F + 1.9, F + 2.2), open = fade(T, F + 2.1, F + 2.7), dif = fade(T, F + 4.3, F + 4.7);
  return <Layer a={a} x={500} y={60} w={1380} h={800}>
    <div style={ab(24, 24, { width: 400, height: 52, ...inner({ borderRadius: 26 }), display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', fontFamily: UI, fontSize: 18, color: INK })}>
      <div style={{ width: 13, height: 13, borderRadius: 7, border: `2px solid ${DIM}`, boxSizing: 'border-box' }} /><Typed T={T} text="MAVE architecture" t0={F + 1.0} t1={F + 1.5} /></div>
    <div style={ab(24, 96, { width: 400, opacity: 1 - dif })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 28, fontFamily: UI, fontSize: 14, color: FAINT, opacity: fade(T, F + 1.0, F + 1.3) }}>{searching && <Icon s="run" T={T} pal={pal} size={13} />}{searching ? 'Searching 2,418 files' : '4 results · newest first'}</div>
      {FILES.map(([n, m, l], i) => { const o = fade(T, F + 1.5 + i * 0.08, F + 1.9 + i * 0.08);
        return <div key={n} style={{ height: 72, marginTop: 8, borderRadius: 14, padding: '0 16px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, opacity: o,
          background: l ? rgba(pal.a1, 0.14 * sel) : 'transparent', border: `1px solid ${l ? rgba(pal.a1, 0.4 * sel) : 'transparent'}` }}>
          <div style={{ width: 32, height: 40, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4, boxSizing: 'border-box', fontFamily: MONO, fontSize: 8, color: DIM }}>{n.split('.').pop().toUpperCase()}</div>
          <div style={{ fontFamily: UI, minWidth: 0 }}><div style={{ fontSize: 16, color: INK, whiteSpace: 'nowrap' }}>{n}</div><div style={{ fontSize: 13, color: FAINT, marginTop: 3 }}>{m}</div></div></div>; })}
    </div>
    <div style={ab(24, 110, { width: 400, opacity: dif, transform: `translateY(${(1 - dif) * 10}px)` })}>
      <Lab>COMPARED WITH V3</Lab>
      <div style={{ fontFamily: UI, fontSize: 30, color: INK, marginTop: 14 }}>3 major changes</div>
      {SECS.slice(1).map(([n, t, ch], i) => <div key={t} style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: i ? 0 : 22, fontFamily: UI, fontSize: 19, color: INK, opacity: fade(T, F + 4.5 + i * 0.2, F + 4.9 + i * 0.2) }}>
        {t}<span style={{ fontFamily: MONO, fontSize: 12, color: pal.a3 }}>{ch}</span></div>)}
    </div>
    <div style={ab(448, 24, { width: 908, height: 752, ...inner({ borderRadius: 20 }), opacity: open, transform: `translateX(${(1 - open) * 30}px)` })}>
      <div style={ab(30, 24, { fontFamily: MONO, fontSize: 13, color: FAINT })}>MAVE_Architecture_v4.pdf · 24 pages</div>
      <div style={ab(null, 16, { right: 24, opacity: dif })}><Chip pal={pal}>v3 → v4 · 3 changes</Chip></div>
      <div style={ab(30, 62, { fontFamily: UI, fontWeight: 500, fontSize: 34, color: INK, letterSpacing: '-0.02em' })}>MAVE Architecture</div>
      {SECS.map(([n, t, ch], i) => { const c = ch ? fade(T, F + 4.4 + i * 0.22, F + 4.8 + i * 0.22) : 0;
        const bars = [[640, 'add'], [560, ch === 'Rewritten' ? 'del' : ''], [420, ch === 'New' ? 'add' : '']];
        return <div key={t} style={ab(18, 128 + i * 152, { width: 872, height: 140, borderRadius: 14, padding: '16px 14px', boxSizing: 'border-box', background: rgba(pal.a1, 0.1 * c) })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 21, color: INK }}><span style={{ fontFamily: MONO, fontSize: 13, color: FAINT }}>{n}</span>{t}
            {ch && <span style={{ marginLeft: 'auto', opacity: c, fontFamily: MONO, fontSize: 12, color: pal.a3, padding: '4px 10px', borderRadius: 10, background: rgba(pal.a1, 0.18) }}>{ch}</span>}</div>
          {bars.map(([w, k], j) => { const on = ch ? c : 0, col = k === 'add' ? rgba(OKC, 0.1 + 0.35 * on) : k === 'del' ? rgba(ERR, 0.1 + 0.3 * on) : 'rgba(255,255,255,0.1)';
            return <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
              <span style={{ width: 10, fontFamily: MONO, fontSize: 13, color: k === 'add' ? OKC : ERR, opacity: k && on > 0.5 ? 1 : 0 }}>{k === 'add' ? '+' : '−'}</span>
              <div style={{ width: w, height: 7, borderRadius: 4, background: k && on > 0.01 ? col : 'rgba(255,255,255,0.1)' }} /></div>; })}
        </div>; })}
    </div>
  </Layer>;
}

// ── 10 orchestration ──
function OrchV({ T, O, pal, a }) {
  const N = [['Research', O + 0.3, O + 2.4, O + 2.6, 'Gathering', '14 sources'], ['Document', O + 0.8, O + 2.6, O + 3.6, 'Updating', 'Architecture v5'], ['Message', O + 1.4, O + 3.6, O + 4.4, 'Sending', 'Sent to James'], ['Calendar', O + 1.9, O + 3.9, O + 4.8, 'Attaching', "Attached to tomorrow's review"]];
  const X = i => 210 + i * 390;
  const art = i => {
    if (i === 0) return SOURCES.map((s, j) => <div key={s.d} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, fontFamily: UI, fontSize: 15, color: DIM }}><div style={{ width: 12, height: 12, borderRadius: 4, background: [pal.a1, pal.a2, pal.a3][j] }} />{s.d}</div>);
    if (i === 1) { const w = tw(T, O + 2.7, O + 3.5, 0, 1, Easing.linear); return <React.Fragment>
      <div style={{ fontFamily: UI, fontSize: 16, color: INK }}>MAVE Architecture v5</div>
      {[220, 190, 240].map((bw, j) => <div key={j} style={{ width: j === 2 ? bw * w : bw, height: 7, borderRadius: 4, marginTop: 14, background: j === 2 ? rgba(OKC, 0.5) : 'rgba(255,255,255,0.12)' }} />)}
      <div style={{ fontFamily: MONO, fontSize: 12, color: FAINT, marginTop: 16 }}>§4 Context Router · research added</div></React.Fragment>; }
    if (i === 2) return <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: UI, fontSize: 15, color: INK }}><div style={{ width: 26, height: 26, borderRadius: 13, background: `linear-gradient(135deg, ${pal.a1}, ${pal.a2})` }} />James</div>
      <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 14, background: rgba(pal.a1, 0.2), fontFamily: UI, fontSize: 15, color: INK, lineHeight: 1.4 }}>Updated architecture doc for tomorrow.</div>
      <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: DIM }}>Architecture_v5.pdf</div></React.Fragment>;
    return <React.Fragment>
      <div style={{ fontFamily: MONO, fontSize: 13, color: FAINT }}>TOMORROW · 10:00</div>
      <div style={{ fontFamily: UI, fontSize: 18, color: INK, marginTop: 8 }}>Product Review</div>
      <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: MONO, fontSize: 12, color: DIM, opacity: fade(T, O + 4.6, O + 4.9) }}>+ Architecture_v5.pdf</div></React.Fragment>;
  };
  const allDone = fade(T, O + 5.1, O + 5.5);
  return <Layer a={a} x={0} y={0} w={1920} h={1080} dy={0}>
    <Lab style={ab(210, 270, { opacity: fade(T, O + 0.3, O + 0.7) })}>ONE INSTRUCTION · FOUR TOOLS</Lab>
    {N.map(([n, ap, s0, d0, run, det], i) => { const s = st(T, s0, d0), o = fade(T, ap, ap + 0.4), ao = fade(T, s0 - 0.1, s0 + 0.35);
      return <React.Fragment key={n}>
        {i > 0 && <div style={ab(X(i) - 90, 385, { width: 90, height: 1.5, background: 'rgba(255,255,255,0.1)', opacity: o })}><div style={{ width: `${fade(T, s0 - 0.35, s0) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${pal.a3}, ${pal.a2})` }} /></div>}
        <div style={ab(X(i), 330, { width: 300, height: 110, opacity: o, transform: `translateY(${(1 - o) * 14}px)`, ...glass(22, s === 'run' ? { border: `1px solid ${rgba(pal.a1, 0.55)}`, boxShadow: `0 0 36px -6px ${rgba(pal.a1, 0.35)}` } : {}) })}>
          <div style={ab(24, 24, { display: 'flex', alignItems: 'center', gap: 12, fontFamily: UI, fontSize: 22, color: INK })}><Icon s={s} T={T} pal={pal} size={18} />{n}</div>
          <div style={ab(24, 66, { fontFamily: UI, fontSize: 15, color: s === 'done' ? DIM : s === 'run' ? pal.a3 : FAINT, whiteSpace: 'nowrap' })}>{s === 'done' ? det : s === 'run' ? run + '…' : 'Queued'}</div></div>
        <div style={ab(X(i), 466, { width: 300, height: 180, ...inner({ padding: '20px 22px' }), opacity: ao * (s === 'done' ? 0.75 : 1), transform: `translateY(${(1 - ao) * 10}px)` })}>{art(i)}</div>
      </React.Fragment>; })}
    <div style={ab(210, 690, { display: 'flex', alignItems: 'center', gap: 14, opacity: allDone, fontFamily: UI, fontSize: 26, color: INK })}><Icon s="done" T={T} pal={pal} size={22} />Completed.</div>
  </Layer>;
}

// ── 11 activity ──
function ActV({ T, Ac, pal, a }) {
  const rows = [['done', 'Fixed navigation build', '12 / 12 tests'], ['done', 'Created pull request', '#128'], ['done', 'Completed interface research', '14 sources'], ['done', 'Updated calendar', 'Gym → 19:00'], ['done', 'Sent message to James', 'Architecture v5 attached'],
    ['live', 'Navigation concept', 'Preparing comparison', 0.72], ['live', 'Presentation', 'Generating', 0.58]];
  return <Layer a={a} x={0} y={0} w={1920} h={1080} dy={0}>
    <div style={ab(260, 120, { display: 'flex', alignItems: 'center', gap: 14 })}><Orb pal={pal} size={14} /><Lab style={{ color: INK }}>MAVE ACTIVITY</Lab></div>
    {rows.map(([s, n, sub, p], i) => { const o = fade(T, Ac + 0.15 + i * 0.09, Ac + 0.55 + i * 0.09);
      return <div key={n} style={ab(260, 170 + i * 84, { width: 1100, height: 84, display: 'flex', alignItems: 'center', gap: 22, borderTop: '1px solid rgba(255,255,255,0.08)', opacity: o, transform: `translateX(${(1 - o) * -16}px)`, fontFamily: UI })}>
        <Icon s={s} T={T} pal={pal} size={22} />
        <div style={{ flex: 1, fontSize: 26, color: s === 'done' ? DIM : INK }}>{n}</div>
        {p ? <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><span style={{ fontSize: 17, color: pal.a3 }}>{sub}</span><Bar p={p + 0.08 * tw(T, Ac, Ac + 4)} w={220} pal={pal} /></div>
          : <span style={{ fontSize: 17, color: FAINT }}>{sub}</span>}</div>; })}
  </Layer>;
}

// ── 12 montage ──
const MLAB = ['CHAT', 'WEB', 'CODE', 'FILES', 'CALENDAR', 'MESSAGES', 'DOCUMENT', 'AGENT', 'HOME'];
function Beat({ i, T, b, B, pal, a }) {
  if (a <= 0.002) return null;
  const k = (T - b) / B;
  const tag = (x, y) => <Lab style={ab(x, y, { color: pal.a3 })}>{MLAB[i]}</Lab>;
  if (i === 0) return <Layer a={a} x={0} y={0} w={1920} h={1080} dy={0}>{tag(220, 330)}
    <div style={ab(220, 372, { fontFamily: UI, fontSize: 28, color: DIM })}>Summarize my week.</div>
    <Words T={T} t0={b + 0.15} dt={0.03} text="Four launches shipped. One blocker cleared." style={{ ...ab(220, 440), width: 1400, fontFamily: UI, fontWeight: 300, fontSize: 60, color: INK, letterSpacing: '-0.02em' }} /></Layer>;
  if (i === 1) return <Layer a={a} x={140} y={80} w={1640} h={780} dy={0}><div style={{ position: 'absolute', inset: 0, ...glass(28), overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: 200, top: 0, width: 800, transform: 'scale(1.3)', transformOrigin: '0 0' }}><Page s={SOURCES[2]} pal={pal} sy={-40 - 180 * k} hp={clamp01(k * 1.8 - 0.4)} /></div></div>{tag(36, 30)}</Layer>;
  if (i === 2) { const sw = k > 0.45; return <Layer a={a} x={820} y={180} w={1000} h={560} dx={40} dy={0}><div style={{ position: 'absolute', inset: 0, ...glass(26) }} />{tag(36, 30)}
    {['const ctx = await loadContext(user);', 'const tools = route(ctx.intent);', sw ? 'return run(tools, { safe: true });' : 'return run(tools);'].map((l, j) =>
      <div key={j} style={ab(36, 110 + j * 100, { width: 928, height: 72, display: 'flex', alignItems: 'center', padding: '0 20px', boxSizing: 'border-box', borderRadius: 10, fontFamily: MONO, fontSize: 28, whiteSpace: 'pre', background: j === 2 ? rgba(sw ? OKC : ERR, 0.12) : 'transparent' })}>{hl(l)}</div>)}</Layer>; }
  if (i === 3) return <Layer a={a} x={180} y={100} w={640} h={760} dx={-40} dy={0}><div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'rgba(240,242,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(j => <div key={j} style={ab(48, 60 + j * 54, { width: j % 4 === 0 ? 260 : [500, 470, 520][j % 3], height: j % 4 === 0 ? 14 : 8, borderRadius: 4, background: j >= 5 && j <= 7 && k > 0.35 ? rgba(pal.a3, 0.65) : 'rgba(255,255,255,0.14)' })} />)}
    <div style={ab(0, 40 + k * 640, { width: 640, height: 60, background: `linear-gradient(180deg, transparent, ${rgba(pal.a3, 0.2)}, transparent)` })} /></div>{tag(48, 24)}</Layer>;
  if (i === 4) { const y = kf(T, [[b + 0.2, 0], [b + 0.5, 1]], EZ.pop); return <Layer a={a} x={1260} y={560} w={460} h={300} dy={20}><div style={{ position: 'absolute', inset: 0, ...glass(24) }} />{tag(28, 24)}
    {[18, 19, 20].map((h, j) => <React.Fragment key={h}><div style={ab(28, 70 + j * 70, { fontFamily: MONO, fontSize: 13, color: FAINT })}>{h}:00</div>{line(90, 78 + j * 70, 340)}</React.Fragment>)}
    <div style={ab(96, 84 + y * 70, { width: 330, height: 58, borderRadius: 12, boxSizing: 'border-box', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: rgba(OKC, 0.12), border: `1px solid ${rgba(OKC, 0.45)}`, fontFamily: UI, fontSize: 18, color: INK })}>
      Gym<span style={{ fontSize: 14, color: OKC, opacity: fade(T, b + 0.5, b + 0.65) }}>Updated</span></div></Layer>; }
  if (i === 5) { const sent = k > 0.45; return <Layer a={a} x={220} y={150} w={560} h={220} dy={-16}><div style={{ position: 'absolute', inset: 0, ...glass(24) }} />{tag(28, 24)}
    <div style={ab(28, 62, { maxWidth: 420, padding: '14px 18px', borderRadius: 18, background: rgba(pal.a1, 0.25), fontFamily: UI, fontSize: 21, color: INK, lineHeight: 1.4 })}>Prototype is on its way — check your inbox tonight.</div>
    <div style={ab(null, 168, { right: 28, display: 'flex', alignItems: 'center', gap: 8, fontFamily: UI, fontSize: 15, color: sent ? OKC : DIM })}>{sent && <Icon s="done" T={T} pal={pal} size={15} />}{sent ? 'Sent' : 'Sending…'}</div></Layer>; }
  if (i === 6) return <Layer a={a} x={260} y={190} w={1400} h={620} dy={0}>{tag(0, -36)}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 450px)', gap: 25 }}>
      {[0, 1, 2, 3, 4, 5].map(j => { const o = fade(T, b + 0.05 + j * 0.08, b + 0.25 + j * 0.08);
        return <div key={j} style={{ height: 270, borderRadius: 14, position: 'relative', overflow: 'hidden', background: '#0a0c18', border: '1px solid rgba(255,255,255,0.1)', opacity: 0.25 + 0.75 * o, transform: `scale(${0.96 + 0.04 * o})` }}>
          <div style={ab(28, 34, { width: 200 * o, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.6)' })} />
          <div style={ab(28, 62, { width: 140 * o, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.22)' })} />
          <div style={ab(250, 34, { width: 170, height: 200, borderRadius: 10, opacity: o, background: `linear-gradient(160deg, ${rgba([pal.a2, pal.a1, pal.a3][j % 3], 0.6)}, ${rgba(pal.a1, 0.3)})` })} /></div>; })}
    </div></Layer>;
  if (i === 7) return <Layer a={a} x={1240} y={300} w={560} h={420} dx={30} dy={0}>{tag(0, 0)}
    {[['Navigation concept', 0.72], ['Presentation', 0.58], ['Usability checks', 0.24]].map(([n, p], j) => (
      <div key={n} style={ab(0, 40 + j * 120, { width: 560, height: 96, ...glass(48), display: 'flex', alignItems: 'center', gap: 18, padding: '0 30px' })}>
        <Icon s="run" T={T} pal={pal} size={20} /><div style={{ flex: 1, fontFamily: UI, fontSize: 21, color: INK }}>{n}<div style={{ marginTop: 10 }}><Bar p={p + 0.2 * k} w={300} pal={pal} /></div></div></div>))}</Layer>;
  return <HomeV T={T} H={b + 0.05} pal={pal} a={a} done />;
}

function Show({ tk }) {
  const { T, CUES, authoredTotal } = useComposition();
  const pal = PALETTES[tk.palette] || PALETTES.Indigo, glow = tk.glow == null ? 1.4 : tk.glow;
  const M = CUES.Mave, H = CUES.Home, C = CUES.Chat, D = CUES.Code, Wb = CUES.Web, R = CUES.Reason, Ag = CUES.Agent, Dy = CUES.Daily, F = CUES.Files, O = CUES.Orchestrate, Ac = CUES.Activity, Mo = CUES.Montage, Fi = CUES.Final, END = authoredTotal;
  const W0 = Wb + 0.9, MB = (Fi - Mo - 0.1) / 9;

  const USER = [[M + 1.6, 0.4, 'MAVE.'], [M + 2.8, 0.8, "What's going on?"], [M + 5.6, 0.4, 'Show me.'], [H + 4.1, 1.0, 'Why did the build fail?'], [C + 4.0, 0.4, 'Fix it.'], [D + 6.8, 0.4, 'Ship it.'],
    [Wb + 0.0, 2.0, 'Before we continue, check how other AI assistants handle contextual navigation.'], [R + 0.0, 0.9, 'Which approach would you choose?'], [Ag + 0.0, 1.4, 'Use this research and update our navigation concept.'],
    [Dy + 0.1, 0.9, "When's my next meeting?"], [Dy + 2.2, 1.0, 'Move my gym session to seven.'], [Dy + 4.3, 1.4, "Tell James I'll send the prototype tonight."],
    [F + 0.0, 1.4, 'Find the latest MAVE architecture document.'], [F + 2.9, 1.2, 'What changed from the previous version?'],
    [O + 0.0, 2.6, "Take the research, update the architecture document, send it to James, and attach it to tomorrow's review."]];
  const MSGS = [[C + 0.1, 'u', 'Why did the build fail?'],
    [C + 0.6, 'm', 'The latest navigation change introduced two TypeScript errors. Both are inside the navigation component.', [['navigation.tsx'], ['Build logs'], ['2 errors', 'err']]],
    [C + 2.6, 'm', 'I can fix them.'], [C + 4.5, 'u', 'Fix it.'], [D + 6.2, 'm', 'Fixed. The build is green again.'], [D + 7.3, 'u', 'Ship it.'], [D + 8.9, 'm', 'Done. Pull request #128 is open.'],
    [Wb + 2.1, 'u', 'Before we continue, check how other AI assistants handle contextual navigation.'], [Wb + 6.6, 'm', '14 sources reviewed. Three patterns appear consistently.', [['Sources · 14']]],
    [R + 1.0, 'u', 'Which approach would you choose?'],
    [R + 1.4, 'm', "The second approach. It scales better with the architecture we're already using, while keeping the interface lightweight.", [['Architecture'], ['14 Sources'], ['Current UI']]],
    [Ag + 1.5, 'u', 'Use this research and update our navigation concept.'], [Ag + 1.9, 'm', "On it. I'll keep working in the background."],
    [Dy + 1.1, 'u', "When's my next meeting?"], [Dy + 1.3, 'm', 'MAVE Product Review at 14:00.'], [Dy + 3.3, 'u', 'Move my gym session to seven.'], [Dy + 3.6, 'm', 'Moved to 19:00.'],
    [Dy + 5.8, 'u', "Tell James I'll send the prototype tonight."], [Dy + 7.1, 'm', 'Sent.'],
    [F + 1.5, 'u', 'Find the latest MAVE architecture document.'], [F + 4.2, 'u', 'What changed from the previous version?'], [F + 4.5, 'm', 'Three major changes since v3.']];
  const SPEAK = [[M + 3.6, 1.4], [C + 0.6, 2.6], [D + 6.2, 0.8], [D + 8.9, 0.6], [Wb + 6.6, 1.0], [R + 1.4, 1.6], [Ag + 1.9, 0.8], [Dy + 1.2, 0.8], [Dy + 3.5, 0.6], [Dy + 7.0, 0.4], [F + 4.5, 0.8], [O + 5.1, 0.6]];
  const sched = [];
  USER.forEach(([t, d]) => { sched.push([t - 0.1, 'listen'], [t + d + 0.15, 'think']); if (!SPEAK.some(([s]) => s > t + d && s < t + d + 1.6)) sched.push([t + d + 0.8, 'idle']); });
  SPEAK.forEach(([t, d]) => sched.push([t, 'speak'], [t + d, 'idle']));
  sched.push([Fi + 0.4, 'off']); sched.sort((a, b) => a[0] - b[0]);
  const vs = voiceAt(T, sched);

  const chatC = { x: 220, y: 150, s: 1.15, h: 610, o: 1 }, dock = { x: 44, y: 64, s: 0.56, h: 1410, o: 1 }, reasonC = { x: 523, y: 150, s: 1.15, h: 610, o: 1 }, agentC = { x: 150, y: 150, s: 1.1, h: 640, o: 1 };
  const TP = kf(T, [[C - 0.2, { ...chatC, o: 0, y: 180 }], [C + 0.3, chatC], [C + 5.0, chatC], [D + 0.3, dock], [R - 0.3, dock], [R + 0.5, reasonC], [Ag + 0.2, reasonC], [Ag + 0.9, agentC], [Ag + 3.8, agentC], [Ag + 4.5, { ...agentC, o: 0 }],
    [F - 0.2, { ...dock, o: 0 }], [F + 0.4, dock], [O - 0.3, dock], [O + 0.3, { ...dock, o: 0 }]]);
  const WS = { x: 500, y: 60, w: 1380, h: 800, o: 1, r: 30 };
  const S = kf(T, [[D - 0.7, { x: 1000, y: 200, w: 800, h: 560, o: 0, r: 30 }], [D + 0.3, WS], [R - 0.5, WS], [R + 0.3, { x: 800, y: 140, w: 1000, h: 680, o: 0, r: 30 }], [F - 0.4, { x: 800, y: 140, w: 1000, h: 680, o: 0, r: 30 }], [F + 0.4, WS], [O - 0.4, WS], [O + 0.3, { x: 300, y: 300, w: 1320, h: 420, o: 0, r: 30 }]]);
  const AP = { x: 1140, y: 150, w: 680, h: 700, o: 1, r: 30 }, IND = { x: 1560, y: 950, w: 320, h: 70, o: 1, r: 35 };
  const AR = kf(T, [[Ag + 0.6, { ...AP, o: 0, x: 1180 }], [Ag + 1.0, AP], [Ag + 3.8, AP], [Ag + 4.6, IND], [Ac + 0.1, IND], [Ac + 0.6, { ...IND, o: 0 }]]);

  const P0 = { cx: 960, cy: 540, w: 300, h: 96 }, PV = { cx: 960, cy: 540, w: 760, h: 104 }, PB = { cx: 960, cy: 985, w: 600, h: 72 };
  const pr = kf(T, [[0, P0], [M + 1.8, P0], [M + 2.5, PV], [M + 6.0, PV], [H + 0.4, PB], [Fi + 0.2, PB], [Fi + 1.4, P0]]);
  const pact = T < Fi ? tw(T, M + 1.8, M + 2.5) : tw(T, Fi + 0.6, Fi + 1.6, 1, 0);
  const press = T < M + 1.95 ? tw(T, M + 1.7, M + 1.95, 1, 0.955, EZ.enter) : tw(T, M + 1.95, M + 2.5, 0.955, 1, EZ.pop);
  const breathe = 1 + 0.006 * Math.sin(T * 1.3) * (1 - pact);
  let cam = kf(T, [[0, 1], [M + 2.5, 1.08], [M + 5.0, 1.03], [H, 1], [Fi + 1.4, 1], [END, 1.04]]) * (1 + 0.006 * Math.sin(T * 0.13));
  if (T > Mo && T < Fi) cam *= 1 + 0.025 * (((T - Mo) / MB) % 1);
  const black = Math.max(1 - tw(T, 0, 1.4, 0, 1, EZ.enter), tw(T, Fi + 4.0, END));
  const rec = tw(T, C - 0.3, C + 0.6);

  const MODES = [[H - 0.3, C + 0.3, 'Home'], [C + 0.3, D, 'Conversation'], [D, Wb + 0.6, 'Code'], [Wb + 0.6, R, 'Web'], [R, Ag + 0.6, 'Conversation'], [Ag + 0.6, Ag + 4.4, 'Agent'], [Dy, Dy + 4.2, 'Calendar'], [Dy + 4.2, F, 'Messages'], [F + 0.3, O, 'Files'], [O, Ac, 'Orchestration'], [Ac, Mo, 'Activity']];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#05060d' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 + (cam - 1) * 0.3})` }}><Ambient T={T} pal={pal} glow={glow} amp={vs.amp * pact} /></div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `scale(${cam})` }}>
        {MODES.map(([a0, a1, n], i) => { const o = win(T, a0, a1, 0.35); return o > 0.01 && <div key={i} style={ab(64, 26, { opacity: o, display: 'flex', alignItems: 'center', gap: 10 })}><div style={{ width: 6, height: 6, borderRadius: 3, background: pal.a3 }} /><Lab>{n.toUpperCase()}</Lab></div>; })}

        <Glance T={T} M={M} pal={pal} a={win(T, M + 3.5, M + 6.6)} />
        <HomeV T={T} H={H} pal={pal} a={win(T, H - 0.4, D + 0.3)} rec={rec} />

        {S.o > 0.002 && <div style={{ position: 'absolute', left: S.x, top: S.y, width: S.w, height: S.h, opacity: S.o, ...glass(S.r) }} />}
        {AR.o > 0.002 && <div style={{ position: 'absolute', left: AR.x, top: AR.y, width: AR.w, height: AR.h, opacity: AR.o, ...glass(AR.r, { border: `1px solid ${rgba(pal.a1, 0.3)}` }) }} />}

        <CodeV T={T} D={D} pal={pal} a={win(T, D - 0.1, Wb + 1.0)} out={tw(T, Wb + 0.3, Wb + 1.0)} />
        <WebV T={T} W0={W0} pal={pal} a={win(T, Wb + 0.7, R)} />
        <FilesV T={T} F={F} pal={pal} a={win(T, F + 0.3, O - 0.1)} />
        <AgentV T={T} Ag={Ag} pal={pal} a={win(T, Ag + 0.9, Ag + 3.9)} />
        <IndV T={T} pal={pal} O={O} a={win(T, Ag + 4.5, Ac + 0.5, 0.3)} r={IND} />
        <DailyV T={T} Dy={Dy} pal={pal} out={F + 0.2} />
        <OrchV T={T} O={O} pal={pal} a={win(T, O + 0.2, Ac + 0.1)} />
        <ActV T={T} Ac={Ac} pal={pal} a={win(T, Ac + 0.05, Mo + 0.05, 0.3)} />
        {MLAB.map((_, i) => { const b = Mo + i * MB; return <Beat key={i} i={i} T={T} b={b} B={MB} pal={pal} a={win(T, b, b + MB + (i === 8 ? 0.5 : 0.06), 0.16)} />; })}

        <Thread T={T} msgs={MSGS} p={TP} pal={pal} />
        <Pill T={T} r={pr} act={pact} sc={press * breathe} vs={vs} pal={pal} glow={glow} opacity={fade(T, 0.3, 1.6)} />
        <Captions T={T} lines={USER} pr={pr} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, fontFamily: UI, fontWeight: 300, fontSize: 34 }}>
        {['Just ask.', 'MAVE handles the rest.'].map((l, i) => { const o = fade(T, Fi + 1.6 + i * 0.6, Fi + 2.4 + i * 0.6);
          return <div key={l} style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)`, color: i ? DIM : INK }}>{l}</div>; })}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: black, pointerEvents: 'none' }} />
    </div>
  );
}

function MaveShowcaseV3() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS || { motionEditor: true, palette: 'Indigo', glow: 1.4 });
  return <React.Fragment>
    <CompositionStage width={1920} height={1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#05060d"><Show tk={t} /></CompositionStage>
    <TweaksPanel>
      <TweakSection label="Playback" />
      <TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
      <TweakSection label="Look" />
      <TweakRadio label="Accent" value={t.palette} options={['Indigo', 'Teal', 'Dusk']} onChange={v => setTweak('palette', v)} />
      <TweakSlider label="Ambient glow" value={t.glow} min={0} max={1.8} step={0.1} onChange={v => setTweak('glow', v)} />
    </TweaksPanel>
  </React.Fragment>;
}
window.MaveShowcaseV3 = MaveShowcaseV3;
})();
