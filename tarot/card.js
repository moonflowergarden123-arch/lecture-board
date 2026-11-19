/* 더콘텐츠스쿨 · 탄생월 맞춤 합격 부적 — 카드 렌더러 (1080×1440 = 3:4)
   배경 = 전통 노란 부적 한지 + 붉은 경면주사 부적 문양 + 길상 그림 (cards/bg_MM.jpg)
   그 위에 이름·배지·낙관·하단 정보를 인쇄하듯 얹는다. */
window.TarotCard = (function () {
  var CINNABAR = '#A5291B', CINNABAR_D = '#7C1A0E', INK = '#3A2413', PAPER_CREAM = '#F8EFDD';
  var imgCache = {}, loading = {};

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function bgSrc(month) { return 'cards/bg_' + pad2(month) + '.jpg'; }

  function bgImg(month) {
    if (imgCache[month]) return Promise.resolve(imgCache[month]);
    if (loading[month]) return loading[month];
    loading[month] = new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { imgCache[month] = im; res(im); };
      im.onerror = function () { rej(new Error('bg load failed: ' + month)); };
      im.src = bgSrc(month);
    });
    return loading[month];
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['400', '500', '600', '700', '800', '900'].map(function (w) {
      return document.fonts.load(w + ' 40px Paperozi').catch(function () {});
    }));
  }

  function preload(month) {
    var jobs = [fontsReady()];
    if (month) jobs.push(bgImg(month));
    return Promise.all(jobs);
  }

  function draw(ctx, W, opts) {
    var S = W / 1080, H = W * 4 / 3;
    var m = opts.month, exam = opts.exam;
    var name = (opts.name || '').trim() || '수험생';
    var im = imgCache[m.month];

    ctx.clearRect(0, 0, W, H);
    if (im) ctx.drawImage(im, 0, 0, W, H);
    else { ctx.fillStyle = '#EFDCA8'; ctx.fillRect(0, 0, W, H); }

    function font(size, weight, spacing) {
      ctx.font = (weight || 400) + ' ' + (size * S).toFixed(2) + 'px Paperozi, sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = ((spacing || 0) * S).toFixed(2) + 'px';
    }
    function measure(str, size, weight, spacing) {
      font(size, weight, spacing);
      var w = ctx.measureText(str).width / S;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      return w;
    }
    function text(str, x, y, o) {
      o = o || {};
      font(o.size || 26, o.weight || 400, o.spacing || 0);
      ctx.textAlign = o.align || 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = o.color || INK;
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
      ctx.fillText(str, x * S, y * S);
      ctx.globalAlpha = 1;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    /* 폭에 맞춰 글자 크기 줄이기 */
    function fit(str, maxW, size, weight, spacing, minSize) {
      var s = size;
      while (s > (minSize || 16) && measure(str, s, weight, spacing) > maxW) s -= 1;
      return s;
    }
    /* 종이에 번진 느낌의 부드러운 크림 빛 — 글자 자리를 살짝 밝힌다 */
    function glow(cx, cy, rx, ry, alpha) {
      ctx.save();
      ctx.translate(cx * S, cy * S);
      ctx.scale(1, ry / rx);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * S);
      g.addColorStop(0, 'rgba(255,247,224,' + alpha + ')');
      g.addColorStop(0.62, 'rgba(255,247,224,' + (alpha * 0.55).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,247,224,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ── 1. 상단 붉은 경면주사 띠 배지 ── */
    var rangeShort = (m.range || '').replace(/\s+/g, '');
    var badgeTxt = m.month + '월생 · ' + m.sign + ' (' + rangeShort + ') · ' + (exam.bujeok || '합격부');
    var bSize = fit(badgeTxt, 800, 27, 600, 0.4, 18);
    var bW = measure(badgeTxt, bSize, 600, 0.4) + 62;
    var bx = 540 - bW / 2, by = 30, bh = 64;

    ctx.save();
    ctx.shadowColor = 'rgba(90,20,10,0.28)';
    ctx.shadowBlur = 10 * S;
    ctx.shadowOffsetY = 3 * S;
    var bg2 = ctx.createLinearGradient(bx * S, by * S, (bx + bW) * S, (by + bh) * S);
    bg2.addColorStop(0, '#B3311F');
    bg2.addColorStop(0.5, '#9E2415');
    bg2.addColorStop(1, '#B3311F');
    ctx.fillStyle = bg2;
    roundRect(ctx, bx * S, by * S, bW * S, bh * S, 7 * S);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,236,200,0.42)';
    ctx.lineWidth = 1.1 * S;
    roundRect(ctx, (bx + 4) * S, (by + 4) * S, (bW - 8) * S, (bh - 8) * S, 5 * S);
    ctx.stroke();
    text(badgeTxt, 540, by + bh / 2 + bSize * 0.36, {
      size: bSize, weight: 600, color: '#FFF3DA', spacing: 0.4
    });

    /* ── 2. 좌상단 이름 + 부제 ── */
    var nameSize = name.length <= 2 ? 74 : name.length === 3 ? 68 : name.length === 4 ? 60 : name.length <= 6 ? 52 : 46;
    var nameW = measure(name, nameSize, 800, -1);
    var nimW = measure('님', 25, 500, 0);
    var grpW = nameW + 8 + nimW;
    var nx = 68, ny = 208;

    glow(nx + grpW / 2 - 6, ny - 62, grpW / 2 + 132, 172, 0.62);

    font(nameSize, 800, -1);
    ctx.textAlign = 'left';
    ctx.fillStyle = CINNABAR_D;
    ctx.fillText(name, nx * S, ny * S);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    font(25, 500, 0);
    ctx.fillStyle = 'rgba(124,26,14,0.85)';
    ctx.fillText('님', (nx + nameW + 8) * S, (ny - 3) * S);

    var subTxt = m.tarotShort + ' · ' + (m.gil || '대길');
    text(subTxt, nx + 2, ny + 40, {
      size: fit(subTxt, 250, 27, 700, 0.6), weight: 700, color: 'rgba(110,52,18,0.92)', align: 'left', spacing: 0.6
    });

    /* ── 3. 우상단 빨간 낙관 ── */
    (function stamp() {
      var scx = 952, scy = 182, side = 100;
      ctx.save();
      ctx.translate(scx * S, scy * S);
      ctx.rotate(-5 * Math.PI / 180);
      glow(0, 0, side * 0.92, side * 0.92, 0.62);
      ctx.shadowColor = 'rgba(90,20,10,0.22)';
      ctx.shadowBlur = 8 * S;
      ctx.shadowOffsetY = 2 * S;
      ctx.fillStyle = '#A8291A';
      roundRect(ctx, -side / 2 * S, -side / 2 * S, side * S, side * S, 5 * S);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,238,205,0.55)';
      ctx.lineWidth = 1.4 * S;
      roundRect(ctx, (-side / 2 + 5) * S, (-side / 2 + 5) * S, (side - 10) * S, (side - 10) * S, 3 * S);
      ctx.stroke();
      /* 도장에 찍힌 결 */
      var rr = mulberry(m.month * 97 + 5);
      for (var i = 0; i < 42; i++) {
        ctx.fillStyle = 'rgba(255,236,204,' + (0.05 + rr() * 0.14).toFixed(2) + ')';
        ctx.fillRect((rr() - 0.5) * side * S, (rr() - 0.5) * side * S, 1.4 * S, 1.4 * S);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFEFD4';
      ctx.font = '800 ' + (34 * S).toFixed(1) + 'px Paperozi, sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.fillText('합', 0, -4 * S);
      ctx.fillText('격', 0, 34 * S);
      ctx.restore();
    })();

    /* ── 4. 하단 한지 톤 정보 박스 ── */
    var bx1 = 52, bx2 = 1028, by1 = 1272, by2 = 1430;
    ctx.save();
    ctx.shadowColor = 'rgba(120,60,20,0.16)';
    ctx.shadowBlur = 14 * S;
    ctx.shadowOffsetY = 3 * S;
    ctx.fillStyle = 'rgba(248,239,221,0.94)';
    roundRect(ctx, bx1 * S, by1 * S, (bx2 - bx1) * S, (by2 - by1) * S, 16 * S);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(165,41,27,0.34)';
    ctx.lineWidth = 1.6 * S;
    roundRect(ctx, bx1 * S, by1 * S, (bx2 - bx1) * S, (by2 - by1) * S, 16 * S);
    ctx.stroke();

    /* 4-1. 별점 세 줄 */
    var cols = [
      { label: '집중력', value: m.ratings.focus },
      { label: '실수제로', value: m.ratings.mistake },
      { label: '행운지수', value: m.ratings.condition }
    ];
    var colX = [232, 540, 848];
    cols.forEach(function (c, i) {
      var starR = 9.5, gapS = 21;
      var numTxt = c.value + '/5';
      var labelW = measure(c.label, 20, 700, 0.4);
      var numW = measure(numTxt, 21, 800, 0);
      var starsW = (5 - 1) * gapS + starR * 2;
      var total = labelW + 12 + starsW + 10 + numW;
      var sx = colX[i] - total / 2;
      text(c.label, sx, 1304, { size: 20, weight: 700, color: 'rgba(106,58,23,0.95)', align: 'left', spacing: 0.4 });
      var stx = sx + labelW + 12 + starR;
      for (var k = 0; k < 5; k++) {
        var cx = stx + k * gapS;
        starPath(ctx, cx * S, 1298 * S, starR * S);
        if (k < c.value) { ctx.fillStyle = '#B3311F'; ctx.fill(); }
        else {
          ctx.strokeStyle = 'rgba(179,49,31,0.32)';
          ctx.lineWidth = 1.3 * S;
          ctx.stroke();
        }
      }
      ctx.textAlign = 'left';
      font(21, 800, 0);
      ctx.fillStyle = '#8E1A0F';
      ctx.fillText(numTxt, (stx + (4 * gapS) + starR + 10) * S, 1305 * S);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    });

    /* 4-2. 구분선 */
    ctx.strokeStyle = 'rgba(165,41,27,0.20)';
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    ctx.moveTo(92 * S, 1328 * S);
    ctx.lineTo(988 * S, 1328 * S);
    ctx.stroke();

    /* 4-3. 응원 문구 */
    text(m.cheer[0], 540, 1358, { size: fit(m.cheer[0], 880, 23, 500, 0.2), weight: 500, color: '#3A2413', spacing: 0.2 });
    text(m.cheer[1], 540, 1388, { size: fit(m.cheer[1], 880, 23, 800, 0.2), weight: 800, color: '#8E1A0F', spacing: 0.2 });

    /* 4-4. 행운 색 · 아이템 (하단 박스 중앙 정렬) — 카드 이미지에는 강사·브랜드 표기를 넣지 않는다 */
    var luckyTxt = '행운색 ' + m.lucky.color + ' · 행운템 ' + m.lucky.item;
    var lSize = fit(luckyTxt, 760, 19, 500, 0.2);
    var dotR = 6, gapC = 10;
    var lTxtW = measure(luckyTxt, lSize, 500, 0.2);
    var lx = 540 - (dotR * 2 + gapC + lTxtW) / 2;
    ctx.beginPath();
    ctx.arc((lx + dotR) * S, 1411 * S, dotR * S, 0, Math.PI * 2);
    ctx.fillStyle = m.lucky.hex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,26,14,0.55)';
    ctx.lineWidth = 1.1 * S;
    ctx.stroke();
    ctx.textAlign = 'left';
    font(lSize, 500, 0.2);
    ctx.fillStyle = 'rgba(90,52,24,0.92)';
    ctx.fillText(luckyTxt, (lx + dotR * 2 + gapC) * S, 1418 * S);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    return true;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var k = 0; k < 10; k++) {
      var a = (k * Math.PI) / 5 - Math.PI / 2;
      var rad = k % 2 === 0 ? r : r * 0.46;
      var px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function render(W, opts) {
    var c = document.createElement('canvas');
    c.width = W; c.height = Math.round(W * 4 / 3);
    draw(c.getContext('2d'), W, opts);
    return c;
  }

  function dataUrl(W, opts) { return render(W, opts).toDataURL('image/png'); }

  function download(W, opts, filename) {
    return preload(opts.month.month).then(function () {
      var c = render(W, opts);
      return new Promise(function (res) {
        c.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          res(true);
        }, 'image/png');
      });
    });
  }

  return {
    preload: preload, draw: draw, render: render, dataUrl: dataUrl, download: download,
    bgImg: bgImg, bgSrc: bgSrc
  };
})();
