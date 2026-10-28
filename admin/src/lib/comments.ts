// 댓글 — giscus 가 GitHub Discussions(Announcements)에 글마다 'post/<번호>' 스레드를 만든다. 그 댓글과 답글을
// GitHub GraphQL 로 읽는다(읽기 전용 토큰). 글쓴이(저장소 주인)가 마지막으로 말하지 않은 댓글이 '답할 것'
import { env } from 'cloudflare:workers';
import { GISCUS } from '../../../src/lib/site';
import { cached, source } from './google';
import { sampleComments } from './sample';

const TTL = 300; // 5분 — 새 댓글은 금방 보고 싶다
const QUERY = `query($owner: String!, $name: String!, $cat: ID!) {
  repository(owner: $owner, name: $name) {
    owner { login }
    discussions(first: 50, categoryId: $cat, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        title
        url
        comments(last: 50) {
          nodes {
            url createdAt isMinimized bodyText
            author { login avatarUrl(size: 40) }
            replies(last: 20) { nodes { url createdAt isMinimized bodyText author { login } } }
          }
        }
      }
    }
  }
}`;

export type Message = { author: string; at: string; url: string; text: string };
export type Thread = Message & {
  avatar: string | null;
  replies: Message[];
  needsReply: boolean; // 마지막 말이 글쓴이가 아니다
};
export type Comments = { owner: string; posts: { id: string; url: string; threads: Thread[] }[] };

type Node = { url: string; createdAt: string; isMinimized: boolean; bodyText: string; author: { login: string; avatarUrl?: string } | null };
type Result = {
  data?: { repository: { owner: { login: string }; discussions: { nodes: { title: string; url: string; comments: { nodes: (Node & { replies: { nodes: Node[] } })[] } }[] } } };
  errors?: { message: string }[];
};

const message = (n: Node): Message => ({ author: n.author?.login ?? 'ghost', at: n.createdAt, url: n.url, text: n.bodyText.replace(/\s+/g, ' ').trim() });

async function load(): Promise<Comments> {
  const [owner, name] = GISCUS.repo.split('/');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    // GitHub API 는 User-Agent 가 없는 요청을 거절한다
    headers: { authorization: `bearer ${env.GITHUB_TOKEN}`, 'content-type': 'application/json', 'user-agent': 'jaden-log-admin' },
    body: JSON.stringify({ query: QUERY, variables: { owner, name, cat: GISCUS.categoryId } }),
  });
  const out = (await res.json().catch(() => null)) as (Result & { message?: string }) | null;
  if (!res.ok || !out?.data) throw new Error(`${res.status} ${out?.errors?.[0]?.message ?? out?.message ?? res.statusText}`);
  const repo = out.data.repository;
  const me = repo.owner.login;
  return {
    owner: me,
    posts: repo.discussions.nodes.flatMap((d) => {
      const id = /^post\/(\d+)$/.exec(d.title)?.[1];
      if (!id) return [];
      // 숨긴 댓글(isMinimized)은 뺀다
      const threads = d.comments.nodes.filter((c) => !c.isMinimized).map((c): Thread => {
        const replies = c.replies.nodes.filter((r) => !r.isMinimized).map(message);
        const last = replies.at(-1)?.author ?? c.author?.login;
        return { ...message(c), avatar: c.author?.avatarUrl ?? null, replies, needsReply: last !== me };
      });
      return threads.length ? [{ id, url: d.url, threads }] : [];
    }),
  };
}

export const loadComments = () => source(sampleComments, () => cached('gh:v1:comments', TTL, load), !!env.GITHUB_TOKEN);

/** 답할 것 먼저, 그다음 최근 순 — 화면들이 같은 순서를 쓴다 */
export function commentStats(c: Comments) {
  const latest = (t: Thread) => t.replies.at(-1)?.at ?? t.at;
  const all = c.posts.flatMap((p) => p.threads.map((t) => ({ ...t, post: p.id, last: latest(t) }))).sort((a, b) => b.last.localeCompare(a.last));
  return {
    owner: c.owner,
    all,
    open: all.filter((t) => t.needsReply),
    post: (id: string) => all.filter((t) => t.post === id),
  };
}
export type CommentStats = ReturnType<typeof commentStats>;
