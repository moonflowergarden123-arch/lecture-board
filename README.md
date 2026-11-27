# 🌿 더콘텐츠스쿨 공개 자료 허브

공개 자료 바로가기만 모은 페이지입니다. 주소: https://moonflowergarden123-arch.github.io/lecture-board/

| 경로 | 자료 |
| --- | --- |
| `/gallery/` | 2028 대입 준비 가상 전시관 (15개 대학 입학처 · 4대 확인 차트) |
| `/jeongsin/` | 정신여고 학사·시험 대시보드 |
| `/prompt/` | 프롬프트 실시간 공유 보드 (강사 모드 PIN 별도 안내) |
| `/tarot/` | 합격 부적 · 탄생월 12종 |
| `/chungju-ai-play/` | 충주성심학교 청주파견학급 연수 사이트 (참가자·강사·발표 화면) |

루트 `index.html`은 위 네 곳으로 가는 카드만 담은 허브 페이지입니다. 디자인 기준은 더콘텐츠스쿨 고정 규격(딥 다크 그린 `#1F3D2B`/`#0D2B22`, 크림 `#FAF8F2`, 골드 `#FFC24B`, 페이퍼로지)을 따릅니다.

## 개인 일정·업무 보드는 여기 없습니다

개인 강의 일정·섭외 현황·컨설팅 준비를 담은 강의·업무 보드는 **공개 저장소와 GitHub Pages에서 내렸습니다**. 그 보드는 이제 현주 님 기기에만 있는 단일 파일로만 봅니다.

```
/workspace/downloads/더콘텐츠스쿨_전용_강의보드.html
```

- 만드는 법: `python3 /workspace/lecture-board/private/build_private_board.py`
  (루트 `data.json` — 없으면 `private/data.json` — 와 `private/board-template.html` + `private/app.js` + `private/style.css` 를 CSS·JS·데이터까지 품은 HTML 한 파일로 합칩니다)
- 이 저장소에서 개인 데이터 파일(`data.json`, `preview.html`, `app.js`, `style.css`, `private/`)은 `.gitignore`로 제외됩니다. **`git add -A` 를 해도 올라가지 않습니다.**
- 아침 브리핑 자동 갱신도 공개 페이지가 아니라 위 전용 파일과 노션 보드에만 반영합니다.

## 개인정보 원칙

이 저장소는 누구나 열 수 있는 공개 페이지입니다. 학생·학부모 실명, 성적, 연락처, 주소, 계좌, 강의료, 상담 내용은 어떤 파일에도 넣지 않습니다.

## 배포

- GitHub Pages · `main` 브랜치 루트
- 검색 노출 방지: `<meta name="robots" content="noindex, nofollow">`
