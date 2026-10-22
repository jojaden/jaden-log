/**
 * 표지 — 홈 대표 글과 카드의 macOS 창에 넣을 내용. 빌드 때 본문에서 뽑는다 (요청 없음).
 * 후보는 코드 카드, 출력 카드(frame="terminal" 또는 lang output), 그림(<Figure>) 세 가지.
 * 글쓴이가 고른 블록(코드 펜스 메타나 <Figure> 속성의 cover)이 있으면 그것을, 없으면 자동으로 고른다.
 * 고르는 도구: scripts/cover.ts (npm run cover). 사이트 빌드와 스크립트가 같이 쓰므로 astro 모듈을 import 하지 않는다.
 */
export type Win =
  | { kind: 'code' | 'term'; name: string; lang: string; body: string }
  | { kind: 'figure'; name: string; svg: string };

/** start: 본문 안 위치, flagAt: cover 를 끼워 넣을 위치 (펜스 메타 끝 · <Figure 바로 뒤) */
export type Block = Win & { cover: boolean; start: number; flagAt: number };

/** 앞 창과, 앞 창이 코드일 때 바로 뒤따르는 실행 결과(뒤 창) */
export type Cover = { front: Win; back?: Win };

const MAX_LINES = 14;

/** 본문의 표지 후보를 나오는 순서대로 */
export function coverBlocks(body: string): Block[] {
  const out: Block[] = [];
  for (const m of body.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)) {
    const meta = m[1];
    const lang = meta.trim().split(/\s+/)[0] ?? '';
    out.push({
      kind: /frame="terminal"/.test(meta) || lang === 'output' ? 'term' : 'code',
      name: /title="([^"]*)"/.exec(meta)?.[1] ?? '',
      lang,
      body: m[2].replace(/\n$/, '').split('\n').slice(0, MAX_LINES).join('\n'),
      cover: /(^|\s)cover(?=\s|$)/.test(meta),
      start: m.index,
      flagAt: m.index + 3 + meta.length,
    });
  }
  for (const m of body.matchAll(/<Figure\b([^>]*)>([\s\S]*?)<\/Figure>/g)) {
    const svg = /<svg[\s\S]*<\/svg>/.exec(m[2])?.[0];
    if (!svg) continue;
    out.push({
      kind: 'figure',
      name: /caption="([^"]*)"/.exec(m[1])?.[1] ?? '',
      svg,
      cover: /(^|\s)cover(?=[\s/]|$)/.test(m[1]),
      start: m.index,
      flagAt: m.index + '<Figure'.length,
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

function withOutput(blocks: Block[], i: number): Cover {
  const next = blocks[i + 1];
  return { front: blocks[i], back: blocks[i].kind === 'code' && next?.kind === 'term' ? next : undefined };
}

/** 고른 블록이 없을 때의 순서: 코드 + 바로 뒤 출력 > 그림 > 코드 > 출력 */
export function pickCover(blocks: Block[]): Cover | null {
  const chosen = blocks.findIndex((b) => b.cover);
  if (chosen >= 0) return withOutput(blocks, chosen);
  const pair = blocks.findIndex((b, i) => b.kind === 'code' && blocks[i + 1]?.kind === 'term');
  if (pair >= 0) return withOutput(blocks, pair);
  for (const kind of ['figure', 'code', 'term'] as const) {
    const i = blocks.findIndex((b) => b.kind === kind);
    if (i >= 0) return { front: blocks[i] };
  }
  return null;
}
