// 화면들이 쓰는 계산 — Report(블로그 DO 의 숫자)와 글 정보(virtual:jd-posts)에서.
// 두 곳에 보이는 숫자(제목 아래 소식과 그래프, 숫자 줄과 목록)는 여기서 한 번만 계산해 같은 값을 쓴다
import posts, { type Post } from 'virtual:jd-posts';
import type { Report } from './report';
import { md, num } from './format';

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
export const between = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400_000);
/** ISO 시각 → 한국 날짜 */
export const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** 분위수 (q=.5 가 중앙값) — 사이 값은 직선으로 */
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), at = (s.length - 1) * q, lo = Math.floor(at);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (at - lo);
};
const median = (xs: number[]) => quantile(xs, 0.5);
/** 반응 곡선이 보는 날 수 — 올린 날(0일)부터 30일째까지 */
export const LAUNCH_DAYS = 30;
/** '보통 글 하루 조회'를 기준으로 쓰려면 기록된 날이 이만큼은 있어야 한다 */
const TYPICAL_MIN_DAYS = 7;

export type Row = {
  post: Post;
  pub: string; // 올린 날 (한국 날짜)
  age: number; // 올린 지 며칠
  all: number; // 지금까지 조회
  d7: number; // 오늘까지 7일
  prev7: number | null; // 그 앞 7일 — 기록이 그 기간을 다 덮지 못하면 null
  d30: number; // 오늘까지 30일 (기록된 날만)
};

