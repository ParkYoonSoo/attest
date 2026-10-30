/* WebAudio로 합성하는 효과음 (외부 음원 파일 없음) */
const AudioFX = (() => {
  let ctx = null, master = null, crowdGain = null, reverb = null, hbTimer = null;
  let muted = false;

  function noise(sec, kind) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'pink') {
          b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
        } else if (kind === 'brown') {
          last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2;
        } else d[i] = w;
      }
    }
    return buf;
  }

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 3);
    const rvGain = ctx.createGain(); rvGain.gain.value = 0.35;
    reverb.connect(rvGain).connect(master);

    // 관중 앰비언스: 두 겹의 노이즈 + 느린 LFO로 웅성거림
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    crowdGain.connect(master);
    [[700, 0.7, 'pink'], [2200, 1.4, 'pink'], [180, 0.8, 'brown']].forEach(([f, q, k], i) => {
      const src = ctx.createBufferSource(); src.buffer = noise(5 + i, k); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.5 : 0.35;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13 + i * 0.21;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.15;
      lfo.connect(lfoG).connect(g.gain); lfo.start();
      src.connect(bp).connect(g).connect(crowdGain); src.start();
      g.connect(reverb);
    });
  }

  const now = () => ctx.currentTime;

  function crowd(v, sec = 1) {
    if (!ctx) return;
    crowdGain.gain.cancelScheduledValues(now());
    crowdGain.gain.setTargetAtTime(v, now(), Math.max(0.01, sec / 3));
  }

  function thump(t, f, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
  }

  function heartbeat(on, bpm = 72) {
    if (!ctx) return;
    clearInterval(hbTimer); hbTimer = null;
    if (!on) return;
    const beat = () => { const t = now() + 0.02; thump(t, 62, 0.9); thump(t + 0.22, 55, 0.55); };
    beat(); hbTimer = setInterval(beat, 60000 / bpm);
  }

  // 스톱워치 버튼: 기계식 '딸깍' + 짧은 비프
  function click(beep = true) {
    if (!ctx) return;
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noise(0.05, 'white');
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(hp).connect(g).connect(master); src.start(t);
    if (beep) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'square'; o.frequency.value = 4000;
      og.gain.setValueAtTime(0.0001, t + 0.01); og.gain.exponentialRampToValueAtTime(0.05, t + 0.015); og.gain.setValueAtTime(0.05, t + 0.07); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(og).connect(master); o.start(t); o.stop(t + 0.1);
    }
  }

  // 출발 신호총
  function gun() {
    if (!ctx) return;
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noise(1.2, 'white');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(lp).connect(g); g.connect(master); g.connect(reverb); src.start(t);
    thump(t, 90, 0.8);
    setTimeout(() => crowd(0.95, 0.8), 350);
    setTimeout(() => crowd(0.45, 4), 9000);
  }

  function whoosh() {
    if (!ctx) return;
    const t = now();
    const src = ctx.createBufferSource(); src.buffer = noise(1.4, 'pink');
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3000, t + 0.7); bp.frequency.exponentialRampToValueAtTime(500, t + 1.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    src.connect(bp).connect(g).connect(master); src.start(t);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.05);
    return muted;
  }

  return { init, crowd, heartbeat, click, gun, whoosh, toggleMute, get muted() { return muted; } };
})();
