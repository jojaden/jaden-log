// 개발 서버 전용 표본 — 첫 글을 올린 날부터 기록이 쌓였다고 치고 화면을 채워 본다. 실제 숫자가 아니다
// (화면 위쪽에 '표본 데이터' 표시가 붙는다). 같은 날에는 늘 같은 숫자가 나오게 씨앗을 고정한다
import posts from 'virtual:jd-posts';
import type { Report } from './report';
import { addDays, between, kstDay } from './stats';

// 한국 독자가 대부분이고, 다른 나라는 영어판으로 드문드문 — 문턱을 넘은 나라와 못 넘은 나라가 섞이게
const COUNTRIES: [string, number][] = [['KR', 0.8], ['US', 0.08], ['JP', 0.04], ['DE', 0.025], ['IN', 0.02], ['GB', 0.015], ['SG', 0.01], ['CA', 0.01]];

export function sampleReport(today: string): Report {
  let seed = 20261028;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = () => { let t = rnd(); for (const [cc, w] of COUNTRIES) if ((t -= w) <= 0) return cc; return 'KR'; };

  const postDays: Report['postDays'] = [];
  const cd = new Map<string, number>(); // `${day} ${cc} ${id}` → 조회
  for (const p of posts) {
    const pub = kstDay(p.pubDate);
    const peak = 6 + rnd() * 26, tail = 0.2 + rnd() * 1.6;
    for (let k = 0; k <= between(pub, today); k++) {
      const day = addDays(pub, k);
      const n = Math.round(peak * Math.exp(-k / 3.5) + tail * (0.3 + rnd() * 1.4));
      if (!n) continue;
      postDays.push({ day, id: p.id, n });
      for (let i = 0; i < n; i++) { const key = `${day} ${pick()} ${p.id}`; cd.set(key, (cd.get(key) ?? 0) + 1); }
    }
  }
  postDays.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));

  const totals = new Map<string, number>(), pc = new Map<string, number>(), visits = new Map<string, number>();
  for (const d of postDays) {
    totals.set(d.id, (totals.get(d.id) ?? 0) + d.n);
    visits.set(d.day, (visits.get(d.day) ?? 0) + d.n);
  }
  for (const [key, n] of cd) { const [, cc, id] = key.split(' '); pc.set(`${cc} ${id}`, (pc.get(`${cc} ${id}`) ?? 0) + n); }
  // 사이트 방문은 하루에 글 여러 편을 읽어도 한 번 — 글 조회의 7할쯤
  const days = [...visits].map(([day, n]) => ({ day, n: Math.max(1, Math.round(n * 0.7)) })).sort((a, b) => a.day.localeCompare(b.day));
  const byCc = new Map<string, number>();
  for (const [key, n] of pc) { const cc = key.split(' ')[0]; byCc.set(cc, (byCc.get(cc) ?? 0) + n); }
  const located = 0.93; // 나라를 모르는 방문(Tor 등)이 조금 있다
  const countries = [...byCc].map(([cc, n]) => ({ cc, n: Math.round(n * 0.7 * located) })).sort((a, b) => b.n - a.n);

  // 나라 문턱 — 블로그 DO 와 같은 규칙으로 센다
  const MIN = 2;
  const localIn = (from: string) => {
    const s = new Map<string, number>();
    for (const [key, n] of cd) { const [day, cc, id] = key.split(' '); if (day >= from) s.set(`${cc} ${id}`, (s.get(`${cc} ${id}`) ?? 0) + n); }
    const k = new Map<string, number>();
    for (const [key, n] of s) if (n >= MIN) { const cc = key.split(' ')[0]; k.set(cc, (k.get(cc) ?? 0) + 1); }
    return k;
  };
  const week = localIn(addDays(today, -6)), month = localIn(addDays(today, -29));
  const all = new Map<string, number>();
  for (const [key, n] of pc) if (n >= MIN) { const cc = key.split(' ')[0]; all.set(cc, (all.get(cc) ?? 0) + 1); }

  return {
    today,
    days,
    countries,
    posts: [...totals].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    postDays,
    postCountries: [...pc].map(([key, n]) => { const [cc, id] = key.split(' '); return { cc, id, n }; }).sort((a, b) => a.cc.localeCompare(b.cc) || b.n - a.n),
    local: countries.map(({ cc }) => ({ cc, all: all.get(cc) ?? 0, week: week.get(cc) ?? 0, month: month.get(cc) ?? 0 })),
    rule: { minViews: MIN, minPosts: 5, weekDays: 7, monthDays: 30, keepDays: 400 },
  };
}
