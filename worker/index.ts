// 방문 수 카운터 — 정적 자산 앞에서 /api/views 만 받는다.
// 다른 요청은 wrangler.jsonc 의 run_worker_first 에 걸리지 않아 이 코드를 거치지 않고 자산이 바로 응답한다.
// 숫자는 Durable Object(SQLite) 하나에 날짜별·나라별로 쌓는다 — 나라는 Cloudflare 가 붙여 주는 코드(cf.country)만 쓰고, IP 같은 개인 정보는 저장하지 않는다.
import { DurableObject } from 'cloudflare:workers';

interface Env {
  VIEWS: DurableObjectNamespace<ViewCounter>;
  ASSETS: Fetcher;
}

/** 한국 시간 기준 날짜 (offset 일 전) */
const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);

/** 나라별 수는 많은 순으로 앞 몇 개만 — 나머지(나라 정보가 없던 예전 방문 포함)는 total 에서 빼서 '기타'로 보인다 */
const TOP_COUNTRIES = 5;

export type Views = { total: number; today: number; yesterday: number; countries: { cc: string; n: number }[]; post?: number };

export class ViewCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS countries (cc TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  }

  /** site: 사이트 방문으로 센다(날짜·나라) · countPost: post 글의 조회로 센다 — 둘은 브라우저가 따로 하루 한 번씩 보낸다 */
  hit(site: boolean, country: string | null, post: string | null, countPost: boolean): Views {
    const sql = this.ctx.storage.sql;
    if (site) {
      sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', kstDay());
      if (country) sql.exec('INSERT INTO countries (cc, n) VALUES (?, 1) ON CONFLICT(cc) DO UPDATE SET n = n + 1', country);
    }
    if (post && countPost) sql.exec('INSERT INTO posts (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1', post);
    return this.stats(post);
  }

  stats(post: string | null = null): Views {
    const sql = this.ctx.storage.sql;
    const day = (d: string) => Number(sql.exec('SELECT n FROM days WHERE day = ?', d).toArray()[0]?.n ?? 0);
    const total = Number(sql.exec('SELECT COALESCE(SUM(n), 0) AS t FROM days').one().t);
    const countries = sql.exec('SELECT cc, n FROM countries ORDER BY n DESC, cc LIMIT ?', TOP_COUNTRIES).toArray().map((r) => ({ cc: String(r.cc), n: Number(r.n) }));
    const views: Views = { total, today: day(kstDay()), yesterday: day(kstDay(1)), countries };
    if (post) views.post = Number(sql.exec('SELECT n FROM posts WHERE id = ?', post).toArray()[0]?.n ?? 0);
    return views;
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/api/views') return env.ASSETS.fetch(req);
    const counter = env.VIEWS.get(env.VIEWS.idFromName('site'));
    const headers = { 'cache-control': 'no-store' };
    // 두 글자 나라 코드만 센다 — Tor(T1)·알 수 없음(XX)은 '기타'로
    const cc = typeof req.cf?.country === 'string' && /^[A-Z]{2}$/.test(req.cf.country) && req.cf.country !== 'XX' ? req.cf.country : null;
    // ?post=<글 번호> — 한국어·영어판은 같은 번호라 한 줄에 합쳐 센다. 숫자가 아니면 무시해 아무 이름으로나 줄이 늘지 않게 한다
    const post = url.searchParams.get('post');
    const postId = post && /^\d{1,4}$/.test(post) ? post : null;
    // ?hit=site,post — POST 가 셀 것. 없으면 사이트 방문만
    const hit = new Set((url.searchParams.get('hit') ?? 'site').split(','));
    if (req.method === 'POST') return Response.json(await counter.hit(hit.has('site'), cc, postId, hit.has('post')), { headers });
    if (req.method === 'GET') return Response.json(await counter.stats(postId), { headers });
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  },
} satisfies ExportedHandler<Env>;
