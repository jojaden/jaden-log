// 링크 미리보기 그림(og:image) — 빌드 때 글마다 1200×630 PNG 를 만든다 (/og/30.png, /og/en/30.png, 사이트 기본 /og/site.png)
// satori 가 글자를 도형으로 바꿔 SVG 를 만들고 resvg 가 PNG 로 굽는다. 글꼴은 사이트가 쓰는 Pretendard 를 빌드 때 한 번 받아 둔다
import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { getBuildablePosts, splitTitle, formatDate, type Post } from '../../lib/posts';
import { catOf, subLabel, siteText, SITE } from '../../lib/site';
import { LANGS, type Lang } from '../../lib/i18n';

export async function getStaticPaths() {
  const [ko, en] = await Promise.all(LANGS.map((l) => getBuildablePosts(l)));
  return [
    ...ko.map((post) => ({ params: { slug: post.id }, props: { post, lang: 'ko' as Lang } })),
    ...en.map((post) => ({ params: { slug: `en/${post.id}` }, props: { post, lang: 'en' as Lang } })),
    { params: { slug: 'site' }, props: { lang: 'ko' as Lang } },
    { params: { slug: 'en/site' }, props: { lang: 'en' as Lang } },
  ];
}

// 글꼴 — 로컬에서는 node_modules/.cache 에 두고 다시 받지 않는다. 받지 못하면 세 번까지 다시 시도한 뒤 빌드를 멈춘다
const FONT_URL = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-{w}.otf';
const CACHE = 'node_modules/.cache/jd-og';
async function font(weight: 'Bold' | 'SemiBold') {
  const file = `${CACHE}/Pretendard-${weight}.otf`;
  if (existsSync(file)) return readFileSync(file);
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(FONT_URL.replace('{w}', weight));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, buf);
      return buf;
    } catch (e) {
      if (i >= 2) throw new Error(`OG 글꼴을 받지 못했습니다 (${weight}): ${e}`);
    }
  }
}
let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 600 | 700 }[]; avatar: string }> | undefined;
const load = () =>
  (assets ??= (async () => {
    const [bold, semi, png] = await Promise.all([font('Bold'), font('SemiBold'), sharp('public/avatar.webp').resize(96, 96).png().toBuffer()]);
    return {
      fonts: [{ name: 'Pretendard', data: bold, weight: 700 }, { name: 'Pretendard', data: semi, weight: 600 }],
      avatar: `data:image/png;base64,${png.toString('base64')}`,
    };
  })());

// satori 는 React 요소 모양의 객체를 받는다 — JSX 없이 작은 도우미로 만든다
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({ type, props: { style, children, ...extra } });

function card(o: { acc: string; kicker: string; title: string; sub: string; foot: string; avatar: string }) {
  return h('div', {
    // border-box 가 없으면 satori 가 여백을 크기 밖에 더해 아래 줄이 그림 밖으로 밀린다
    width: 1200, height: 630, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '72px 80px', background: '#000', color: '#F5F5F7', fontFamily: 'Pretendard',
    backgroundImage: `radial-gradient(900px 520px at 100% 0%, ${o.acc}33, transparent 70%)`,
  }, [
    h('div', { display: 'flex', flexDirection: 'column' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 600, color: o.acc }, [
        h('div', { width: 14, height: 14, borderRadius: 7, background: o.acc }),
        o.kicker,
      ]),
      h('div', { marginTop: 34, fontSize: o.title.length > 28 ? 64 : 76, fontWeight: 700, lineHeight: 1.12, letterSpacing: -2, wordBreak: 'keep-all', display: 'flex' }, o.title),
      o.sub ? h('div', { marginTop: 22, fontSize: 38, fontWeight: 600, lineHeight: 1.3, color: '#A1A1A6', wordBreak: 'keep-all', display: 'flex' }, o.sub) : null,
    ].filter(Boolean)),
    h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 28, fontWeight: 600, color: '#A1A1A6' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 16, color: '#F5F5F7' }, [
        h('img', { width: 52, height: 52, borderRadius: 26 }, undefined, { src: o.avatar, width: 52, height: 52 }),
        SITE.title,
      ]),
      o.foot,
    ]),
  ]);
}

export const GET: APIRoute = async ({ props }) => {
  const { post, lang } = props as { post?: Post; lang: Lang };
  const { fonts, avatar } = await load();
  const node = post
    ? (() => {
        const { main, sub } = splitTitle(post.data.title);
        const acc = catOf(post.data.category)?.acc ?? '#2997FF';
        // 영어 부제는 — 뒤라 소문자로 시작한다. 따로 한 줄에 놓이므로 첫 글자만 대문자로 (글 머리와 같게)
        const subLine = lang === 'en' && sub ? sub[0].toUpperCase() + sub.slice(1) : sub;
        return card({ acc, kicker: `${post.data.category} · ${subLabel(post.data.category, post.data.subcategory, lang)}`, title: main, sub: subLine, foot: formatDate(post.data.pubDate, lang), avatar });
      })()
    : card({ acc: '#2997FF', kicker: lang === 'en' ? 'Developer blog' : '개발 블로그', title: siteText(lang).slogan, sub: siteText(lang).heroSub, foot: 'AI · Infra · Go · Database', avatar });
  const svg = await satori(node as never, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
