# 2028 대입 준비 가상 전시관 (`gallery/`)

더콘텐츠스쿨 · 오현주 강사 — 중1·중2·중3 학부모를 위한 3D 가상 전시관.
공개 주소: **https://moonflowergarden123-arch.github.io/lecture-board/gallery/**

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면 뼈대(입장 안내 · 해설 카드 · 퀴즈 · 수료 관람권 · 목록 대체 화면) |
| `style.css` | 디자인(페이퍼로지체, 크림·딥그린·골드) |
| `gallery.js` | 3D 전시실(Three.js) · 이동/둘러보기 · 액자 클릭 · 카드/퀴즈/관람권 동작 |
| `gallery-data.json` | **전시 내용 전부** — 존 이름, 액자 14점의 제목·본문·포인트·링크·프롬프트, 필수 확인 차트(`chart`), 퀴즈 |
| `vendor/three.min.js` | Three.js (외부 CDN 없이 동작) |
| `fonts/Paperozi-*.woff2` | 페이퍼로지체 7종 |

## 내용만 고쳐서 다시 배포하기

1. `gallery-data.json` 한 파일만 수정합니다. (액자 추가는 `frames` 배열에 항목을 하나 더 넣으면 존·개수 표시가 자동으로 따라갑니다.)
2. 아래 명령으로 커밋·푸시하면 **학부모님이 이미 가지고 있는 같은 주소**에 1분 안에 반영됩니다.

```bash
cd lecture-board
git add gallery/
git commit -m "content(gallery): ○○ 수정" -- gallery/
git push origin main
```

> `lecture-board/` 루트의 `index.html`·`data.json`·`app.js`·`style.css`·`preview.html`은
> 강의 업무 보드입니다. `gallery/` 작업과 섞이지 않도록 **커밋할 때 `-- gallery/` 경로를 꼭 붙입니다.**

## 쓰지 않는 것 (중요)

- 모집인원·등급컷·경쟁률 같은 **수치를 만들어 넣지 않습니다.** 대학별 수치는 각 대학 모집요강 원문으로만 안내합니다.
- 제도 내용은 교육부(2023-12-27 확정안, 2025-01-20 수능 시험·점수체제)와 한국교육과정평가원 공개 자료를 근거로 정리했습니다.
- 학생 실명·연락처·성적 등 개인정보는 넣지 않습니다.

## 3관 입학처 링크 (15개 대학)

- 9번 액자의 입학처 15곳 주소는 **2026-11-18 브라우저로 직접 접속(HTTP 200 · 입학처 화면 표시)해 확인한 주소**입니다.
  - 동국대는 `admission.dongguk.edu`가 응답하지 않아, 교육부가 안내하는 정식 주소 `https://ipsi.dongguk.edu`를 씁니다.
  - 한양대 `https://go.hanyang.ac.kr/main.do`, 한국외대 `https://adms.hufs.ac.kr/index.do`, 서울시립대 `https://admission.uos.ac.kr/admissionNew/main.do`처럼 중간 안내 화면을 건너뛰는 주소를 씁니다.
  - 건국대는 `enter.konkuk.ac.kr`로 들어가면 `admission.konkuk.ac.kr`로 넘어가므로 최종 주소를 썼습니다.
  - 일부 대학(예: 홍익대)은 봇 차단을 거치므로 자동 접속 점검 도구에서는 막힐 수 있습니다. 사람이 쓰는 브라우저에서는 정상으로 열립니다.
- 주소를 바꿀 때는 반드시 실제 접속으로 확인한 뒤 `meta`의 확인 날짜도 함께 고칩니다.
- 10번 액자의 `chart`는 `items[].no/title/where/what/fact` 구조입니다. `fact`에는 **공식 자료로 확인한 사실만** 넣고, 확인하지 못한 수치는 넣지 않습니다.
