// 빌드 때 astro.config.mjs 가 블로그 frontmatter 로 만드는 글 목록
declare module 'virtual:jd-posts' {
  export type Post = {
    id: string;
    title: string;
    titleEn: string | null; // 영어판 제목 (없으면 null)
    pubDate: string; // ISO
    updatedDate: string | null;
    category: string;
    subcategory: string;
    cover: { ko: boolean; en: boolean }; // 표지를 직접 지정했는지
    inbound: number; // 다른 글(한국어판)에서 이 글로 오는 링크 수
  };
  const posts: Post[]; // 올린 날 최신 순
  export default posts;
}

declare namespace Cloudflare {
  interface Env {
    VIEWS: DurableObjectNamespace<import('../../worker/index').ViewCounter>;
    ADMIN_SAMPLE?: string; // 개발 서버에서 '1' 이면 블로그 숫자 대신 표본
    ACCESS_TEAM_DOMAIN?: string; // Access 팀 도메인 'https://<팀>.cloudflareaccess.com' — JWT 발급자
    ACCESS_AUD?: string; // 관리자 Worker 의 Access 앱 AUD 태그 — JWT 받는 쪽
    CACHE: KVNamespace; // Google 응답을 잠깐 담아 두는 곳
    GOOGLE_CLIENT_ID?: string; // 시크릿 — Search Console·AdSense 를 읽는 열쇠 (계획 문서 G8)
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REFRESH_TOKEN?: string;
    GITHUB_TOKEN?: string; // 시크릿 — 댓글(GitHub Discussions)을 읽는 공개 저장소 읽기 전용 토큰
  }
}
