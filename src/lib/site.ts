export const SITE = {
  title: 'Jaden.log',
  author: 'Jaden',
  slogan: '배운 것을 기록하고, 기록하며 다시 배웁니다',
  heroSub: '공부한 개념부터 직접 부딪혀 본 문제까지, 개발하며 알게 된 것들',
  description: '공부한 개념부터 직접 부딪혀 본 문제까지, 개발하며 알게 된 것들을 기록하는 개발 블로그',
  tistory: 'https://jaden-dev.tistory.com',
  github: 'https://github.com/jojaden',
  perPage: 9,
};

// giscus 댓글 — GitHub Discussions(jojaden/jaden-log)의 Announcements 카테고리에 글별 스레드를 만든다
export const GISCUS = {
  repo: 'jojaden/jaden-log',
  repoId: 'R_kgDOVR7Xtg',
  category: 'Announcements',
  categoryId: 'DIC_kwDOVR7Xts4DJPFJ',
};

export const NAV = [
  { href: '/category', label: '글 목록' },
  { href: '/tag', label: '태그' },
];

export type Category = {
  name: string;
  slug: string; // 주소용 (/category/go)
  subSlugs: Record<string, string>; // 소분류 이름 → 주소용
  desc: string;
  subs: string[];
  tint: string; // 카드 타일 배경
  acc: string; // 카드 머리말 색
};

// 홈 주제 카드 순서: 윗줄 AI · Infra · Go / 아랫줄 Database
export const CATEGORIES: Category[] = [
  {
    name: 'AI',
    slug: 'ai',
    subSlugs: { 'AI 도구 활용': 'tools', 'AI 단상': 'essay' },
    desc: 'Claude Code·Codex 같은 AI 도구를 직접 써 보고 만들어 본 기록, 그리고 AI로 배운다는 것에 대한 생각',
    subs: ['AI 도구 활용', 'AI 단상'],
    tint: 'rgba(191,90,242,.18)',
    acc: '#DA8FFF',
  },
  {
    name: 'Infra',
    slug: 'infra',
    subSlugs: { Kubernetes: 'kubernetes' },
    desc: '쿠버네티스 자원 설정과 온프레미스 설치에서 만난 문제를, 원인부터 직접 따라가 본 기록',
    subs: ['Kubernetes'],
    tint: 'rgba(48,209,88,.16)',
    acc: '#30D158',
  },
  {
    name: 'Go',
    slug: 'go',
    subSlugs: { '개념 정리': 'concepts', '실전 · 트러블슈팅': 'troubleshooting' },
    desc: '슬라이스·인터페이스·context가 실제로 무엇을 들고 있는지, 그리고 실전에서 만난 타임아웃과 최적화 기록',
    subs: ['개념 정리', '실전 · 트러블슈팅'],
    tint: 'rgba(100,210,255,.16)',
    acc: '#64D2FF',
  },
  {
    name: 'Database',
    slug: 'database',
    subSlugs: { '개념 정리': 'concepts', '실전 · 트러블슈팅': 'troubleshooting' },
    desc: '트랜잭션·락·정규화를 개념으로 정리하고, 인덱스와 다중 Pod 동시성을 실전에서 다시 보기',
    subs: ['개념 정리', '실전 · 트러블슈팅'],
    tint: 'rgba(255,159,10,.16)',
    acc: '#FFB340',
  },
];

export const catOf = (name: string) => CATEGORIES.find((c) => c.name === name);
export function catHref(cat: string, sub?: string) {
  const c = catOf(cat);
  if (!c) return '/category';
  return sub ? `/category/${c.slug}/${c.subSlugs[sub] ?? encodeURIComponent(sub)}` : `/category/${c.slug}`;
}
export const tagHref = (t: string) => `/tag/${encodeURIComponent(t)}`;
