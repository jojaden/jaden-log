// Search Console — 블로그 속성(URL 접두어)의 검색 성과. 날짜는 Search Console 기준인 미국 태평양 시간이다.
// 날짜별 그래프는 집계 중인 최근 숫자까지 받고(dataState: all), 기간을 견주는 숫자와 표는 다 집계된 날까지만 센다
import { BLOG, pathOf, postOf } from './format';
import { cached, google, source } from './google';
import { sampleSearch } from './sample';
import { addDays } from './stats';

const API = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(`${BLOG}/`)}/searchAnalytics/query`;
const TTL = 3 * 3600; // 세 시간 — 집계 중인 숫자가 하루에 몇 번 바뀌는 정도
export const WINDOW = 28; // 글·검색어 표가 보는 날 수 (Search Console 기본 기간)
export const DAYS = 90; // 날짜별 그래프

export type Metrics = { clicks: number; impressions: number; ctr: number; position: number };
type Rows = { rows?: (Metrics & { keys: string[] })[]; metadata?: { first_incomplete_date?: string } };
export type Search = {
  last: string; // 날짜별 기록의 마지막 날 (집계 중일 수 있다)
  end: string; // 다 집계된 마지막 날 — 28일·7일 창의 끝
  incomplete: string | null; // 이날부터는 아직 집계 중
  days: (Metrics & { day: string })[];
  pages: (Metrics & { page: string })[]; // 최근 WINDOW 일
  pagesPrev: (Metrics & { page: string })[]; // 그 앞 WINDOW 일
  queries: (Metrics & { query: string })[];
  pageQueries: (Metrics & { page: string; query: string })[];
};

export const ptToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const query = (startDate: string, endDate: string, dimensions: string[], rowLimit = 1000) =>
  google<Rows>(API, { startDate, endDate, dimensions, rowLimit, dataState: 'all' });
const metrics = ({ clicks, impressions, ctr, position }: Metrics): Metrics => ({ clicks, impressions, ctr, position });

export const loadSearch = () =>
  source(sampleSearch, () => {
    const today = ptToday();
    return cached(`sc:v2:${today}`, TTL, async (): Promise<Search> => {
      const days = await query(addDays(today, 1 - DAYS), today, ['date']);
      const last = days.rows?.at(-1)?.keys[0] ?? today;
      const incomplete = days.metadata?.first_incomplete_date ?? null;
      // 집계 중인 날을 창에 넣으면 최근 기간만 짧게 잡혀 늘 줄어든 것처럼 보인다
      const end = incomplete && incomplete <= last ? addDays(incomplete, -1) : last;
      const from = (n: number) => addDays(end, 1 - n); // end 까지 n 일의 첫날
      const [pages, prev, queries, pairs] = await Promise.all([
        query(from(WINDOW), end, ['page']),
        query(from(2 * WINDOW), addDays(end, -WINDOW), ['page']),
        query(from(WINDOW), end, ['query']),
        query(from(WINDOW), end, ['page', 'query'], 5000),
      ]);
      return {
        last, end, incomplete,
        days: (days.rows ?? []).map((r) => ({ day: r.keys[0], ...metrics(r) })),
        pages: (pages.rows ?? []).map((r) => ({ page: r.keys[0], ...metrics(r) })),
        pagesPrev: (prev.rows ?? []).map((r) => ({ page: r.keys[0], ...metrics(r) })),
        queries: (queries.rows ?? []).map((r) => ({ query: r.keys[0], ...metrics(r) })),
        pageQueries: (pairs.rows ?? []).map((r) => ({ page: r.keys[0], query: r.keys[1], ...metrics(r) })),
      };
    });
  });

/** 여러 줄을 하나로 — CTR 은 다시 나누고, 평균 순위는 노출로 가중 평균 */
export const combine = (xs: Metrics[]): Metrics => {
  let clicks = 0, impressions = 0, weighted = 0;
  for (const x of xs) {
    clicks += x.clicks;
    impressions += x.impressions;
    weighted += x.position * x.impressions;
  }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? weighted / impressions : 0 };
};
const group = <T extends Metrics>(xs: T[], key: (x: T) => string | null) => {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    if (k != null) m.set(k, [...(m.get(k) ?? []), x]);
  }
  return new Map([...m].map(([k, v]) => [k, combine(v)]));
};
const byClicks = (a: Metrics, b: Metrics) => b.clicks - a.clicks || b.impressions - a.impressions;

// 고칠 후보 — 노출은 많은데 CTR 이 글 평균의 절반이 안 되는 글, 첫 쪽 아래나 둘째 쪽(8~20위)에 걸린 글.
// 제목·설명만 고쳐도 클릭이 늘 수 있다. 평균은 글별 숫자와 같은 단위(주소별 집계)로 잰다
export const FIX = { minImpressions: 50, ctrBelow: 0.5, rankFrom: 8, rankTo: 20, rankImpressions: 20 };
// 다음 글 후보 — 20위 밖에서 노출되는 검색어: 다루는 글이 약하거나 없다
export const TOPIC = { rankAbove: 20, minImpressions: 10 };

export function searchStats(s: Search) {
  const span = (from: number, to: number) => combine(s.days.filter((d) => d.day >= addDays(s.end, -to) && d.day <= addDays(s.end, -from)));
  const site = span(0, WINDOW - 1);
  const pageCtr = combine(s.pages).ctr; // 주소별 집계의 평균 CTR — 사이트 전체(속성별 집계)와 조금 다르다
  const perPost = group(s.pages, (x) => postOf(x.page));
  const perPostPrev = group(s.pagesPrev, (x) => postOf(x.page));
  // 글은 번호로 묶고, 글이 아닌 주소(홈·분류 등)는 경로 그대로
  const pages = [...group(s.pages, (x) => postOf(x.page) ?? pathOf(x.page))].map(([key, m]) => ({ key, post: !key.startsWith('/'), ...m })).sort(byClicks);
  const fix = [...perPost]
    .map(([id, m]) => ({
      id, ...m,
      why: [
        ...(m.impressions >= FIX.minImpressions && m.ctr < pageCtr * FIX.ctrBelow ? ['CTR 낮음'] : []),
        ...(m.impressions >= FIX.rankImpressions && m.position >= FIX.rankFrom && m.position <= FIX.rankTo ? [`${FIX.rankFrom}~${FIX.rankTo}위`] : []),
      ],
    }))
    .filter((x) => x.why.length)
    .sort((a, b) => b.impressions - a.impressions);
  return {
    end: s.end,
    incomplete: s.incomplete,
    pageCtr,
    site, sitePrev: span(WINDOW, 2 * WINDOW - 1),
    week: span(0, 6), weekPrev: span(7, 13),
    pages, fix,
    queries: [...s.queries].sort(byClicks),
    topics: s.queries.filter((q) => q.position > TOPIC.rankAbove && q.impressions >= TOPIC.minImpressions).sort((a, b) => b.impressions - a.impressions),
    post: (id: string) => perPost.get(id),
    postPrev: (id: string) => perPostPrev.get(id),
    /** 한 글로 들어온 검색어 — 한국어판·영어판을 합쳐서 */
    postQueries: (id: string) => [...group(s.pageQueries.filter((x) => postOf(x.page) === id), (x) => x.query)].map(([query, m]) => ({ query, ...m })).sort(byClicks),
    /** 날짜별 — 집계 중인 날까지, 기록이 없는 날은 0 */
    series: () => {
      const on = new Map(s.days.map((d) => [d.day, d]));
      const days = Array.from({ length: DAYS }, (_, k) => addDays(s.last, k - DAYS + 1));
      return { days, clicks: days.map((d) => on.get(d)?.clicks ?? 0), impressions: days.map((d) => on.get(d)?.impressions ?? 0) };
    },
  };
}
export type SearchStats = ReturnType<typeof searchStats>;
