/* 전국 유·초·중·고 학생 분포 히트맵
   데이터: 행정안전부 주민등록인구통계(2026.10) + 통계청 SGIS 행정동 경계(2026.10.01) */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var RAD = Math.PI / 180;
  var RAMP = ['#F3F5E6', '#E1EAC7', '#C8DBA6', '#A8CA86', '#83B36B', '#5D9A56', '#38773F', '#17482A'];
  var NOCLASS = '#E4E2D7';

  var state = {
    lv: { k: true, e: true, m: true, h: true },
    metric: 'area',
    sido: 'ALL',
    hover: null,
    selected: null
  };

  var regions = [], sides = [], sidoList = [];
  var canvas, ctx, dpr = 1, W = 0, H = 0;
  var view = { k: 1, tx: 0, ty: 0 };
  var base = null;            // projection params
  var classPaths = [];        // 8 classes + nodata
  var outsidePath = null;     // 선택한 시·도 밖 지역(흐리게)
  var allPath = null;
  var geoBBox = null;
  var breaks = [];
  var MAXV = 0;
  var anim = null, rafPending = false, booted = false;

  /* ───────────────────────── 데이터 ───────────────────────── */

  function fetchData() {
    return fetch('data.json').then(function (r) {
      if (!r.ok) throw new Error('data.json ' + r.status);
      return r.json();
    });
  }

  function prepare(data) {
    regions = data.regions;
    var geoms = data.geoms;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      r.i = i;
      r.dong = r.n.split(' ').pop();
      r.polys = geoms[r.g] || [];
      r.regions = null;
    }
    // 시도 목록 (인구 많은 순)
    var agg = {};
    regions.forEach(function (r) {
      (agg[r.sido] = agg[r.sido] || { name: r.sido, pop: 0, n: 0 });
      agg[r.sido].pop += r.p; agg[r.sido].n++;
    });
    sidoList = Object.keys(agg).map(function (k) { return agg[k]; })
      .sort(function (a, b) { return b.pop - a.pop; });
  }

  function shortSido(name) {
    if (name === '전남광주통합특별시') return '전남·광주';
    return name
      .replace('특별자치시', '').replace('특별자치도', '')
      .replace('특별시', '').replace('광역시', '').replace('도', '');
  }
  function shortSgg(name) {
    // '화성시효행구' -> '화성시 효행구'
    return name.replace(/(시|군)(.+구)$/, '$1 $2');
  }

  /* ───────────────────────── 투영 ───────────────────────── */

  function mercY(lat) { return -Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)); }

  function computeGeoBBox() {
    // 본토+제주 기준으로 화면을 맞춘다(백령도·울릉도 등 먼 섬은 화면 밖으로 나갈 수 있음)
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    regions.forEach(function (r) {
      if (r.a < 1) return;
      for (var p = 0; p < r.polys.length; p++) {
        var ring = r.polys[p][0];
        for (var j = 0; j < ring.length; j += 2) {
          var lo = ring[j] / 1e5, la = ring[j + 1] / 1e5;
          if (lo < 125.9 || lo > 129.7) continue;
          if (lo < x0) x0 = lo; if (lo > x1) x1 = lo;
          if (la < y0) y0 = la; if (la > y1) y1 = la;
        }
      }
    });
    var my0 = mercY(y0), my1 = mercY(y1);
    geoBBox = { x0: x0 * RAD, x1: x1 * RAD, y0: Math.min(my0, my1), y1: Math.max(my0, my1) };
  }

  function buildBase() {
    var bw = geoBBox.x1 - geoBBox.x0, bh = geoBBox.y1 - geoBBox.y0;
    var s = Math.min(W / bw, H / bh) * 0.975;
    base = {
      s: s,
      ox: (W - bw * s) / 2 - geoBBox.x0 * s,
      oy: (H - bh * s) / 2 - geoBBox.y0 * s
    };
  }

  function px(lon, lat) { return [lon * RAD * base.s + base.ox, mercY(lat) * base.s + base.oy]; }

  /* ───────────────────────── 지오메트리 ───────────────────────── */

  function buildGeometry() {
    allPath = new Path2D();
    regions.forEach(function (r) {
      var path = new Path2D();
      var xs0 = 1e9, ys0 = 1e9, xs1 = -1e9, ys1 = -1e9;
      var rings = [];
      for (var p = 0; p < r.polys.length; p++) {
        var poly = r.polys[p];
        for (var q = 0; q < poly.length; q++) {
          var src = poly[q], n = src.length, arr = new Float32Array(n);
          for (var j = 0; j < n; j += 2) {
            var xy = px(src[j] / 1e5, src[j + 1] / 1e5);
            arr[j] = xy[0]; arr[j + 1] = xy[1];
            if (xy[0] < xs0) xs0 = xy[0]; if (xy[0] > xs1) xs1 = xy[0];
            if (xy[1] < ys0) ys0 = xy[1]; if (xy[1] > ys1) ys1 = xy[1];
          }
          rings.push(arr);
          path.moveTo(arr[0], arr[1]);
          for (var k = 2; k < n; k += 2) path.lineTo(arr[k], arr[k + 1]);
          path.closePath();
          allPath.moveTo(arr[0], arr[1]);
          for (var k2 = 2; k2 < n; k2 += 2) allPath.lineTo(arr[k2], arr[k2 + 1]);
          allPath.closePath();
        }
      }
      r.path = path;
      r.rings = rings;
      r.bbox = [xs0, ys0, xs1, ys1];
      r.cx = (xs0 + xs1) / 2; r.cy = (ys0 + ys1) / 2;
    });
    // 시도 라벨 위치(면적 가중 평균)
    var acc = {};
    regions.forEach(function (r) {
      var a = acc[r.sido] = acc[r.sido] || { x: 0, y: 0, w: 0, bx0: 1e9, by0: 1e9, bx1: -1e9, by1: -1e9 };
      a.x += r.cx * r.a; a.y += r.cy * r.a; a.w += r.a;
      if (r.bbox[0] < a.bx0) a.bx0 = r.bbox[0];
      if (r.bbox[1] < a.by0) a.by0 = r.bbox[1];
      if (r.bbox[2] > a.bx1) a.bx1 = r.bbox[2];
      if (r.bbox[3] > a.by1) a.by1 = r.bbox[3];
    });
    Object.keys(acc).forEach(function (k) {
      var a = acc[k];
      sidoList.forEach(function (s) {
        if (s.name === k) {
          s.lx = a.x / a.w; s.ly = a.y / a.w;
          s.bbox = [a.bx0, a.by0, a.bx1, a.by1];
        }
      });
    });
  }

  /* ───────────────────────── 값 · 색 ───────────────────────── */

  function countOf(r) {
    var c = 0;
    if (state.lv.k) c += r.k[0];
    if (state.lv.e) c += r.k[1];
    if (state.lv.m) c += r.k[2];
    if (state.lv.h) c += r.k[3];
    return c;
  }

  function valueOf(r) {
    var c = countOf(r);
    if (state.metric === 'count') return c;
    if (state.metric === 'area') return r.a > 0 ? c / r.a : null;
    return r.p > 0 ? c / (r.p / 1000) : null;
  }

  function computeBreaks() {
    var vals = [];
    for (var i = 0; i < regions.length; i++) {
      var v = valueOf(regions[i]);
      if (v !== null && v > 0) vals.push(v);
    }
    vals.sort(function (a, b) { return a - b; });
    breaks = [];
    if (!vals.length) { MAXV = 0; return; }
    for (var q = 1; q < 8; q++) {
      var idx = Math.min(vals.length - 1, Math.floor(vals.length * q / 8));
      breaks.push(vals[idx]);
    }
    MAXV = vals[vals.length - 1];
  }

  function classOf(v) {
    if (v === null || v <= 0) return -1;
    for (var i = 0; i < breaks.length; i++) if (v <= breaks[i]) return i;
    return 7;
  }

  function buildClassPaths() {
    classPaths = [];
    for (var c = 0; c < 8; c++) classPaths.push(new Path2D());
    var none = new Path2D();
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      var cls = classOf(valueOf(r));
      addTo(cls < 0 ? none : classPaths[cls], r);
    }
    classPaths.push(none);
  }

  function addTo(path, r) {
    var idx = 0;
    for (var p = 0; p < r.polys.length; p++) {
      var poly = r.polys[p];
      for (var q = 0; q < poly.length; q++) {
        var arr = r.rings[idx++];
        path.moveTo(arr[0], arr[1]);
        for (var k = 2; k < arr.length; k += 2) path.lineTo(arr[k], arr[k + 1]);
        path.closePath();
      }
    }
  }

  /* ───────────────────────── 그리기 ───────────────────────── */

  function draw() {
    if (!W || !H) return;
    var k = view.k, tx = view.tx, ty = view.ty;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#E1E7D8';
    ctx.fillRect(0, 0, W, H);

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);

    // 후버 강조된 지역은 아래에 깔기
    var seam = (k > 8 ? 1.2 : 0.5) / (k * dpr);
    for (var c = 0; c < classPaths.length; c++) {
      if (!classPaths[c]) continue;
      var col = c === 8 ? NOCLASS : RAMP[c];
      ctx.fillStyle = col;
      ctx.fill(classPaths[c]);
      if (k > 2.2) { ctx.strokeStyle = col; ctx.lineWidth = seam; ctx.stroke(classPaths[c]); }
    }

    if (outsidePath) {
      ctx.fillStyle = 'rgba(226,231,219,.82)';
      ctx.fill(outsidePath);
    }

    if (state.hover !== null && state.hover !== state.selected) {
      var hr = regions[state.hover];
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.fill(hr.path);
    }
    if (state.selected !== null) {
      var sr = regions[state.selected];
      ctx.fillStyle = 'rgba(255,194,75,.28)';
      ctx.fill(sr.path);
    }

    // 경계선
    if (k > 1.5) {
      ctx.lineWidth = (k > 5 ? 0.7 : 0.6) / (k * dpr);
      ctx.strokeStyle = 'rgba(252,250,242,.62)';
      ctx.stroke(allPath);
    }

    if (state.selected !== null) {
      ctx.lineWidth = 2.2 / (k * dpr);
      ctx.strokeStyle = '#C98A12';
      ctx.stroke(regions[state.selected].path);
    }
    if (state.hover !== null) {
      var h = regions[state.hover];
      ctx.lineWidth = 1.6 / (k * dpr);
      ctx.strokeStyle = 'rgba(13,43,34,.85)';
      ctx.stroke(h.path);
    }

    drawLabels(k, tx, ty);
    updateBadge();
  }

  function drawLabels(k, tx, ty) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var placed = [];
    function free(x, y, w, h) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (Math.abs(x - p.x) < (w + p.w) / 2 + 6 && Math.abs(y - p.y) < (h + p.h) / 2 + 4) return false;
      }
      return true;
    }

    // 시도 이름 (인구 많은 순으로 자리 잡기)
    if (k < 4.5) {
      ctx.font = '700 ' + Math.min(16, 12 + k * 1.1) + 'px Paperozi, sans-serif';
      var order = sidoList.slice().sort(function (a, b) { return b.pop - a.pop; });
      order.forEach(function (s) {
        if (!s.bbox) return;
        var cx = s.lx * k + tx, cy = s.ly * k + ty;
        var txt = shortSido(s.name);
        var tw = ctx.measureText(txt).width;
        var lh = 15;
        var cands = [[0, 0], [0, -lh - 2], [0, lh + 2], [-tw * 0.62, 0], [tw * 0.62, 0], [0, -2 * lh - 4], [0, 2 * lh + 4], [-tw * 0.62, -lh], [tw * 0.62, lh]];
        for (var i = 0; i < cands.length; i++) {
          var x = cx + cands[i][0], y = cy + cands[i][1];
          if (x < tw / 2 + 4 || x > W - tw / 2 - 4 || y < 12 || y > H - 12) continue;
          if (!free(x, y, tw, lh)) continue;
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3.4;
          ctx.strokeText(txt, x, y);
          ctx.fillStyle = 'rgba(20,58,32,.94)';
          ctx.fillText(txt, x, y);
          placed.push({ x: x, y: y, w: tw, h: lh });
          break;
        }
      });
    }

    // 행정동 이름
    if (k >= 3.2) {
      ctx.font = (k > 6 ? '400 11.5px ' : '400 10.5px ') + 'Paperozi, sans-serif';
      var shown = 0;
      var order2 = regions.slice().sort(function (a, b) { return b.a - a.a; });
      for (var i = 0; i < order2.length; i++) {
        if (shown > 260) break;
        var r = order2[i];
        var bw = (r.bbox[2] - r.bbox[0]) * k, bh2 = (r.bbox[3] - r.bbox[1]) * k;
        if (bw < 38) continue;
        var cx2 = r.cx * k + tx, cy2 = r.cy * k + ty;
        if (cx2 < -40 || cx2 > W + 40 || cy2 < -20 || cy2 > H + 20) continue;
        var tw2 = ctx.measureText(r.dong).width;
        if (!free(cx2, cy2, tw2, 12)) continue;
        ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 2.8;
        ctx.strokeText(r.dong, cx2, cy2);
        ctx.fillStyle = 'rgba(26,36,30,.92)';
        ctx.fillText(r.dong, cx2, cy2);
        placed.push({ x: cx2, y: cy2, w: tw2, h: 12 });
        shown++;
      }
    }
  }

  function updateBadge() {
    var el = $('#mapBadge');
    var scope = state.sido === 'ALL' ? '전국' : shortSido(state.sido);
    var n = state.sido === 'ALL' ? regions.length : regions.filter(function (r) { return r.sido === state.sido; }).length;
    el.innerHTML = '<b>' + scope + '</b> · ' + n.toLocaleString() + '개 행정동 · ' +
      METRIC[state.metric].short;
  }

  /* ───────────────────────── 상호작용 ───────────────────────── */

  function requestDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; draw(); });
  }

  function zoomAt(factor, cx, cy) {
    var nk = Math.max(1, Math.min(140, view.k * factor));
    var f = nk / view.k;
    view.tx = cx - (cx - view.tx) * f;
    view.ty = cy - (cy - view.ty) * f;
    view.k = nk;
  }

  function animateTo(target, dur) {
    if (anim) cancelAnimationFrame(anim.id);
    var from = { k: view.k, tx: view.tx, ty: view.ty };
    var t0 = performance.now();
    dur = dur || 420;
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      view.k = from.k + (target.k - from.k) * e;
      view.tx = from.tx + (target.tx - from.tx) * e;
      view.ty = from.ty + (target.ty - from.ty) * e;
      draw();
      if (p < 1) anim.id = requestAnimationFrame(step); else anim = null;
    }
    anim = { id: requestAnimationFrame(step) };
  }

  function fitBBox(bb, pad) {
    pad = pad || 0.86;
    var bw = Math.max(bb[2] - bb[0], 1e-6), bh = Math.max(bb[3] - bb[1], 1e-6);
    var k = Math.min(W / bw, H / bh) * pad;
    k = Math.max(1, Math.min(140, k));
    return {
      k: k,
      tx: W / 2 - k * (bb[0] + bb[2]) / 2,
      ty: H / 2 - k * (bb[1] + bb[3]) / 2
    };
  }

  function focusRegion(i, instant) {
    var r = regions[i];
    var t = fitBBox(r.bbox, 0.62);
    if (t.k < 4) t.k = Math.min(140, Math.max(4, view.k * 1.4));
    t.tx = W / 2 - t.k * r.cx; t.ty = H / 2 - t.k * r.cy;
    if (instant) { view = t; draw(); } else animateTo(t);
  }

  function hitTest(mx, my) {
    if (!base) return null;
    var bx = (mx - view.tx) / view.k, by = (my - view.ty) / view.k;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i], b = r.bbox;
      if (bx < b[0] || bx > b[2] || by < b[1] || by > b[3]) continue;
      if (inRings(r.rings, bx, by)) return i;
    }
    return null;
  }

  function inRings(rings, x, y) {
    var inside = false;
    for (var q = 0; q < rings.length; q++) {
      var a = rings[q], n = a.length;
      for (var i = 0, j = n - 2; i < n; j = i, i += 2) {
        var yi = a[i + 1], yj = a[j + 1];
        if ((yi > y) !== (yj > y)) {
          var xi = a[i], xj = a[j];
          if (x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
      }
    }
    return inside;
  }

  /* ───────────────────────── UI ───────────────────────── */

  var METRIC = {
    area: { short: '면적 km²당', unit: '명/km²', hint: '선택한 행정동의 경계 면적(km²)으로 나눈 값입니다. 좁은 동네에 학생이 몰릴수록 높아집니다.' },
    per1000: { short: '인구 1천명당', unit: '명/1천명', hint: '행정동 총인구 1,000명당 학령인구입니다. 동네 규모를 걷어내고 "아이 비중"을 봅니다.' },
    count: { short: '절대 학생 수', unit: '명', hint: '선택한 학령군 인원의 합계입니다. 학원·교재·강의 수요의 크기를 그대로 봅니다.' }
  };

  function fmt(n, d) {
    if (n === null || n === undefined) return '–';
    if (!isFinite(n)) return '–';
    if (d === undefined) d = (n >= 100 ? 0 : (n >= 10 ? 1 : 2));
    return n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  }
  function fmtVal(v) {
    if (v === null) return '–';
    if (state.metric === 'count') return fmt(Math.round(v)) + '명';
    return fmt(v, v >= 100 ? 0 : 1) + ' ' + METRIC[state.metric].unit;
  }

  function renderSummary() {
    var t = 0, p = 0, n = 0, active = false;
    for (var i = 0; i < regions.length; i++) {
      var v = countOf(regions[i]);
      t += v; p += regions[i].p;
      if (v > 0) { n++; active = true; }
    }
    var st = $('#sumTotal'), ss = $('#sumShare'), sc = $('#sumCount');
    if (!st) return;
    st.textContent = t.toLocaleString('ko-KR') + '명';
    ss.textContent = p > 0 ? (t / p * 100).toFixed(1) + '%' : '–';
    sc.textContent = n.toLocaleString('ko-KR') + ' / 3,559';
    st.style.color = active ? '' : '#B4553F';
  }

  function refresh() {
    computeBreaks();
    renderSummary();
    buildClassPaths();
    renderLegend();
    renderRank();
    renderDetail();
    draw();
  }

  function renderLegend() {
    var bar = $('#legendBar');
    bar.style.background = 'linear-gradient(90deg,' + RAMP.join(',') + ')';
    var sc = $('#legendScale');
    if (!breaks.length) { sc.innerHTML = '<span>값 없음</span>'; return; }
    var lo = 0, hi = MAXV;
    sc.innerHTML = '<span>' + fmt(lo) + '</span><span>' + fmt(breaks[3]) + '</span><span>' + fmt(hi) + ' ' +
      (state.metric === 'count' ? '명' : METRIC[state.metric].unit) + '</span>';

    var ms = $('#mapScale');
    ms.classList.add('show');
    ms.innerHTML = '<div class="sc-bar" style="background:linear-gradient(90deg,' + RAMP.join(',') + ')"></div>' +
      '<div class="sc-lbl"><span>' + fmt(lo) + '</span><span>' + fmt(hi) + ' ' + METRIC[state.metric].unit + '</span></div>';
  }

  function candidateRegions() {
    var list = regions;
    if (state.sido !== 'ALL') list = regions.filter(function (r) { return r.sido === state.sido; });
    return list;
  }

  function renderRank() {
    var list = candidateRegions().map(function (r) { return { r: r, v: valueOf(r) }; })
      .filter(function (o) { return o.v !== null && o.v > 0; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 10);
    var ol = $('#rankList');
    var max = list.length ? list[0].v : 1;
    $('#rankTitle').textContent = (state.sido === 'ALL' ? '전국' : shortSido(state.sido)) + ' TOP 10';
    $('#rankUnit').textContent = METRIC[state.metric].unit;
    ol.innerHTML = '';
    if (!list.length) {
      ol.innerHTML = '<li class="detail-empty">선택한 조건에 값이 있는 행정동이 없습니다.</li>';
      return;
    }
    list.forEach(function (o, idx) {
      var li = document.createElement('li');
      li.className = 'rank-item' + (state.selected === o.r.i ? ' on' : '');
      li.innerHTML =
        '<span class="rank-no">' + (idx + 1) + '</span>' +
        '<span class="rank-mid"><span class="rank-nm">' + esc(o.r.dong) + '</span>' +
        '<span class="rank-sgg">' + esc(shortSido(o.r.sido) + ' ' + shortSgg(o.r.sgg)) + '</span>' +
        '<span class="rank-bar"><i style="width:' + Math.max(3, (o.v / max) * 100) + '%"></i></span></span>' +
        '<span class="rank-v">' + fmtVal(o.v) + '</span>';
      li.addEventListener('click', function () {
        select(o.r.i, true);
        closeSheets();
      });
      ol.appendChild(li);
    });
  }

  function renderDetail() {
    var box = $('#detailBody');
    if (state.selected === null) {
      box.className = 'detail-empty';
      box.innerHTML = '지도에서 행정동을 클릭하거나 순위를 눌러 보세요.';
      return;
    }
    var r = regions[state.selected];
    box.className = '';
    var tot = countOf(r);
    var perKm = r.a > 0 ? tot / r.a : null;
    var per1000 = r.p > 0 ? tot / (r.p / 1000) : null;
    var maxBand = Math.max(r.k[0], r.k[1], r.k[2], r.k[3], 1);
    var names = ['유치원', '초등학교', '중학교', '고등학교'];
    var rows = r.k.map(function (v, i) {
      return '<div class="dt-row"><span class="dot" style="--c:' + ['#F2B33D', '#6BA55F', '#428448', '#1B5230'][i] +
        ';background:' + ['#F2B33D', '#6BA55F', '#428448', '#1B5230'][i] + '"></span>' +
        '<span class="lb">' + names[i] + '</span>' +
        '<span class="bb"><i style="width:' + Math.round(v / maxBand * 100) + '%"></i></span>' +
        '<span class="vv">' + fmt(v) + '</span></div>';
    }).join('');

    box.innerHTML =
      '<div class="dt-title">' + esc(r.dong) + '</div>' +
      '<div class="dt-sub">' + esc(r.sido + ' ' + shortSgg(r.sgg)) + ' · ' + r.c + '</div>' +
      '<div class="dt-grid">' +
      cell('선택 학령 합계', fmt(tot) + '명') +
      cell('총인구', fmt(r.p) + '명') +
      cell('면적', fmt(r.a, 2) + ' km²') +
      cell('면적당', perKm === null ? '–' : fmt(perKm, 1) + ' 명/km²') +
      cell('인구 1천명당', per1000 === null ? '–' : fmt(per1000, 1) + '명') +
      cell('학령 비중', r.p > 0 ? fmt(tot / r.p * 100, 1) + '%' : '–') +
      '</div><div class="dt-rows">' + rows + '</div>';
  }

  function cell(k, v) {
    return '<div class="dt-cell"><span>' + k + '</span><b>' + v + '</b></div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function select(i, zoom) {
    state.selected = i;
    if (zoom) focusRegion(i);
    renderRank(); renderDetail(); requestDraw();
  }

  /* ───────────────────────── 시도 버튼 / 검색 ───────────────────────── */

  function buildSidoGrid() {
    var grid = $('#sidoGrid');
    grid.innerHTML = '';
    var allBtn = document.createElement('button');
    allBtn.type = 'button'; allBtn.className = 'sido-btn all on'; allBtn.textContent = '전국';
    allBtn.dataset.sido = 'ALL';
    grid.appendChild(allBtn);
    sidoList.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sido-btn'; b.textContent = shortSido(s.name);
      b.title = s.name + ' · ' + s.n + '개 행정동';
      b.dataset.sido = s.name;
      grid.appendChild(b);
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.sido-btn');
      if (!b) return;
      setSido(b.dataset.sido);
    });
  }

  function buildOutside() {
    outsidePath = null;
    if (state.sido === 'ALL') return;
    var p = new Path2D();
    for (var i = 0; i < regions.length; i++) {
      if (regions[i].sido !== state.sido) addTo(p, regions[i]);
    }
    outsidePath = p;
  }

  function setSido(name) {
    state.sido = name;
    buildOutside();
    Array.prototype.forEach.call(document.querySelectorAll('.sido-btn'), function (b) {
      b.classList.toggle('on', b.dataset.sido === name);
    });
    renderRank();
    closeSheets();
    if (name === 'ALL') { animateTo({ k: 1, tx: 0, ty: 0 }); }
    else {
      var s = sidoList.filter(function (x) { return x.name === name; })[0];
      if (s && s.bbox) animateTo(fitBBox(s.bbox, 0.92));
    }
  }

  function setupSearch() {
    var input = $('#searchInput'), box = $('#searchResults');
    function run() {
      var q = input.value.trim();
      if (q.length < 1) { box.hidden = true; box.innerHTML = ''; return; }
      var hits = regions.filter(function (r) { return r.n.indexOf(q) >= 0 || r.dong.indexOf(q) >= 0; })
        .map(function (r) { return { r: r, v: valueOf(r) }; })
        .sort(function (a, b) { return (b.v || 0) - (a.v || 0); })
        .slice(0, 8);
      if (!hits.length) {
        box.innerHTML = '<div class="empty">검색 결과가 없습니다.</div>';
      } else {
        box.innerHTML = hits.map(function (o, i) {
          return '<button type="button" data-i="' + o.r.i + '"><span class="sr-name">' +
            esc(o.r.n) + '</span><span class="sr-v">' + fmtVal(o.v) + '</span></button>';
        }).join('');
      }
      box.hidden = false;
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      var i = +b.dataset.i;
      select(i, true);
      input.value = regions[i].n;
      box.hidden = true;
      closeSheets();
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) box.hidden = true;
    });
  }

  /* ───────────────────────── 시트(모바일) ───────────────────────── */

  function closeSheets() {
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('open'); });
    document.querySelectorAll('.mobile-bar button').forEach(function (b) { b.classList.remove('on'); });
  }

  function setupSheets() {
    document.querySelectorAll('.mobile-bar button').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = document.getElementById(b.dataset.sheet);
        var wasOpen = t.classList.contains('open');
        closeSheets();
        if (!wasOpen) { t.classList.add('open'); b.classList.add('on'); }
      });
    });
    document.querySelectorAll('[data-close-sheet]').forEach(function (b) {
      b.addEventListener('click', closeSheets);
    });
  }

  function setupControls() {
    $('#levelChecks').addEventListener('change', function () {
      document.querySelectorAll('#levelChecks input').forEach(function (inp) {
        state.lv[inp.value] = inp.checked;
      });
      refresh();
    });
    $('#allOn').addEventListener('click', function () {
      document.querySelectorAll('#levelChecks input').forEach(function (i) { i.checked = true; state.lv[i.value] = true; });
      refresh();
    });
    $('#allOff').addEventListener('click', function () {
      document.querySelectorAll('#levelChecks input').forEach(function (i) { i.checked = false; state.lv[i.value] = false; });
      refresh();
    });
    $('#metricRadios').addEventListener('change', function (e) {
      state.metric = e.target.value;
      $('#metricHint').textContent = METRIC[state.metric].hint;
      refresh();
    });
    $('#zoomIn').addEventListener('click', function () { zoomAt(1.6, W / 2, H / 2); draw(); });
    $('#zoomOut').addEventListener('click', function () { zoomAt(1 / 1.6, W / 2, H / 2); draw(); });
    $('#zoomFit').addEventListener('click', function () { animateTo({ k: 1, tx: 0, ty: 0 }); });
    $('#resetBtn').addEventListener('click', function () {
      state.sido = 'ALL'; state.selected = null; state.hover = null;
      buildOutside();
      document.querySelectorAll('.sido-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.sido === 'ALL'); });
      refresh(); animateTo({ k: 1, tx: 0, ty: 0 });
    });
    $('#infoBtn').addEventListener('click', function () { $('#infoModal').hidden = false; });
    document.querySelectorAll('[data-close-modal]').forEach(function (b) {
      b.addEventListener('click', function () { $('#infoModal').hidden = true; });
    });
    $('#infoModal').addEventListener('click', function (e) {
      if (e.target.id === 'infoModal') $('#infoModal').hidden = true;
    });
  }

  /* ───────────────────────── 지도 이벤트 ───────────────────────── */

  var pointers = new Map(), drag = null, pinch = null;

  function localXY(e) {
    var rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function setupMap() {
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localXY(e));
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: 0 };
      } else if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinch = {
          d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
          k: view.k, tx: view.tx, ty: view.ty,
          cx: (pts[0][0] + pts[1][0]) / 2, cy: (pts[0][1] + pts[1][1]) / 2
        };
        drag = null;
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      var xy = localXY(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, xy);

      if (pinch && pointers.size >= 2) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        var f = Math.max(0.2, Math.min(5, d / (pinch.d || 1)));
        var nk = Math.max(1, Math.min(140, pinch.k * f));
        var cx = (pts[0][0] + pts[1][0]) / 2, cy = (pts[0][1] + pts[1][1]) / 2;
        var r = nk / pinch.k;
        view.k = nk;
        view.tx = cx - (pinch.cx - pinch.tx) * r;
        view.ty = cy - (pinch.cy - pinch.ty) * r;
        canvas.classList.add('dragging');
        requestDraw();
        return;
      }

      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
        if (drag.moved > 3) {
          view.tx = drag.tx + dx; view.ty = drag.ty + dy;
          canvas.classList.add('dragging');
          requestDraw();
        }
        return;
      }

      // hover
      var i = hitTest(xy[0], xy[1]);
      if (i !== state.hover) {
        state.hover = i;
        showTooltip(i, xy[0], xy[1]);
        requestDraw();
      } else if (i !== null) {
        positionTooltip(xy[0], xy[1]);
      }
    });

    function endPointer(e) {
      var wasDrag = drag && drag.moved > 3;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !wasDrag) {
        var xy = localXY(e);
        var i = hitTest(xy[0], xy[1]);
        if (i !== null) select(i, false);
      }
      drag = null;
      canvas.classList.remove('dragging');
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', function (e) {
      pointers.delete(e.pointerId); drag = null; pinch = null;
      canvas.classList.remove('dragging');
    });
    canvas.addEventListener('pointerleave', function () {
      if (state.hover !== null) { state.hover = null; hideTooltip(); requestDraw(); }
    });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var xy = localXY(e);
      var f = Math.pow(1.0016, -e.deltaY);
      zoomAt(f, xy[0], xy[1]);
      requestDraw();
    }, { passive: false });

    canvas.addEventListener('dblclick', function (e) {
      var xy = localXY(e);
      zoomAt(e.shiftKey ? 1 / 1.9 : 1.9, xy[0], xy[1]);
      draw();
    });
  }

  function showTooltip(i, x, y) {
    var tt = $('#tooltip');
    if (i === null) { hideTooltip(); return; }
    var r = regions[i];
    var names = ['유치원', '초등학교', '중학교', '고등학교'];
    var key = ['k', 'e', 'm', 'h'];
    var rows = r.k.map(function (v, idx) {
      var on = state.lv[key[idx]];
      return '<div class="tt-row"><span>' + names[idx] + '</span><b' + (on ? ' class="tt-hi"' : '') + '>' + fmt(v) + '명</b></div>';
    }).join('');
    var v = valueOf(r);
    tt.innerHTML =
      '<h5>' + esc(r.dong) + '</h5>' +
      '<div class="tt-sido">' + esc(r.sido + ' ' + shortSgg(r.sgg)) + '</div>' +
      rows +
      '<div class="tt-sep"></div>' +
      '<div class="tt-row"><span>선택 합계</span><b>' + fmt(countOf(r)) + '명</b></div>' +
      '<div class="tt-row"><span>' + METRIC[state.metric].short + '</span><b>' + fmtVal(v) + '</b></div>';
    tt.classList.add('on');
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    var tt = $('#tooltip');
    var w = tt.offsetWidth, h = tt.offsetHeight;
    var left = x + 16, top = y + 16;
    if (left + w > W - 6) left = x - w - 14;
    if (top + h > H - 6) top = y - h - 12;
    tt.style.left = Math.max(4, left) + 'px';
    tt.style.top = Math.max(4, top) + 'px';
  }

  function hideTooltip() { $('#tooltip').classList.remove('on'); }

  /* ───────────────────────── 크기 ───────────────────────── */

  function resize() {
    var wrap = $('#mapwrap');
    var rect = wrap.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(rect.width);
    H = Math.round(rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    buildBase();
    buildGeometry();
    buildClassPaths();
    draw();
  }

  /* ───────────────────────── 시작 ───────────────────────── */

  function boot() {
    canvas = $('#map');
    ctx = canvas.getContext('2d', { alpha: false });
    fetchData().then(function (data) {
      prepare(data);
      computeGeoBBox();
      buildSidoGrid();
      setupSearch();
      setupSheets();
      setupControls();
      setupMap();

      var wrap = $('#mapwrap');
      var rect = wrap.getBoundingClientRect();
      W = Math.round(rect.width); H = Math.round(rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      buildBase();
      buildGeometry();
      refresh();

      window.__SH = { get base(){return base}, get bbox(){return geoBBox}, get view(){return view}, get W(){return W}, get H(){return H}, regionAt:function(i){return regions[i];}, count:regions.length, draw:draw, zoomAt:zoomAt, setSido:setSido };
      $('#loading').classList.add('off');
      setTimeout(function () { $('#loading').style.display = 'none'; }, 400);

      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(resize, 140);
      });
      // 초기 안내: 상위 지역으로 살짝 줌인 효과
      setTimeout(function () { draw(); }, 60);
    }).catch(function (err) {
      $('#loading').innerHTML = '<p style="max-width:280px;text-align:center">지도 데이터를 불러오지 못했습니다.<br>' + esc(err.message) + '</p>';
      console.error(err);
    });
  }

  function start() { if (booted) return; booted = true; boot(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
