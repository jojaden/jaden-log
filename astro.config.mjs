// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { satteri } from '@astrojs/markdown-satteri';
import { readdirSync, readFileSync, writeFileSync, existsSync, renameSync, rmSync } from 'node:fs';

// 배포 주소가 정해지면 SITE_URL 만 바꾼다 (Workers 기본 주소 → 개인 도메인)
const site = process.env.SITE_URL ?? 'https://jaden-log.jhg7856.workers.dev';

// 본문을 아직 옮기지 않은 자리표시 글(frontmatter stub: true)은 사이트맵에서 뺀다 — [slug].astro 의 noindex 와 짝
const postsDir = new URL('./src/content/posts/', import.meta.url);
const stubIds = new Set(
  readdirSync(postsDir)
    .filter((f) => /\.mdx?$/.test(f)) // en/ 폴더(영어판)는 건너뛴다
    .filter((f) => /^stub:\s*true\s*$/m.test(readFileSync(new URL(f, postsDir), 'utf8').split(/^---$/m)[1] ?? ''))
    .map((f) => f.replace(/\.mdx?$/, '')),
);
const isStub = (page) => stubIds.has(new URL(page).pathname.replace(/^\/|\/$/g, ''));

// 글이 한 편뿐인 태그 페이지도 사이트맵에서 뺀다 — 카드 한 장짜리라 noindex (tag/[tag].astro 와 짝).
// 목록에 나오는 글(draft·hidden 제외)의 tags 를 언어판마다 센다
const singleTags = (dir) => {
  const n = {};
  for (const f of readdirSync(dir).filter((f) => /\.mdx?$/.test(f))) {
    const fm = readFileSync(new URL(f, dir), 'utf8').split(/^---$/m)[1] ?? '';
    if (/^(draft|hidden):\s*true\s*$/m.test(fm)) continue;
    for (const tag of JSON.parse(/^tags:\s*(\[.*\])\s*$/m.exec(fm)?.[1] ?? '[]')) n[tag] = (n[tag] ?? 0) + 1;
  }
  return new Set(Object.keys(n).filter((tag) => n[tag] === 1));
};
const thinTags = { ko: singleTags(postsDir), en: singleTags(new URL('en/', postsDir)) };
const isThinTag = (page) => {
  const m = /^\/(en\/)?tag\/([^/]+)\/?$/.exec(new URL(page).pathname);
  return !!m && thinTags[m[1] ? 'en' : 'ko'].has(decodeURIComponent(m[2]));
};

// 영어판 빌드 뒷정리 (dist/en/**)
// 1) 각주 문구는 처리기 설정 하나뿐이라 한국어로 나온다 — 영어판 HTML 의 각주 제목·되돌아가기 문구만 영어로 바꾼다
// 2) src/pages/en/404.astro 는 폴더 형식(en/404/index.html)으로 나온다 — Cloudflare 가 찾는 en/404.html 로 옮긴다
const enFixups = {
  name: 'jd-en-fixups',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : e.name.endsWith('.html') ? [new URL(e.name, d)] : []));
      const en = new URL('en/', dir);
      if (!existsSync(en)) return;
      const notFound = new URL('404/', en);
      if (existsSync(notFound)) {
        renameSync(new URL('index.html', notFound), new URL('404.html', en));
        rmSync(notFound, { recursive: true });
      }
      for (const f of walk(en)) {
        const s = readFileSync(f, 'utf8');
        if (!s.includes('data-footnotes')) continue;
        writeFileSync(f, s
          .replace('id="footnote-label">각주</h2>', 'id="footnote-label">Footnotes</h2>')
          .replace(/aria-label="(\d+)번 각주가 달린 본문으로"/g, 'aria-label="Back to reference $1"'));
      }
    },
  },
};

