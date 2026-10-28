// Cloudflare Access 를 거친 요청만 받는다. Worker 전체를 Access 로 잠그지만, 그 설정이 꺼지거나 빠져도 숫자가 새지 않게
// 여기서 한 번 더 막는다. 모든 응답은 검색에 걸리지 않고, 어디에도 캐시되지 않게
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const HEADERS = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

// Access 팀 도메인의 공개 키 — Worker 가 살아 있는 동안 한 번 만들어 두면 jose 가 받아 오고 키 교체도 따라간다
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Access 가 인증한 요청인지. 로컬은 wrangler.jsonc 의 access.dev 가 ctx.access 를 흉내 낸다.
 *  배포에서는 정적 자산이 있는 Worker 라 Access 가 앞단 라우터에서 처리되고 ctx.access 가 넘어오지 않는다(Cloudflare 문서) —
 *  그래서 Access 가 요청에 붙여 주는 JWT(Cf-Access-Jwt-Assertion)를 팀 도메인의 공개 키로 직접 검증한다 */
async function viaAccess(request: Request, ctx: { access?: unknown } | undefined) {
  if (ctx?.access) return true;
  const token = request.headers.get('cf-access-jwt-assertion');
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  if (!token || !team || !aud) return false;
  keys ??= createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
  try {
    await jwtVerify(token, keys, { issuer: team, audience: aud });
    return true;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async ({ locals, request }, next) => {
  if (!(await viaAccess(request, locals.cfContext as { access?: unknown } | undefined))) {
    return new Response('Cloudflare Access 로그인이 필요합니다.', { status: 403, headers: { ...HEADERS, 'content-type': 'text/plain; charset=utf-8' } });
  }
  const res = await next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADERS)) out.headers.set(k, v);
  return out;
});
