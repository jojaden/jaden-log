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
      filter: (page) => !page.includes('/style-sample') && !/\/en\/404\/?$/.test(page) && !/^\/(en\/)?search\/?$/.test(new URL(page).pathname) && !isStub(page),
      // 주소의 + 는 %2B 로 — Cloudflare 가 /tag/N+1 을 /tag/N%2B1 로 넘긴다(307). Base.astro 의 canonical 과 같은 모양
      serialize: (item) => ({ ...item, url: item.url.replace(/\+/g, '%2B'), links: item.links?.map((l) => ({ ...l, url: l.url.replace(/\+/g, '%2B') })) }),
      // 언어판끼리 서로를 가리키는 xhtml:link — 주소의 /en 접두로 언어를 나눈다
      i18n: { defaultLocale: 'ko', locales: { ko: 'ko-KR', en: 'en-US' } },
    }), enFixups],
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // 개발 서버(astro dev)에는 Worker 가 없다 — 많이 읽은 글 순위만 배포된 사이트에서 받아 온다. 방문 수(/api/views)는 넘기지 않는다
  vite: { server: { proxy: { '/api/popular': { target: site, changeOrigin: true } } } },
});
