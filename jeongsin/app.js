/* 정신여고 2026 학사·공지 대시보드 */
(() => {
  'use strict';

  const KEY_MINE = 'jeongsin_board_mine_v1';
  const KEY_STAR = 'jeongsin_board_star_v1';
  const KEY_CHECK = 'jeongsin_board_check_v1';
  const KEY_PLAN  = 'jeongsin_exam_plan_v1';
  const DAY_MAX_MS = 1000 * 60 * 60 * 24;

  const load = (k, def) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? def : v;
    } catch (e) { return def; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const mine = new Set(load(KEY_MINE, []));
  const star = new Set(load(KEY_STAR, []));
  const checks = new Set(load(KEY_CHECK, []));
  let plan = load(KEY_PLAN, []);
  if (!Array.isArray(plan)) plan = [];

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const KIND = {
    exam:     { label: '시험·평가', cls: 'exam' },
    vacation: { label: '휴업·방학', cls: 'vacation' },
    event:    { label: '행사',      cls: 'event' },
    holiday:  { label: '공휴일',    cls: 'holiday' },
    notice:   { label: '안내',      cls: 'notice' }
  };
  const PRIORITY = { exam: 5, event: 4, notice: 3, vacation: 2, holiday: 1 };

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const todayISO = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const diffDays = (aISO, bISO) => Math.round((parseISO(aISO) - parseISO(bISO)) / DAY_MAX_MS);
  const fmtDate = s => { const d = parseISO(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const fmtDateLong = s => { const d = parseISO(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };

  let DATA = null;
  let kindFilter = 'all';
  let catFilter = '전체';
  let query = '';

  /* ── header / sources ───────────────────────────── */
  function renderHeader() {
    const m = DATA.meta;
    $('#asOf').textContent = m.asOfLabel;

    const panel = $('#srcPanel');
    const parts = [];
    parts.push('<p class="cap">출처</p><ul>');
    m.sources.forEach(s => {
      parts.push(`<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a><br><span>${s.detail}</span></li>`);
    });
    parts.push('</ul><p class="cap" style="margin-top:12px">확인하지 못한 부분</p><ul>');
    m.cautions.forEach(c => parts.push(`<li>${c}</li>`));
    parts.push('</ul>');
    panel.innerHTML = parts.join('');

    const toggle = $('#srcToggle');
    toggle.addEventListener('click', () => {
      const open = panel.hasAttribute('hidden');
      if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '출처·한계 접기' : '출처·한계 보기';
    });
  }

  /* ── D-day ──────────────────────────────────────── */
  function renderDday() {
    const box = $('#dday');
    const today = todayISO();
    const withId = DATA.events.map((e, i) => ({ ...e, id: 'e' + i }));
    const upcoming = withId
      .filter(e => (e.endDate || e.date) >= today && e.title !== '토요휴업일')
      .sort((a, b) => (a.date === b.date ? (PRIORITY[b.kind] || 0) - (PRIORITY[a.kind] || 0) : a.date < b.date ? -1 : 1));

    if (!upcoming.length) {
      box.innerHTML = '<div class="dday-skel">확인된 남은 일정이 없습니다. 학교 공지로 확인하세요.</div>';
      return;
    }
    const top = upcoming[0];
    const d = diffDays(top.date, today);
    const dLabel = d === 0 ? 'D-DAY' : `D-${d}`;
    const k = KIND[top.kind] || KIND.notice;

    const nexts = upcoming.slice(1, 4);
    box.innerHTML = `
      <div class="dday-main">
        <div class="dday-num">${dLabel}</div>
        <div class="dday-body">
          <p class="dday-kicker">가장 가까운 ${k.label}</p>
          <p class="dday-title">${top.title}</p>
          <p class="dday-meta">${fmtDateLong(top.date)}${top.endDate ? ` ~ ${fmtDateLong(top.endDate)}` : ''}${top.time ? ' · ' + top.time : ''} · ${top.grades}</p>
        </div>
      </div>
      ${nexts.length ? `<div class="dday-next">${nexts.map(n =>
        `<span class="next-pill"><b>${fmtDate(n.date)}</b> ${n.title}</span>`).join('')}</div>` : ''}
    `;
  }

  /* ── timeline ───────────────────────────────────── */
  function kindMatches(e) {
    if (kindFilter === 'all') return true;
    if (kindFilter === 'mine') return mine.has(e.id) || star.has(e.id);
    if (kindFilter === 'exam') return e.kind === 'exam';
    if (kindFilter === 'vacation') return e.kind === 'vacation' || e.kind === 'holiday';
    if (kindFilter === 'event') return e.kind === 'event' || e.kind === 'notice';
    return true;
  }

  function renderTimeline() {
    const wrap = $('#timeline');
    wrap.innerHTML = '';
    const today = todayISO();
    const rows = DATA.events.map((e, i) => ({ ...e, id: 'e' + i })).filter(kindMatches);

    if (!rows.length) {
      wrap.appendChild(el('p', 'ev-empty', '표시할 일정이 없습니다. 필터를 바꿔 보세요.'));
      return;
    }

    let curMonth = '';
    rows.forEach(e => {
      const month = e.date.slice(0, 7);

      if (month !== curMonth) {
        curMonth = month;
        const cnt = rows.filter(r => r.date.slice(0, 7) === month).length;
        const [y, m] = month.split('-');
        const head = el('div', 'month-head',
          `<h3>${y}년 ${Number(m)}월</h3><span class="m-line"></span><span class="m-cnt">${cnt}개</span>`);
        wrap.appendChild(head);
      }

      const start = parseISO(e.date);
      const isToday = e.date <= today && (e.endDate || e.date) >= today;
      const isPast = (e.endDate || e.date) < today;
      const k = KIND[e.kind] || KIND.notice;

      const node = el('article', `ev${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`);
      node.innerHTML = `
        <div class="ev-date">
          <span class="dnum">${start.getMonth() + 1}/${start.getDate()}</span>
          <span class="dow">${DOW[start.getDay()]}요일</span>
          ${isToday ? '<span class="ev-dev">오늘</span>' : ''}
        </div>
        <div class="ev-main">
          <div class="ev-title">
            <span>${e.title}</span>
            ${e.endDate ? `<span class="range">~ ${fmtDate(e.endDate)}</span>` : ''}
            <span class="tag ${k.cls}">${k.label}</span>
            <span class="tag grade">${e.grades}</span>
          </div>
          ${e.time ? `<p class="ev-time">🕒 ${e.time}</p>` : ''}
          ${e.desc ? `<p class="ev-desc">${e.desc}</p>` : ''}
        </div>
        <div class="ev-acts">
          <button type="button" class="ev-btn star${star.has(e.id) ? ' on' : ''}" data-act="star" data-id="${e.id}">${star.has(e.id) ? '★ 중요' : '☆ 중요'}</button>
          <button type="button" class="ev-btn${mine.has(e.id) ? ' on' : ''}" data-act="mine" data-id="${e.id}">${mine.has(e.id) ? '✓ 내 일정' : '＋ 내 일정'}</button>
        </div>
      `;
      wrap.appendChild(node);
    });
  }

  function bindTimeline() {
    $('#timeline').addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'star') {
        star.has(id) ? star.delete(id) : star.add(id);
        save(KEY_STAR, [...star]);
      } else {
        mine.has(id) ? mine.delete(id) : mine.add(id);
        save(KEY_MINE, [...mine]);
      }
      renderTimeline();
    });

    $('#kindFilter').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-kind]');
      if (!b) return;
      kindFilter = b.dataset.kind;
      [...$('#kindFilter').children].forEach(c => c.classList.toggle('is-on', c === b));
      renderTimeline();
    });
  }

  /* ── notices ────────────────────────────────────── */
  const CAT_CLS = { '시험·평가': 'exam', '진로·입시': 'ent', '학사·행사': 'sch' };

  function renderNotices() {
    const wrap = $('#noticeList');
    wrap.innerHTML = '';
    const q = query.trim().toLowerCase();
    const list = DATA.notices.filter(n => {
      if (catFilter !== '전체' && n.category !== catFilter) return false;
      if (!q) return true;
      const hay = [n.title, n.dept, n.board, n.category, ...(n.summary || [])].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => (a.date < b.date ? 1 : -1));

    if (!list.length) {
      const p = el('p', 'no-result', '조건에 맞는 공지가 없습니다. 검색어를 줄여 보세요.');
      p.style.gridColumn = '1 / -1';
      wrap.appendChild(p);
      return;
    }

    list.forEach(n => {
      const link = DATA.meta.boards[n.board] || DATA.meta.school.homepage;
      const cls = CAT_CLS[n.category] || 'sch';
      const card = el('article', `note cat-${cls}`);
      card.innerHTML = `
        <div class="note-top">
          <span class="note-date">${n.date.replace(/-/g, '.')}</span>
          <span class="note-board">${n.board}</span>
          <span class="note-cat ${cls}">${n.category}</span>
          ${n.upcoming ? '<span class="note-now">확인 필요</span>' : ''}
        </div>
        <h3>${n.title}</h3>
        <ul>${(n.summary || []).map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="note-foot">
          <span class="note-dept">${n.dept}</span>
          <a class="note-link" href="${link}" target="_blank" rel="noopener">원문 보기 ↗</a>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  function bindNotices() {
    $('#q').addEventListener('input', e => { query = e.target.value; renderNotices(); });
    $('#catFilter').addEventListener('click', e => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      catFilter = b.dataset.cat;
      [...$('#catFilter').children].forEach(c => c.classList.toggle('is-on', c === b));
      renderNotices();
    });
  }

  /* ── checklist ──────────────────────────────────── */
  function renderChecklist() {
    const wrap = $('#checklist');
    wrap.innerHTML = '';
    const all = DATA.checklist.flatMap(g => g.items.map(i => i.id));

    DATA.checklist.forEach(group => {
      const card = el('section', 'cgroup', `<h3>${group.group}</h3>`);
      group.items.forEach(item => {
        const label = el('label', 'citem');
        const on = checks.has(item.id);
        label.innerHTML = `
          <input type="checkbox" data-id="${item.id}" ${on ? 'checked' : ''}>
          <span class="ctxt">${item.text}${item.why ? `<span class="cwhy">${item.why}</span>` : ''}</span>
        `;
        card.appendChild(label);
      });
      wrap.appendChild(card);
    });

    const done = all.filter(id => checks.has(id)).length;
    $('#progBar').style.width = all.length ? `${(done / all.length) * 100}%` : '0%';
    $('#progText').textContent = `${done} / ${all.length} 완료`;
  }

  function bindChecklist() {
    $('#checklist').addEventListener('change', e => {
      const cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      cb.checked ? checks.add(cb.dataset.id) : checks.delete(cb.dataset.id);
      save(KEY_CHECK, [...checks]);
      const all = DATA.checklist.flatMap(g => g.items.map(i => i.id));
      const done = all.filter(id => checks.has(id)).length;
      $('#progBar').style.width = all.length ? `${(done / all.length) * 100}%` : '0%';
      $('#progText').textContent = `${done} / ${all.length} 완료`;
    });
  }

  /* ── exam · 기출 탭 ─────────────────────────────── */
  function renderExamLinks() {
    const wrap = $('#examLinks');
    if (!wrap) return;
    wrap.innerHTML = DATA.exam.links.map(l => `
      <a class="exlink ${l.tier === 'hero' ? 'hero' : 'sub'}" href="${esc(l.url)}" target="_blank" rel="noopener">
        <div class="exlink-top">
          <span class="exlink-emoji" aria-hidden="true">${l.emoji}</span>
          <span class="exlink-title">${esc(l.title)}</span>
        </div>
        <p class="exlink-sub">${esc(l.sub)}</p>
        <div class="exlink-foot">
          <span class="exlink-cta">${esc(l.cta)} ↗</span>
          <span class="exlink-note">${esc(l.note)}</span>
        </div>
      </a>`).join('');
  }

  function ddayLabel(iso, today) {
    const d = diffDays(iso, today);
    return { d, label: d === 0 ? 'D-DAY' : (d > 0 ? 'D-' + d : 'D+' + Math.abs(d)) };
  }

  function renderExamDday() {
    const box = $('#examDday');
    if (!box) return;
    const today = todayISO();
    const rows = DATA.exam.schedule
      .map(s => ({ ...s, ...ddayLabel(s.start, today) }))
      .filter(s => s.d >= 0)
      .sort((a, b) => a.d - b.d);
    if (!rows.length) {
      box.innerHTML = '<p class="exdday-empty">확인된 예정 시험이 없습니다.</p>';
      return;
    }
    box.innerHTML = rows.map(s => `
      <span class="exchip">
        <b>${s.label}</b>
        <span>${esc(s.title)}</span>
        <small>${fmtDateLong(s.start)}${s.end && s.end !== s.start ? ' ~ ' + fmtDateLong(s.end) : ''}</small>
      </span>`).join('');
  }

  function renderGichul() {
    const g = DATA.exam.gichul;
    $('#gichulPath').textContent = g.path;
    $('#gichulBoards').innerHTML = g.boards.map(b =>
      `<a class="btn-line" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)} 게시판 ↗</a>`).join('');
    $('#gichulFacts').innerHTML = `
      <li><b>열람 방법</b> — ${esc(g.access)}</li>
      <li><b>공개 근거</b> — ${esc(g.law)} <a class="btn-line" style="padding:2px 8px;font-size:11px;margin-left:4px" href="${esc(g.lawUrl)}" target="_blank" rel="noopener">지침 원문 ↗</a></li>
      <li><b>교내 지정 장소 열람</b> — ${esc(g.place)}</li>
      <li><b>${esc(g.latest)}</b></li>`;
  }

  function renderExamSchedule() {
    const wrap = $('#examSchedule');
    const today = todayISO();
    wrap.innerHTML = DATA.exam.schedule.map(s => {
      const dd = ddayLabel(s.start, today);
      const end = s.end && s.end !== s.start ? ` ~ ${fmtDateLong(s.end)}` : '';
      const badge = dd.d >= 0
        ? `<span class="exblk-badge ${dd.d <= 7 ? 'soon' : ''}">${dd.label}</span>`
        : `<span class="exblk-badge" style="background:rgba(74,92,83,.55)">종료</span>`;
      return `
        <article class="exblk">
          <div class="exblk-top">
            <h4>${esc(s.title)}</h4>
            ${badge}
            <span class="exblk-when">${esc(s.grades)} · ${fmtDateLong(s.start)}${end}</span>
          </div>
          ${s.periods && s.periods.length ? `<div class="periods">${s.periods.map(p => `<span>${esc(p)}</span>`).join('')}</div>` : ''}
          ${s.days && s.days.length ? `<ul class="daylist">${s.days.map(d => {
            const dt = parseISO(d.date);
            return `<li><span class="dd">${dt.getMonth() + 1}/${dt.getDate()} (${DOW[dt.getDay()]})</span><span class="ds">${esc(d.subjects)}</span></li>`;
          }).join('')}</ul>` : ''}
          <p class="blk-note">${esc(s.note)}</p>
          <p class="blk-src">출처: ${esc(s.source)}</p>
        </article>`;
    }).join('');
  }

  function renderEvalPlan() {
    const e = DATA.exam.evalPlan;
    $('#evalSteps').innerHTML = e.steps.map(s => `<li>${esc(s)}</li>`).join('');
    $('#evalBasis').textContent = e.basis;
    $('#evalLink').href = e.url;
    $('#evalSchoolLink').href = e.schoolUrl;
  }

  /* ── 과목별 D-Day 플래너 ─────────────────────────── */
  function savePlan() { save(KEY_PLAN, plan); }

  function renderPlan() {
    const wrap = $('#planList');
    if (!wrap) return;
    const today = todayISO();
    if (!plan.length) {
      wrap.innerHTML = '<p class="plan-empty">아직 넣은 항목이 없습니다.<br>예: 과목 ‘미적분’, 마감일 11/30, 목표 90점, 메모 ‘3단원까지’</p>';
      return;
    }
    const rows = plan.slice().sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.date || '') < (b.date || '') ? -1 : 1;
    });
    wrap.innerHTML = rows.map(p => {
      const dd = p.date ? ddayLabel(p.date, today) : { d: 0, label: '' };
      const cls = dd.d === 0 ? 'today' : (dd.d < 0 ? 'past' : '');
      const label = !p.date ? '' : (dd.d === 0 ? 'D-DAY' : (dd.d > 0 ? 'D-' + dd.d : '지남'));
      return `
        <div class="plan${p.done ? ' done' : ''}" data-id="${esc(p.id)}">
          <input type="checkbox" data-act="toggle" ${p.done ? 'checked' : ''} aria-label="${esc(p.subject)} 완료 표시">
          <div class="plan-main">
            <div class="plan-title">
              <span>${esc(p.subject)}</span>
              ${p.goal ? `<span class="plan-goal">목표 ${esc(p.goal)}점</span>` : ''}
            </div>
            <p class="plan-meta">${p.date ? p.date.replace(/-/g, '.') + ' (' + DOW[parseISO(p.date).getDay()] + ')' : '날짜 없음'}${p.memo ? ' · ' + esc(p.memo) : ''}</p>
          </div>
          <div class="plan-right">
            <span class="plan-dday ${cls}">${label}</span>
            <button type="button" class="plan-del" data-act="del">삭제</button>
          </div>
        </div>`;
    }).join('');
  }

  function bindPlanner() {
    const form = $('#planForm');
    if (!form) return;
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const subject = $('#pSubject').value.trim();
      if (!subject) { $('#pSubject').focus(); return; }
      plan.push({
        id: 'p' + Date.now().toString(36),
        subject,
        date: $('#pDate').value || '',
        goal: $('#pGoal').value.trim(),
        memo: $('#pMemo').value.trim(),
        done: false
      });
      savePlan();
      form.reset();
      renderPlan();
      $('#pSubject').focus();
    });

    $('#planList').addEventListener('change', ev => {
      const cb = ev.target.closest('input[data-act=toggle]');
      if (!cb) return;
      const id = cb.closest('.plan').dataset.id;
      const item = plan.find(p => p.id === id);
      if (!item) return;
      item.done = cb.checked;
      savePlan();
      renderPlan();
    });

    $('#planList').addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-act=del]');
      if (!btn) return;
      const id = btn.closest('.plan').dataset.id;
      plan = plan.filter(p => p.id !== id);
      savePlan();
      renderPlan();
    });
  }

  /* ── 학부모 Q&A ─────────────────────────────────── */
  function renderQa() {
    const wrap = $('#examQa');
    if (!wrap) return;
    wrap.innerHTML = DATA.exam.qa.map((item, i) => `
      <details${i === 0 ? ' open' : ''}>
        <summary>${esc(item.q)}</summary>
        <div class="qa-body">
          <ul>${item.a.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
          <p class="qa-src">근거: ${esc(item.src)} · <a href="${esc(item.url)}" target="_blank" rel="noopener">원문 보기 ↗</a></p>
        </div>
      </details>`).join('');
  }

  /* ── AI 프롬프트 복사 ───────────────────────────── */
  function renderPrompt() {
    const box = $('#promptBox');
    const data = DATA.exam.prompt;
    if (box) box.textContent = data;
    if (box) box.dataset.raw = data;
  }

  function bindCopy() {
    const btn = $('#copyPrompt');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const text = (($('#promptBox') || {}).dataset || {}).raw || (($('#promptBox') || {}).textContent || '');
      const note = $('#copyNote');
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch (e) { ok = false; }
      if (!ok) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, text.length);
          ok = document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e) { ok = false; }
      }
      if (note) {
        note.textContent = ok
          ? '✅ 복사됐습니다. ChatGPT·클로드 등에 붙여넣고 우리 학교 이름만 바꿔 보내세요.'
          : '복사가 막혔습니다. 위 프롬프트를 길게 눌러 직접 선택해 복사해 주세요.';
      }
      btn.textContent = ok ? '✅ 복사 완료' : '📋 AI 프롬프트 복사';
      setTimeout(() => { btn.textContent = '📋 AI 프롬프트 복사'; }, 2600);
    });
  }

  /* ── tabs ───────────────────────────────────────── */
  function bindTabs() {
    const tabs = [...document.querySelectorAll('.tab')];
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(x => {
          const on = x === t;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-selected', String(on));
          const panel = document.getElementById('panel-' + x.dataset.tab);
          if (panel) { panel.classList.toggle('is-on', on); panel.hidden = !on; }
        });
      });
    });
  }

  /* ── boot ───────────────────────────────────────── */
  async function boot() {
    renderHeaderFallback();
    try {
      const res = await fetch('data.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('data ' + res.status);
      DATA = await res.json();
    } catch (err) {
      $('#timeline').innerHTML = '<p class="ev-empty">데이터를 불러오지 못했습니다. 새로고침 해 주세요.</p>';
      return;
    }
    renderHeader();
    renderDday();
    renderTimeline();
    renderNotices();
    renderChecklist();
    renderExamLinks();
    renderExamDday();
    renderGichul();
    renderExamSchedule();
    renderEvalPlan();
    renderPlan();
    renderQa();
    renderPrompt();
    bindTabs();
    bindTimeline();
    bindNotices();
    bindChecklist();
    bindPlanner();
    bindCopy();
  }

  function renderHeaderFallback() {
    // 출처 패널은 데이터 로드 후 채웁니다. 그 전까지 버튼이 죽어 보이지 않도록 안내만 둡니다.
    $('#srcPanel').innerHTML = '<p>출처 정보를 불러오는 중…</p>';
  }

  boot();
})();
