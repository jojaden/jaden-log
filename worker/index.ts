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
/** 많이 읽은 글의 나라별 순위 — 그 나라에서 2번 이상 읽힌 글이 5편 이상인 나라만 낸다. 이번 주·이번 달도 그 기간 안에서 같은 조건 */
const LOCAL_MIN_VIEWS = 2;
const LOCAL_MIN_POSTS = 5;
/** 많이 읽은 글의 기간 순위 — 이번 주는 오늘까지 7일, 이번 달은 30일 */
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
/** 글별·나라별 날짜 기록을 두는 날 수 — 관리자 화면이 새 글의 첫 30일을 이전 새 글들과, 올해를 지난해 이맘때와 견준다 */
const KEEP_DAYS = 400;

type CountryViews = { cc: string; n: number; rank?: number };
/** ids·week·month: 지금까지·최근 7일·30일 순위 */
type Ranks = { ids: string[]; week: string[]; month: string[] };
/** 전 세계의 세 순위 · countries: 기록이 넉넉한 나라마다의 세 순위(읽힌 수가 많은 나라부터, 기록이 모자란 기간은 빈 목록) · cc: 그중 보는 사람의 나라(없으면 null) */
export type Popular = Ranks & { cc: string | null; countries: (Ranks & { cc: string })[] };
export type Views = { total: number; today: number; yesterday: number; countries: CountryViews[]; post?: number };
/** 관리자 화면(jaden-log-admin)이 읽는 숫자 전부 — 공개 경로 없이 그 Worker 의 Durable Object 바인딩으로만 부른다 */
export type Report = {
  today: string; // 한국 시간 기준 오늘
  days: { day: string; n: number }[]; // 날짜별 사이트 방문 (기록 전부)
  countries: { cc: string; n: number }[]; // 나라별 사이트 방문 (지금까지)
  posts: { id: string; n: number }[]; // 글별 조회 (지금까지)
  postDays: { day: string; id: string; n: number }[]; // 날짜별 글 조회 (KEEP_DAYS 안)
  postCountries: { cc: string; id: string; n: number }[]; // 나라별 글 조회 (지금까지)
  postCountriesWeek: { cc: string; id: string; n: number }[]; // 나라별 글 조회 (오늘까지 WEEK_DAYS 일)
  /** 나라별 순위 문턱 — 기간마다 그 나라에서 rule.minViews 번 이상 읽힌 글 수. rule.minPosts 편이 되면 홈에 그 나라 칸이 열린다 */
  local: { cc: string; all: number; week: number; month: number }[];
  rule: { minViews: number; minPosts: number; weekDays: number; monthDays: number; keepDays: number };
};

