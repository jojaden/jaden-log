// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

// 배포 주소가 정해지면 SITE_URL 만 바꾼다 (Workers 기본 주소 → 개인 도메인)
const site = process.env.SITE_URL ?? 'https://jaden-log.workers.dev';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // expressiveCode 는 mdx 보다 앞에 둔다
  integrations: [expressiveCode(), mdx(), sitemap({ filter: (page) => !page.includes('/style-sample') })],
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
