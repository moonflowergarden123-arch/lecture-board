/* ==========================================================================
   2028 대입 준비 가상 전시관
   Three.js scene + UI · 더콘텐츠스쿨 / 오현주 강사
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var DATA_URL = 'gallery-data.json';
  var ROOM = { W: 11.2, H: 4.6, Z0: 4.4, Z1: -76.0 };
  var EYE = 1.62;
  var FRAME_W = 2.2, FRAME_H = 1.65, FRAME_Y = 1.98, SPACING = 5.0, FIRST_Z = -6.0;

  var state = {
    data: null,
    grade: 'm3',
    current: 0,
    entered: false,
    ready: false,
    modal: null,
    quiz: { answers: [null, null], checked: false },
    autoNear: {},
    nearT: {},
    score: 0
  };

  var scene, camera, renderer, clock, pickables = [], frames = [], banners = [];
  var yaw = 0, pitch = 0;
  var keys = {};
  var joy = { active: false, id: null, x: 0, y: 0 };
  var fly = null;
  var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  var frameStats = { t: 0, n: 0 };
  var startPos = new THREE.Vector3(0, EYE, 2.2);

  /* ------------------------------------------------------------------ utils */
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('on'); }, 1900);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // sRGB 색을 렌더러 출력(sRGBEncoding)에 맞게 선형으로 변환
  function C(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function zoneOf(f) { return state.data.meta.zones.filter(function (z) { return z.id === f.zone; })[0]; }
  function todayLabel() {
    var d = new Date();
    return d.getFullYear() + '. ' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getDate());
  }

  /* --------------------------------------------------------------- textures */
  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c: c, x: c.getContext('2d'), w: w, h: h };
  }
  function pot(n) { var p = 1; while (p < n) p *= 2; return p; }
  // power-of-two backing store (mipmaps work on every GPU), drawn in design coordinates
  function mkCanvasPOT(w, h) {
    var cw = pot(w), ch = pot(h);
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    x.setTransform(cw / w, 0, 0, ch / h, 0, 0);
    return { c: c, x: x, w: w, h: h, cw: cw, ch: ch };
  }
  function tex(canvas) {
    var t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
  function roundRect(x, rx, ry, rw, rh, r) {
    x.beginPath();
    x.moveTo(rx + r, ry);
    x.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    x.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    x.arcTo(rx, ry + rh, rx, ry, r);
    x.arcTo(rx, ry, rx + rw, ry, r);
    x.closePath();
  }
  function setFont(x, w, s) { x.font = w + ' ' + s + 'px Paperozi, "Pretendard", -apple-system, "Apple SD Gothic Neo", sans-serif'; }
  function fitFont(x, text, maxW, start, weight, min) {
    var s = start;
    while (s > (min || 14)) {
      setFont(x, weight, s);
      if (x.measureText(text).width <= maxW) break;
      s -= 2;
    }
    return s;
  }
  function wrapLines(x, text, maxW, lh) {
    var words = String(text).split(/\s+/), line = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(t).width > maxW && line) { out.push(line); line = words[i]; }
      else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  var PAL = {
    z0: ['#E3E8DA', '#CBD8C4', '#AFC3A9', '#EDF1E6', '#8FA88C'],
    z1: ['#F2E6C9', '#E4CF9C', '#D2B36C', '#F8F1DF', '#B8934A'],
    z2: ['#F1DDD0', '#E4C5B0', '#D3A383', '#F8ECE3', '#B4755A'],
    z3: ['#DBE4DF', '#BFCFC9', '#9EB5AE', '#EAF0EC', '#6F9089'],
    z4: ['#E6DDE8', '#D1C3D7', '#B9A5C4', '#F1EBF4', '#8C7599'],
    z5: ['#D9E1D4', '#BCCBB7', '#9EB099', '#E9EEE4', '#74906F']
  };
  var ACCENT = { z0: '#1F3D2B', z1: '#8A6A1F', z2: '#8E4B34', z3: '#2E5459', z4: '#5F5470', z5: '#1F3D2B' };

  function brushBackdrop(x, w, h, pal) {
    var g = x.createLinearGradient(0, 0, w * .3, h);
    g.addColorStop(0, pal[3]); g.addColorStop(.55, pal[0]); g.addColorStop(1, pal[1]);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (var i = 0; i < 820; i++) {
      var px = Math.random() * w, py = Math.random() * h;
      var col = pal[Math.floor(Math.random() * pal.length)];
      x.globalAlpha = .05 + Math.random() * .16;
      x.strokeStyle = col;
      x.lineWidth = 2 + Math.random() * 7;
      x.lineCap = 'round';
      var len = 8 + Math.random() * 34, ang = -.5 + Math.random() * 1.0;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      x.stroke();
    }
    x.globalAlpha = 1;
    // soft vignette
    var rg = x.createRadialGradient(w / 2, h / 2, h * .18, w / 2, h / 2, h * .86);
    rg.addColorStop(0, 'rgba(255,252,244,0)');
    rg.addColorStop(1, 'rgba(60,45,25,.20)');
    x.fillStyle = rg; x.fillRect(0, 0, w, h);
  }

  function watermarkTiles(x, w, h) {
    x.save();
    x.globalAlpha = .042;
    x.fillStyle = '#2A2620';
    setFont(x, 700, 24);
    x.rotate(-0.34);
    for (var yy = -h; yy < h * 2; yy += 170) {
      for (var xx = -w; xx < w * 2; xx += 420) {
        x.fillText('더콘텐츠스쿨 · 오현주', xx, yy);
      }
    }
    x.restore();
  }

  function makeArtwork(f) {
    var W = 1024, H = 768;
    var o = mkCanvasPOT(W, H), x = o.x;
    var pal = PAL[f.zone] || PAL.z1, accent = ACCENT[f.zone] || '#1F3D2B';
    brushBackdrop(x, W, H, pal);

    // print panel
    x.save();
    x.shadowColor = 'rgba(40,30,15,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 6;
    x.fillStyle = 'rgba(255,253,247,.945)';
    roundRect(x, 52, 46, W - 104, H - 92, 4); x.fill();
    x.restore();
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(200,155,60,.55)';
    roundRect(x, 52, 46, W - 104, H - 92, 4); x.stroke();
    roundRect(x, 66, 60, W - 132, H - 120, 2); x.stroke();
    x.lineWidth = .8; x.strokeStyle = 'rgba(200,155,60,.28)';
    roundRect(x, 74, 68, W - 148, H - 136, 2); x.stroke();

    var L = 112, R = W - 112, TOP = 132, art = f.art || {};

    // top label
    setFont(x, 700, 18);
    x.fillStyle = accent; x.globalAlpha = .8;
    x.fillText((art.tag || (zoneOf(f) || {}).sub || 'GALLERY').toUpperCase(), L, TOP - 32);
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(200,155,60,.7)'; x.fillRect(L, TOP - 22, 44, 2);

    if (art.kind === 'columns') {
      var cols = art.columns || [], cw = (R - L) / cols.length;
      cols.forEach(function (c, i) {
        var cx = L + cw * i, cwid = cw - 34;
        setFont(x, 800, 54); x.fillStyle = accent; x.fillText(c.head, cx, TOP + 62);
        setFont(x, 600, 20); x.fillStyle = 'rgba(200,155,60,.95)'; x.fillText(c.sub, cx, TOP + 96);
        x.fillStyle = 'rgba(200,155,60,.5)'; x.fillRect(cx, TOP + 114, cwid, 1.4);
        (c.lines || []).forEach(function (ln, j) {
          setFont(x, 500, 25); x.fillStyle = '#4A4238';
          var fs = fitFont(x, ln, cwid - 20, 25, 500, 17);
          setFont(x, 500, fs);
          x.fillStyle = 'rgba(200,155,60,.9)';
          x.beginPath(); x.arc(cx + 5, TOP + 152 + j * 46, 3.4, 0, 6.2832); x.fill();
          x.fillStyle = '#4A4238';
          x.fillText(ln, cx + 18, TOP + 159 + j * 46);
        });
      });
      x.fillStyle = 'rgba(42,38,32,.08)';
      x.fillRect(L, H - 150, R - L, 1);
      var cap = [f.title, f.summary].filter(Boolean).join('  ·  ');
      var cfs = fitFont(x, cap, R - L, 22, 600, 13);
      setFont(x, 600, cfs); x.fillStyle = '#6E6659';
      x.fillText(cap, L, H - 108);
    } else if (art.kind === 'triptych') {
      var its = art.items || [], iw = (R - L - 40) / its.length;
      its.forEach(function (it, i) {
        var ix = L + i * (iw + 20);
        x.fillStyle = 'rgba(247,239,221,.9)';
        roundRect(x, ix, TOP + 4, iw, 372, 6); x.fill();
        x.strokeStyle = 'rgba(200,155,60,.4)'; x.lineWidth = 1; x.stroke();
        setFont(x, 800, 26); x.fillStyle = 'rgba(200,155,60,.95)';
        x.fillText(it.num, ix + 22, TOP + 50);
        setFont(x, 800, 34); x.fillStyle = accent;
        var hs = fitFont(x, it.head, iw - 44, 34, 800, 20);
        setFont(x, 800, hs);
        x.fillText(it.head, ix + 22, TOP + 104);
        x.fillStyle = 'rgba(200,155,60,.55)'; x.fillRect(ix + 22, TOP + 122, iw - 44, 1.2);
        (it.lines || []).forEach(function (ln, j) {
          var fs2 = fitFont(x, ln, iw - 44, 23, 500, 15);
          setFont(x, 500, fs2); x.fillStyle = '#4A4238';
          x.fillText(ln, ix + 22, TOP + 166 + j * 40);
        });
      });
    } else if (art.kind === 'stat') {
      setFont(x, 800, 250); x.fillStyle = accent;
      x.fillText(art.big, L - 6, TOP + 250);
      var bw = x.measureText(art.big).width;
      setFont(x, 700, 54); x.fillStyle = 'rgba(200,155,60,.95)';
      x.fillText(art.unit, L + bw + 16, TOP + 246);
      x.fillStyle = 'rgba(42,38,32,.1)'; x.fillRect(L, TOP + 292, R - L, 1.2);
      (art.lines || []).forEach(function (ln, j) {
        setFont(x, 600, 34); x.fillStyle = '#3A342B';
        x.fillText(ln, L, TOP + 348 + j * 52);
      });
    } else if (art.kind === 'bars') {
      var bars = art.bars || [];
      bars.forEach(function (b, i) {
        var by = TOP + 26 + i * 92;
        setFont(x, 700, 30); x.fillStyle = accent;
        x.fillText(b.label, L, by + 12);
        setFont(x, 600, 22); x.fillStyle = '#6E6659';
        x.fillText(b.range, L, by + 42);
        var bx = L + 210, bmax = R - bx - 10, bw2 = bmax * (b.w / 32);
        x.fillStyle = 'rgba(42,38,32,.07)'; roundRect(x, bx, by - 12, bmax, 26, 13); x.fill();
        var g2 = x.createLinearGradient(bx, 0, bx + bw2, 0);
        g2.addColorStop(0, '#D9B463'); g2.addColorStop(1, '#C89B3C');
        x.fillStyle = g2; roundRect(x, bx, by - 12, Math.max(bw2, 14), 26, 13); x.fill();
      });
    } else if (art.kind === 'rows') {
      (art.rows || []).forEach(function (r, i) {
        var ry = TOP + 40 + i * 118;
        x.fillStyle = 'rgba(200,155,60,.14)';
        x.beginPath(); x.arc(L + 30, ry - 8, 30, 0, 6.2832); x.fill();
        setFont(x, 800, 30); x.fillStyle = '#8A6A1F'; x.textAlign = 'center';
        x.fillText(r.num, L + 30, ry + 3); x.textAlign = 'left';
        setFont(x, 800, 38); x.fillStyle = accent;
        x.fillText(r.head, L + 82, ry + 4);
        setFont(x, 500, 25); x.fillStyle = '#5A5245';
        x.fillText(r.sub, L + 82, ry + 42);
        x.fillStyle = 'rgba(42,38,32,.08)'; x.fillRect(L, ry + 66, R - L, 1);
      });
    } else if (art.kind === 'grid') {
      var items = art.items || [], cols = art.cols || 2;
      var rows = Math.max(1, Math.ceil(items.length / cols));
      var gapX = 24, gapY = 18, gw = (R - L - gapX * (cols - 1)) / cols;
      var gtop = TOP + 24, gbottom = H - 132;
      var ch = (gbottom - gtop - gapY * (rows - 1)) / rows;
      items.forEach(function (nm, i) {
        var gx = L + (i % cols) * (gw + gapX);
        var gy = gtop + Math.floor(i / cols) * (ch + gapY);
        x.fillStyle = 'rgba(247,239,221,.9)';
        roundRect(x, gx, gy, gw, ch, 8); x.fill();
        x.strokeStyle = 'rgba(200,155,60,.35)'; x.lineWidth = 1; x.stroke();
        x.fillStyle = 'rgba(200,155,60,.85)'; x.fillRect(gx + 16, gy + ch / 2 - 15, 4, 30);
        var gfs = fitFont(x, nm, gw - 46, Math.min(30, ch * 0.4), 700, 14);
        setFont(x, 700, gfs); x.fillStyle = accent;
        x.fillText(nm, gx + 30, gy + ch / 2 + gfs * 0.36);
      });
      setFont(x, 700, 17); x.fillStyle = 'rgba(122,114,102,.9)';
      x.fillText((art.foot || '').toUpperCase(), L, H - 104);
    } else if (art.kind === 'poster') {
      setFont(x, 800, 92); x.fillStyle = accent;
      var b2 = fitFont(x, art.big, R - L, 92, 800, 40);
      setFont(x, 800, b2); x.fillText(art.big, L, TOP + 110);
      setFont(x, 700, 22); x.fillStyle = 'rgba(200,155,60,.95)';
      x.fillText((art.unit || '').toUpperCase(), L, TOP + 152);
      x.fillStyle = 'rgba(42,38,32,.1)'; x.fillRect(L, TOP + 182, R - L, 1.2);
      (art.lines || []).forEach(function (ln, j) {
        var fs3 = fitFont(x, ln, R - L, 32, 600, 18);
        setFont(x, 600, fs3); x.fillStyle = '#3A342B';
        x.fillText(ln, L, TOP + 236 + j * 56);
      });
    } else if (art.kind === 'prompt') {
      (art.lines || []).forEach(function (ln, j) {
        var py = TOP + 76 + j * 128;
        x.fillStyle = 'rgba(200,155,60,.14)';
        roundRect(x, L, py - 58, R - L, 100, 10); x.fill();
        setFont(x, 800, 40); x.fillStyle = accent;
        x.fillText(ln, L + 28, py + 6);
      });
      setFont(x, 600, 24); x.fillStyle = '#6E6659';
      x.fillText('COPY & PASTE  ·  결과는 초안, 수치는 원문 확인', L, H - 100);
    } else if (art.kind === 'quiz') {
      setFont(x, 800, 320); x.fillStyle = 'rgba(200,155,60,.9)'; x.textAlign = 'center';
      x.fillText(art.big, W / 2, TOP + 300); x.textAlign = 'left';
      setFont(x, 700, 22); x.fillStyle = accent; x.textAlign = 'center';
      x.fillText((art.lines || []).join('  ·  '), W / 2, TOP + 356); x.textAlign = 'left';
    }

    // corner mark
    setFont(x, 700, 15); x.fillStyle = 'rgba(42,38,32,.42)';
    x.textAlign = 'right';
    x.fillText('NO. ' + pad2(f.no) + ' / 14', R, H - 76);
    x.textAlign = 'left';

    // 금색 액자 테두리(액자 앞면에 그려 넣음)
    var bd = 26;
    x.fillStyle = '#C89B3C';
    x.fillRect(0, 0, W, bd); x.fillRect(0, H - bd, W, bd);
    x.fillRect(0, 0, bd, H); x.fillRect(W - bd, 0, bd, H);
    x.strokeStyle = 'rgba(255,244,214,.55)'; x.lineWidth = 3;
    x.strokeRect(bd / 2, bd / 2, W - bd, H - bd);
    x.strokeStyle = 'rgba(120,86,20,.55)'; x.lineWidth = 3;
    x.strokeRect(bd, bd, W - bd * 2, H - bd * 2);
    x.strokeStyle = 'rgba(255,244,214,.35)'; x.lineWidth = 2;
    x.strokeRect(bd + 3, bd + 3, W - (bd + 3) * 2, H - (bd + 3) * 2);

    watermarkTiles(x, W, H);
    return o.c;
  }

  function makePlaque(f) {
    var o = mkCanvasPOT(768, 190), x = o.x;
    x.fillStyle = '#FBF6EA'; x.fillRect(0, 0, 768, 190);
    x.fillStyle = '#C89B3C'; x.fillRect(0, 0, 8, 190);
    x.strokeStyle = 'rgba(200,155,60,.45)'; x.lineWidth = 2; x.strokeRect(1, 1, 766, 188);
    setFont(x, 800, 22); x.fillStyle = '#A8792B';
    x.fillText('NO. ' + pad2(f.no), 34, 48);
    setFont(x, 700, 17); x.fillStyle = 'rgba(122,114,102,.95)';
    x.textAlign = 'right'; x.fillText((zoneOf(f) || {}).name || '', 734, 48); x.textAlign = 'left';
    var fs = fitFont(x, f.title, 690, 40, 800, 22);
    setFont(x, 800, fs); x.fillStyle = '#1F3D2B';
    x.fillText(f.title, 34, 108);
    setFont(x, 500, 20); x.fillStyle = '#7A7266';
    x.fillText(f.en, 34, 146);
    return o.c;
  }

  function makeBanner(z) {
    var o = mkCanvasPOT(1024, 224), x = o.x;
    x.fillStyle = z.accent; x.fillRect(0, 0, 1024, 224);
    x.strokeStyle = 'rgba(228,200,126,.75)'; x.lineWidth = 3; x.strokeRect(16, 16, 992, 192);
    x.strokeStyle = 'rgba(228,200,126,.35)'; x.lineWidth = 1; x.strokeRect(26, 26, 972, 172);
    setFont(x, 500, 20); x.fillStyle = 'rgba(228,200,126,.85)'; x.textAlign = 'center';
    x.fillText(z.sub, 512, 72);
    setFont(x, 800, 62); x.fillStyle = '#FBF6EA';
    var fs = fitFont(x, z.name, 900, 62, 800, 30);
    setFont(x, 800, fs);
    x.fillText(z.name, 512, 152);
    x.textAlign = 'left';
    return o.c;
  }

  function makeEntrancePoster() {
    var W = 1024, H = 1024;
    var o = mkCanvasPOT(W, H), x = o.x;
    brushBackdrop(x, W, H, PAL.z0);
    x.fillStyle = '#C89B3C';
    roundRect(x, 52, 76, W - 104, H - 152, 3); x.fill();
    x.fillStyle = 'rgba(255,253,247,.97)';
    roundRect(x, 76, 100, W - 152, H - 200, 2); x.fill();
    x.strokeStyle = 'rgba(200,155,60,.55)'; x.lineWidth = 2;
    roundRect(x, 88, 112, W - 176, H - 224, 2); x.stroke();
    setFont(x, 600, 22); x.fillStyle = '#A8792B'; x.textAlign = 'center';
    x.fillText('GALLERY · THE CONTENTS SCHOOL', W / 2, 190);
    setFont(x, 800, 92); x.fillStyle = '#1F3D2B';
    x.fillText('2028 대입', W / 2, 330);
    x.fillText('준비 가상 전시관', W / 2, 430);
    x.fillStyle = 'rgba(200,155,60,.8)'; x.fillRect(W / 2 - 90, 480, 180, 2);
    setFont(x, 500, 30); x.fillStyle = '#5A5245';
    x.fillText('중1 · 중2 · 중3 학부모를 위한', W / 2, 560);
    x.fillText('5개 관 · 14점의 안내판', W / 2, 606);
    setFont(x, 700, 24); x.fillStyle = '#A8792B';
    x.fillText('오현주 강사 · 더콘텐츠스쿨', W / 2, 730);
    x.textAlign = 'left';
    watermarkTiles(x, W, H);
    return o.c;
  }

  function makeWallTex() {
    var o = mkCanvas(8, 256), x = o.x;
    var g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#E7DBC5'); g.addColorStop(.55, '#DFD1B6'); g.addColorStop(1, '#CFBD9F');
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    return o.c;
  }

  function makeFloorTex() {
    var o = mkCanvas(512, 512), x = o.x;
    x.fillStyle = '#8A6038'; x.fillRect(0, 0, 512, 512);
    var planks = 6, ph = 512 / planks;
    var cols = ['#8E6238', '#7C5230', '#9A6E42', '#6E4828', '#A0764A', '#84582F'];
    for (var i = 0; i < planks; i++) {
      x.fillStyle = cols[i % cols.length];
      x.fillRect(0, i * ph, 512, ph - 2);
      // grain
      for (var k = 0; k < 26; k++) {
        x.globalAlpha = .07 + Math.random() * .12;
        x.strokeStyle = Math.random() > .5 ? '#3C2410' : '#C79A66';
        x.lineWidth = .8 + Math.random() * 1.6;
        var gy = i * ph + Math.random() * ph;
        x.beginPath();
        x.moveTo(0, gy);
        x.bezierCurveTo(150, gy + (Math.random() - .5) * 8, 340, gy + (Math.random() - .5) * 8, 512, gy + (Math.random() - .5) * 5);
        x.stroke();
      }
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(40,24,10,.5)';
      x.fillRect(0, i * ph + ph - 2, 512, 2);
      // butt joint
      var jx = Math.random() * 512;
      x.fillStyle = 'rgba(40,24,10,.4)'; x.fillRect(jx, i * ph, 1.5, ph - 2);
    }
    return o.c;
  }

  function makeCeilTex() {
    var o = mkCanvas(8, 64), x = o.x;
    var g = x.createLinearGradient(0, 0, 8, 64);
    g.addColorStop(0, '#F1E9D8'); g.addColorStop(1, '#E0D3BA');
    x.fillStyle = g; x.fillRect(0, 0, 8, 64);
    return o.c;
  }

  function makeShadowTex() {
    var o = mkCanvas(256, 256), x = o.x;
    var g = x.createRadialGradient(128, 128, 20, 128, 128, 126);
    g.addColorStop(0, 'rgba(48,33,14,.42)');
    g.addColorStop(.55, 'rgba(48,33,14,.20)');
    g.addColorStop(1, 'rgba(48,33,14,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return o.c;
  }

  /* ------------------------------------------------------------------ scene */
  function layoutFrames() {
    var list = state.data.frames;
    frames = list.map(function (f, i) {
      if (i === list.length - 1) {
        // exit wall, facing +Z
        return { f: f, i: i, x: 0, z: ROOM.Z1 + 0.06, ry: 0, side: 'end' };
      }
      var right = (i % 2 === 0);
      var x = right ? ROOM.W / 2 - 0.06 : -ROOM.W / 2 + 0.06;
      var ry = right ? -Math.PI / 2 : Math.PI / 2;
      return { f: f, i: i, x: x, z: FIRST_Z - i * SPACING, ry: ry, side: right ? 'R' : 'L' };
    });
  }

  function buildScene() {
    var W = ROOM.W, H = ROOM.H, len = ROOM.Z0 - ROOM.Z1, cz = (ROOM.Z0 + ROOM.Z1) / 2;

    scene = new THREE.Scene();
    scene.background = C('#8C7C63');
    scene.fog = new THREE.Fog(C('#9A8A70'), 26, 72);

    camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 160);
    camera.rotation.order = 'YXZ';
    camera.position.copy(startPos);

    var wallT = tex(makeWallTex()); wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping;
    var floorT = tex(makeFloorTex()); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
    var ceilT = tex(makeCeilTex()); ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping;

    // floor
    var fMap = floorT.clone(); fMap.needsUpdate = true; fMap.wrapS = fMap.wrapT = THREE.RepeatWrapping;
    fMap.repeat.set(3, 14);
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, len),
      new THREE.MeshBasicMaterial({ map: fMap })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, cz);
    scene.add(floor);

    // ceiling
    var cMap = ceilT.clone(); cMap.needsUpdate = true; cMap.wrapS = cMap.wrapT = THREE.RepeatWrapping;
    cMap.repeat.set(3, 16);
    var ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(W, len),
      new THREE.MeshBasicMaterial({ map: cMap })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, cz);
    scene.add(ceil);

    // side walls
    var wMapL = wallT.clone(); wMapL.needsUpdate = true;
    wMapL.wrapS = wMapL.wrapT = THREE.RepeatWrapping; wMapL.repeat.set(10, 1);
    var wMapR = wMapL.clone(); wMapR.needsUpdate = true; wMapR.repeat.set(10, 1);
    var wallGeo = new THREE.PlaneGeometry(len, H);
    var wl = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ map: wMapL }));
    wl.rotation.y = Math.PI / 2; wl.position.set(-W / 2, H / 2, cz);
    scene.add(wl);
    var wr = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ map: wMapR }));
    wr.rotation.y = -Math.PI / 2; wr.position.set(W / 2, H / 2, cz);
    scene.add(wr);

    // end + entrance walls
    var ew = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: C('#E8DCC6') }));
    ew.position.set(0, H / 2, ROOM.Z1);
    scene.add(ew);
    var sw = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: C('#25432F') }));
    sw.rotation.y = Math.PI;
    sw.position.set(0, H / 2, ROOM.Z0);
    scene.add(sw);

    // baseboard
    var bbMat = new THREE.MeshBasicMaterial({ color: C('#4A2E1C') });
    var bbGeo = new THREE.BoxGeometry(0.07, 0.2, len);
    var bbL = new THREE.Mesh(bbGeo, bbMat); bbL.position.set(-W / 2 + 0.035, 0.1, cz); scene.add(bbL);
    var bbR = new THREE.Mesh(bbGeo, bbMat); bbR.position.set(W / 2 - 0.035, 0.1, cz); scene.add(bbR);
    var bbE = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, 0.07), bbMat);
    bbE.position.set(0, 0.1, ROOM.Z1 + 0.035); scene.add(bbE);

    // ceiling cove line
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, len), new THREE.MeshBasicMaterial({ color: C('#B99354') }));
    rail.position.set(-W / 2 + 0.03, H - 0.5, cz); scene.add(rail);
    var rail2 = rail.clone(); rail2.position.x = W / 2 - 0.03; scene.add(rail2);

    // wainscot line (벽 하단 구분선)
    var wainsMat = new THREE.MeshBasicMaterial({ color: C('#B7A488') });
    var wainsGeo = new THREE.BoxGeometry(0.04, 0.035, len);
    var wainsL = new THREE.Mesh(wainsGeo, wainsMat); wainsL.position.set(-W / 2 + 0.02, 1.06, cz); scene.add(wainsL);
    var wainsR = new THREE.Mesh(wainsGeo, wainsMat); wainsR.position.set(W / 2 - 0.02, 1.06, cz); scene.add(wainsR);

    // picture rail (벽 중간 몰딩)
    var moldMat = new THREE.MeshBasicMaterial({ color: C('#E6D8BE') });
    var moldGeo = new THREE.BoxGeometry(0.03, 0.02, len);
    var moldL = new THREE.Mesh(moldGeo, moldMat); moldL.position.set(-W / 2 + 0.015, 3.02, cz); scene.add(moldL);
    var moldR = new THREE.Mesh(moldGeo, moldMat); moldR.position.set(W / 2 - 0.015, 3.02, cz); scene.add(moldR);

    // 천장 조명 띠
    var lightMat = new THREE.MeshBasicMaterial({ color: C('#FFF8E8') });
    [-2.6, 2.6].forEach(function (lx) {
      var strip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, len - 6), lightMat);
      strip.position.set(lx, H - 0.05, cz);
      scene.add(strip);
    });

    // entrance poster
    var posterT = tex(makeEntrancePoster());
    var poster = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: posterT }));
    poster.rotation.y = Math.PI;
    poster.position.set(0, 2.15, ROOM.Z0 - 0.03);
    scene.add(poster);

    // frames
    layoutFrames();
    frames.forEach(function (fr) {
      var f = fr.f;
      var g = new THREE.Group();
      g.position.set(fr.x, 0, fr.z);
      g.rotation.y = fr.ry;

      // 액자 뒤판(두께)·그림 앞면
      var back = new THREE.Mesh(
        new THREE.BoxGeometry(FRAME_W + 0.02, FRAME_H + 0.02, 0.05),
        new THREE.MeshBasicMaterial({ color: C('#8A6A1F') })
      );
      back.position.set(0, FRAME_Y, 0.008);
      back.userData.frameIndex = fr.i; g.add(back);

      var artT = tex(makeArtwork(f));
      var art = new THREE.Mesh(new THREE.PlaneGeometry(FRAME_W, FRAME_H),
        new THREE.MeshBasicMaterial({ map: artT }));
      art.position.set(0, FRAME_Y, 0.045);
      art.userData.frameIndex = fr.i;
      g.add(art);

      // plaque
      var plT = tex(makePlaque(f));
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.37),
        new THREE.MeshBasicMaterial({ map: plT }));
      pl.position.set(0, 0.86, 0.05);
      pl.userData.frameIndex = fr.i;
      g.add(pl);

      scene.add(g);
      fr.group = g;
      fr.center = new THREE.Vector3(fr.x, FRAME_Y, fr.z);
      var n = new THREE.Vector3(Math.sin(fr.ry + Math.PI), 0, Math.cos(fr.ry + Math.PI)).normalize();
      // normal pointing into the room
      if (fr.side === 'R') n.set(-1, 0, 0);
      else if (fr.side === 'L') n.set(1, 0, 0);
      else n.set(0, 0, 1);
      fr.normal = n;
      fr.front = new THREE.Vector3(fr.x + n.x * 2.95, EYE, fr.z + n.z * 2.95);

      fr.group.traverse(function (o) {
        if (o.userData && o.userData.frameIndex !== undefined) pickables.push(o);
      });
    });

    // zone banners
    var zones = state.data.meta.zones;
    zones.forEach(function (z, zi) {
      if (zi === 0) return;
      var firstIdx = state.data.frames.findIndex(function (f) { return f.zone === z.id; });
      if (firstIdx < 0) return;
      var fr = frames[firstIdx];
      var bz = (zi === zones.length - 1) ? ROOM.Z1 + 3.4 : fr.z + 2.4;
      var b = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.85),
        new THREE.MeshBasicMaterial({ map: tex(makeBanner(z)), side: THREE.DoubleSide }));
      b.position.set(0, 3.5, bz);
      scene.add(b);
      banners.push(b);
    });

    // renderer
    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(C('#8C7C63'), 1);

    clock = new THREE.Clock();
  }

  /* --------------------------------------------------------------- controls */
  function lookDelta(dx, dy) {
    yaw -= dx * 0.0034;
    pitch = clamp(pitch - dy * 0.0030, -1.05, 1.05);
  }

  function bindControls() {
    var cv = $('#scene');
    var drag = null;

    cv.addEventListener('pointerdown', function (e) {
      if (state.modal) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, t: Date.now(), moved: 0 };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId || state.modal) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6) { fly = null; }
      lookDelta(dx, dy);
    });
    cv.addEventListener('pointerup', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var quick = (Date.now() - drag.t) < 550 && drag.moved < 12;
      drag = null;
      if (quick && state.entered && !state.modal) pick(e.clientX, e.clientY);
    });
    cv.addEventListener('pointercancel', function () { drag = null; });

    // joystick
    var joyEl = $('#joy'), knob = $('#joy-knob');
    function joyStart(e) {
      joy.active = true; joy.id = e.pointerId;
      joyEl.setPointerCapture(e.pointerId);
      joyMove(e);
    }
    function joyMove(e) {
      if (!joy.active || e.pointerId !== joy.id) return;
      var r = joyEl.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var max = r.width * 0.36;
      var d = Math.hypot(dx, dy) || 1;
      var k = Math.min(d, max) / d;
      joy.x = (dx * k) / max; joy.y = (dy * k) / max;
      knob.style.transform = 'translate(' + (joy.x * max) + 'px,' + (joy.y * max) + 'px)';
    }
    function joyEnd(e) {
      if (e.pointerId !== joy.id) return;
      joy.active = false; joy.id = null; joy.x = joy.y = 0;
      knob.style.transform = 'translate(0,0)';
    }
    joyEl.addEventListener('pointerdown', joyStart);
    joyEl.addEventListener('pointermove', joyMove);
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);

    window.addEventListener('keydown', function (e) {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape' && state.modal) closeModal(state.modal);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 220); });
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();

  function pick(clientX, clientY) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(pickables, false);
    if (hits.length && hits[0].object.userData.frameIndex !== undefined) {
      focusFrame(hits[0].object.userData.frameIndex, true);
    }
  }

  /* --------------------------------------------------------------- movement */
  function updateMovement(dt) {
    if (state.modal) return;
    var vx = 0, vz = 0;
    if (joy.active || joy.x || joy.y) { vx = joy.x; vz = joy.y; }
    if (keys['w'] || keys['arrowup']) vz -= 1;
    if (keys['s'] || keys['arrowdown']) vz += 1;
    if (keys['a'] || keys['arrowleft']) vx -= 1;
    if (keys['d'] || keys['arrowright']) vx += 1;
    if (!vx && !vz) return;

    var mag = Math.hypot(vx, vz);
    if (mag > 1) { vx /= mag; vz /= mag; }
    var speed = 2.75;
    var fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    var rgt = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    camera.position.x += (fwd.x * -vz + rgt.x * vx) * speed * dt;
    camera.position.z += (fwd.z * -vz + rgt.z * vx) * speed * dt;
    clampCamera();
  }

  function clampCamera() {
    var lim = ROOM.W / 2 - 0.75;
    camera.position.x = clamp(camera.position.x, -lim, lim);
    camera.position.z = clamp(camera.position.z, ROOM.Z1 + 1.5, ROOM.Z0 - 0.8);
    camera.position.y = EYE;
  }

  function updateFly(dt) {
    if (!fly) return;
    fly.t += dt * 1000 / fly.dur;
    var t = Math.min(1, fly.t), e = easeInOut(t);
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    yaw = fly.y0 + (fly.y1 - fly.y0) * e;
    pitch = fly.pitch0 + (fly.pitch1 - fly.pitch0) * e;
    if (t >= 1) {
      var cb = fly.cb; fly = null;
      if (cb) cb();
    }
  }

  function focusFrame(idx, open) {
    var fr = frames[idx];
    if (!fr) return;
    state.current = idx;
    updateHud();
    var p0 = camera.position.clone();
    var d0 = viewDistance();
    var p1 = new THREE.Vector3(fr.center.x + fr.normal.x * d0, EYE, fr.center.z + fr.normal.z * d0);
    var dx = fr.center.x - p1.x, dz = fr.center.z - p1.z;
    var y1 = Math.atan2(-dx, -dz);
    var dist = Math.hypot(dx, dz);
    var pitch1 = Math.atan2(fr.center.y - p1.y, dist);
    // shortest rotation
    var dyaw = ((y1 - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    fly = {
      t: 0, dur: Math.max(520, Math.min(1150, p0.distanceTo(p1) * 130)),
      p0: p0, p1: p1, y0: yaw, y1: yaw + dyaw, pitch0: pitch, pitch1: clamp(pitch1, -.5, .5),
      cb: function () {
        if (open) openCard(idx);
      }
    };
    state.autoNear[idx] = true;
  }

  var peekTimer = null;
  function viewDistance() {
    var vFov = camera.fov * Math.PI / 180;
    var hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    var needW = (FRAME_W * 1.18 / 2) / Math.tan(hFov / 2);
    var needH = (FRAME_H * 1.32 / 2) / Math.tan(vFov / 2);
    return clamp(Math.max(needW, needH, 3.4), 3.4, 4.45);
  }
  function updateNear(dt) {
    if (state.modal) { $('#peek').classList.remove('on'); return; }
    var camDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    var best = null, bestD = 99;
    for (var i = 0; i < frames.length; i++) {
      var fr = frames[i];
      var d = Math.hypot(camera.position.x - fr.center.x, camera.position.z - fr.center.z);
      if (d > 3.3) { state.autoNear[i] = false; state.nearT[i] = 0; continue; }
      var to = new THREE.Vector3(fr.center.x - camera.position.x, 0, fr.center.z - camera.position.z);
      if (to.lengthSq() > 0.0001) to.normalize();
      var facing = to.dot(camDir);
      if (d < 2.2 && facing > 0.5) {
        state.nearT[i] = (state.nearT[i] || 0) + dt;
        if (d < bestD) { bestD = d; best = i; }
        if (!state.autoNear[i] && state.nearT[i] > 0.85 && !fly) {
          state.autoNear[i] = true;
          openCard(i);
          return;
        }
      } else {
        state.nearT[i] = 0;
      }
    }
    var peek = $('#peek');
    if (best !== null && bestD < 2.7) {
      peek.textContent = 'NO.' + pad2(frames[best].f.no) + '  ' + frames[best].f.title + '  ·  눌러서 보기';
      peek.classList.add('on');
    } else {
      peek.classList.remove('on');
      if (best === null) { /* nothing */ }
    }
  }

  /* ------------------------------------------------------------------- HUD */
  function updateHud() {
    var total = state.data.frames.length;
    var idx = state.current;
    $('#c-no').textContent = String(idx + 1);
    $('#counter').querySelector('span').textContent = '/ ' + total;
    $('#c-zone').textContent = (zoneOf(state.data.frames[idx]) || {}).name || '';
    $('#btn-prev').disabled = idx <= 0;
    $('#btn-next').disabled = idx >= total - 1;
  }

  function nextFrame() {
    if (!state.entered) return;
    if (state.modal) { closeModal(state.modal); }
    var t = Math.min(state.current + 1, state.data.frames.length - 1);
    if (t === state.current && state.current === state.data.frames.length - 1) { toast('마지막 작품입니다'); return; }
    focusFrame(t, true);
  }
  function prevFrame() {
    if (!state.entered) return;
    if (state.modal) { closeModal(state.modal); }
    var t = Math.max(state.current - 1, 0);
    if (t === state.current && state.current === 0) { toast('첫 작품입니다'); return; }
    focusFrame(t, true);
  }

  /* --------------------------------------------------------------- modals */
  function openModal(id) {
    var el = $('#' + id);
    if (!el) return;
    el.classList.add('on');
    state.modal = id;
    document.body.classList.add('modal-open');
  }
  function closeModal(id) {
    var el = $('#' + id);
    if (!el) return;
    el.classList.remove('on');
    if (state.modal === id) state.modal = null;
    if (!$('.modal-layer.on')) document.body.classList.remove('modal-open');
    if (id === 'card') $('#peek').classList.remove('on');
  }

  /* ------------------------------------------------------------ info card */
  function renderCard(idx) {
    var f = state.data.frames[idx];
    var z = zoneOf(f) || { name: '' };
    $('#card-kicker').textContent = z.name;
    $('#card-count').textContent = pad2(f.no) + ' / ' + state.data.frames.length;
    $('#card-title').textContent = f.title;
    $('#card-en').textContent = f.en || '';
    $('#card-meta').textContent = f.meta || '';

    var h = [];
    if (f.summary) h.push('<div class="summary">' + esc(f.summary) + '</div>');
    (f.body || []).forEach(function (p) { h.push('<p>' + esc(p) + '</p>'); });

    if (f.gradeNotes) {
      h.push('<div class="grade-grid">');
      state.data.meta.grades.forEach(function (g) {
        var n = f.gradeNotes[g.id];
        if (!n) return;
        h.push('<div class="grade-card' + (g.id === state.grade ? ' on' : '') + '">' +
          '<div class="gh"><span class="badge">' + esc(g.short) + '</span>' + esc(n.headline) + '</div>' +
          '<ul>' + n.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>');
      });
      h.push('</div>');
    }

    if (f.points && f.points.length) {
      h.push('<ul class="points">');
      f.points.forEach(function (p) {
        h.push('<li><span class="k">' + esc(p.k) + '</span><span class="v">' + esc(p.v) + '</span></li>');
      });
      h.push('</ul>');
    }

    if (f.prompts && f.prompts.length) {
      h.push('<div class="prompts">');
      f.prompts.forEach(function (p, i) {
        h.push('<div class="prompt"><div class="ph"><span class="pt">' + esc(p.title) + '</span>' +
          '<button class="copy" data-copy="' + i + '" type="button">복사</button></div>' +
          '<div class="px">' + esc(p.text) + '</div></div>');
      });
      h.push('</div>');
    }

    if (f.chart && f.chart.items && f.chart.items.length) {
      h.push('<div class="sec-label">' + esc(f.chart.title || '확인 차트') + '</div>');
      h.push('<div class="chart">');
      f.chart.items.forEach(function (it) {
        h.push('<div class="chart-item">');
        h.push('<div class="ch"><span class="cno">' + esc(it.no || '') + '</span>' +
          '<span class="ct">' + esc(it.title || '') + '</span></div>');
        if (it.where) h.push('<div class="crow"><span class="clb">어디서</span><span class="cvv">' + esc(it.where) + '</span></div>');
        if (it.what) h.push('<div class="crow"><span class="clb">무엇을</span><span class="cvv">' + esc(it.what) + '</span></div>');
        if (it.fact) h.push('<div class="cfact">' + esc(it.fact) + '</div>');
        h.push('</div>');
      });
      h.push('</div>');
      if (f.chart.note) h.push('<p class="chart-note">' + esc(f.chart.note) + '</p>');
    }

    if (f.links && f.links.length) {
      h.push('<div class="sec-label">공식 링크 열기</div>');
      h.push('<div class="links">');
      f.links.forEach(function (l) {
        h.push('<a class="link-btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
          '<span>' + esc(l.label) + '</span><span class="arw">↗</span></a>');
      });
      h.push('</div>');
    }

    var acts = [];
    if (f.quiz) acts.push('<button class="btn gold" data-quiz type="button">퀴즈 풀기</button>');
    if (f.detail) acts.push('<button class="btn" data-detail type="button">자세히 보기</button>');
    if (f.jump) acts.push('<button class="btn ghost" data-jump="' + f.jump + '" type="button">' + esc(f.jumpLabel || '이동') + '</button>');
    if (acts.length) h.push('<div class="actions">' + acts.join('') + '</div>');

    if (f.detail) h.push('<div class="detail-wrap" id="detail-box"><div class="dh">더 깊이</div><p>' + esc(f.detail) + '</p></div>');

    h.push('<div class="card-nav">' +
      '<button class="btn" data-nav="-1" type="button"' + (idx === 0 ? ' disabled' : '') + '>◀ 이전 작품</button>' +
      '<button class="btn" data-nav="1" type="button"' + (idx === state.data.frames.length - 1 ? ' disabled' : '') + '>다음 작품 ▶</button>' +
      '</div>');

    var body = $('#card-body');
    body.innerHTML = h.join('');
    body.scrollTop = 0;

    $$('[data-detail]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var box = $('#detail-box');
        box.classList.toggle('on');
        b.textContent = box.classList.contains('on') ? '접기' : '자세히 보기';
      });
    });
    $$('[data-copy]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = f.prompts[+b.dataset.copy];
        copyText(p.text).then(function () {
          b.textContent = '복사됨'; b.classList.add('done');
          toast('프롬프트를 복사했습니다');
          setTimeout(function () { b.textContent = '복사'; b.classList.remove('done'); }, 1800);
        });
      });
    });
    $$('[data-nav]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = idx + (+b.dataset.nav);
        if (t < 0 || t >= state.data.frames.length) return;
        closeModal('card');
        focusFrame(t, true);
      });
    });
    $$('[data-jump]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = (+b.dataset.jump) - 1;
        closeModal('card');
        focusFrame(t, true);
      });
    });
    $$('[data-quiz]', body).forEach(function (b) {
      b.addEventListener('click', function () { closeModal('card'); openQuiz(); });
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
  }

  function openCard(idx) {
    renderCard(idx);
    openModal('card');
    $('#peek').classList.remove('on');
  }

  /* ----------------------------------------------------------------- help */
  function buildHelp() {
    var zones = state.data.meta.zones;
    var cnt = {};
    state.data.frames.forEach(function (f) { cnt[f.zone] = (cnt[f.zone] || 0) + 1; });
    var zl = $('#zone-list');
    zl.innerHTML = zones.map(function (z, i) {
      var first = state.data.frames.findIndex(function (f) { return f.zone === z.id; });
      return '<li><button data-zone="' + first + '" type="button">' +
        '<span class="zi" style="background:' + z.accent + '">' + (i + 1) + '</span>' +
        '<span class="zn">' + esc(z.name) + '</span>' +
        '<span class="zc">' + (cnt[z.id] || 0) + '점</span></button></li>';
    }).join('');
    $$('[data-zone]', zl).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.zone;
        closeModal('help');
        focusFrame(i, true);
      });
    });

    // minimap (컨테이너 폭에 맞춰 그림)
    var svg = $('#minimap');
    var wrap = svg.parentNode;
    var MW = Math.max(280, Math.min(680, (wrap.clientWidth || 320)));
    var MH = 132;
    svg.setAttribute('viewBox', '0 0 ' + MW + ' ' + MH);
    svg.setAttribute('width', MW);
    svg.setAttribute('height', MH);
    var x0 = 18, x1 = MW - 18, y = 74;
    var span = Math.abs(ROOM.Z1 - ROOM.Z0);
    function xOf(z) { return x0 + (1 - (z - ROOM.Z1) / span) * (x1 - x0); }
    var parts = [];
    parts.push('<defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#E4D3A9"/><stop offset="1" stop-color="#C89B3C"/></linearGradient></defs>');
    parts.push('<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="url(#mg)" stroke-width="3" stroke-linecap="round"/>');
    zones.forEach(function (z) {
      var fs = state.data.frames.filter(function (f) { return f.zone === z.id; });
      if (!fs.length) return;
      var a = xOf(frames[state.data.frames.indexOf(fs[0])].z);
      var b = xOf(frames[state.data.frames.indexOf(fs[fs.length - 1])].z);
      parts.push('<line x1="' + Math.min(a, b) + '" y1="52" x2="' + Math.max(a, b) + '" y2="52" stroke="' + z.accent + '" stroke-width="3" opacity=".6"/>');
      var shortName = (/^\d관/.test(z.name) ? z.name.split(' · ')[0] : (z.name.indexOf('출구') === 0 ? '출구' : '입구'));
      parts.push('<text x="' + ((a + b) / 2).toFixed(1) + '" y="40" text-anchor="middle" font-family="Paperozi,sans-serif" font-size="10" font-weight="700" fill="#7A6631">' + esc(shortName) + '</text>');
    });
    frames.forEach(function (fr, i) {
      var x = xOf(fr.z), yy = y + (fr.side === 'R' ? -15 : fr.side === 'L' ? 15 : 0);
      parts.push('<circle class="mm-dot" data-i="' + i + '" cx="' + x.toFixed(1) + '" cy="' + yy + '" r="6.5" fill="' + (i === state.current ? '#C89B3C' : '#FBF6EA') + '" stroke="#8A6A1F" stroke-width="1.4" style="cursor:pointer"/>');
      parts.push('<text x="' + x.toFixed(1) + '" y="' + (yy + 3.4) + '" text-anchor="middle" font-size="7.5" font-family="Paperozi,sans-serif" font-weight="700" fill="' + (i === state.current ? '#3A2E12' : '#8A6A1F') + '" pointer-events="none">' + (i + 1) + '</text>');
    });
    svg.innerHTML = parts.join('');
    $$('.mm-dot', svg).forEach(function (d) {
      d.addEventListener('click', function () {
        closeModal('help');
        focusFrame(+d.dataset.i, true);
      });
    });
  }

  /* ----------------------------------------------------------------- quiz */
  function openQuiz() {
    state.quiz = { answers: [null, null], checked: false };
    renderQuiz();
    openModal('quiz');
  }

  function renderQuiz() {
    var q = state.data.quiz;
    var h = [];
    h.push('<p style="font-size:13px;color:#7A7266;margin:0 0 16px">' + esc(q.intro) + '</p>');
    q.questions.forEach(function (qq, qi) {
      h.push('<div class="q-block" data-q="' + qi + '">');
      h.push('<div class="q-no">Q' + (qi + 1) + ' / ' + q.questions.length + '</div>');
      h.push('<div class="q-text">' + esc(qq.q) + '</div>');
      h.push('<div class="opts">');
      qq.options.forEach(function (op, oi) {
        h.push('<button class="opt" data-a="' + qi + '-' + oi + '" type="button">' +
          '<span class="bullet">' + String.fromCharCode(65 + oi) + '</span><span>' + esc(op) + '</span></button>');
      });
      h.push('</div><div class="q-why" id="why-' + qi + '">' + esc(qq.why) + '</div></div>');
    });
    h.push('<div class="quiz-score" id="quiz-score" style="display:none"></div>');
    $('#quiz-body').innerHTML = h.join('');

    $$('.opt', $('#quiz-body')).forEach(function (b) {
      b.addEventListener('click', function () {
        if (state.quiz.checked) return;
        var p = b.dataset.a.split('-'), qi = +p[0], oi = +p[1];
        state.quiz.answers[qi] = oi;
        $$('[data-q="' + qi + '"] .opt', $('#quiz-body')).forEach(function (o) { o.classList.remove('sel'); });
        b.classList.add('sel');
      });
    });
    $('#btn-check').textContent = '정답 확인';
    $('#btn-check').dataset.mode = 'check';
  }

  function checkQuiz() {
    var q = state.data.quiz;
    var ok = 0;
    q.questions.forEach(function (qq, qi) {
      var sel = state.quiz.answers[qi];
      $$('[data-q="' + qi + '"] .opt', $('#quiz-body')).forEach(function (o) {
        var oi = +o.dataset.a.split('-')[1];
        o.classList.remove('sel');
        if (oi === qq.answer) o.classList.add('right');
        else if (oi === sel) o.classList.add('wrong');
      });
      $('#why-' + qi).classList.add('on');
      if (sel === qq.answer) ok++;
    });
    state.quiz.checked = true;
    state.score = ok;
    var sc = $('#quiz-score');
    sc.style.display = 'block';
    sc.textContent = ok + ' / ' + q.questions.length + ' 정답 · ' + (ok === q.questions.length ? '완벽합니다!' : '해설을 한 번 더 읽어 보세요');
    var b = $('#btn-check');
    b.textContent = '수료 관람권 받기';
    b.dataset.mode = 'ticket';
  }

  function openTicket() {
    var q = state.data.quiz.ticket;
    var g = state.data.meta.grades.filter(function (x) { return x.id === state.grade; })[0] || { label: '학부모' };
    $('#ticket-card').innerHTML =
      '<div class="tt-en">' + esc(q.en) + '</div>' +
      '<div class="tt-title">' + esc(q.title) + '</div>' +
      '<div class="tt-sub">' + esc(state.data.meta.title) + '</div>' +
      '<div class="tt-div"></div>' +
      '<div class="tt-line">' + esc(q.line2) + '</div>' +
      '<div class="tt-line">5개 관 · ' + state.data.frames.length + '점 관람 완료</div>' +
      '<div class="tt-grade">' + esc(g.label) + ' 학부모 · ' + state.score + '/' + state.data.quiz.questions.length + ' 정답</div>' +
      '<div class="tt-issuer">' + esc(q.issuer) + '</div>' +
      '<div class="tt-date">' + todayLabel() + '</div>' +
      '<div class="seal">더콘텐츠<br>스쿨</div>';
    openModal('ticket');
  }

  function saveTicket() {
    var W = 1080, H = 700;
    var o = mkCanvas(W, H), x = o.x;
    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FFFCF3'); g.addColorStop(1, '#F3E7CE');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#C89B3C'; x.lineWidth = 6; x.strokeRect(22, 22, W - 44, H - 44);
    x.lineWidth = 2; x.strokeRect(36, 36, W - 72, H - 72);
    x.textAlign = 'center';
    setFont(x, 700, 26); x.fillStyle = '#C89B3C';
    x.fillText('C E R T I F I C A T E   O F   V I S I T', W / 2, 150);
    setFont(x, 800, 78); x.fillStyle = '#1F3D2B';
    x.fillText('수료 관람권', W / 2, 260);
    setFont(x, 500, 30); x.fillStyle = '#5A5245';
    x.fillText('2028 대입 준비 가상 전시관', W / 2, 320);
    x.fillStyle = 'rgba(200,155,60,.75)'; x.fillRect(W / 2 - 150, 360, 300, 2);
    setFont(x, 500, 28); x.fillStyle = '#4A4238';
    x.fillText('위 관람객은 전시관의 안내를 모두 확인하였습니다.', W / 2, 420);
    var gr = state.data.meta.grades.filter(function (q) { return q.id === state.grade; })[0] || { label: '학부모' };
    setFont(x, 700, 26); x.fillStyle = '#8A6A1F';
    x.fillText('5개 관 14점 · ' + gr.label + ' 학부모 · ' + state.score + '/2 정답', W / 2, 468);
    setFont(x, 800, 40); x.fillStyle = '#1F3D2B';
    x.fillText('더콘텐츠스쿨 · 오현주 강사', W / 2, 580);
    setFont(x, 500, 22); x.fillStyle = '#8A8275';
    x.fillText(todayLabel(), W / 2, 620);
    x.textAlign = 'left';
    watermarkTiles(x, W, H);

    try {
      var a = document.createElement('a');
      a.href = o.c.toDataURL('image/png');
      a.download = '2028대입준비_가상전시관_수료관람권.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('수료 관람권을 저장했습니다');
    } catch (e) { toast('이미지 저장이 지원되지 않는 환경입니다'); }
  }

  /* -------------------------------------------------------------- fallback */
  function buildFallback() {
    var list = $('#fb-list');
    list.innerHTML = state.data.frames.map(function (f, i) {
      var z = zoneOf(f) || { name: '' };
      return '<button class="fb-item" data-fb="' + i + '" type="button">' +
        '<span class="n">' + pad2(f.no) + '</span>' +
        '<span><span class="t">' + esc(f.title) + '</span><span class="z">' + esc(z.name) + '</span></span>' +
        '</button>';
    }).join('');
    $$('[data-fb]', list).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.fb;
        closeModal('fallback');
        state.current = i; updateHud();
        openCard(i);
      });
    });
  }

  /* ---------------------------------------------------------------- intro */
  function buildIntro() {
    var gb = $('#grade-btns');
    gb.innerHTML = state.data.meta.grades.map(function (g) {
      return '<button class="gbtn' + (g.id === state.grade ? ' on' : '') + '" data-g="' + g.id + '" type="button">' +
        esc(g.short) + '<small>' + esc(g.headline) + '</small></button>';
    }).join('');
    $$('[data-g]', gb).forEach(function (b) {
      b.addEventListener('click', function () {
        state.grade = b.dataset.g;
        $$('[data-g]', gb).forEach(function (o) { o.classList.remove('on'); });
        b.classList.add('on');
        try { localStorage.setItem('tcs_gallery_grade', state.grade); } catch (e) { }
      });
    });
    $('#btn-enter').addEventListener('click', enterGallery);
  }

  function enterGallery() {
    closeModal('intro');
    state.entered = true;
    setTimeout(function () { focusFrame(0, false); }, 260);
    setTimeout(function () {
      var peek = $('#peek');
      peek.textContent = '액자를 누르면 설명 카드가 열립니다 · 아래 ‘다음’으로 이동';
      peek.classList.add('on');
      setTimeout(function () { if (!state.modal) peek.classList.remove('on'); }, 4200);
    }, 2000);
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) { state.data = json; return start(); })
      .catch(function (e) {
        $('#loading').classList.add('done');
        $('#fb-note').textContent = '전시 데이터를 불러오지 못했습니다 (' + e.message + '). 페이지를 새로고침해 주세요.';
        openModal('fallback');
      });
  }

  function start() {
    try { var sg = localStorage.getItem('tcs_gallery_grade'); if (sg) state.grade = sg; } catch (e) { }
    if (state.data.meta.grades.every(function (g) { return g.id !== state.grade; })) state.grade = 'm3';

    buildIntro();
    layoutFrames();
    buildHelp();
    buildFallback();
    updateHud();

    var fontsReady = (document.fonts && document.fonts.load)
      ? Promise.all([300, 400, 500, 600, 700, 800, 900].map(function (w) {
        return document.fonts.load(w + ' 40px Paperozi', '가나다 ABC 123').catch(function () { });
      }))
      : Promise.resolve();

    fontsReady.then(function () {
      var canvasOK = true;
      try {
        var t = document.createElement('canvas');
        canvasOK = !!(window.WebGLRenderingContext && (t.getContext('webgl') || t.getContext('experimental-webgl')));
      } catch (e) { canvasOK = false; }

      if (!canvasOK) {
        $('#loading').classList.add('done');
        openModal('fallback');
        return;
      }
      try {
        buildScene();
        bindControls();
        $('#loading').classList.add('done');
        state.ready = true;
        openModal('intro');
        animate();
      } catch (err) {
        $('#loading').classList.add('done');
        $('#fb-note').textContent = '3D 관람을 시작할 수 없어 목록으로 보여드립니다.';
        openModal('fallback');
      }
    });
  }

  /* ----------------------------------------------------------------- loop */
  var last = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!state.ready) return;
    var dt = Math.min(clock.getDelta(), 0.05);

    if (!state.modal) updateMovement(dt);
    updateFly(dt);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    updateNear(dt);
    renderer.render(scene, camera);

    // adaptive quality
    frameStats.t += dt; frameStats.n++;
    if (frameStats.n >= 90) {
      var avg = frameStats.t / frameStats.n;
      if (avg > 0.028 && pixelRatio > 1.15) {
        pixelRatio = Math.max(1.15, pixelRatio - 0.25);
        onResize();
      }
      frameStats.t = 0; frameStats.n = 0;
    }
  }

  /* ------------------------------------------------------------------ UI */
  $('#btn-help').addEventListener('click', function () { openModal('help'); });
  $('#btn-list').addEventListener('click', function () { closeModal('help'); openModal('fallback'); });
  $('#btn-prev').addEventListener('click', prevFrame);
  $('#btn-next').addEventListener('click', nextFrame);

  $('#btn-check').addEventListener('click', function () {
    if ($('#btn-check').dataset.mode === 'ticket') { closeModal('quiz'); openTicket(); return; }
    var missing = state.quiz.answers.filter(function (a) { return a === null; }).length;
    if (missing) { toast('두 문제 모두 선택해 주세요'); return; }
    checkQuiz();
  });
  $('#btn-save-ticket').addEventListener('click', saveTicket);

  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeModal(b.dataset.close); });
  });
  $$('[data-close-card]').forEach(function (b) {
    b.addEventListener('click', function () { closeModal('card'); });
  });
  $$('.modal-layer').forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m && m.id !== 'intro') closeModal(m.id);
    });
  });

  // 복제 방지 (프롬프트 복사 버튼만 허용)
  ['contextmenu', 'selectstart', 'dragstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('copy', function (e) {
    if (!e.target.closest || !e.target.closest('.prompt')) e.preventDefault();
  });
  document.addEventListener('cut', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && ['c', 'x', 'a', 's', 'u'].indexOf((e.key || '').toLowerCase()) >= 0) {
      e.preventDefault();
    }
  });

  boot();
})();
