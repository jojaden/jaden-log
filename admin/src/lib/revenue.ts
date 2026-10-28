// AdSense — 예상 수익. 블로그 사이트가 승인(READY)되기 전에는 계정·사이트 상태만 읽어 '승인 전'으로 알린다.
// 날짜는 AdSense 계정 시간대 기준이다
import { BLOG, postOf } from './format';
import { cached, google, source } from './google';
import { sampleRevenue } from './sample';
import { addDays, kstDay } from './stats';

const API = 'https://adsense.googleapis.com/v2';
const TTL = 3600; // 한 시간 — 오늘 예상 수익은 그사이에도 바뀐다
export const DAYS = 90; // 날짜별 그래프 (이번 달·지난달도 여기서 센다)
export const WINDOW = 30; // 글·나라 표가 보는 날 수
const METRICS = ['ESTIMATED_EARNINGS', 'PAGE_VIEWS', 'PAGE_VIEWS_RPM', 'IMPRESSIONS', 'CLICKS'];

export type Money = { earnings: number; pageViews: number; rpm: number; impressions: number; clicks: number };
export type Site = { domain: string; state: string };
export type Revenue =
  | { approved: false; account: string | null; site: Site | null }
  | {
      approved: true;
      account: string;
      currency: string;
      today: string;
      days: (Money & { day: string })[];
      pages: (Money & { page: string })[]; // 최근 WINDOW 일
      countries: (Money & { cc: string })[]; // 최근 WINDOW 일
    };
type Report = { headers: { name: string; currencyCode?: string }[]; rows?: { cells: { value?: string }[] }[] };

// 사이트 상태 — AdSense 문서의 뜻을 한국어로
export const SITE_STATE: Record<string, string> = {
  REQUIRES_REVIEW: '검토 전',
  GETTING_READY: '검토 중',
  NEEDS_ATTENTION: '고칠 것이 있음',
  READY: '승인됨',
};

const date = (day: string, k: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return [[`${k}.year`, String(y)], [`${k}.month`, String(m)], [`${k}.day`, String(d)]];
};
async function report(account: string, from: string, to: string, dim: string, orderBy?: string) {
  const qs = new URLSearchParams([
    ['dateRange', 'CUSTOM'], ...date(from, 'startDate'), ...date(to, 'endDate'),
    ['dimensions', dim], ...METRICS.map((m) => ['metrics', m]), ...(orderBy ? [['orderBy', orderBy]] : []), ['limit', '1000'],
  ]);
  const r = await google<Report>(`${API}/${account}/reports:generate?${qs}`);
  const col = (name: string) => r.headers.findIndex((h) => h.name === name);
  const key = col(dim), at = METRICS.map(col);
  return {
    currency: r.headers[at[0]]?.currencyCode ?? 'USD',
    rows: (r.rows ?? []).map(({ cells }) => {
      const n = (i: number) => Number(cells[i]?.value) || 0;
      return { key: cells[key]?.value ?? '', earnings: n(at[0]), pageViews: n(at[1]), rpm: n(at[2]), impressions: n(at[3]), clicks: n(at[4]) };
    }),
  };
}

export const loadRevenue = () =>
  source(sampleRevenue, () =>
    // 키의 날짜는 하루가 바뀌면 새로 받게 하는 데만 쓴다 — 기간은 아래에서 계정 시간대로 센다
    cached(`ads:v2:${kstDay(new Date().toISOString())}`, TTL, async (): Promise<Revenue> => {
      const { accounts = [] } = await google<{ accounts?: { name: string; timeZone?: { id?: string } }[] }>(`${API}/accounts`);
      const account = accounts[0]?.name;
      if (!account) return { approved: false, account: null, site: null };
      // 보고서 날짜는 계정 시간대 기준이라 '오늘'도 그 시간대로
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: accounts[0].timeZone?.id ?? 'Asia/Seoul' }).format(new Date());
      const { sites = [] } = await google<{ sites?: Site[] }>(`${API}/${account}/sites`);
      const host = new URL(BLOG).hostname;
      const found = sites.find((x) => host === x.domain || host.endsWith(`.${x.domain}`));
      const site = found ? { domain: found.domain, state: found.state } : null;
      if (site?.state !== 'READY') return { approved: false, account, site };
      const [days, pages, countries] = await Promise.all([
        report(account, addDays(today, 1 - DAYS), today, 'DATE'),
        report(account, addDays(today, 1 - WINDOW), today, 'PAGE_URL', '-ESTIMATED_EARNINGS'),
        report(account, addDays(today, 1 - WINDOW), today, 'COUNTRY_CODE', '-ESTIMATED_EARNINGS'),
      ]);
      const money = ({ key, ...m }: Money & { key: string }) => m;
      return {
        approved: true, account, currency: days.currency, today,
        days: days.rows.map((r) => ({ day: r.key, ...money(r) })),
        pages: pages.rows.map((r) => ({ page: r.key, ...money(r) })),
        countries: countries.rows.map((r) => ({ cc: r.key, ...money(r) })),
      };
    }),
  );

/** 여러 줄을 하나로 — RPM 은 다시 나눈다 */
const combine = (xs: Money[]): Money => {
  const s = { earnings: 0, pageViews: 0, impressions: 0, clicks: 0 };
  for (const x of xs) for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += x[k];
  return { ...s, rpm: s.pageViews ? (s.earnings / s.pageViews) * 1000 : 0 };
};

export function revenueStats(r: Extract<Revenue, { approved: true }>) {
  const { today } = r;
  const span = (from: string, to: string) => combine(r.days.filter((d) => d.day >= from && d.day <= to));
  // 지난달 같은 기간 — 오늘이 31일이고 지난달이 30일까지면 지난달 말일까지
  const month = today.slice(0, 7);
  const lastMonthEnd = addDays(`${month}-01`, -1);
  const sameDay = `${lastMonthEnd.slice(0, 7)}-${today.slice(8)}`;
  const perPost = new Map<string, Money[]>();
  for (const p of r.pages) {
    const id = postOf(p.page);
    if (id) perPost.set(id, [...(perPost.get(id) ?? []), p]);
  }
  const on = new Map(r.days.map((d) => [d.day, d.earnings]));
  const days = Array.from({ length: DAYS }, (_, k) => addDays(today, k - DAYS + 1));
  return {
    currency: r.currency,
    today: span(today, today),
    yesterday: span(addDays(today, -1), addDays(today, -1)),
    month: span(`${month}-01`, today),
    lastMonth: span(`${lastMonthEnd.slice(0, 7)}-01`, sameDay < lastMonthEnd ? sameDay : lastMonthEnd),
    window: span(addDays(today, 1 - WINDOW), today),
    post: (id: string) => (perPost.has(id) ? combine(perPost.get(id)!) : undefined),
    posts: [...perPost].map(([id, xs]) => ({ id, ...combine(xs) })).sort((a, b) => b.earnings - a.earnings),
    countries: r.countries.filter((c) => c.earnings > 0),
    series: { days, values: days.map((d) => on.get(d) ?? 0) },
  };
}
export type RevenueStats = ReturnType<typeof revenueStats>;
