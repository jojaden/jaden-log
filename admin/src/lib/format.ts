// 화면의 숫자·날짜 표기 — 한국어, 천 단위 쉼표, 변화에는 부호(진짜 빼기 기호)
const nf = new Intl.NumberFormat('ko-KR');
const regions = new Intl.DisplayNames(['ko'], { type: 'region' });

export const BLOG = 'https://jaden-log.jhg7856.workers.dev';

export const num = (n: number) => nf.format(n);
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf.format(Math.abs(n));
/** '2026-10-28' → '10월 28일' */
export const md = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
/** '2026-10-28' → '2026. 10. 28.' — 표에서 견주는 날짜 */
export const ymd = (day: string) => `${day.slice(0, 4)}. ${Number(day.slice(5, 7))}. ${Number(day.slice(8, 10))}.`;
/** 지난 기간과 견준 변화 — 견줄 기록이 없으면 그렇다고 쓰고, 0에서 늘었으면 '새로' */
export const delta = (cur: number, prev: number | null, base: string): { caption: string; tone: 'up' | 'down' | null } => {
  if (prev == null) return { caption: `${base}은 기록 전`, tone: null };
  if (prev === 0) return { caption: cur ? `${signed(cur)} (${base} 0회)` : `${base}과 같음`, tone: null };
  const diff = cur - prev;
  return { caption: `${signed(diff)} (${base} ${nf.format(prev)}회)`, tone: diff > 0 ? 'up' : diff < 0 ? 'down' : null };
};
export const region = (cc: string) => regions.of(cc) ?? cc;
export const flag = (cc: string) => `${BLOG}/flags/${cc.toLowerCase()}.svg`;
export const thumb = (id: string) => `${BLOG}/og/${id}.png`;
