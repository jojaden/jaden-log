// MDX 글에서 import 없이 쓰는 컴포넌트 — 글 페이지가 components 로 넘긴다
import Lead from './Lead.astro';
import Figure from './Figure.astro';
import Lab from './Lab.astro';
import Note from './Note.astro';
import C from './C.astro';
import Table from './Table.astro';
import Series from './Series.astro';

export const mdxComponents = { Lead, Figure, Lab, Note, C, Series, table: Table };
