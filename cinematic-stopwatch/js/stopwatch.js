/* 손에 쥔 기계식 스톱워치 (SVG) + 7-세그먼트 LCD */
const Watch = (() => {
  const svg = document.getElementById('watchSvg');
  const NS = 'http://www.w3.org/2000/svg';
  const CX = 400, CY = 395, RX = 212, RY = 222;

  /* ---------- 유틸 ---------- */
  const bez = (p, t) => {
    const u = 1 - t;
    return [0, 1].map(i => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]);
  };
  const bezD = (p, t) => {
    const u = 1 - t;
    return [0, 1].map(i => 3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i]));
  };
  const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const dStr = p => `M${p[0]} C${p[1]} ${p[2]} ${p[3]}`;
  const deg = v => Math.atan2(v[1], v[0]) * 180 / Math.PI;
  const edge = th => { const a = th * Math.PI / 180; return [CX + RX * Math.sin(a), CY - RY * Math.cos(a)]; };

  /* ---------- 손가락(튜브 셰이딩) ---------- */
  function finger(p, w, o = {}) {
    const d = dStr(p);
    const tip = p[3], dir = norm(bezD(p, 0.98)), nrm = [-dir[1], dir[0]];
    const nOff = o.nailSide || 0;
    const nc = [tip[0] - dir[0] * w * 0.3 + nrm[0] * w * nOff, tip[1] - dir[1] * w * 0.3 + nrm[1] * w * nOff];
    const ang = deg(dir);
    let creases = '';
    for (const t of (o.creases || [0.45, 0.72])) {
      const q = bez(p, t), dd = norm(bezD(p, t)), nn = [-dd[1], dd[0]], L = w * 0.26;
      creases += `<path d="M${q[0] - nn[0] * L} ${q[1] - nn[1] * L} Q${q[0] + dd[0] * 4} ${q[1] + dd[1] * 4} ${q[0] + nn[0] * L} ${q[1] + nn[1] * L}" stroke="rgba(120,55,35,.35)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    }
    const sh = o.shadow === false ? '' :
      `<path d="${d}" stroke="rgba(0,0,0,.55)" stroke-width="${w * 0.95}" fill="none" stroke-linecap="round" transform="translate(${o.sx ?? 8} ${o.sy ?? 12})" filter="url(#fBlur8)"/>`;
    return `${sh}
      <path d="${d}" stroke="#8a4e36" stroke-width="${w + 3}" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="url(#skinTube)" stroke-width="${w}" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#e6ad8c" stroke-width="${w * 0.62}" fill="none" stroke-linecap="round" transform="translate(${-w * 0.1} ${-w * 0.1})" filter="url(#fBlur3)"/>
      <path d="${d}" stroke="#f9dcc6" stroke-width="${w * 0.2}" fill="none" stroke-linecap="round" opacity=".55" transform="translate(${-w * 0.2} ${-w * 0.2})" filter="url(#fBlur3)"/>
      ${creases}
      ${o.nail === false ? '' : `<g transform="translate(${nc[0]} ${nc[1]}) rotate(${ang})">
        <ellipse rx="${w * 0.33}" ry="${w * 0.28}" fill="#efc3ae" stroke="rgba(150,80,60,.45)" stroke-width="1.5"/>
        <ellipse cx="${w * 0.2}" rx="${w * 0.1}" ry="${w * 0.24}" fill="#fbe8dc" opacity=".9"/>
        <ellipse cx="${-w * 0.08}" cy="${-w * 0.08}" rx="${w * 0.14}" ry="${w * 0.06}" fill="#fff" opacity=".55"/>
      </g>`}`;
  }

  /* ---------- 7-세그먼트 ---------- */
  function segPolys(w, h, t) {
    const g = t * 0.16, ht = t / 2;
    const Hs = (x1, x2, y) => [[x1 + g, y], [x1 + ht + g, y - ht], [x2 - ht - g, y - ht], [x2 - g, y], [x2 - ht - g, y + ht], [x1 + ht + g, y + ht]];
    const Vs = (x, y1, y2) => [[x, y1 + g], [x + ht, y1 + ht + g], [x + ht, y2 - ht - g], [x, y2 - g], [x - ht, y2 - ht - g], [x - ht, y1 + ht + g]];
    const L = ht, R = w - ht, T = ht, M = h / 2, Bt = h - ht;
    return { a: Hs(L, R, T), b: Vs(R, T, M), c: Vs(R, M, Bt), d: Hs(L, R, Bt), e: Vs(L, M, Bt), f: Vs(L, T, M), g: Hs(L, R, M) };
  }
  const MAP = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };
  const digits = [];
  function makeDigit(parent, x, y, w, h, t) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y}) skewX(-7)`);
    const polys = segPolys(w, h, t), seg = {};
    for (const k in polys) {
      const pts = polys[k].map(p => p.join(',')).join(' ');
      const sh = document.createElementNS(NS, 'polygon');
      sh.setAttribute('points', pts); sh.setAttribute('class', 'segsh'); sh.setAttribute('transform', 'translate(2.2 2.6)');
      const s = document.createElementNS(NS, 'polygon');
      s.setAttribute('points', pts); s.setAttribute('class', 'seg');
      g.appendChild(sh); g.appendChild(s);
      seg[k] = [s, sh];
    }
    parent.appendChild(g);
    const d = { seg, val: null, set(v) {
      if (v === this.val) return; this.val = v;
      const on = MAP[v];
      for (const k in seg) { const c = on.includes(k); seg[k][0].classList.toggle('on', c); seg[k][1].classList.toggle('on', c); }
    } };
    digits.push(d); return d;
  }

  /* ---------- SVG 조립 ---------- */
  function build() {
    const btn = (id, th, w, label) => {
      const e = edge(th);
      return `<g transform="translate(${e[0]} ${e[1]}) rotate(${th})">
        <rect x="${-w / 2 - 8}" y="-16" width="${w + 16}" height="34" rx="10" fill="#0c0c0e"/>
        <g id="${id}">
          <rect x="${-w / 2}" y="-38" width="${w}" height="44" rx="9" fill="url(#capSide)"/>
          <rect x="${-w / 2 + 4}" y="-38" width="${w - 8}" height="9" rx="4.5" fill="rgba(255,255,255,.16)"/>
          <rect x="${-w / 2}" y="-38" width="${w}" height="44" rx="9" fill="none" stroke="rgba(255,255,255,.08)"/>
        </g>
      </g>`;
    };

    // 손가락 경로 (베지어) — back: 손바닥에서 나와 본체 왼쪽을 감싸는 부분, tip: 본체 앞면에 걸치는 끝마디
    const P_INDEX_BASE = [[330, 430], [240, 425], [158, 395], [154, 334]];
    const P_INDEX_TIP = [[154, 336], [148, 282], [174, 224], [210, 192]];
    const P_MIDDLE = [[330, 520], [230, 535], [150, 492], [158, 436]];
    const P_MIDDLE_TIP = [[158, 438], [168, 414], [194, 405], [222, 410]];
    const P_RING = [[360, 600], [260, 615], [186, 578], [193, 527]];
    const P_RING_TIP = [[193, 529], [204, 508], [228, 502], [250, 507]];
    const P_PINKY = [[400, 650], [310, 672], [244, 642], [250, 600]];
    const P_PINKY_TIP = [[250, 602], [262, 586], [282, 582], [300, 586]];
    const P_THUMB_BASE = [[590, 680], [668, 630], [676, 450], [648, 348]];
    const P_THUMB_TIP = [[648, 350], [634, 292], [606, 232], [574, 197]];

    svg.innerHTML = `
    <defs>
      <radialGradient id="bodyGrad" cx="38%" cy="30%" r="80%">
        <stop offset="0" stop-color="#3a3b40"/><stop offset=".45" stop-color="#16171a"/><stop offset="1" stop-color="#020203"/>
      </radialGradient>
      <radialGradient id="faceGrad" cx="45%" cy="35%" r="75%">
        <stop offset="0" stop-color="#232428"/><stop offset=".7" stop-color="#0f1012"/><stop offset="1" stop-color="#060607"/>
      </radialGradient>
      <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="lcdGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a9b39e"/><stop offset=".25" stop-color="#c9d1bd"/><stop offset="1" stop-color="#b6bfa9"/>
      </linearGradient>
      <linearGradient id="lcdGlare" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".35" stop-color="#fff" stop-opacity=".06"/>
        <stop offset=".36" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="capSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#101012"/><stop offset=".3" stop-color="#3a3b40"/><stop offset=".55" stop-color="#26272b"/><stop offset="1" stop-color="#08080a"/>
      </linearGradient>
      <radialGradient id="palmGrad" cx="55%" cy="35%" r="70%">
        <stop offset="0" stop-color="#eebf9f"/><stop offset=".6" stop-color="#d79c7a"/><stop offset="1" stop-color="#a86a4d"/>
      </radialGradient>
      <linearGradient id="skinTube" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2a988"/><stop offset="1" stop-color="#c0805f"/>
      </linearGradient>
      <linearGradient id="armShade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#5a2a18" stop-opacity=".25"/><stop offset="1" stop-color="#2a120a" stop-opacity=".5"/>
      </linearGradient>
      <linearGradient id="sleeveGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1d2a4d"/><stop offset="1" stop-color="#070c1a"/>
      </linearGradient>
      <filter id="fBlur3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="fBlur8" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="fBlur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
      <filter id="lcdInset"><feGaussianBlur stdDeviation="4"/></filter>
      <clipPath id="lcdClip"><rect x="258" y="318" width="284" height="128" rx="14"/></clipPath>
      <clipPath id="bodyClip"><ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}"/></clipPath>
    </defs>

    <!-- 뒤쪽: 팔, 소매, 손바닥 -->
    <g id="handBack">
      <!-- 팔뚝 + 소매 -->
      <path d="M560 700 C620 650 700 610 745 612 L1180 1080 L900 1240 Z" fill="url(#palmGrad)"/>
      <path d="M560 700 C620 650 700 610 745 612 L1180 1080 L900 1240 Z" fill="url(#armShade)"/>
      <path d="M842 780 L1000 930 L1500 1400 L1300 1600 L700 940 Z" fill="url(#sleeveGrad)"/>
      <path d="M842 780 L700 940" stroke="rgba(0,0,0,.5)" stroke-width="26" filter="url(#fBlur8)"/>
      <path d="M865 805 L725 962" stroke="#e8ecf5" stroke-width="9" opacity=".85"/>
      <path d="M890 832 L752 988" stroke="#e8ecf5" stroke-width="4" opacity=".6"/>
      <!-- 손바닥 -->
      <path d="M220 540 C210 640 320 720 470 735 C560 744 640 725 700 690 C760 650 760 560 700 520 C600 450 330 430 220 540Z" fill="url(#palmGrad)"/>
      <path d="M470 728 C580 735 660 712 710 670" stroke="rgba(255,228,205,.4)" stroke-width="12" fill="none" filter="url(#fBlur8)"/>
      <path d="M300 690 C380 728 470 738 540 732" stroke="rgba(120,60,40,.35)" stroke-width="6" fill="none" filter="url(#fBlur3)"/>
      ${finger(P_PINKY, 46, { nail: false, shadow: false, creases: [0.62] })}
      ${finger(P_RING, 54, { nail: false, shadow: false, creases: [0.64] })}
      ${finger(P_MIDDLE, 58, { nail: false, shadow: false, creases: [0.64] })}
      <g id="indexBase">${finger(P_INDEX_BASE, 58, { nail: false, shadow: false, creases: [0.66] })}</g>
    </g>

    <!-- 스톱워치 버튼 (본체 뒤) -->
    ${btn('capSplit', -44, 70)}
    ${btn('capStart', 44, 70)}
    ${btn('capMode', 0, 52)}

    <!-- 스트랩 고리 -->
    <path d="M385 610 C380 700 360 760 330 900" stroke="#0b0b0c" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M415 610 C420 700 430 780 470 920" stroke="#111113" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M383 640 C378 700 362 760 336 880" stroke="rgba(255,255,255,.12)" stroke-width="3" fill="none"/>
    <rect x="368" y="596" width="64" height="40" rx="12" fill="#0d0d0f"/>

    <!-- 본체 -->
    <ellipse cx="${CX + 6}" cy="${CY + 14}" rx="${RX}" ry="${RY}" fill="rgba(0,0,0,.5)" filter="url(#fBlur8)"/>
    <ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}" fill="url(#bodyGrad)"/>
    <ellipse cx="${CX}" cy="${CY}" rx="${RX - 3}" ry="${RY - 3}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
    <ellipse cx="${CX}" cy="${CY + 6}" rx="${RX - 22}" ry="${RY - 24}" fill="url(#faceGrad)"/>
    <ellipse cx="${CX}" cy="${CY + 6}" rx="${RX - 22}" ry="${RY - 24}" fill="none" stroke="rgba(0,0,0,.8)" stroke-width="3"/>

    <!-- 인쇄 라벨 -->
    <g font-family="Arial Black, Arial, sans-serif" font-weight="900" text-anchor="middle">
      <text x="400" y="240" fill="#f0f0f0" font-size="15" letter-spacing="1">MODE</text>
      <g transform="translate(268 262) rotate(-40)"><text fill="#f0f0f0" font-size="14" y="-6">SPLIT</text><text fill="#f0f0f0" font-size="14" y="10">RESET</text></g>
      <g transform="translate(532 262) rotate(40)"><text fill="#f0f0f0" font-size="14" y="-6">START</text><text fill="#f0f0f0" font-size="14" y="10">STOP</text></g>
      <text x="400" y="282" fill="#e3342f" font-size="26" font-style="italic" letter-spacing="1" font-family="Georgia, serif">Timekeeper</text>
      <g fill="#4aa3ff" font-size="12" font-family="Arial, sans-serif" font-weight="700">
        ${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d, i) => `<text x="${286 + i * 38}" y="308">${d}</text>`).join('')}
      </g>
    </g>
    <!-- 빨강/파랑 액센트 프레임 -->
    <path d="M246 330 Q246 314 262 312 L538 312 Q554 314 554 330" stroke="#e3342f" stroke-width="4" fill="none"/>
    <path d="M246 432 Q246 452 266 452 L534 452 Q554 452 554 432" stroke="#e3342f" stroke-width="4" fill="none"/>
    <path d="M246 352 L246 410 M554 352 L554 410" stroke="#e3342f" stroke-width="4"/>

    <!-- LCD -->
    <rect x="252" y="314" width="296" height="138" rx="18" fill="#050506"/>
    <rect x="258" y="318" width="284" height="128" rx="14" fill="url(#lcdGrad)"/>
    <g clip-path="url(#lcdClip)">
      <rect x="258" y="318" width="284" height="128" rx="14" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="14" filter="url(#lcdInset)"/>
      <g id="lcdDays"></g>
      <g id="lcdDigits"></g>
      <text id="lcdSplit" class="lcdtxt" x="486" y="350">SPLIT</text>
      <text id="lcdRun" class="lcdtxt" x="272" y="350">RUN</text>
      <rect x="258" y="318" width="284" height="128" fill="url(#lcdGlare)"/>
    </g>

    <!-- 하단 인쇄 -->
    <g font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">
      <text x="400" y="476" fill="#f0f0f0" font-size="13" letter-spacing="1">■STOP W  ■DATE  ■TIME</text>
      <text x="400" y="499" fill="#4aa3ff" font-size="12" letter-spacing="2">WATER <tspan fill="#e3342f">◆</tspan> RESIST</text>
      <text x="400" y="538" fill="#f4f4f4" font-size="30" font-family="Arial Black, Arial, sans-serif" font-weight="900" letter-spacing="1">TK-100</text>
      <g fill="#4aa3ff">
        <path d="M268 466 l18 0 l-5 10 l-18 0z"/><path d="M292 466 l18 0 l-5 10 l-18 0z"/>
        <path d="M532 466 l-18 0 l5 10 l18 0z"/><path d="M508 466 l-18 0 l5 10 l18 0z"/>
      </g>
    </g>
    <!-- 광택 -->
    <ellipse cx="${CX - 40}" cy="${CY - 120}" rx="${RX - 60}" ry="80" fill="url(#gloss)" clip-path="url(#bodyClip)"/>

    <!-- 앞쪽 손가락 -->
    <g id="fingersFront">
      ${finger(P_PINKY_TIP, 46, { creases: [], sx: 6, sy: 8 })}
      ${finger(P_RING_TIP, 54, { creases: [], sx: 6, sy: 8 })}
      ${finger(P_MIDDLE_TIP, 58, { creases: [], sx: 6, sy: 8 })}
      <g id="indexF"><g id="indexTip">${finger(P_INDEX_TIP, 56, { creases: [0.4], sx: 10, sy: 8 })}</g></g>
      <g id="thumb">
        ${finger(P_THUMB_BASE, 82, { nail: false, creases: [], sx: -10, sy: 12 })}
        <g id="thumbTip">${finger(P_THUMB_TIP, 76, { creases: [0.3], nailSide: -0.2, sx: -12, sy: 10 })}</g>
      </g>
    </g>`;

    // LCD 요소
    const days = svg.querySelector('#lcdDays');
    const today = new Date().getDay();
    for (let i = 0; i < 7; i++) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', 276 + i * 38); r.setAttribute('y', 326); r.setAttribute('width', 22); r.setAttribute('height', 5); r.setAttribute('rx', 1);
      r.setAttribute('class', 'seg' + (i === today ? ' on' : ''));
      days.appendChild(r);
    }
    const dg = svg.querySelector('#lcdDigits');
    const big = { w: 40, h: 74, t: 10 }, sm = { w: 24, h: 44, t: 7 };
    makeDigit(dg, 278, 366, big.w, big.h, big.t);
    makeDigit(dg, 324, 366, big.w, big.h, big.t);
    makeDigit(dg, 384, 366, big.w, big.h, big.t);
    makeDigit(dg, 430, 366, big.w, big.h, big.t);
    makeDigit(dg, 478, 396, sm.w, sm.h, sm.t);
    makeDigit(dg, 505, 396, sm.w, sm.h, sm.t);
    const colon = document.createElementNS(NS, 'g');
    colon.innerHTML = `<rect class="segsh on" x="372" y="386" width="8" height="8" transform="translate(2 2)"/><rect class="seg on" x="372" y="386" width="8" height="8"/>
      <rect class="segsh on" x="368" y="416" width="8" height="8" transform="translate(2 2)"/><rect class="seg on" x="368" y="416" width="8" height="8"/>`;
    dg.appendChild(colon);
  }

  /* ---------- 표시 ---------- */
  function show(ms) {
    const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
    let v;
    if (h < 1) v = [m >= 10 ? Math.floor(m / 10) : ' ', m % 10, Math.floor(s / 10), s % 10, Math.floor(cs / 10), cs % 10];
    else v = [h >= 10 ? Math.floor(h / 10) % 10 : ' ', h % 10, Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10];
    v.forEach((x, i) => digits[i].set(String(x)));
  }
  function flag(id, mode) { // mode: false | 'on' | 'blink'
    const el = svg.querySelector(id);
    el.classList.toggle('on', !!mode); el.classList.toggle('blink', mode === 'blink');
  }

  /* ---------- 손가락 프레스 ---------- */
  const rig = document.getElementById('rig');
  let busy = Promise.resolve();
  function press(which, onContact) {
    busy = busy.then(() => new Promise(res => {
      const cls = which === 'start' ? 'press-start' : 'press-split';
      rig.classList.remove('release');
      rig.classList.add(cls);
      setTimeout(() => {
        onContact && onContact();
        setTimeout(() => {
          rig.classList.add('release'); rig.classList.remove(cls);
          setTimeout(res, 120);
        }, 90);
      }, 100);
    }));
    return busy;
  }

  build(); show(0);
  return { show, flag, press };
})();
