import { getCollection, type CollectionEntry } from 'astro:content';
import GithubSlugger from 'github-slugger';
import { coverBlocks, pickCover, type Cover } from './cover';

export type Post = CollectionEntry<'posts'>;

const isProd = import.meta.env.PROD;

/** 목록에 나오는 글 (최신순). draft·hidden 제외 */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', (p) => !p.data.hidden && !(isProd && p.data.draft));
  return all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 페이지를 만들 글 (hidden 포함) */
export async function getBuildablePosts(): Promise<Post[]> {
  return getCollection('posts', (p) => !(isProd && p.data.draft));
}

export const postHref = (p: Post) => `/${p.id}`;

/** 제목을 ` — ` 로 나눈다. 앞부분은 타일, 뒷부분은 부제 */
export function splitTitle(title: string): { main: string; sub: string } {
  const i = title.indexOf(' — ');
  if (i < 0) return { main: title, sub: '' };
  return { main: title.slice(0, i), sub: title.slice(i + 3) };
}

/** 하이픈 줄바꿈 방지 (On‑Premise) */
export const nbHyphen = (s: string) => s.replace(/-/g, '‑');

export function formatDate(d: Date) {
  const f = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(d).replace(/\s/g, '').replace(/\.$/, '');
}

/**
 * 카드·대표 글의 macOS 창에 넣을 표지 (규칙은 cover.ts).
 * 티스토리 때는 홈을 열 때마다 글 9개를 받아 왔지만 여기서는 요청이 없다.
 */
export const extractCover = (body: string | undefined): Cover | null => (body ? pickCover(coverBlocks(body)) : null);

export type TocItem = { depth: 2 | 3; text: string; id: string; lab?: boolean };

/**
 * 목차 — 본문 h2 와 실습 블록(<Lab title="…">)을 나오는 순서대로.
 * id 는 Astro 와 같은 github-slugger 로 만든다 (실습은 lab- 접두).
 */
export function buildToc(body: string | undefined): TocItem[] {
  if (!body) return [];
  const slugger = new GithubSlugger();
  const labSlugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const text = h[2].replace(/`/g, '');
      const id = slugger.slug(text);
      if (h[1].length === 2) items.push({ depth: 2, text, id });
      continue;
    }
    const lab = /<Lab\b[^>]*\btitle="([^"]+)"/.exec(line);
    if (lab) items.push({ depth: 3, text: lab[1], id: labId(lab[1], labSlugger), lab: true });
  }
  return items;
}

export function labId(title: string, slugger?: GithubSlugger) {
  return 'lab-' + (slugger ? slugger.slug(title) : new GithubSlugger().slug(title));
}

export function countBy(posts: Post[]) {
  const top = new Map<string, number>();
  const sub = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const p of posts) {
    top.set(p.data.category, (top.get(p.data.category) ?? 0) + 1);
    const k = `${p.data.category}/${p.data.subcategory}`;
    sub.set(k, (sub.get(k) ?? 0) + 1);
    for (const t of p.data.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  return { top, sub, tags, total: posts.length };
}
