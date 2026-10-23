// 시리즈 — 이어지는 글 묶음은 여기 한 곳에만 적는다. 글 페이지가 글 번호로 찾아 글 아래 영역에 그린다.
// 영어판이 없는 편은 영어 목록에서 저절로 빠진다
import type { Lang } from './i18n';

type Part = { id: string; label: Record<Lang, string> };
export type Series = { title: Record<Lang, string>; parts: Part[] };

export const SERIES: Series[] = [
  {
    title: { ko: 'DB 총정리 시리즈', en: 'DB series' },
    parts: [
      { id: '7', label: { ko: '낙관적 락 vs 비관적 락, 데드락', en: 'Optimistic vs pessimistic locking, deadlocks' } },
      { id: '9', label: { ko: '트랜잭션: ACID, 격리 수준, Redo/Undo', en: 'Transactions: ACID, isolation levels, Redo/Undo' } },
      { id: '10', label: { ko: '정규화·반정규화와 ORM vs 프로시저', en: 'Normalization, denormalization, ORM vs procedures' } },
      { id: '18', label: { ko: '회고: 인덱스와 실행계획', en: 'Retrospective: indexes and query plans' } },
    ],
  },
  {
    title: { ko: 'Go 기본 시리즈', en: 'Go fundamentals series' },
    parts: [
      { id: '11', label: { ko: '인터페이스와 메서드셋', en: 'Interfaces and method sets' } },
      { id: '12', label: { ko: '슬라이스·map·string 내부 구조', en: 'Inside slices, maps, and strings' } },
      { id: '13', label: { ko: 'defer·error·클로저', en: 'defer, errors, and closures' } },
      { id: '14', label: { ko: '임베딩과 Go의 객체지향', en: 'Embedding and object orientation in Go' } },
      { id: '15', label: { ko: 'context', en: 'context' } },
      { id: '20', label: { ko: '정리: 복사와 타입 시스템, 두 축', en: 'Wrap-up: copying and the type system' } },
    ],
  },
];

/** 이 글이 속한 시리즈 */
export const seriesOf = (id: string) => SERIES.find((s) => s.parts.some((p) => p.id === id));
