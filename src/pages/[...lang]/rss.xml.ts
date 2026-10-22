import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postHref } from '../../lib/posts';
import { SITE, siteText, subLabel } from '../../lib/site';
import { LANGS, langParam, type Lang } from '../../lib/i18n';

export const getStaticPaths = () => LANGS.map((l) => ({ params: { lang: langParam(l) }, props: { lang: l } }));

export async function GET(context: APIContext) {
  const lang = context.props.lang as Lang;
  const posts = await getPosts(lang);
  return rss({
    title: SITE.title,
    description: siteText(lang).description,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: postHref(p),
      categories: [p.data.category, subLabel(p.data.category, p.data.subcategory, lang), ...p.data.tags],
    })),
    customData: `<language>${lang}</language>`,
  });
}
