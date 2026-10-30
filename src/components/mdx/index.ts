// MDX 글에서 import 없이 쓰는 컴포넌트 — 글 페이지가 components 로 넘긴다
import Lead from './Lead.astro';
import Figure from './Figure.astro';
import Lab from './Lab.astro';
import Note from './Note.astro';
import C from './C.astro';
import Table from './Table.astro';
import Summary from './Summary.astro';
import Compare from './Compare.astro';
import Side from './Side.astro';
import Stats from './Stats.astro';
import Bars from './Bars.astro';
import Carousel from './Carousel.astro';
import Slide from './Slide.astro';
import Key from './Key.astro';
import Big from './Big.astro';
import Quiz from './Quiz.astro';
import Shot from './Shot.astro';

export const mdxComponents = { Lead, Figure, Lab, Note, C, Summary, Compare, Side, Stats, Bars, Carousel, Slide, Key, Big, Quiz, Shot, table: Table };
