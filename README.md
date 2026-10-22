# Jaden.log

> 배운 것을 기록하고, 기록하며 다시 배웁니다

공부한 개념부터 직접 부딪혀 본 문제까지, 개발하며 알게 된 것들을 기록하는 개발 블로그입니다.

[![블로그 바로 가기](https://img.shields.io/badge/%EB%B8%94%EB%A1%9C%EA%B7%B8%20%EB%B0%94%EB%A1%9C%20%EA%B0%80%EA%B8%B0-jaden--log.jhg7856.workers.dev-2997FF?style=for-the-badge)](https://jaden-log.jhg7856.workers.dev)

## 다루는 주제

| 주제 | 내용 |
|---|---|
| **AI** | Claude Code·Codex 같은 AI 도구를 직접 써 보고 만들어 본 기록, 그리고 AI로 배운다는 것에 대한 생각 |
| **Infra** | 쿠버네티스 자원 설정과 온프레미스 설치에서 만난 문제를, 원인부터 직접 따라가 본 기록 |
| **Go** | 슬라이스·인터페이스·context가 실제로 무엇을 들고 있는지, 그리고 실전에서 만난 타임아웃과 최적화 기록 |
| **Database** | 트랜잭션·락·정규화를 개념으로 정리하고, 인덱스와 다중 Pod 동시성을 실전에서 다시 보기 |

## 이런 블로그예요

- **읽기에 집중한 다크 테마** — 넓은 본문 열, 따라오는 목차, 읽은 만큼 차는 진행 막대
- **코드와 그림으로 보여 주기** — 파일명이 붙은 코드 카드와 실행 결과 카드, 추가·삭제 줄 표시, 직접 그린 SVG 그림
- **글을 돕는 요소** — 세 줄 요약, 좋음·나쁨 비교 카드, 측정값과 막대 그래프, 넘겨 보는 사례 카드, 형광펜, 각주
- **가벼운 움직임** — 스크롤에 맞춰 떠오르는 카드, 접히는 상단 메뉴. 모션 줄이기 설정을 따르고, 무거운 라이브러리 없이 CSS와 짧은 JS로
- **빠른 정적 사이트** — 빌드 때 모든 페이지를 만들고 Cloudflare 엣지에서 바로 전달
- **댓글** — GitHub 계정으로 남기는 giscus 댓글
- **한국어 · 영어** — 같은 글을 `/en` 아래 영어로도 (상단 `EN` / `KO`로 전환, 댓글은 두 언어판이 함께)

## 기술 스택

- [Astro](https://astro.build) + MDX
- [Expressive Code](https://expressive-code.com) — 코드 카드
- [Pagefind](https://pagefind.app) — 정적 검색
- [giscus](https://giscus.app) — GitHub Discussions 댓글
- Cloudflare Workers — 정적 자산 배포, 방문 수 카운터(Durable Object, `worker/index.ts`)

## 로컬에서 실행하기

```bash
npm install
npm run dev      # http://localhost:4321 (초안 글 포함)
npm run build    # dist/ 빌드 + 검색 색인
```

| 명령 | 하는 일 |
|---|---|
| `npm run preview` | 빌드 결과를 Workers 런타임으로 로컬 실행 |
| `npm run deploy` | 빌드 후 `wrangler deploy` |
| `npm run cover -- <글 id> [번호]` | 홈 표지(macOS 창) 후보 보기 · 지정 (`0`이면 자동) |

## 글 쓰기

글은 `src/content/posts/*.mdx`에 있고, 파일 이름이 주소가 됩니다 (`31.mdx` → `/31`). 영어판은 `src/content/posts/en/`에 같은 파일 이름으로 두면 `/en/31`이 됩니다.
본문에서 쓸 수 있는 요소는 `src/components/mdx/`에 있고, 모두 모아 둔 예시는 `style-sample.mdx`(`npm run dev` 후 `/style-sample`)에서 볼 수 있습니다.

````mdx
---
title: "Go sync.Pool — Put 이후엔 Bytes()도 남의 것이다"
pubDate: 2026-10-21T18:00:00+09:00
category: "Go"
subcategory: "개념 정리"
tags: ["sync.Pool"]
---

<Lead>도입 문단</Lead>

<Summary>
1. 첫째 요약
2. 둘째 요약
3. 셋째 요약
</Summary>

## 본문 h2 (목차에 번호로 들어감)

```go title="pool.go"
코드 카드 (파일명 헤더)
```

```text frame="terminal" title="실행과 예상 출력"
출력 카드 — 바로 앞 코드 카드와 한 쌍이면 홈 표지에서 뒤 창으로 겹쳐 나온다
```
````

- 본문 요소: `Lead · Summary · Figure · Lab · Note · C · Compare/Side · Stats · Bars · Carousel/Slide · Series`
- 마크다운 그대로: `<mark>` 형광펜, 각주 `[^1]`, 코드 펜스 `del={2} ins={3-5}`
- 홈 표지(macOS 창)는 코드 펜스 메타나 `<Figure cover …>`의 `cover`로 지정합니다 (`npm run cover`). 지정이 없으면 코드+출력 쌍 > 그림 > 코드 > 출력 순으로 자동 선택합니다.

## 구조

- `src/lib/site.ts` — 블로그 제목·카테고리(홈 주제 카드 순서·색)
- `src/styles/` — 디자인 토큰(`global.css`) · 본문(`prose.css`)
- `ec.config.mjs` — 코드 카드 설정
