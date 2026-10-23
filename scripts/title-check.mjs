// 제목 검색 적합성 검사 — 구글 검색 결과 제목은 글자 수가 아니라 픽셀 폭으로 잘린다 (데스크톱 약 600px, 모바일 약 480px).
// 제목이 어디서 잘리는지, 잘린 뒤에도 검색어(영문 식별자)가 남는지 본다. 티스토리 때 tistory_title_check.py 를 옮긴 것.
//
//   npm run check:title                 글 전부 (stub·draft 제외)
//   npm run check:title -- 31 en/31     글 id 로 (영어판은 en/<id>)
//   npm run check:title -- "제목 — 훅"   제목 문자열로
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const DESKTOP = 600;
const MOBILE = 480;
const POSTS = new URL('../src/content/posts/', import.meta.url);

function w(ch) {
  const o = ch.codePointAt(0);
  if ((o > 0x1100 && o < 0xd7a4) || (o > 0x3000 && o < 0x303f)) return 23; // 한글·전각
  if (/[A-Z]/.test(ch)) return 11;
  if (/[0-9]/.test(ch)) return 8;
  if (ch === ' ') return 4.5;
  if ('—·|:-–'.includes(ch)) return 9;
  return 7.5;
}
const px = (t) => Math.round([...t].reduce((a, c) => a + w(c), 0));
function cut(t, limit) {
  let acc = 0;
  const chars = [...t];
  for (let i = 0; i < chars.length; i++) {
    acc += w(chars[i]);
    if (acc > limit) return chars.slice(0, i).join('');
  }
  return t;
}

function frontmatter(file) {
  const src = readFileSync(file, 'utf8');
  const fm = src.split(/^---$/m)[1] ?? '';
  const get = (k) => new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm').exec(fm)?.[1];
  return { title: get('title')?.replace(/\\"/g, '"'), stub: get('stub') === 'true', draft: get('draft') === 'true' };
}

function check(t, label = '', en = false) {
  const total = px(t);
  console.log(`\n  ${label}${t}`);
  console.log(`    전체 ${total}px   데스크톱(600) ${total <= DESKTOP ? '통과' : '잘림'}   모바일(480) ${total <= MOBILE ? '통과' : '잘림'}`);
  if (total > MOBILE) console.log(`    모바일에 보이는 데까지 → 「${cut(t, MOBILE)}…」`);
  if (total > DESKTOP) console.log(`    데스크톱에 보이는 데까지 → 「${cut(t, DESKTOP)}…」`);
  if (!en && !/[A-Za-z]/.test(cut(t, MOBILE))) console.log('    ⚠ 모바일에 보이는 구간에 영문 식별자가 없다 — 키워드를 앞으로 옮길 것');
  if (!t.includes(' — ')) console.log('    ⚠ 구분자 ` — ` 가 없다 — 앞부분이 카드 타일·큰 제목, 뒷부분이 부제가 된다');
  if (/[:|]/.test(t)) console.log('    ⚠ 구분자는 ` — ` 로 통일 (`:` `|` 금지)');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  for (const f of readdirSync(POSTS).filter((f) => /\.mdx?$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    const fm = frontmatter(new URL(f, POSTS));
    if (fm.title && !fm.stub && !fm.draft) check(fm.title, `[${f.replace(/\.mdx?$/, '')}] `);
  }
} else {
  for (const a of args) {
    const file = ['mdx', 'md'].map((e) => new URL(`${a}.${e}`, POSTS)).find((u) => existsSync(u));
    if (file) check(frontmatter(file).title ?? '', `[${a}] `, a.startsWith('en/'));
    else check(a);
  }
}
console.log();
