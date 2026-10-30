/* 육상 경기장 시네마틱 렌더러 (Canvas 2D, 간이 원근 투영)
   좌표계: x = 트랙 진행 방향(오른쪽 +), y = 위, z = 카메라에서 관중석 방향 */
const Stadium = (() => {
  const bgC = document.getElementById('bg'), fgC = document.getElementById('fg');
  const B = bgC.getContext('2d'), F = fgC.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const cam = { x: -10, y: 12, z: -16, f: 1.05, cy: 0.26 };
  const S = { scene: 'track', pose: 0, flashRate: 1, starterK: 0, race: null, follow: false, time: 0 };

  const TRACK_Z0 = 10, LANE = 1.22, LANES = 8;
  const TRACK_Z1 = TRACK_Z0 + 0.25 + LANE * LANES + 0.5;
  const BOARD_Z = TRACK_Z1 + 1.3;
  const STAND_Z0 = BOARD_Z + 1.2, STAND_Y0 = 1.3, TIERS = 46, TDZ = 1.0, TDY = 0.56;
  const ROOF_Z_FRONT = STAND_Z0 + 18, ROOF_Z_BACK = STAND_Z0 + TIERS * TDZ + 3;
  const ROOF_Y_FRONT = STAND_Y0 + TIERS * TDY + 4.5;
  const X_MIN = -120, X_MAX = 220, TEX_W = 4096, ROW_H = 6;

  let crowdTex, glowCool, glowWarm;
  const flashes = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- 사전 생성 텍스처 ---------- */
  function buildCrowd() {
    crowdTex = document.createElement('canvas');
    crowdTex.width = TEX_W; crowdTex.height = TIERS * ROW_H;
    const c = crowdTex.getContext('2d');
    const pxm = TEX_W / (X_MAX - X_MIN), seat = 0.55 * pxm;
    const shirts = ['#c8343a', '#e8e3d8', '#2a5bd7', '#f2c230', '#1b1b1f', '#3f8f4f', '#e66a2c', '#7a3fb0', '#f4f4f4', '#d24a7a', '#23305a', '#9aa3b5', '#111'];
    const skins = ['#e3b48f', '#c58b62', '#8d5a3b', '#5a3622', '#f0c9a6'];
    for (let r = 0; r < TIERS; r++) {
      const y = r * ROW_H;
      c.fillStyle = r % 2 ? '#141824' : '#10131c'; c.fillRect(0, y, TEX_W, ROW_H);
      for (let x = 0; x < TEX_W; x += seat) {
        const xm = X_MIN + x / pxm;
        if (Math.abs(((xm + 600) % 26) - 13) < 0.7) { c.fillStyle = '#2a3042'; c.fillRect(x, y, seat, ROW_H); continue; }
        if (Math.random() < 0.06) continue;
        const jx = x + rand(-0.8, 0.8);
        c.fillStyle = shirts[Math.random() * shirts.length | 0];
        c.fillRect(jx + 0.5, y + 2.6, seat - 1.2, ROW_H - 2.6);
        c.fillStyle = skins[Math.random() * skins.length | 0];
        c.fillRect(jx + 1.4, y + 0.5, seat - 3, 2.3);
      }
    }
  }
  function glow(rgb) {
    const s = document.createElement('canvas'); s.width = s.height = 128;
    const c = s.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.12, `rgba(${rgb},.85)`);
    g.addColorStop(0.35, `rgba(${rgb},.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); return s;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    W = window.innerWidth; H = window.innerHeight;
    for (const c of [bgC, fgC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  }

  /* ---------- 투영 ---------- */
  const FL = () => cam.f * H;
  function P(x, y, z) {
    const Z = Math.max(0.05, z - cam.z), f = FL();
    return [W / 2 + f * (x - cam.x) / Z, cam.cy * H - f * (y - cam.y) / Z, f / Z];
  }
  const rowY = (y, z) => cam.cy * H - FL() * (y - cam.y) / Math.max(0.05, z - cam.z);

  /* ---------- 배경: 하늘, 지붕 조명, 관중석, 전광판 ---------- */
  function drawBG(dt) {
    const c = B;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#02030a'); sky.addColorStop(0.55, '#0a0f1f'); sky.addColorStop(1, '#141a2c');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    // 지붕 캐노피 (아래면)
    const yBack = rowY(ROOF_Y_FRONT + 3, ROOF_Z_BACK), yFront = rowY(ROOF_Y_FRONT, ROOF_Z_FRONT);
    c.fillStyle = '#06070c';
    c.fillRect(0, Math.min(yBack, yFront) - 2, W, Math.abs(yFront - yBack) + 4);
    c.strokeStyle = 'rgba(80,90,120,.18)'; c.lineWidth = 1;
    for (let x = Math.floor((cam.x - 140) / 8) * 8; x < cam.x + 140; x += 8) {
      const a = P(x, ROOF_Y_FRONT, ROOF_Z_FRONT), b = P(x, ROOF_Y_FRONT + 3, ROOF_Z_BACK);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }

    // 관중석 (먼 층부터)
    c.imageSmoothingEnabled = true;
    for (let k = TIERS - 1; k >= 0; k--) {
      const z = STAND_Z0 + k * TDZ, y = STAND_Y0 + k * TDY;
      const yTop = rowY(y + TDY, z + TDZ), yBot = rowY(y, z) + 0.6;
      if (yBot < -10 || yTop > H + 10) continue;
      const a = P(X_MIN, y, z + TDZ * 0.5), b = P(X_MAX, y, z + TDZ * 0.5);
      c.globalAlpha = 0.55 + 0.45 * (k / TIERS);
      c.drawImage(crowdTex, 0, k * ROW_H, TEX_W, ROW_H, a[0], yTop, b[0] - a[0], Math.max(1, yBot - yTop));
    }
    c.globalAlpha = 1;
    // 관중석 노출 보정: 위쪽일수록 어둡게
    const topY = rowY(STAND_Y0 + TIERS * TDY, STAND_Z0 + TIERS * TDZ), botY = rowY(STAND_Y0, STAND_Z0);
    const dk = c.createLinearGradient(0, topY, 0, botY);
    dk.addColorStop(0, 'rgba(3,4,10,.78)'); dk.addColorStop(0.6, 'rgba(3,4,10,.5)'); dk.addColorStop(1, 'rgba(3,4,10,.3)');
    c.fillStyle = dk; c.fillRect(0, topY, W, botY - topY);
    // 관중석 하단 벽
    const wTop = rowY(STAND_Y0, STAND_Z0), wBot = rowY(0, STAND_Z0);
    c.fillStyle = '#0b0d14'; c.fillRect(0, wTop, W, wBot - wTop + 1);

    // 관중석 위로 깔리는 조명 헤이즈
    c.globalCompositeOperation = 'lighter';
    const hz = c.createLinearGradient(0, yFront, 0, wTop);
    hz.addColorStop(0, 'rgba(120,140,190,.16)'); hz.addColorStop(0.5, 'rgba(90,100,140,.06)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hz; c.fillRect(0, yFront, W, Math.max(0, wTop - yFront));

    // 카메라 플래시
    const spawn = S.flashRate * dt * 22;
    for (let i = 0; i < spawn + (Math.random() < spawn % 1 ? 1 : 0); i++) {
      const k = Math.random() * TIERS | 0;
      flashes.push({ x: cam.x + rand(-60, 60), y: STAND_Y0 + k * TDY + 0.6, z: STAND_Z0 + k * TDZ, life: rand(0.06, 0.16), age: 0 });
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const fl = flashes[i]; fl.age += dt;
      if (fl.age > fl.life) { flashes.splice(i, 1); continue; }
      const p = P(fl.x, fl.y, fl.z), s = Math.max(6, p[2] * 1.4) * (1 - fl.age / fl.life);
      c.globalAlpha = 0.9; c.drawImage(glowCool, p[0] - s / 2, p[1] - s / 2, s, s);
    }
    c.globalAlpha = 1;

    // 지붕 조명등 + 아나모픽 플레어
    for (let x = Math.floor((cam.x - 150) / 3.2) * 3.2; x < cam.x + 150; x += 3.2) {
      for (let r = 0; r < 2; r++) {
        const p = P(x, ROOF_Y_FRONT - 0.3 - r * 0.9, ROOF_Z_FRONT - 0.5);
        if (p[0] < -50 || p[0] > W + 50) continue;
        const s = Math.max(5, p[2] * 2.6);
        c.drawImage(r ? glowWarm : glowCool, p[0] - s / 2, p[1] - s / 2, s, s);
      }
    }
    for (const cx of [-58, -18, 22, 62, 102, 142]) {
      const p = P(cx, ROOF_Y_FRONT - 0.7, ROOF_Z_FRONT - 0.6);
      if (p[0] < -W || p[0] > 2 * W) continue;
      const s = Math.max(40, p[2] * 16);
      c.globalAlpha = 0.55; c.drawImage(glowCool, p[0] - s / 2, p[1] - s / 2, s, s);
      const lg = c.createLinearGradient(p[0] - W * 0.4, 0, p[0] + W * 0.4, 0);
      lg.addColorStop(0, 'rgba(90,150,255,0)'); lg.addColorStop(0.5, 'rgba(140,190,255,.5)'); lg.addColorStop(1, 'rgba(90,150,255,0)');
      c.globalAlpha = 0.6; c.fillStyle = lg; c.fillRect(p[0] - W * 0.4, p[1] - 1, W * 0.8, 2);
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over';

    // LED 광고 보드
    const bTop = rowY(0.95, BOARD_Z), bBot = rowY(0, BOARD_Z);
    c.fillStyle = '#04050a'; c.fillRect(0, bTop, W, bBot - bTop + 1);
    const fs = (bBot - bTop) * 0.62;
    if (fs > 1.5) {
      c.save(); c.beginPath(); c.rect(0, bTop, W, bBot - bTop); c.clip();
      c.font = `800 ${fs}px ${getComputedStyle(document.body).fontFamily}`;
      c.textBaseline = 'middle';
      const msgs = [['100M FINAL', '#ff8a1e'], ['ATHLETICS CHAMPIONSHIPS 2026', '#f2f5ff'], ['● LIVE', '#ff3b3b'], ['TIMEKEEPER', '#4fd1ff']];
      const span = 16, off = (S.time * 2.2) % (span * msgs.length);
      for (let x = Math.floor((cam.x - 120) / span) * span; x < cam.x + 120; x += span) {
        const idx = ((Math.round(x / span) % msgs.length) + msgs.length) % msgs.length;
        const p = P(x - off, 0.47, BOARD_Z);
        c.fillStyle = msgs[idx][1]; c.globalAlpha = 0.9;
        c.fillText(msgs[idx][0], p[0], p[1]);
      }
      c.restore(); c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,140,60,.06)'; c.fillRect(0, bTop - (bBot - bTop), W, (bBot - bTop) * 3);
      c.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------- 전경: 트랙, 잔디, 선수 ---------- */
  function drawFG() {
    const c = F;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    if (S.scene === 'starter') { drawStarter(c); return; }

    const yApron = rowY(0, BOARD_Z), yT1 = rowY(0, TRACK_Z1), yT0 = rowY(0, TRACK_Z0);
    // 에이프런
    c.fillStyle = '#3a1a16'; c.fillRect(0, yApron, W, yT1 - yApron + 1);
    // 트랙
    const tg = c.createLinearGradient(0, yT1, 0, yT0);
    tg.addColorStop(0, '#6e2a1f'); tg.addColorStop(1, '#a8452f');
    c.fillStyle = tg; c.fillRect(0, yT1, W, yT0 - yT1 + 1);
    // 레인 라인
    for (let i = 0; i <= LANES; i++) {
      const z = TRACK_Z0 + 0.25 + i * LANE;
      const a = rowY(0, z), b = rowY(0, z + 0.05);
      c.fillStyle = 'rgba(245,242,235,.85)'; c.fillRect(0, b, W, Math.max(0.7, a - b));
    }
    // 출발선, 10m 표시, 결승선
    const zA = TRACK_Z0 + 0.25, zB = TRACK_Z0 + 0.25 + LANE * LANES;
    const line = (x, w, col) => {
      const p1 = P(x, 0, zA), p2 = P(x + w, 0, zA), p3 = P(x + w, 0, zB), p4 = P(x, 0, zB);
      c.fillStyle = col; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.fill();
    };
    line(0.02, 0.05, 'rgba(255,255,255,.95)');
    line(100, 0.05, 'rgba(255,255,255,.95)');
    for (let x = 10; x < 100; x += 10) line(x, 0.05, 'rgba(255,255,255,.25)');
    // 트랙 광택 (조명 반사)
    c.globalCompositeOperation = 'lighter';
    const sh = c.createLinearGradient(0, yT1, 0, yT0);
    sh.addColorStop(0, 'rgba(140,160,220,.22)'); sh.addColorStop(0.4, 'rgba(120,130,170,.05)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(0, yT1, W, yT0 - yT1);
    c.globalCompositeOperation = 'source-over';
    // 잔디 (줄무늬)
    let zz = TRACK_Z0;
    for (let i = 0; zz > cam.z + 0.3 && i < 40; i++) {
      const z2 = Math.max(cam.z + 0.3, zz - 3);
      const ya = rowY(0, zz), yb = rowY(0, z2);
      if (ya > H) break;
      c.fillStyle = i % 2 ? '#14301a' : '#183a1f';
      c.fillRect(0, ya, W, Math.min(H, yb) - ya + 1);
      zz = z2;
    }
    const gv = c.createLinearGradient(0, yT0, 0, H);
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = gv; c.fillRect(0, yT0, W, H - yT0);

    // 선수 (먼 레인부터)
    for (let i = LANES - 1; i >= 0; i--) drawRunner(c, i);
  }

  /* ---------- 선수 ---------- */
  const KNEEL = {
    head: [0.13, 0.63], sh: [-0.02, 0.6], hip: [-0.62, 0.5],
    elbN: [-0.01, 0.3], handN: [0, 0], elbF: [0.02, 0.3], handF: [0.03, 0],
    kneeN: [-0.3, 0.3], ankN: [-0.55, 0.09], toeN: [-0.44, 0.01],
    kneeF: [-0.68, 0.05], ankF: [-1.02, 0.14], toeF: [-0.92, 0.01],
  };
  const SET = {
    head: [0.09, 0.69], sh: [-0.06, 0.65], hip: [-0.58, 0.88],
    elbN: [-0.04, 0.33], handN: [0, 0], elbF: [-0.02, 0.33], handF: [0.03, 0],
    kneeN: [-0.27, 0.5], ankN: [-0.52, 0.1], toeN: [-0.41, 0.01],
    kneeF: [-0.78, 0.4], ankF: [-1.13, 0.22], toeF: [-1.03, 0.02],
  };
  const RUNNERS = Array.from({ length: LANES }, (_, i) => ({
    singlet: ['#e8e8ea', '#f2c230', '#1f6fe0', '#d42a2a', '#16a35a', '#f07c1c', '#1a1a1f', '#8a2be2'][i],
    shorts: ['#1a1a1f', '#0a5a2a', '#0b2a6b', '#1a1a1f', '#f2f2f2', '#1a1a1f', '#c8a43a', '#1a1a1f'][i],
    shoe: ['#d7ff3a', '#ff4fa0', '#ffffff', '#3affd2', '#ff7a1a', '#d7ff3a', '#ff3a3a', '#ffffff'][i],
    skin: ['#5a3624', '#7a4a2e', '#3e2418', '#8d5a3b', '#4a2c1c', '#b07a52', '#352015', '#6a4028'][i],
    rt: rand(0.12, 0.17), vmax: rand(11.3, 12.1), tau: rand(1.1, 1.4), bob: rand(0, 6),
  }));

  function runPose(ph, lean) {
    const hipY = 0.97 + 0.03 * Math.cos(ph * 2);
    const hip = [0, hipY];
    const sh = [0.55 * Math.sin(lean), hipY + 0.55 * Math.cos(lean)];
    const head = [sh[0] + 0.18 * Math.sin(lean + 0.2), sh[1] + 0.18 * Math.cos(lean + 0.2)];
    const leg = p => {
      const a = 0.7 * Math.sin(p) + 0.12 + lean * 0.25;
      const bend = 0.25 + 1.5 * Math.max(0, Math.cos(p));
      const knee = [hip[0] + 0.46 * Math.sin(a), hip[1] - 0.46 * Math.cos(a)];
      const sa = a - bend;
      const ank = [knee[0] + 0.46 * Math.sin(sa), knee[1] - 0.46 * Math.cos(sa)];
      const toe = [ank[0] + 0.17 * Math.cos(sa), ank[1] + 0.17 * Math.sin(sa)];
      return [knee, ank, toe];
    };
    const arm = p => {
      const ua = -0.85 * Math.sin(p) + lean * 0.4;
      const elb = [sh[0] + 0.3 * Math.sin(ua), sh[1] - 0.3 * Math.cos(ua)];
      const fa = ua + 1.45;
      return [elb, [elb[0] + 0.27 * Math.sin(fa), elb[1] - 0.27 * Math.cos(fa)]];
    };
    const [kneeN, ankN, toeN] = leg(ph), [kneeF, ankF, toeF] = leg(ph + Math.PI);
    const [elbN, handN] = arm(ph), [elbF, handF] = arm(ph + Math.PI);
    return { head, sh, hip, elbN, handN, elbF, handF, kneeN, ankN, toeN, kneeF, ankF, toeF };
  }

  function shade(hex, k) { // k<0 어둡게, k>0 밝게
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = k < 0 ? 0 : 255, a = Math.abs(k);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return `rgb(${r},${g},${b})`;
  }

  function raceState(R, t) {
    const tt = t - R.rt;
    if (tt <= 0) return { d: 0, tt };
    let d = R.vmax * (tt - R.tau * (1 - Math.exp(-tt / R.tau)));
    if (d > 100) d = 100 + 22 * (1 - Math.exp(-(d - 100) / 22));
    return { d, tt };
  }

  function drawRunner(c, i) {
    const R = RUNNERS[i];
    const z = TRACK_Z0 + 0.25 + LANE * (i + 0.5);
    let J, rootX = 0;
    const setP = {};
    for (const k in SET) setP[k] = [lerp(KNEEL[k][0], SET[k][0], S.pose), lerp(KNEEL[k][1], SET[k][1], S.pose)];
    const breath = Math.sin(S.time * 1.7 + R.bob) * 0.006;
    for (const k of ['head', 'sh', 'hip']) setP[k][1] += breath;

    if (S.race) {
      const t = S.race.t;
      const { d, tt } = raceState(R, t);
      if (tt <= 0) J = setP;
      else {
        const lean = 0.95 * Math.exp(-tt / 0.8) + 0.16;
        const ph = Math.PI * 2 * (d / 4.4 + 0.5 * (1 - Math.exp(-d / 5))) - 0.6;
        const run = runPose(ph, lean);
        const k = clamp(tt / 0.28, 0, 1);
        J = {};
        for (const key in run) J[key] = [lerp(setP[key][0], run[key][0] - 0.58 + d, k), lerp(setP[key][1], run[key][1], k)];
      }
    } else J = setP;

    const p0 = P(rootX, 0, z), s = p0[2];
    if (p0[0] < -400 || p0[0] > W + 400 + s * 120) { /* 화면 밖 */ }
    const X = j => p0[0] + j[0] * s, Y = j => p0[1] - j[1] * s;

    // 스타팅 블록
    if (!S.race || S.race.t < 1.2) {
      c.fillStyle = '#1b1d22';
      const bx = [-0.5, -1.1], fy = 0.0;
      for (const b of bx) { c.fillRect(X([b - 0.06, 0]), Y([0, 0.14]), 0.16 * s, 0.14 * s); }
      c.fillRect(X([-1.15, 0]), Y([0, 0.03]), 0.7 * s, 0.03 * s + 0.5);
    }
    const skin = shade(R.skin, -0.42), rim = shade(R.skin, 0.3);
    const off = Math.max(0.6, 0.011 * s);
    const limb = (a, b, w, col, rimCol) => {
      c.lineWidth = w * s;
      c.strokeStyle = rimCol; c.beginPath(); c.moveTo(X(a), Y(a) - off); c.lineTo(X(b), Y(b) - off); c.stroke();
      c.strokeStyle = col; c.beginPath(); c.moveTo(X(a), Y(a)); c.lineTo(X(b), Y(b)); c.stroke();
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    const far = 0.55;
    // 먼 쪽 팔다리
    limb(J.hip, J.kneeF, 0.16, shade(R.skin, -far), shade(R.skin, 0.1));
    limb(J.kneeF, J.ankF, 0.11, shade(R.skin, -far), shade(R.skin, 0.1));
    limb(J.ankF, J.toeF, 0.07, shade(R.shoe, -0.45), shade(R.shoe, -0.2));
    limb(J.sh, J.elbF, 0.09, shade(R.skin, -far), shade(R.skin, 0.1));
    limb(J.elbF, J.handF, 0.075, shade(R.skin, -far), shade(R.skin, 0.1));
    // 몸통
    limb(J.hip, J.sh, 0.27, shade(R.singlet, -0.5), shade(R.singlet, 0.15));
    const mid = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    limb(J.hip, mid(J.hip, J.kneeF, 0.4), 0.19, shade(R.shorts, -0.3), shade(R.shorts, 0.2));
    // 머리
    c.fillStyle = rim; c.beginPath(); c.arc(X(J.head), Y(J.head) - off, 0.105 * s, 0, 7); c.fill();
    c.fillStyle = skin; c.beginPath(); c.arc(X(J.head), Y(J.head), 0.105 * s, 0, 7); c.fill();
    // 가까운 쪽 팔다리
    limb(J.hip, J.kneeN, 0.17, skin, rim);
    limb(J.hip, mid(J.hip, J.kneeN, 0.42), 0.2, shade(R.shorts, -0.2), shade(R.shorts, 0.3));
    limb(J.kneeN, J.ankN, 0.115, skin, rim);
    limb(J.ankN, J.toeN, 0.075, shade(R.shoe, -0.15), shade(R.shoe, 0.3));
    limb(J.sh, J.elbN, 0.095, skin, rim);
    limb(J.elbN, J.handN, 0.08, skin, rim);
    // 레인 번호 비브
    if (s > 30) {
      const bp = mid(J.hip, J.sh, 0.55);
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.fillRect(X(bp) - 0.07 * s, Y(bp) - 0.06 * s, 0.14 * s, 0.11 * s);
      c.fillStyle = '#111'; c.font = `700 ${0.09 * s}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(i + 1), X(bp), Y(bp) - 0.005 * s);
    }
  }

  /* ---------- 스타터 클로즈업 ---------- */
  function drawStarter(c) {
    const k = S.starterK;
    const u = H * 0.95 * (1 + 0.06 * k);
    const ox = W * 0.6 + (1 - k) * W * 0.02, oy = H * 1.02;
    const pt = (x, y) => [ox + x * u, oy + y * u];
    const body = '#07080c', rimc = 'rgba(160,185,230,.6)';
    const path = (pts, close = true) => {
      c.beginPath(); c.moveTo(...pt(...pts[0]));
      for (let i = 1; i < pts.length; i++) {
        const q = pts[i];
        if (q.length === 6) c.bezierCurveTo(...pt(q[0], q[1]), ...pt(q[2], q[3]), ...pt(q[4], q[5]));
        else c.lineTo(...pt(q[0], q[1]));
      }
      if (close) c.closePath();
    };
    const shapes = [];
    // 몸통 (재킷)
    shapes.push(() => path([[-0.36, 0.05], [-0.33, -0.3, -0.26, -0.45, -0.16, -0.5], [-0.05, -0.53], [0.06, -0.53],
      [0.16, -0.5, 0.24, -0.47, 0.26, -0.38], [0.3, -0.2, 0.32, -0.05, 0.34, 0.05]]));
    // 목, 머리, 모자
    shapes.push(() => { c.beginPath(); c.ellipse(...pt(0.0, -0.56), 0.055 * u, 0.05 * u, 0, 0, 7); });
    shapes.push(() => { c.beginPath(); c.ellipse(...pt(-0.005, -0.64), 0.07 * u, 0.085 * u, 0, 0, 7); });
    shapes.push(() => path([[-0.08, -0.68], [-0.07, -0.76, 0.05, -0.77, 0.07, -0.69], [0.07, -0.67], [-0.17, -0.665], [-0.15, -0.685]]));
    // 들어 올린 오른팔 + 신호총
    shapes.push(() => path([[0.17, -0.5], [0.24, -0.6, 0.27, -0.66, 0.27, -0.74], [0.25, -0.86], [0.205, -0.86], [0.21, -0.74], [0.2, -0.66, 0.15, -0.6, 0.1, -0.53]]));
    shapes.push(() => { c.beginPath(); c.ellipse(...pt(0.228, -0.885), 0.03 * u, 0.04 * u, 0.1, 0, 7); });
    shapes.push(() => path([[0.215, -0.9], [0.215, -1.02], [0.236, -1.02], [0.24, -0.9], [0.255, -0.89], [0.25, -0.87], [0.2, -0.87]]));
    // 귀를 막은 왼팔
    shapes.push(() => path([[-0.15, -0.53], [-0.29, -0.6], [-0.1, -0.695], [-0.065, -0.64], [-0.215, -0.585], [-0.14, -0.47]]));

    c.save();
    c.translate(-0.0025 * u, -0.003 * u);
    c.fillStyle = rimc; shapes.forEach(s => { s(); c.fill(); });
    c.restore();
    c.fillStyle = body; shapes.forEach(s => { s(); c.fill(); });
    // 재킷 디테일
    c.strokeStyle = 'rgba(200,40,40,.35)'; c.lineWidth = 0.006 * u;
    c.beginPath(); c.moveTo(...pt(-0.03, -0.52)); c.lineTo(...pt(-0.02, 0.05)); c.stroke();
  }

  /* ---------- 루프 ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    S.time += dt;
    if (S.race) {
      S.race.t = (now - S.race.t0) / 1000;
      if (S.follow) {
        let lead = 0;
        for (const R of RUNNERS) lead = Math.max(lead, raceState(R, S.race.t).d);
        const target = clamp(lead - 0.6, -0.6, 104);
        cam.x += (target - cam.x) * Math.min(1, dt * 2.6);
      }
    }
    if (Stadium.onFrame) Stadium.onFrame(dt);
    drawBG(dt); drawFG();
    requestAnimationFrame(frame);
  }

  function init() {
    resize(); buildCrowd();
    glowCool = glow('210,225,255'); glowWarm = glow('255,215,160');
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  return {
    init, cam, S,
    startRace() { S.race = { t0: performance.now(), t: 0 }; },
    resetRace() { S.race = null; },
    blur(bg, fg) { bgC.style.filter = bg ? `blur(${bg}px)` : 'none'; fgC.style.filter = fg ? `blur(${fg}px)` : 'none'; },
  };
})();
