// 표지 고르기 — 홈 대표 글과 카드의 macOS 창에 넣을 블록을 정한다 (규칙은 src/lib/cover.ts)
//   npm run cover -- <글 id>              후보 목록과 지금 표지
//   npm run cover -- <글 id> <후보 번호>   그 후보를 표지로 지정
//   npm run cover -- <글 id> 0             지정 해제 (자동 선택으로)
import { readFileSync, writeFileSync } from 'node:fs';
import { coverBlocks, pickCover, type Block } from '../src/lib/cover.ts';

const [id, pick] = process.argv.slice(2);
if (!id) {
  console.error('사용법: npm run cover -- <글 id> [후보 번호|0]');
  process.exit(1);
}
const file = new URL(`../src/content/posts/${id}.mdx`, import.meta.url);
const src = readFileSync(file, 'utf8');

const LABEL = { code: '코드', term: '출력', figure: '그림' } as const;
const preview = (b: Block) =>
  b.kind === 'figure' ? ['(SVG 그림)'] : b.body.split('\n').filter((l) => l.trim()).slice(0, 3);

function list(text: string) {
  const blocks = coverBlocks(text);
  if (!blocks.length) {
    console.log(`${id}: 표지 후보가 없습니다 (코드·출력·<Figure> 없음). 홈에는 소분류 이름이 나옵니다.`);
    return;
  }
  const cover = pickCover(blocks);
  blocks.forEach((b, i) => {
    const mark = b === cover?.front ? (b.cover ? '  ★ 지정한 표지' : '  ← 자동 선택') : b === cover?.back ? '  (뒤 창)' : '';
    const lang = 'lang' in b && b.lang ? ` (${b.lang})` : '';
    console.log(`${i + 1}. ${LABEL[b.kind]}  ${b.name || '이름 없음'}${lang}${mark}`);
    for (const l of preview(b)) console.log(`     │ ${l.slice(0, 72)}`);
  });
}

if (pick === undefined) {
  list(src);
} else {
  // 기존 지정을 모두 지우고, 고른 블록에만 cover 를 단다
  const cleared = src
    .replace(/^(```[^\n]*?)\s+cover(?=\s|$)/gm, '$1')
    .replace(/(<Figure\b[^>]*?)\s+cover(?=[\s/>])/g, '$1');
  const n = Number(pick);
  const blocks = coverBlocks(cleared);
  if (!Number.isInteger(n) || n < 0 || n > blocks.length) {
    console.error(`후보 번호는 0~${blocks.length} 사이여야 합니다.`);
    process.exit(1);
  }
  const next = n === 0 ? cleared : cleared.slice(0, blocks[n - 1].flagAt) + ' cover' + cleared.slice(blocks[n - 1].flagAt);
  writeFileSync(file, next);
  list(next);
}
