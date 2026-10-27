// 방문 수 카운터 — 정적 자산 앞에서 /api/views(방문 수)와 /api/popular(많이 읽은 글)만 받는다.
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
const TOP_COUNTRIES = 3;
/** 이 나라는 상위에 들지 못해도 순위와 함께 따로 보인다 */
const HOME_COUNTRY = 'KR';
/** 많이 읽은 글의 나라별 순위 — 그 나라에서 2번 이상 읽힌 글이 5편 이상일 때만 쓰고, 모자라면 전체 순위를 낸다 */
const LOCAL_MIN_VIEWS = 2;
const LOCAL_MIN_POSTS = 5;

type CountryViews = { cc: string; n: number; rank?: number };
/** cc: 순위를 낸 나라. 전체 순위면 null */
export type Popular = { cc: string | null; ids: string[] };
export type Views = { total: number; today: number; yesterday: number; countries: CountryViews[]; post?: number };

export class ViewCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS countries (cc TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS post_countries (cc TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (cc, id))');
  }

  /** site: 사이트 방문으로 센다(날짜·나라) · countPost: post 글의 조회로 센다 — 둘은 브라우저가 따로 하루 한 번씩 보낸다 */
  hit(site: boolean, country: string | null, post: string | null, countPost: boolean): Views {
    const sql = this.ctx.storage.sql;
    if (site) {
      sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', kstDay());
      if (country) sql.exec('INSERT INTO countries (cc, n) VALUES (?, 1) ON CONFLICT(cc) DO UPDATE SET n = n + 1', country);
    }
    if (post && countPost) {
      sql.exec('INSERT INTO posts (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1', post);
      if (country) sql.exec('INSERT INTO post_countries (cc, id, n) VALUES (?, ?, 1) ON CONFLICT(cc, id) DO UPDATE SET n = n + 1', country, post);
    }
    return this.stats(post);
  }

  stats(post: string | null = null): Views {
    const sql = this.ctx.storage.sql;
    const day = (d: string) => Number(sql.exec('SELECT n FROM days WHERE day = ?', d).toArray()[0]?.n ?? 0);
    const total = Number(sql.exec('SELECT COALESCE(SUM(n), 0) AS t FROM days').one().t);
    const countries: CountryViews[] = sql.exec('SELECT cc, n FROM countries ORDER BY n DESC, cc LIMIT ?', TOP_COUNTRIES).toArray().map((r) => ({ cc: String(r.cc), n: Number(r.n) }));
    const home = sql.exec('SELECT n FROM countries WHERE cc = ?', HOME_COUNTRY).toArray()[0];
    if (home && !countries.some((c) => c.cc === HOME_COUNTRY)) {
      // 순위 = 나보다 많은 나라 수 + 1 (같은 수면 같은 순위)
      const ahead = Number(sql.exec('SELECT COUNT(*) AS k FROM countries WHERE n > ?', home.n).one().k);
      countries.push({ cc: HOME_COUNTRY, n: Number(home.n), rank: ahead + 1 });
    }
    const views: Views = { total, today: day(kstDay()), yesterday: day(kstDay(1)), countries };
    if (post) views.post = Number(sql.exec('SELECT n FROM posts WHERE id = ?', post).toArray()[0]?.n ?? 0);
    return views;
  }

  /** 많이 읽은 글 — 조회 수 순서의 글 번호만 (수는 내보내지 않는다). 보는 사람의 나라에 읽은 기록이 넉넉하면 그 나라 순위로 */
  popular(limit: number, country: string | null): Popular {
    const sql = this.ctx.storage.sql;
    const ids = (q: string, ...args: (string | number)[]) => sql.exec(q, ...args).toArray().map((r) => String(r.id));
    if (country && Number(sql.exec('SELECT COUNT(*) AS k FROM post_countries WHERE cc = ? AND n >= ?', country, LOCAL_MIN_VIEWS).one().k) >= LOCAL_MIN_POSTS) {
      return { cc: country, ids: ids('SELECT id FROM post_countries WHERE cc = ? ORDER BY n DESC, id DESC LIMIT ?', country, limit) };
    }
    return { cc: null, ids: ids('SELECT id FROM posts ORDER BY n DESC, id DESC LIMIT ?', limit) };
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const counter = env.VIEWS.get(env.VIEWS.idFromName('site'));
    // 두 글자 나라 코드만 쓴다 — Tor(T1)·알 수 없음(XX)은 '기타'로
    const cc = typeof req.cf?.country === 'string' && /^[A-Z]{2}$/.test(req.cf.country) && req.cf.country !== 'XX' ? req.cf.country : null;
    // 홈의 '많이 읽은 글' — 글 번호 10개. 언어판에 없는 글은 홈이 걸러 낸다.
    // 나라마다 답이 달라 공용 캐시에는 두지 않고, 각자의 브라우저에만 몇 분씩 둬 홈을 열 때마다 묻지 않게
    if (url.pathname === '/api/popular' && req.method === 'GET') {
      return Response.json(await counter.popular(10, cc), { headers: { 'cache-control': 'private, max-age=300' } });
    }
    if (url.pathname !== '/api/views') return env.ASSETS.fetch(req);
    const headers = { 'cache-control': 'no-store' };
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