// 한국어판·영어판 짝 검사 — 글은 언어마다 파일이 따로라, 한쪽만 고치고 다른 쪽을 빼먹지 않게 뼈대를 견준다.
// 절 제목(h2·h3)·코드·표·컴포넌트 순서, 그림의 cover·wide, 확인 문제의 id·형태, 분류·날짜가 같아야 한다.
// 빌드는 멈추고, 개발 서버는 경고만 띄운다. 초안(draft)은 영어판이 없어도 된다
const FM_KEYS = ['category', 'subcategory', 'pubDate', 'updatedDate', 'draft', 'hidden', 'stub'];
const frontOf = (src) => {
  const fm = src.split(/^---$/m)[1] ?? '';
  return Object.fromEntries(FM_KEYS.map((k) => [k, new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(fm)?.[1].trim() ?? '']));
};
// variants={[ ... ]} 의 대괄호 짝을 찾아 값으로 읽는다 (글 쪽 자료라 문자열·숫자·배열뿐이다)
const variantsOf = (tag) => {
  const i = tag.indexOf('variants={');
  if (i < 0) return [];
  let depth = 0, q = '', j = i + 'variants={'.length;
  for (; j < tag.length; j++) {
    const c = tag[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = ''; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && --depth === 0) break;
  }
  return Function(`"use strict"; return (${tag.slice(i + 'variants={'.length, j + 1)})`)();
};
const shapeOf = (src) => {
  const body = src.split(/^---$/m).slice(2).join('---').replace(/^```[\s\S]*?^```/gm, '\n<CODE>\n');
  const out = [];
  for (const m of body.matchAll(/^(#{2,3}) |^<CODE>$|^\|.*\|\n\|[\s:|-]+\|$|<([A-Z][A-Za-z]*)\b((?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*)>/gm)) {
    if (m[1]) out.push(`h${m[1].length}`);
    else if (m[0] === '<CODE>') out.push('code');
    else if (m[0].startsWith('|')) out.push('table');
    else if (m[2] === 'Figure') out.push(`Figure${/\bcover\b/.test(m[3]) ? '[cover]' : ''}${/\bwide\b/.test(m[3]) ? '[wide]' : ''}`);
    else if (m[2] === 'Quiz') {
      const v = variantsOf(m[3]).map((x) => (x.fig != null ? `fig${x.fig}/${x.pool?.length}` : x.code != null ? `code${x.code.split('[[').length - 1}${x.type ? 't' : ''}/${x.no?.length ?? 0}` : x.ox != null ? `ox:${x.ox}` : `q/${x.no?.length}`) + (x.at ? '@' : ''));
      out.push(`Quiz#${/\bid="([^"]+)"/.exec(m[3])?.[1]}${/\bpre\b/.test(m[3]) ? '[pre]' : ''}(${v.join(' ')})`);
    } else out.push(m[2]);
  }
  return out;
};
const pairCheck = {
  name: 'jd-pair-check',
  hooks: {
    'astro:config:setup': ({ command, logger }) => {
      const read = (dir) => new Map(readdirSync(dir).filter((f) => f.endsWith('.mdx')).map((f) => [f.replace(/\.mdx$/, ''), readFileSync(new URL(f, dir), 'utf8')]));
      const ko = read(postsDir), en = read(new URL('en/', postsDir));
      const bad = [];
      for (const id of new Set([...ko.keys(), ...en.keys()])) {
        const k = ko.get(id), e = en.get(id);
        if (!k) { bad.push(`${id}: 한국어판이 없다`); continue; }
        if (!e) { if (frontOf(k).draft !== 'true') bad.push(`${id}: 영어판이 없다`); continue; }
        const fk = frontOf(k), fe = frontOf(e);
        for (const key of FM_KEYS) if (fk[key] !== fe[key]) bad.push(`${id}: frontmatter ${key} 가 다르다 (${fk[key] || '없음'} ↔ ${fe[key] || '없음'})`);
        const sk = shapeOf(k), se = shapeOf(e);
        const n = sk.findIndex((x, i) => x !== se[i]);
        if (n >= 0 || sk.length !== se.length) {
          const at = n >= 0 ? n : Math.min(sk.length, se.length);
          bad.push(`${id}: ${at + 1}번째 블록부터 다르다 — 한국어 ${sk[at] ?? '(끝)'} ↔ 영어 ${se[at] ?? '(끝)'} (앞 블록: ${sk[at - 1] ?? '(처음)'})`);
        }
      }
      if (!bad.length) return;
      const msg = `한국어판·영어판 짝이 맞지 않는다\n  ${bad.join('\n  ')}`;
      if (command === 'build') throw new Error(msg);
      logger.warn(msg);
    },
  },
};

// 개발 서버(astro dev)에는 Worker 가 없다 — 많이 읽은 글 순위만 배포된 사이트에서 받아 온다. 방문 수(/api/views)는 넘기지 않는다.
// 기간 탭·나라 칩은 기록이 쌓여야 보이므로, 세 편이 안 되는 순위와 비어 있는 나라 목록은 표본으로 채워 개발 중에도 보이게 한다
const devPopular = {
  name: 'jd-dev-popular',
  configureServer(server) {
    server.middlewares.use('/api/popular', async (_req, res) => {
      const real = await fetch(`${site}/api/popular`).then((r) => r.json()).catch(() => ({ cc: null, ids: [] }));
      // 표본 — 받은 지금까지 순위의 앞 몇 편을 맨 뒤로 돌린 순서. 채울 때마다 돌리는 수를 달리해 순위끼리 다르게 보이게
      let k = 0;
      const fill = (order) => {
        if (order?.length >= 3) return order;
        k = (k + 3) % real.ids.length;
        return [...real.ids.slice(k), ...real.ids.slice(0, k)];
      };
      // 나라 표본 — 칩이 셋을 넘어 옆으로 넘기는 것까지 보이게 일곱 나라. 보는 사람의 나라는 DEV_COUNTRY=US npm run dev 처럼 바꿔 볼 수 있다(기본 KR)
      const sample = !real.countries?.length;
      const me = process.env.DEV_COUNTRY ?? 'KR';
      const data = {
        ...real,
        week: fill(real.week),
        month: fill(real.month),
        cc: sample ? me : real.cc,
        countries: (sample ? [...new Set(['US', 'KR', 'JP', 'DE', 'GB', 'CA', 'SG', me])].map((cc) => ({ cc })) : real.countries)
          .map((c) => ({ cc: c.cc, ids: fill(c.ids), week: fill(c.week), month: fill(c.month) })),
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
    });
  },
};

export default defineConfig({
  site,
  // 주소 끝 슬래시 없음 (/30) — 사이트맵·canonical 이 배포 설정(wrangler.jsonc 의 drop-trailing-slash)과 같은 모양이 된다
  trailingSlash: 'never',
  build: { format: 'directory' },
  // 각주([^1]) 제목·되돌아가기 문구를 한국어로 (Astro 기본 처리기 Sätteri 의 gfm.footnotes. .mdx 도 이 설정을 이어받는다)
  markdown: {
    processor: satteri({
      features: { gfm: { footnotes: { label: '각주', backLabel: '{reference}번 각주가 달린 본문으로' } } },
    }),
  },
  // expressiveCode 는 mdx 보다 앞에 둔다
  integrations: [expressiveCode(), mdx(), sitemap({
      // 검색 페이지는 noindex 라 뺀다 — 사이트맵에 있으면 Search Console 이 '제출했지만 noindex' 로 알린다
      filter: (page) => !page.includes('/style-sample') && !/\/en\/404\/?$/.test(page) && !/^\/(en\/)?search\/?$/.test(new URL(page).pathname) && !isStub(page) && !isThinTag(page),
      // 주소의 + 는 %2B 로 — Cloudflare 가 /tag/N+1 을 /tag/N%2B1 로 넘긴다(307). Base.astro 의 canonical 과 같은 모양
      serialize: (item) => ({ ...item, url: item.url.replace(/\+/g, '%2B'), links: item.links?.map((l) => ({ ...l, url: l.url.replace(/\+/g, '%2B') })) }),
      // 언어판끼리 서로를 가리키는 xhtml:link — 주소의 /en 접두로 언어를 나눈다
      i18n: { defaultLocale: 'ko', locales: { ko: 'ko-KR', en: 'en-US' } },
    }), enFixups, pairCheck],
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: { plugins: [devPopular] },
});
