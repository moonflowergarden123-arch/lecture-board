/* 더콘텐츠스쿨 · 탄생월 맞춤 합격 부적 — 앱 로직 */
(function () {
  var MONTHS = window.MONTHS, EXAMS = window.EXAMS;
  var state = { month: null, exam: 'suneung', name: '', canvas: null, opts: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  var monthBox = $('#monthChips'), examBox = $('#examChips');
  var form = $('#pickForm'), stage = $('#stage'), flip = $('#flipCard');
  var resultBox = $('#result'), resultImg = $('#resultImg'), resultCap = $('#resultCap'), examTip = $('#examTip');
  var warn = $('#formWarn'), drawBtn = $('#drawBtn');

  /* ── D-Day — 2028학년도 수능(교육부 발표: 2027. 11. 18. 목) ── */
  (function heroDday() {
    var box = document.getElementById('heroDday');
    var num = document.getElementById('heroDdayNum');
    var when = document.getElementById('heroDdayWhen');
    var iso = (EXAMS.suneung && EXAMS.suneung.date) || '';
    if (!box || !num || !when || !iso) return;
    var p = iso.split('-');
    var target = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    var kst = new Date(Date.now() + 9 * 60 * 60 * 1000);   /* 한국 시간 기준 날짜 */
    var today = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
    var left = Math.round((target - today) / 86400000);
    if (left > 0) { when.textContent = '수능까지'; num.textContent = 'D-' + left; }
    else if (left === 0) { when.textContent = '오늘'; num.textContent = '수능 D-DAY'; }
    else { when.textContent = '2028학년도 수능'; num.textContent = 'D+' + (-left); }
    box.hidden = false;
  })();

  /* 월 칩 */
  MONTHS.forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.month = m.month;
    b.innerHTML = m.month + '월<small>' + m.sign.replace('자리', '') + '</small>';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      state.month = m.month;
      $$('.chip', monthBox).forEach(function (c) {
        var on = c === b; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on);
      });
      warn.hidden = true;
    });
    monthBox.appendChild(b);
  });

  /* 시험 유형 칩 */
  Object.keys(EXAMS).forEach(function (k) {
    var e = EXAMS[k];
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (k === state.exam ? ' is-on' : '');
    b.dataset.exam = k; b.textContent = e.label;
    b.setAttribute('aria-pressed', k === state.exam);
    b.addEventListener('click', function () {
      state.exam = k;
      $$('.chip', examBox).forEach(function (c) {
        var on = c.dataset.exam === k; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on);
      });
    });
    examBox.appendChild(b);
  });

  /* 탭 */
  var thumbsBuilt = false;
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tab').forEach(function (x) {
        var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on);
      });
      var id = t.dataset.tab;
      $('#tab-pick').classList.toggle('is-on', id === 'pick');
      $('#tab-all').classList.toggle('is-on', id === 'all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (id === 'all' && !thumbsBuilt) { thumbsBuilt = true; buildGrid(); }
    });
  });

  /* 1~12월 그리드 */
  function buildGrid() {
    var grid = $('#monthGrid');
    MONTHS.forEach(function (m) {
      var tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML =
        '<div class="thumb"><img loading="lazy" alt="' + m.month + '월 ' + m.sign + ' 합격 부적" src="cards/thumb_' +
        pad2(m.month) + '.jpg"></div>' +
        '<div class="meta"><div class="name">' + m.month + '월 · ' + m.sign +
        '<span>' + m.motive + ' · ' + m.tarot.name + '</span></div>' +
        '<button class="save" type="button">PNG</button></div>';
      grid.appendChild(tile);
      var opts = { month: m, exam: EXAMS.general, name: '' };
      $('.save', tile).addEventListener('click', function (ev) {
        var btn = ev.currentTarget;
        btn.disabled = true; btn.textContent = '저장중';
        window.TarotCard.download(1080, opts, fileBase(m)).then(function () {
          btn.disabled = false; btn.textContent = 'PNG';
          toast(m.month + '월 부적을 저장했어요');
        }, function () {
          btn.disabled = false; btn.textContent = 'PNG';
          toast('저장에 실패했어요. 잠시 후 다시 눌러 주세요');
        });
      });
    });
  }

  function fileBase(m) { return pad2(m.month) + '월_' + m.sign + '_합격부적.png'; }
  function userFile(m, name) {
    return pad2(m.month) + '월_' + m.sign + '_합격부적' + (name ? '_' + name : '') + '.png';
  }

  /* 뽑기 */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!state.month) {
      warn.hidden = false;
      form.classList.add('shake');
      setTimeout(function () { form.classList.remove('shake'); }, 420);
      return;
    }
    state.name = ($('#nameInput').value || '').trim().slice(0, 12);
    var m = MONTHS[state.month - 1];
    state.opts = { month: m, exam: EXAMS[state.exam], name: state.name };

    drawBtn.disabled = true;
    drawBtn.textContent = '부적에 이름을 쓰는 중…';
    window.TarotCard.preload(m.month).then(function () {
      var c = window.TarotCard.render(1080, state.opts);
      state.canvas = c;
      resultImg.src = c.toDataURL('image/png');
      stage.hidden = false;
      stage.classList.add('is-on');
      var already = flip.classList.contains('is-turn');
      if (already) {
        flip.classList.remove('pop');
        void flip.offsetWidth;
        flip.classList.add('pop');
      } else {
        flip.classList.remove('is-turn');
      }
      stage.classList.remove('burst');
      resultBox.classList.remove('is-on');
      resultBox.hidden = true;
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setTimeout(function () {
        if (!already) flip.classList.add('is-turn');
        stage.classList.add('burst');
      }, already ? 30 : 260);
      setTimeout(function () {
        resultBox.hidden = false;
        resultBox.classList.add('is-on');
        var who = state.name ? state.name + ' 님' : '수험생 님';
        resultCap.textContent = who + '의 ' + m.month + '월 ' + m.motive + ' 부적이 도착했어요';
        examTip.innerHTML = '<b>시험장 한 마디</b> · ' + EXAMS[state.exam].tip;
      }, 1250);

      drawBtn.disabled = false;
      drawBtn.textContent = '다시 뽑기';
    }, function () {
      drawBtn.disabled = false;
      drawBtn.textContent = '내 부적 뽑기';
      toast('부적 그림을 불러오지 못했어요. 다시 시도해 주세요');
    });
  });

  /* 저장 */
  $('#saveBtn').addEventListener('click', function () {
    if (!state.opts) return;
    var btn = this;
    btn.disabled = true; btn.textContent = '이미지 만드는 중…';
    window.TarotCard.download(1080, state.opts, userFile(state.opts.month, state.name)).then(function () {
      btn.disabled = false; btn.textContent = '📥 내 휴대폰에 이미지로 저장';
      toast('부적을 저장했어요. 사진첩을 확인해 보세요');
    }, function () {
      btn.disabled = false; btn.textContent = '📥 내 휴대폰에 이미지로 저장';
      toast('저장에 실패했어요. 잠시 후 다시 눌러 주세요');
    });
  });

  /* 공유 */
  $('#shareBtn').addEventListener('click', function () {
    var m = state.opts && state.opts.month;
    if (!m) return;
    var who = state.name ? state.name + ' 님' : '수험생 님';
    var text = who + '의 ' + m.month + '월 합격 부적 · ' + m.motive + ' · ' + m.tarot.name + '\n합격을 기원합니다!';
    var url = location.href.split('#')[0];
    var nav = navigator;
    if (state.canvas && nav.canShare && window.File) {
      state.canvas.toBlob(function (blob) {
        var file = new File([blob], userFile(m, state.name), { type: 'image/png' });
        if (nav.canShare({ files: [file] })) {
          nav.share({ files: [file], text: text + '\n' + url }).catch(function () {});
          return;
        }
        shareUrl();
      }, 'image/png');
      return;
    }
    shareUrl();

    function shareUrl() {
      if (nav.share) {
        nav.share({ title: '탄생월 맞춤 합격 부적', text: text, url: url }).catch(function () {});
      } else if (nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text + '\n' + url).then(function () {
          toast('링크를 복사했어요. 카톡에 붙여 넣어 주세요');
        }, function () { toast('주소창의 링크를 복사해 공유해 주세요'); });
      } else {
        toast('주소창의 링크를 복사해 공유해 주세요');
      }
    }
  });

  /* 토스트 */
  var toastEl = $('#toast'), toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* 헤드리스 배치용 */
  window.__tarotExport = function (month, name, examKey) {
    var m = MONTHS[month - 1];
    var opts = { month: m, exam: EXAMS[examKey || 'suneung'], name: name || '' };
    return window.TarotCard.preload(m.month).then(function () {
      return window.TarotCard.dataUrl(1080, opts);
    });
  };
  window.__tarotReady = window.TarotCard.preload();
})();
