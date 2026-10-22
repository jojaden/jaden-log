import { localize, type Lang } from './i18n';

export const SITE = {
  title: 'Jaden.log',
  author: 'Jaden',
  slogan: '배운 것을 기록하고, 기록하며 다시 배웁니다',
  heroSub: '공부한 개념부터 직접 부딪혀 본 문제까지, 개발하며 알게 된 것들',
  description: '공부한 개념부터 직접 부딪혀 본 문제까지, 개발하며 알게 된 것들을 기록하는 개발 블로그',
  // 영어판 문구 (/en)
  en: {
    slogan: 'Write down what I learn, and learn again by writing',
    heroSub: 'From concepts I studied to problems I ran into, what I learn as a developer',
    description: 'A developer blog about what I learn, from concepts I studied to problems I ran into',
  },
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

// 상단 메뉴 — 이름은 i18n 사전의 키, 경로는 한국어 기준 (localize 로 언어별 경로)
export const NAV = [
  { href: '/category', key: 'posts' },
  { href: '/tag', key: 'tags' },
] as const;

export type Category = {
  name: string;
  slug: string; // 주소용 (/category/go)
  subSlugs: Record<string, string>; // 소분류 이름 → 주소용
  desc: string;
  subs: string[];
  en: { desc: string; subs: Record<string, string> }; // 영어판 설명 · 소분류 이름
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
    en: { desc: 'Notes from using and building with AI tools like Claude Code and Codex, and thoughts on learning with AI', subs: { 'AI 도구 활용': 'AI Tools', 'AI 단상': 'Essays' } },
    tint: 'rgba(191,90,242,.18)',
    acc: '#DA8FFF',
  },
  {
    name: 'Infra',
    slug: 'infra',
    subSlugs: { Kubernetes: 'kubernetes' },
    desc: '쿠버네티스 자원 설정과 온프레미스 설치에서 만난 문제를, 원인부터 직접 따라가 본 기록',
    subs: ['Kubernetes'],
    en: { desc: 'Problems from Kubernetes resource settings and on-premise installs, traced back to the cause', subs: { Kubernetes: 'Kubernetes' } },
    tint: 'rgba(48,209,88,.16)',
    acc: '#30D158',
  },
  {
    name: 'Go',
    slug: 'go',
    subSlugs: { '개념 정리': 'concepts', '실전 · 트러블슈팅': 'troubleshooting' },
    desc: '슬라이스·인터페이스·context가 실제로 무엇을 들고 있는지, 그리고 실전에서 만난 타임아웃과 최적화 기록',
    subs: ['개념 정리', '실전 · 트러블슈팅'],
    en: { desc: 'What slices, interfaces, and context really hold, plus timeouts and optimizations met in production', subs: { '개념 정리': 'Concepts', '실전 · 트러블슈팅': 'Troubleshooting' } },
    tint: 'rgba(100,210,255,.16)',
    acc: '#64D2FF',
  },
  {
    name: 'Database',
    slug: 'database',
    subSlugs: { '개념 정리': 'concepts', '실전 · 트러블슈팅': 'troubleshooting' },
    desc: '트랜잭션·락·정규화를 개념으로 정리하고, 인덱스와 다중 Pod 동시성을 실전에서 다시 보기',
    subs: ['개념 정리', '실전 · 트러블슈팅'],
    en: { desc: 'Transactions, locks, and normalization as concepts, then indexes and multi-pod concurrency in practice', subs: { '개념 정리': 'Concepts', '실전 · 트러블슈팅': 'Troubleshooting' } },
    tint: 'rgba(255,159,10,.16)',
    acc: '#FFB340',
  },
];

export const catOf = (name: string) => CATEGORIES.find((c) => c.name === name);
export function catHref(cat: string, sub?: string, lang: Lang = 'ko') {
  const c = catOf(cat);
  if (!c) return localize('/category', lang);
  return localize(sub ? `/category/${c.slug}/${c.subSlugs[sub] ?? encodeURIComponent(sub)}` : `/category/${c.slug}`, lang);
}
export const tagHref = (t: string, lang: Lang = 'ko') => localize(`/tag/${encodeURIComponent(t)}`, lang);

/** 언어별 표시 이름·설명 — 소분류는 한국어 이름이 키 */
export const subLabel = (cat: string, sub: string, lang: Lang) => (lang === 'en' ? catOf(cat)?.en.subs[sub] ?? sub : sub);
export const catDesc = (c: Category, lang: Lang) => (lang === 'en' ? c.en.desc : c.desc);
export const siteText = (lang: Lang) => (lang === 'en' ? { ...SITE, ...SITE.en } : SITE);
