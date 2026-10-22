import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const schema = z.object({
  title: z.string(),
  description: z.string().optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  category: z.string(), // 대분류: AI · Infra · Go · Database
  subcategory: z.string(), // 소분류
  tags: z.array(z.string()).default([]),
  tistoryId: z.number().optional(), // 옛 티스토리 글 번호 (이전 안내용)
  draft: z.boolean().default(false), // 빌드에서 제외
  hidden: z.boolean().default(false), // 페이지는 만들되 목록·피드·사이트맵에서 제외
  stub: z.boolean().default(false), // 본문 이전 전 자리표시 글 (글 이전 단계에서 지움)
});

// 한국어 글은 posts/ 바로 아래, 영어 글은 posts/en/ 에 같은 파일 이름(= 같은 글 번호)으로 둔다
const posts = defineCollection({ loader: glob({ pattern: '*.{md,mdx}', base: './src/content/posts' }), schema });
const postsEn = defineCollection({ loader: glob({ pattern: '*.{md,mdx}', base: './src/content/posts/en' }), schema });

export const collections = { posts, postsEn };
