# Jaden.log

티스토리(jaden-dev.tistory.com)에서 옮겨 온 개발 블로그. Astro + MDX, Cloudflare Workers(정적 자산) 배포.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 로컬 미리보기 (draft 글 포함) |
| `npm run build` | `dist/` 빌드 + Pagefind 검색 색인 |
| `npm run preview` | 빌드 결과를 Workers 런타임으로 로컬 실행 |
| `npm run deploy` | 빌드 후 `wrangler deploy` |
| `npm run cover -- <글 id> [번호]` | 홈 표지(macOS 창) 후보 보기 · 지정 (`0`이면 자동) |

## 구조

- `src/content/posts/*.mdx` — 글. 파일 이름이 주소 (`31.mdx` → `/31`)
- `src/components/mdx/` — 글에서 쓰는 컴포넌트 `Lead · Summary · Figure · Lab · Note · C · Compare/Side · Stats · Bars · Carousel/Slide · Series`. 쓰는 모습은 `style-sample.mdx` (`npm run dev` 후 `/style-sample`)
  - 마크다운 그대로 쓰는 것: `<mark>` 형광펜, 각주 `[^1]`, 코드 펜스 `del={2} ins={3-5}`
- `src/lib/site.ts` — 블로그 제목·카테고리(홈 주제 카드 순서·색)
- `src/styles/` — 토큰(global.css) · 본문(prose.css)
- `ec.config.mjs` — 코드 카드 (Expressive Code)
- `migration/` — 티스토리 원본 (2026-10-21 내보내기)

## 글 쓰기

```mdx
---
title: "Go sync.Pool — Put 이후엔 Bytes()도 남의 것이다"
pubDate: 2026-10-21T18:00:00+09:00
category: "Go"
subcategory: "개념 정리"
tags: ["sync.Pool"]
---

<Lead>도입 문단</Lead>

## 본문 h2 (목차에 번호로 들어감)

```go title="pool.go"
코드 카드 (파일명 헤더)
```

```text frame="terminal" title="실행과 예상 출력"
출력 카드 — 바로 앞 코드 카드와 한 쌍이면 홈 표지에서 뒤 창으로 겹쳐 나온다
```

<Lab title="실습 제목">…</Lab>
<Note title="정리">…</Note>
인라인: `식별자` · <C k="path">/etc/x</C> · <C k="err">OOMKilled</C> · <C k="num">800MB</C>
```

홈 표지(macOS 창)는 코드 펜스 메타나 `<Figure cover …>`의 `cover`로 지정한다 (`npm run cover`). 지정이 없으면 코드+출력 쌍 > 그림 > 코드 > 출력 순으로 자동 선택.