export class ViewCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS countries (cc TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, n INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS post_countries (cc TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (cc, id))');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS post_days (day TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, id))');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS post_country_days (day TEXT NOT NULL, cc TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, cc, id))');
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
      if (country) {
        sql.exec('INSERT INTO post_countries (cc, id, n) VALUES (?, ?, 1) ON CONFLICT(cc, id) DO UPDATE SET n = n + 1', country, post);
        sql.exec('INSERT INTO post_country_days (day, cc, id, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, cc, id) DO UPDATE SET n = n + 1', kstDay(), country, post);
      }
      sql.exec('INSERT INTO post_days (day, id, n) VALUES (?, ?, 1) ON CONFLICT(day, id) DO UPDATE SET n = n + 1', kstDay(), post);
      sql.exec('DELETE FROM post_days WHERE day < ?', kstDay(KEEP_DAYS - 1));
      sql.exec('DELETE FROM post_country_days WHERE day < ?', kstDay(KEEP_DAYS - 1));
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

  /** 많이 읽은 글 — 조회 수 순서의 글 번호만 (수는 내보내지 않는다). 읽은 기록이 넉넉한 나라는 나라별 순위도 */
  popular(limit: number, country: string | null): Popular {
    const sql = this.ctx.storage.sql;
    const ids = (q: string, ...args: (string | number)[]) => sql.exec(q, ...args).toArray().map((r) => String(r.id));
    const since = (days: number) => ids('SELECT id FROM post_days WHERE day >= ? GROUP BY id ORDER BY SUM(n) DESC, id DESC LIMIT ?', kstDay(days - 1), limit);
    // 나라의 기간 순위 — 그 기간에도 나라 조건을 넘을 때만. 지금까지 수는 기간 수보다 작을 수 없어 기간 조건을 넘는 나라는 모두 아래 countries 에 든다
    const localSince = (cc: string, days: number) => {
      const rows = sql.exec('SELECT id, SUM(n) AS k FROM post_country_days WHERE cc = ? AND day >= ? GROUP BY id ORDER BY SUM(n) DESC, id DESC', cc, kstDay(days - 1)).toArray();
      return rows.filter((r) => Number(r.k) >= LOCAL_MIN_VIEWS).length >= LOCAL_MIN_POSTS ? rows.slice(0, limit).map((r) => String(r.id)) : [];
    };
    const countries = sql.exec('SELECT cc FROM post_countries GROUP BY cc HAVING SUM(n >= ?) >= ? ORDER BY SUM(n) DESC, cc', LOCAL_MIN_VIEWS, LOCAL_MIN_POSTS).toArray()
      .map((r) => String(r.cc))
      .map((cc) => ({
        cc,
        ids: ids('SELECT id FROM post_countries WHERE cc = ? ORDER BY n DESC, id DESC LIMIT ?', cc, limit),
        week: localSince(cc, WEEK_DAYS),
        month: localSince(cc, MONTH_DAYS),
      }));
    return {
      cc: countries.some((c) => c.cc === country) ? country : null,
      ids: ids('SELECT id FROM posts ORDER BY n DESC, id DESC LIMIT ?', limit),
      week: since(WEEK_DAYS),
      month: since(MONTH_DAYS),
      countries,
    };
  }

  /** 관리자 화면 — 쌓인 숫자를 그대로 넘긴다. 방문자에게 보이는 경로(fetch)에는 연결하지 않는다 */
  report(): Report {
    const sql = this.ctx.storage.sql;
    const rows = <T>(q: string, ...args: (string | number)[]) => sql.exec(q, ...args).toArray() as T[];
    // 기간 안에서 나라마다 LOCAL_MIN_VIEWS 번 이상 읽힌 글 수
    const localSince = (days: number) => new Map(
      rows<{ cc: string; k: number }>('SELECT cc, COUNT(*) AS k FROM (SELECT cc, id FROM post_country_days WHERE day >= ? GROUP BY cc, id HAVING SUM(n) >= ?) GROUP BY cc', kstDay(days - 1), LOCAL_MIN_VIEWS)
        .map((r) => [String(r.cc), Number(r.k)]),
    );
    const week = localSince(WEEK_DAYS);
    const month = localSince(MONTH_DAYS);
    return {
      today: kstDay(),
      days: rows<{ day: string; n: number }>('SELECT day, n FROM days ORDER BY day'),
      countries: rows<{ cc: string; n: number }>('SELECT cc, n FROM countries ORDER BY n DESC, cc'),
      posts: rows<{ id: string; n: number }>('SELECT id, n FROM posts ORDER BY n DESC, id DESC'),
      postDays: rows<{ day: string; id: string; n: number }>('SELECT day, id, n FROM post_days ORDER BY day, id'),
      postCountries: rows<{ cc: string; id: string; n: number }>('SELECT cc, id, n FROM post_countries ORDER BY cc, n DESC'),
      postCountriesWeek: rows<{ cc: string; id: string; n: number }>('SELECT cc, id, SUM(n) AS n FROM post_country_days WHERE day >= ? GROUP BY cc, id ORDER BY cc, n DESC', kstDay(WEEK_DAYS - 1)),
      local: rows<{ cc: string; k: number }>('SELECT cc, SUM(n >= ?) AS k FROM post_countries GROUP BY cc ORDER BY SUM(n) DESC, cc', LOCAL_MIN_VIEWS)
        .map((r) => ({ cc: String(r.cc), all: Number(r.k), week: week.get(String(r.cc)) ?? 0, month: month.get(String(r.cc)) ?? 0 })),
      rule: { minViews: LOCAL_MIN_VIEWS, minPosts: LOCAL_MIN_POSTS, weekDays: WEEK_DAYS, monthDays: MONTH_DAYS, keepDays: KEEP_DAYS },
    };
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const counter = env.VIEWS.get(env.VIEWS.idFromName('site'));
    // 두 글자 나라 코드만 쓴다 — Tor(T1)·알 수 없음(XX)은 '기타'로
    const cc = typeof req.cf?.country === 'string' && /^[A-Z]{2}$/.test(req.cf.country) && req.cf.country !== 'XX' ? req.cf.country : null;
    // 홈의 '많이 읽은 글' — 글 번호 20개(홈은 10개까지 보인다). 언어판에 없는 글은 홈이 걸러 낸다.
    // 나라마다 답이 달라 공용 캐시에는 두지 않고, 각자의 브라우저에만 몇 분씩 둬 홈을 열 때마다 묻지 않게
    if (url.pathname === '/api/popular' && req.method === 'GET') {
      return Response.json(await counter.popular(20, cc), { headers: { 'cache-control': 'private, max-age=300' } });
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