export function derive(r: Report) {
  const { today } = r;
  const visitOn = new Map(r.days.map((d) => [d.day, d.n]));
  const siteStart = r.days[0]?.day ?? null; // 사이트 방문 기록이 시작된 날
  const postStart = r.postDays[0]?.day ?? null; // 날짜별 글 조회 기록이 시작된 날
  // ago 일 전이 기록 안에 드는지 — 아니면 그 기간과 견주지 않는다
  const covered = (start: string | null, ago: number) => start != null && addDays(today, -ago) >= start;
  const recorded = (day: string) => postStart != null && day >= postStart;

  const perPost = new Map<string, Map<string, number>>();
  for (const d of r.postDays) {
    if (!perPost.has(d.id)) perPost.set(d.id, new Map());
    perPost.get(d.id)!.set(d.day, d.n);
  }
  const viewsOn = (id: string, day: string) => perPost.get(id)?.get(day) ?? 0;
  const viewsIn = (id: string, from: number, to: number) => {
    let s = 0;
    for (let k = from; k <= to; k++) s += viewsOn(id, addDays(today, -k));
    return s;
  };
  const visitsIn = (from: number, to: number) => {
    let s = 0;
    for (let k = from; k <= to; k++) s += visitOn.get(addDays(today, -k)) ?? 0;
    return s;
  };

  const total = new Map(r.posts.map((p) => [p.id, p.n]));
  const rows: Row[] = posts.map((post) => {
    const pub = kstDay(post.pubDate);
    return {
      post, pub, age: between(pub, today), all: total.get(post.id) ?? 0,
      d7: viewsIn(post.id, 0, 6), prev7: covered(postStart, 13) ? viewsIn(post.id, 7, 13) : null, d30: viewsIn(post.id, 0, 29),
    };
  });

  // 보통 글 하루 조회 — 최근 30일 중 기록된 날로 나눈 글별 하루 평균의 중앙값.
  // 기록된 날이 TYPICAL_MIN_DAYS 보다 적거나 0.1회가 안 되면 견줄 값이 못 되어 쓰지 않는다
  const recordDays = postStart ? Math.min(30, between(postStart, today) + 1) : 0;
  // 글마다 기록된 날 중 올린 뒤의 날로만 나눈다 — 막 올린 글이 30일로 나뉘어 기준을 끌어내리지 않게
  const mid = recordDays >= TYPICAL_MIN_DAYS ? median(rows.map((x) => x.d30 / Math.max(1, Math.min(recordDays, x.age + 1)))) : null;
  const typical = mid != null && mid >= 0.05 ? mid : null;

  /** 새 글 반응 곡선 — 올린 날부터 하루하루. 가로축은 올린 지 날수의 두 배(14~30일)라 새 글이 왼쪽에 몰리지 않는다.
   *  기록 전인 날과 아직 오지 않은 날은 null */
  const launch = (post: Post) => {
    const pub = kstDay(post.pubDate), age = between(pub, today);
    const span = Math.min(LAUNCH_DAYS, Math.max(14, age * 2));
    const days = Array.from({ length: span + 1 }, (_, k) => k);
    const values = days.map((k) => {
      const day = addDays(pub, k);
      return k > age || !recorded(day) ? null : viewsOn(post.id, day);
    });
    // 견줄 글 — 이 글보다 먼저 올렸고 첫날부터 기록된 글이 셋 이상일 때, 날마다 그 글들의 중앙값과 가운데 절반(25~75%)
    const peers = posts.filter((q) => q.pubDate < post.pubDate && recorded(kstDay(q.pubDate)));
    const peerViews = (k: number) => peers.filter((q) => between(kstDay(q.pubDate), today) >= k).map((q) => viewsOn(q.id, addDays(kstDay(q.pubDate), k)));
    const spread = peers.length >= 3 ? days.map((k) => { const vs = peerViews(k); return vs.length >= 3 ? vs : null; }) : null;
    const compare = spread && spread.map((vs) => (vs ? median(vs) : null));
    const shown = values.filter((v): v is number => v != null);
    const firstRecorded = values.findIndex((v) => v != null); // 없으면 -1
    return {
      post, pub, age, span, values, compare, peers: peers.length, firstRecorded,
      band: spread && { lo: spread.map((vs) => (vs ? quantile(vs, 0.25) : null)), hi: spread.map((vs) => (vs ? quantile(vs, 0.75) : null)) },
      recordedDays: shown.length,
      total: sum(shown),
      compareTotal: compare ? Math.round(sum(values.map((v, k) => (v == null ? 0 : compare[k] ?? 0)))) : null,
    };
  };

  const kpi = {
    today: visitOn.get(today) ?? 0,
    yesterday: covered(siteStart, 1) ? visitOn.get(addDays(today, -1)) ?? 0 : null,
    visits7: visitsIn(0, 6),
    visitsPrev7: covered(siteStart, 13) ? visitsIn(7, 13) : null,
    // 숨긴 글·지운 글의 조회도 블로그 전체 조회라 센다 (글 목록에는 안 나온다)
    views7: sum(r.postDays.filter((x) => x.day >= addDays(today, -6)).map((x) => x.n)),
    viewsPrev7: covered(postStart, 13) ? sum(r.postDays.filter((x) => x.day >= addDays(today, -13) && x.day <= addDays(today, -7)).map((x) => x.n)) : null,
  };

  /** 날짜별 사이트 방문 — 기록 첫날부터 오늘까지 (기록이 없는 날은 0) */
  const visitSeries = () => {
    if (!siteStart) return { days: [] as string[], values: [] as number[] };
    const days = Array.from({ length: between(siteStart, today) + 1 }, (_, k) => addDays(siteStart, k));
    return { days, values: days.map((d) => visitOn.get(d) ?? 0) };
  };
  /** 한 글의 날짜별 조회 — 최근 n일(올린 날보다 앞은 빼고), 기록 전인 날은 null */
  const postSeries = (post: Post, n: number) => {
    const span = Math.min(n, between(kstDay(post.pubDate), today) + 1);
    const days = Array.from({ length: Math.max(1, span) }, (_, k) => addDays(today, k - span + 1));
    return { days, values: days.map((d) => (recorded(d) ? viewsOn(post.id, d) : null)) };
  };

  // 나라별 7일 많이 읽힌 글 — 블로그 Worker 를 이 숫자가 생기기 전 판으로 둔 채 관리자를 먼저 배포하면 비어 있다
  const ccWeek = r.postCountriesWeek ?? [];
  const ccAll = new Map(r.postCountries.map((c) => [`${c.cc} ${c.id}`, c.n]));
  const rowOf = new Map(rows.map((x) => [x.post.id, x]));
  /** 7일 동안 글 조회가 있었던 나라 — 많은 순 */
  const weekCountries = [...ccWeek.reduce((m, c) => m.set(c.cc, (m.get(c.cc) ?? 0) + c.n), new Map<string, number>())]
    .map(([cc, n]) => ({ cc, n }))
    .sort((a, b) => b.n - a.n || a.cc.localeCompare(b.cc));
  /** 한 나라에서 7일 동안 많이 읽힌 글 — d7·all 을 그 나라 숫자로 바꾼 줄. 글 목록에 없는 글(숨긴 글 등)은 뺀다 */
  const topIn = (cc: string, limit: number): Row[] => ccWeek
    .filter((c) => c.cc === cc && rowOf.has(c.id))
    .map((c) => ({ ...rowOf.get(c.id)!, d7: c.n, all: ccAll.get(`${cc} ${c.id}`) ?? 0 }))
    .sort((a, b) => b.d7 - a.d7 || b.all - a.all)
    .slice(0, limit);

  const located = sum(r.countries.map((c) => c.n));
  const visitsAll = sum(r.days.map((d) => d.n));

  return {
    today, siteStart, postStart, recordDays, rows, typical, launch, kpi, visitSeries, postSeries,
    countries: r.countries, located, visitsAll, unlocated: Math.max(0, visitsAll - located),
    postCountries: (id: string) => r.postCountries.filter((c) => c.id === id).sort((a, b) => b.n - a.n),
    weekCountries, topIn,
    local: r.local, rule: r.rule,
  };
}
export type Derived = ReturnType<typeof derive>;
export type Launch = ReturnType<Derived['launch']>;

/** 개요 제목 아래 한 줄 — 오늘 가장 먼저 알아야 할 사실. 숫자는 그래프·숫자 줄과 같은 값 */
export function finding(d: Derived, L: Launch | null): string {
  if (!L || L.age > LAUNCH_DAYS) return `최근 ${LAUNCH_DAYS}일 동안 새 글이 없어요 · 오늘 방문 ${num(d.kpi.today)}회, 7일 ${num(d.kpi.visits7)}회`;
  const head = `새 글 /${L.post.id} 올린 지 ${L.age}일째`;
  if (!L.recordedDays) return `${head} — 날짜별 조회 기록이 아직 없어요`;
  if (L.compare && L.firstRecorded === 0 && L.compareTotal) {
    return `${head}, ${L.recordedDays}일 동안 ${num(L.total)}회 — 이전 새 글 같은 기간 중앙값 ${num(L.compareTotal)}회의 ${(L.total / L.compareTotal).toFixed(1)}배`;
  }
  const since = L.firstRecorded > 0 && d.postStart ? ` (기록은 ${md(d.postStart)}부터)` : '';
  const typical = d.typical != null ? ` — 보통 글은 하루 ${d.typical.toFixed(1)}회` : ` · 견줄 기록이 아직 ${d.recordDays}일치뿐이에요`;
  return `${head}, 기록된 ${L.recordedDays}일 동안 ${num(L.total)}회${since}${typical}`;
}
