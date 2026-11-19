# 📋 프롬프트 실시간 공유 Board (더콘텐츠스쿨)

강의 중 새 프롬프트를 수강생 화면에 바로 띄우고, 수강생은 버튼 한 번으로 복사하는 보드입니다.
빌드 도구 없이 `index.html` + `prompts.json` 두 파일(+ `fonts/`)로만 동작합니다.

- 라이브: https://moonflowergarden123-arch.github.io/lecture-board/prompt/
- 강사 모드 기본 PIN: **1234** (강사 모드 안에서 변경 가능, 이 브라우저에만 저장)

## 수강생 화면

- 위쪽 카드에 ‘지금 올라온 프롬프트’가 뜨고 `📋 복사하기`를 누르면 복사 + `복사 완료!` 토스트
- 브라우저가 복사를 막으면 본문이 자동 선택되므로 `Ctrl/Cmd + C`로 복사
- 아래 ‘이전 프롬프트’에 등록된 모든 프롬프트가 최신순 번호와 함께 전부 표시
- 각 행의 `선택`을 누르면 위 카드로 올라오고, `최신 프롬프트로 돌아가기`로 복귀
- 5초마다 `prompts.json`을 확인하며, 새 프롬프트가 오면
  - 최신 화면을 보고 있을 때 → 자동으로 새 카드로 교체
  - 과거 프롬프트를 보고 있을 때 → `새 프롬프트가 도착했어요!` 배지만 표시

## 강사 모드

맨 아래 `강사 모드 켜기` → PIN(초기 1234) → 패널에서

1. **새 프롬프트 올리기** — 새 번호가 붙어 위 카드로 즉시 올라감
2. **목록 관리** — 수정 / 삭제 / 📌 맨 위로
3. **실시간 공유 설정(GitHub)** — PAT를 한 번 저장하면 `보드에 바로 올리기`가
   `moonflowergarden123-arch/lecture-board` 의 `prompt/prompts.json` 을 자동 커밋
4. **토큰 없이 배포** — `prompts.json 내려받기`, `공유 링크 복사`(URL 해시에 내용 포함)

### GitHub 토큰 만드는 법

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained token**
→ Repository access에서 `lecture-board` 선택 → Permissions에서 `Contents: Read and write` 만 체크.
토큰은 이 브라우저(localStorage)에만 저장되며 공용 PC에서는 사용 후 `토큰 삭제`를 누릅니다.

토큰을 저장하면 수강생 화면 반영은 보통 **30~60초** 걸립니다(GitHub Pages 캐시).

## 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면·스타일·스크립트 전체 (외부 라이브러리 없음) |
| `prompts.json` | 프롬프트 데이터 (`updatedAt`, `prompts[]`) — 이 파일만 고치면 배포됩니다 |
| `fonts/` | 페이퍼로지(Paperozi) 웹폰트 |

### prompts.json 형식

```jsonc
{
  "updatedAt": "2026-11-18T14:38:00+09:00",
  "prompts": [
    {
      "no": 6,                                  // 1부터 누적되는 번호
      "title": "부모-자녀 대화 질문 5가지",     // 선택
      "tag": "#부모교육",                       // 선택
      "createdAt": "2026-11-18T14:31:00+09:00", // 상대 시간 계산에 사용
      "pinnedAt": null                          // 📌 맨 위로 올린 시각 (없으면 null)
    }
  ]
}
```

## Netlify 배포

이 폴더를 그대로 Netlify에 드래그 앤 드롭하면 됩니다(빌드 명령 없음, publish directory = 이 폴더).
`index.html` 을 열면 `./prompts.json` 을 읽으므로 반드시 같은 폴더에 함께 올려야 합니다.
