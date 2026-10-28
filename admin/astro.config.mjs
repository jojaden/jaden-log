// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// 블로그 글 정보 — 빌드 때 ../src/content/posts 의 frontmatter 와 몇 가지 상태만 읽어 virtual:jd-posts 로 넘긴다.
// 본문은 번들에 넣지 않는다
const postsDir = new URL('../src/content/posts/', import.meta.url);
const split = (text) => {
  const [, head = '', ...body] = text.split(/^---$/m);
  return { head, body: body.join('---') };
};
// 이 블로그 frontmatter 는 한 줄에 키 하나 — 문자열·배열은 JSON 모양, 날짜·참거짓은 그대로
const frontmatter = (head) => {
  const out = {};
  for (const line of head.split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim();
    try {
      out[m[1]] = /^["[]/.test(v) ? JSON.parse(v) : v === 'true' ? true : v === 'false' ? false : v.replace(/^'(.*)'$/, '$1');
    } catch {
      out[m[1]] = v.replace(/^"|"$/g, '');
    }
  }
  return out;
};
// 표지를 직접 지정했는지 — scripts/cover.ts 가 코드 블록 메타나 <Figure> 에 다는 cover 표시
const hasCover = (body) => /^```[^\n]*\scover(?=\s|$)/m.test(body) || /<Figure\b[^>]*\scover(?=[\s/>])/.test(body);

function readPosts() {
  const files = readdirSync(postsDir).filter((f) => /\.mdx?$/.test(f));
  const posts = files.map((f) => {
    const id = f.replace(/\.mdx?$/, '');
    const { head, body } = split(readFileSync(new URL(f, postsDir), 'utf8'));
    const en = new URL(`en/${f}`, postsDir);
    const enDoc = existsSync(en) ? split(readFileSync(en, 'utf8')) : null;
    return { id, fm: frontmatter(head), body, en: enDoc && { fm: frontmatter(enDoc.head), body: enDoc.body } };
  }).filter((p) => !p.fm.draft && !p.fm.hidden && !p.fm.stub);
  // 다른 글 본문(한국어판)에서 이 글로 오는 링크 — 글마다 한 번만 센다
  const inbound = new Map();
  for (const p of posts) {
    const to = new Set([...p.body.matchAll(/\]\(\/(\d+)(?=[)#])|href="\/(\d+)(?=["#])/g)].map((m) => m[1] ?? m[2]));
    to.delete(p.id);
    for (const id of to) inbound.set(id, (inbound.get(id) ?? 0) + 1);
  }
  return posts
    .map((p) => ({
      id: p.id,
      title: p.fm.title,
      titleEn: p.en?.fm.title ?? null,
      pubDate: new Date(p.fm.pubDate).toISOString(),
      updatedDate: p.fm.updatedDate ? new Date(p.fm.updatedDate).toISOString() : null,
      category: p.fm.category,
      subcategory: p.fm.subcategory,
      cover: { ko: hasCover(p.body), en: p.en ? hasCover(p.en.body) : false },
      inbound: inbound.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}

const jdPosts = {
  name: 'jd-admin-posts',
  resolveId: (id) => (id === 'virtual:jd-posts' ? '\0virtual:jd-posts' : undefined),
  load: (id) => (id === '\0virtual:jd-posts' ? `export default ${JSON.stringify(readPosts())};` : undefined),
};

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  // 세션을 쓰지 않는다 — 어댑터가 세션용 KV 를 만들지 않게
  session: false,
  devToolbar: { enabled: false },
  vite: {
    plugins: [jdPosts],
    // 블로그의 디자인 토큰(../src/styles/global.css)을 그대로 가져다 쓴다
    server: { fs: { allow: ['..'] } },
  },
});
