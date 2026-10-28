// Google API — 관리자 Worker 시크릿의 refresh token 으로 access token 을 받아 Search Console·AdSense 를 읽기 전용으로 부른다.
// 받은 응답은 KV(CACHE)에 담아 두고 정해 둔 시간 동안 다시 부르지 않는다
import { env } from 'cloudflare:workers';

/** 화면이 받는 모양 — 열쇠가 없으면 off, 부르다 실패하면 error 와 Google 이 준 까닭 */
export type Source<T> =
  | { state: 'off' }
  | { state: 'error'; error: string }
  | { state: 'ok'; data: T; at: number; sample: boolean };

// access token 은 한 시간 동안 쓸 수 있다 — Worker 가 살아 있는 동안 메모리에 두고, 요청이 겹쳐도 한 번만 받는다
let token: { value: Promise<string>; exp: number } | undefined;

function accessToken(): Promise<string> {
  if (token && token.exp > Date.now()) return token.value;
  const value = (async () => {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: env.GOOGLE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
    if (body.access_token) return body.access_token;
    throw new Error(
      body.error === 'invalid_grant'
        ? 'Google 열쇠가 만료됐거나 취소됐어요. 계획 문서 G7 로 새 열쇠를 받아 G8 처럼 다시 넣으세요.'
        : `Google 열쇠로 접근 토큰을 받지 못했어요 (${body.error_description ?? body.error ?? res.status})`,
    );
  })();
  token = { value, exp: Date.now() + 50 * 60_000 };
  value.catch(() => (token = undefined));
  return value;
}

/** Google API 호출 — 본문이 있으면 POST. 접근 토큰이 먼저 무효가 되면(401) 새로 받아 한 번 더. 실패하면 Google 이 준 까닭을 그대로 */
export async function google<T>(url: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${await accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    token = undefined;
    return google<T>(url, body, false);
  }
  const out = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new Error(`${res.status} ${out?.error?.message ?? res.statusText}`);
  return out as T;
}

/** KV 에 담아 둔 값 — 없거나 지났으면 새로 받아 담는다. 실패는 담지 않는다.
 *  담기가 실패해도(같은 키에 1초 안에 두 번 쓰면 KV 가 거절한다) 받은 값은 그대로 쓴다 */
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<{ data: T; at: number }> {
  const hit = await env.CACHE.get<{ data: T; at: number }>(key, 'json');
  if (hit) return hit;
  const fresh = { data: await load(), at: Date.now() };
  await env.CACHE.put(key, JSON.stringify(fresh), { expirationTtl: ttl }).catch(() => {});
  return fresh;
}

/** 개발 서버에서 ADMIN_SAMPLE=1 이면 표본, 열쇠가 없으면 off, 아니면 불러온다 */
export async function source<T>(sample: () => T, load: () => Promise<{ data: T; at: number }>): Promise<Source<T>> {
  if (import.meta.env.DEV && env.ADMIN_SAMPLE === '1') return { state: 'ok', data: sample(), at: Date.now(), sample: true };
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) return { state: 'off' };
  try {
    return { state: 'ok', ...(await load()), sample: false };
  } catch (e) {
    return { state: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
