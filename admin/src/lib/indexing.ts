// 색인 — 사이트맵에 올린 주소마다 Search Console URL 검사로 Google 색인 상태를 묻는다 (주소 하나에 한 번, 하루 2,000번까지).
// 무료 Worker 는 요청 한 번에 외부 호출을 50번까지만 한다. 그래서 화면을 열 때마다 하루 넘게 묵은 주소를 BATCH 개씩
// 응답을 보낸 뒤(waitUntil) 다시 묻고, 결과는 KV 한 키에 모아 둔다. 화면은 모아 둔 것을 바로 그린다
import { env } from 'cloudflare:workers';
import { BLOG } from './format';
import { cached, google, source } from './google';
import { sampleIndexing } from './sample';

const API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const KEY = 'idx:v1';
const BUSY = 'idx:busy'; // 묻는 중 — 새로 고침을 거듭해도 같은 주소를 겹쳐 묻지 않게
const FRESH = 24 * 3600_000; // 하루 — 색인 상태는 천천히 바뀐다
const BATCH = 35; // 접근 토큰 1 · 검색 성과 5 · 사이트맵 2 를 더해도 50 안쪽

export type Inspection = {
  verdict: string; // PASS 면 색인됨. NEUTRAL 은 제외, FAIL 은 오류, 그 밖은 Google 이 아직 모르는 주소
  state: string; // Google 이 쓴 상태 문구 — 색인 안 된 주소는 이걸로 묶는다
  crawled: string | null; // 마지막 크롤링 (ISO). 아직 안 왔으면 null
  link: string; // Search Console 의 이 주소 검사 화면 — 색인 생성 요청은 거기서
  at: number; // 물어본 때
};
type Saved = { results: Record<string, Inspection>; error: string | null };
export type Indexing = Saved & { urls: string[]; checking: number };

// 블로그 Worker 를 서비스 바인딩으로 부른다 — 같은 계정의 workers.dev 주소는 fetch 로 부르면 Cloudflare 가 막는다
const locs = async (path: string) => {
  const res = await env.BLOG.fetch(`${BLOG}${path}`);
  if (!res.ok) throw new Error(`사이트맵 ${path} 를 읽지 못했어요 (${res.status})`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
};
const sitemap = async () => (await Promise.all((await locs('/sitemap-index.xml')).map((u) => locs(new URL(u).pathname)))).flat();

type Raw = { inspectionResult: { inspectionResultLink: string; indexStatusResult: { verdict: string; coverageState: string; lastCrawlTime?: string } } };
async function inspect(url: string): Promise<Inspection> {
  const { inspectionResult: r } = await google<Raw>(API, { inspectionUrl: url, siteUrl: `${BLOG}/`, languageCode: 'ko-KR' });
  const x = r.indexStatusResult;
  return { verdict: x.verdict, state: x.coverageState, crawled: x.lastCrawlTime ?? null, link: r.inspectionResultLink, at: Date.now() };
}

const read = async () => (await env.CACHE.get<Saved>(KEY, 'json')) ?? { results: {}, error: null };

/** 묵은 주소를 다시 묻고 담는다. 실패한 주소는 지난 결과를 두고 첫 까닭만 남긴다. 사이트맵에서 빠진 주소는 버린다 */
async function refresh(urls: string[], due: string[]) {
  const got = await Promise.allSettled(due.map(inspect));
  const { results } = await read();
  due.forEach((u, i) => {
    const g = got[i];
    if (g.status === 'fulfilled') results[u] = g.value;
  });
  const failed = got.find((g): g is PromiseRejectedResult => g.status === 'rejected');
  const error = failed ? (failed.reason instanceof Error ? failed.reason.message : String(failed.reason)) : null;
  const keep = Object.fromEntries(urls.filter((u) => results[u]).map((u) => [u, results[u]]));
  await env.CACHE.put(KEY, JSON.stringify({ results: keep, error })).catch(() => {});
  await env.CACHE.delete(BUSY).catch(() => {});
}

export const loadIndexing = (waitUntil: (p: Promise<unknown>) => void) =>
  source(sampleIndexing, async () => {
    const { data: urls } = await cached('idx:urls:v1', 6 * 3600, sitemap);
    const saved = await read();
    const now = Date.now();
    const age = (u: string) => saved.results[u]?.at ?? 0;
    const due = urls.filter((u) => now - age(u) > FRESH).sort((a, b) => age(a) - age(b)).slice(0, BATCH);
    if (due.length && !(await env.CACHE.get(BUSY))) {
      // KV 가 지우는 가장 짧은 시간이 60초 — 묻다가 Worker 가 끊겨도 1분 뒤에는 다시 묻는다
      await env.CACHE.put(BUSY, '1', { expirationTtl: 60 });
      waitUntil(refresh(urls, due));
    }
    return { data: { ...saved, urls, checking: due.length }, at: now };
  });

/** 화면용 — 색인 안 된 주소는 Google 이 쓴 상태별로 묶어 많은 묶음부터, 색인된 주소는 한 묶음 */
export function indexGroups(x: Indexing) {
  const known = x.urls.filter((u) => x.results[u]);
  const missing = new Map<string, string[]>();
  for (const u of known) {
    const r = x.results[u];
    if (r.verdict !== 'PASS') missing.set(r.state, [...(missing.get(r.state) ?? []), u]);
  }
  return {
    indexed: known.filter((u) => x.results[u].verdict === 'PASS'),
    missing: [...missing]
      .map(([state, urls]) => ({ state, urls, fail: urls.some((u) => x.results[u].verdict === 'FAIL') }))
      .sort((a, b) => b.urls.length - a.urls.length),
    unchecked: x.urls.length - known.length,
  };
}
