// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { readdirSync, readFileSync } from 'node:fs';

// 배포 주소가 정해지면 SITE_URL 만 바꾼다 (Workers 기본 주소 → 개인 도메인)
const site = process.env.SITE_URL ?? 'https://jaden-log.jhg7856.workers.dev';

// 본문을 아직 옮기지 않은 자리표시 글(frontmatter stub: true)은 사이트맵에서 뺀다 — [slug].astro 의 noindex 와 짝
const postsDir = new URL('./src/content/posts/', import.meta.url);
const stubIds = new Set(
  readdirSync(postsDir)
    .filter((f) => /^stub:\s*true\s*$/m.test(readFileSync(new URL(f, postsDir), 'utf8').split(/^---$/m)[1] ?? ''))
    .map((f) => f.replace(/\.mdx?$/, '')),
);
const isStub = (page) => stubIds.has(new URL(page).pathname.replace(/^\/|\/$/g, ''));

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // expressiveCode 는 mdx 보다 앞에 둔다
  integrations: [expressiveCode(), mdx(), sitemap({ filter: (page) => !page.includes('/style-sample') && !isStub(page) })],
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
