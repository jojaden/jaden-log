// 브라우저 검색 — /search 페이지와 ⌘K 검색 창이 함께 쓴다.
// Pagefind 가 빌드 뒤 dist/pagefind 에 만든 색인을 읽는다 (서버 없음). 페이지의 <html lang> 과 같은 언어 색인만 읽는다
type Raw = { url: string; excerpt: string; content?: string; meta?: { title?: string; cat?: string; date?: string } };
type PF = { search: (q: string) => Promise<{ results: { data: () => Promise<Raw> }[] }>; init?: () => Promise<void> };
export type Hit = { url: string; title: string; meta: string; excerpt: string };

let pf: Promise<PF | null> | undefined;
/** 색인 읽기 — 개발 서버처럼 색인이 없으면 null */
export function loadIndex() {
  const url = '/pagefind/pagefind.js';
  return (pf ??= (import(/* @vite-ignore */ url) as Promise<PF>).then(async (m) => { await m.init?.(); return m; }).catch(() => null));
}

// 색인 주소는 폴더 형식(/30/)이라 사이트 링크와 같은 모양(/30)으로 바꾼다 — 끝 슬래시 주소는 한 번 더 넘어가야 한다
const clean = (u: string) => (u.length > 1 ? u.replace(/\/$/, '') : u);

/**
 * 검색 — 결과가 없으면 빈 배열, 색인이 없으면 null.
 * Pagefind 는 맞는 낱말이 없어도 코드 속 한 글자('z')처럼 가까운 낱말로 결과를 낸다.
 * 검색어 낱말의 앞 세 글자가 제목·본문 어디에도 없는 결과는 뺀다 (어미·복수형은 앞 세 글자로 살아남는다)
 */
export async function search(q: string, limit = 20): Promise<Hit[] | null> {
  const p = await loadIndex();
  if (!p) return null;
  const r = await p.search(q);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.slice(0, 3));
  const data = await Promise.all(r.results.slice(0, 50).map((x) => x.data()));
  return data
    .filter((d) => { const text = `${d.meta?.title ?? ''} ${d.content ?? ''}`.toLowerCase(); return words.some((w) => text.includes(w)); })
    .slice(0, limit)
    .map((d) => ({ url: clean(d.url), title: d.meta?.title ?? '', meta: [d.meta?.cat, d.meta?.date].filter(Boolean).join(' · '), excerpt: d.excerpt }));
}

/** 결과 HTML 에 넣을 글자 이스케이프 (발췌 excerpt 는 Pagefind 가 <mark> 를 넣어 주므로 그대로 쓴다) */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
