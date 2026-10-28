// Cloudflare Access 를 거친 요청만 받는다. Worker 전체를 Access 로 잠그지만, 그 설정이 꺼지거나 빠져도 숫자가 새지 않게
// 여기서 한 번 더 막는다 — Access 가 인증한 요청에만 ctx.access 가 있다(로컬은 wrangler.jsonc 의 access.dev 가 흉내 낸다).
// 모든 응답은 검색에 걸리지 않고, 어디에도 캐시되지 않게
import { defineMiddleware } from 'astro:middleware';

const HEADERS = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

export const onRequest = defineMiddleware(async ({ locals }, next) => {
  if (!(locals.cfContext as { access?: unknown } | undefined)?.access) {
    return new Response('Cloudflare Access 로그인이 필요합니다.', { status: 403, headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
  }
  const res = await next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADERS)) out.headers.set(k, v);
  return out;
});
