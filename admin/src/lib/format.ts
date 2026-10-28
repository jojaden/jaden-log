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
/** 0.0412 → '4.1%' */
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** 평균 순위 — 소수 한 자리 */
export const rank = (x: number) => x.toFixed(1);
/** 수익 — 계정 통화로. 원·엔은 소수 없이. 숫자 줄은 amount 와 unit 을 나눠 쓴다 (단위는 작게) */
const digits = (c: string) => (c === 'KRW' || c === 'JPY' ? 0 : 2);
export const amount = (n: number, c: string) => new Intl.NumberFormat('ko-KR', { minimumFractionDigits: digits(c), maximumFractionDigits: digits(c) }).format(n);
export const unit = (c: string) => ({ KRW: '원', JPY: '엔' })[c] ?? c;
export const money = (n: number, c: string) => `${amount(n, c)}${digits(c) ? ' ' : ''}${unit(c)}`;
/** 주소의 경로 — 'https://…/en/21' → '/en/21' */
export const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};
/** 글 주소면 글 번호 — 한국어판·영어판을 한 글로 센다 (블로그 방문 수와 같은 방식). 글이 아니면 null */
export const postOf = (url: string) => /^\/(?:en\/)?(\d+)\/?$/.exec(pathOf(url))?.[1] ?? null;
