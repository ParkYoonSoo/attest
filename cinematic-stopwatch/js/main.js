/* 인트로 타임라인 + 스톱워치 로직 + 글래스 UI */
(() => {
  const $ = s => document.querySelector(s);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const smooth = (a, b, t) => { const k = clamp01((t - a) / (b - a)); return k * k * (3 - 2 * k); };

  const cam = Stadium.cam, S = Stadium.S;
  const rig = $('#rig'), fade = $('#fade'), ui = $('#ui');

  // 필름 그레인 텍스처
  (() => {
    const c = document.createElement('canvas'); c.width = c.height = 220;
    const x = c.getContext('2d'), d = x.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  Stadium.init();

  /* =========================================================
     인트로 타임라인 (초)
     A 0–4.8   경기장 와이드 크레인 숏
     B 4.8–9.4 트랙 레벨 망원: 제자리에 → 차려
     C 9.4–11.8 스타터 클로즈업 (긴장)
     D 11.8–14.6 랙 포커스 → 계측원의 손 + 스톱워치
     ========================================================= */
  const END = 14.6;
  let mode = 'splash', introT0 = 0, fired = new Set();

  function setMainCamera() {
    cam.x = -0.6; cam.y = 1.45; cam.z = 1.5; cam.f = 1.35; cam.cy = 0.5;
    S.scene = 'track'; S.pose = 1; S.flashRate = 0.6;
    Stadium.blur(12, 7);
  }

  function applyIntro(t) {
    if (t < 4.8) {
      const k = ease(t / 4.8);
      S.scene = 'track'; S.pose = 0; S.flashRate = 1.3;
      cam.x = lerp(-18, -4, k); cam.y = lerp(17, 15, k); cam.z = -34; cam.f = lerp(1.2, 1.32, k); cam.cy = 0.37;
      Stadium.blur(0.8, 0);
    } else if (t < 9.4) {
      const k = (t - 4.8) / 4.6;
      S.scene = 'track'; S.flashRate = 0.35;
      S.pose = smooth(7.3, 8.1, t);
      cam.x = lerp(-3.0, -2.4, k); cam.y = 0.5; cam.z = lerp(4.4, 5.1, k); cam.f = 1.55; cam.cy = 0.6;
      Stadium.blur(4.5, 0);
    } else if (t < 11.8) {
      const k = (t - 9.4) / 2.4;
      S.scene = 'starter'; S.starterK = k; S.pose = 1; S.flashRate = 0.25;
      cam.x = lerp(-6, -5, k); cam.y = 1.2; cam.z = 6; cam.f = 0.95; cam.cy = 0.92;
      Stadium.blur(9, 0);
    } else {
      const k = smooth(11.8, 13.6, t);
      setMainCamera();
      Stadium.blur(lerp(2, 12, k), lerp(0, 7, k));
    }
  }

  const cues = [
    [0.0, () => { fade.style.transition = 'opacity 1.4s'; fade.style.opacity = 0; AudioFX.crowd(0.55, 2); }],
    [1.0, () => $('#lowerThird').classList.add('show')],
    [4.3, () => $('#lowerThird').classList.remove('show')],
    [5.4, () => subtitle('On your marks…', '제 자 리 에')],
    [6.7, () => AudioFX.crowd(0.14, 1.5)],
    [6.9, () => subtitle(null)],
    [7.3, () => { subtitle('Set.', '차 려'); AudioFX.heartbeat(true, 70); }],
    [9.2, () => subtitle(null)],
    [9.4, () => { AudioFX.crowd(0.06, 0.5); AudioFX.heartbeat(true, 92); }],
    [11.55, () => AudioFX.whoosh()],
    [11.8, () => { rig.classList.remove('offstage'); document.body.classList.add('main'); }],
    [12.6, () => { caption('OFFICIAL TIMEKEEPER · LANE 1–8'); }],
    [13.4, () => { AudioFX.heartbeat(false); AudioFX.crowd(0.16, 2); showUI(); }],
  ];

  function subtitle(en, ko) {
    const el = $('#subtitle');
    if (!en) { el.classList.remove('show'); return; }
    el.querySelector('.en').textContent = en; el.querySelector('.ko').textContent = ko;
    el.classList.add('show');
  }
  function caption(txt) { const c = $('#caption'); c.textContent = txt; c.classList.add('show'); }
  function showUI() { ui.classList.remove('hidden'); requestAnimationFrame(() => ui.classList.add('show')); $('#skip').classList.add('hidden'); }

  function startIntro(offset = 0) {
    mode = 'intro'; fired = new Set();
    introT0 = performance.now() - offset * 1000;
    rig.classList.add('offstage'); document.body.classList.remove('main');
    ui.classList.remove('show'); ui.classList.add('hidden');
    $('#caption').classList.remove('show'); $('#lowerThird').classList.remove('show'); subtitle(null);
    fade.style.transition = 'none'; fade.style.opacity = 1;
    $('#skip').classList.remove('hidden');
    Stadium.resetRace(); S.follow = false;
    for (const [t] of cues) if (t < offset - 0.05) fired.add(t);
    if (offset > 0) { fade.style.opacity = 0; if (offset > 11.8) { rig.classList.remove('offstage'); document.body.classList.add('main'); } }
  }

  function skipIntro() {
    if (mode !== 'intro') return;
    mode = 'main';
    subtitle(null); $('#lowerThird').classList.remove('show');
    fade.style.transition = 'opacity .6s'; fade.style.opacity = 0;
    rig.classList.remove('offstage'); document.body.classList.add('main');
    setMainCamera();
    AudioFX.heartbeat(false); AudioFX.crowd(0.16, 1);
    caption('OFFICIAL TIMEKEEPER · LANE 1–8');
    showUI();
  }

  Stadium.onFrame = () => {
    if (mode === 'intro') {
      const t = (performance.now() - introT0) / 1000;
      applyIntro(t);
      for (const [ct, fn] of cues) if (t >= ct && !fired.has(ct)) { fired.add(ct); fn(); }
      if (t >= END) mode = 'main';
    } else if (mode === 'main') {
      if (!S.race && !S.follow) {
        const tt = performance.now() / 1000;
        cam.x += ((-0.6 + Math.sin(tt * 0.15) * 0.25) - cam.x) * 0.02;
      }
    }
    tick();
  };

  /* =========================================================
     스톱워치 로직
     ========================================================= */
  let running = false, startAt = 0, acc = 0, laps = [], splitUntil = 0, splitVal = 0;
  const now = () => running ? acc + performance.now() - startAt : acc;

  const fmt = ms => {
    const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
    const p = n => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : m) + ':' + p(s) + '.' + p(cs);
  };

  function tick() {
    const t = now(), pn = performance.now();
    const holding = pn < splitUntil;
    Watch.show(holding ? splitVal : t);
    Watch.flag('#lcdSplit', holding ? 'blink' : false);
    Watch.flag('#lcdRun', running ? 'on' : false);
    const last = laps.length ? laps[laps.length - 1] : 0;
    $('#roTime').textContent = fmt(running || t > 0 ? t - (running ? last : 0) : 0);
    $('#roLabel').textContent = running ? `LAP ${laps.length + 1}` : t > 0 ? 'PAUSED' : 'READY';
    if (!running && t > 0) $('#roTime').textContent = fmt(t);
  }

  function refreshButtons() {
    const t = now();
    const p = $('#btnPrimary');
    p.classList.toggle('running', running);
    $('#lblPrimary').textContent = running ? '정지' : t > 0 ? '재개' : '시작';
    $('#icoPrimary').setAttribute('d', running ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5v14l11-7z');
    $('#lblSecondary').textContent = running || t === 0 ? '랩' : '재설정';
    $('#icoSecondary').setAttribute('d', running || t === 0 ? 'M5 21V4h11l-1.5 3.5L16 11H5' : 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5');
    $('#btnSecondary').disabled = !running && t === 0;
  }

  function renderLaps() {
    const list = $('#lapList');
    const splits = laps.map((v, i) => v - (i ? laps[i - 1] : 0));
    let best = -1, worst = -1;
    if (splits.length > 1) { best = splits.indexOf(Math.min(...splits)); worst = splits.indexOf(Math.max(...splits)); }
    list.innerHTML = splits.map((sp, i) => ({ sp, i })).reverse().map(({ sp, i }) =>
      `<li class="${i === best ? 'best' : i === worst ? 'worst' : ''}"><span class="n">LAP ${String(i + 1).padStart(2, '0')}</span><span class="sp">${fmt(sp)}</span><span class="tot">${fmt(laps[i])}</span></li>`).join('');
    $('#lapCount').textContent = laps.length;
    $('#lapEmpty').style.display = laps.length ? 'none' : '';
  }

  let pressing = false;
  function guard(fn) { if (mode !== 'main' || pressing) return; pressing = true; fn().then(() => { pressing = false; }); }

  function primary() {
    guard(() => Watch.press('start', () => {
      AudioFX.click();
      if (running) {
        acc += performance.now() - startAt; running = false; splitUntil = 0;
      } else {
        const fresh = acc === 0;
        startAt = performance.now(); running = true;
        if (fresh) { AudioFX.gun(); Stadium.startRace(); S.follow = true; }
      }
      refreshButtons();
    }));
  }
  function secondary() {
    if (!running && now() === 0) return;
    guard(() => Watch.press('split', () => {
      AudioFX.click();
      if (running) {
        const t = now(); laps.push(t); splitVal = t; splitUntil = performance.now() + 1800; renderLaps();
      } else {
        acc = 0; laps = []; splitUntil = 0; renderLaps();
        Stadium.resetRace(); S.follow = false;
        AudioFX.crowd(0.16, 1.5);
      }
      refreshButtons();
    }));
  }

  /* ---------- 이벤트 ---------- */
  $('#btnPrimary').addEventListener('click', primary);
  $('#btnSecondary').addEventListener('click', secondary);
  $('#btnLaps').addEventListener('click', () => { const c = $('#lapCard'); c.classList.toggle('closed'); $('#btnLaps').classList.toggle('on', !c.classList.contains('closed')); });
  $('#btnSound').addEventListener('click', () => {
    const m = AudioFX.toggleMute();
    $('#icoSound').setAttribute('d', m ? 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6' : 'M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12');
  });
  $('#btnReplay').addEventListener('click', () => {
    running = false; acc = 0; laps = []; splitUntil = 0; renderLaps(); refreshButtons();
    AudioFX.crowd(0, 0.3); startIntro();
  });
  $('#skip').addEventListener('click', skipIntro);

  $('#enter').addEventListener('click', () => {
    AudioFX.init();
    $('#splash').classList.add('gone');
    startIntro();
  });

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (mode === 'splash' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); $('#enter').click(); return; }
    if (e.code === 'Escape') { skipIntro(); return; }
    if (e.code === 'Space') { e.preventDefault(); primary(); }
    else if (e.key === 'l' || e.key === 'L') { if (running) secondary(); }
    else if (e.key === 'r' || e.key === 'R') { if (!running) secondary(); }
  });

  if (window.matchMedia('(max-width:760px)').matches) $('#lapCard').classList.add('closed');
  else $('#btnLaps').classList.add('on');
  renderLaps(); refreshButtons();

  // 디버그/미리보기: index.html?t=6  또는 ?skip
  const q = new URLSearchParams(location.search);
  if (q.has('t') || q.has('skip')) {
    $('#splash').style.display = 'none';
    if (q.has('skip')) { startIntro(); skipIntro(); }
    else startIntro(parseFloat(q.get('t')) || 0);
    if (q.has('freeze')) window.__freeze = true;
  }
  window.__app = { primary, secondary, startIntro };
})();
