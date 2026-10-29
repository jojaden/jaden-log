// 시리즈 — 이어지는 글 묶음은 여기 한 곳에만 적는다. 글 페이지가 글 번호로 찾아 글 아래 영역에 그린다.
// 영어판이 없는 편은 영어 목록에서 저절로 빠진다
import type { Lang } from './i18n';

// id 가 없는 편은 아직 쓰지 않은 계획 편이다. 링크 없이 흐리게 보이고, 그 편을 쓰면 id 를 채운다
type Part = { id?: string; label: Record<Lang, string> };
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
  {
    title: { ko: 'Go 런타임 시리즈', en: 'Go runtime series' },
    parts: [
      { id: '21', label: { ko: 'GMP·GOMAXPROCS와 컨테이너 CPU limit', en: 'GMP, GOMAXPROCS, and container CPU limits' } },
      { id: '22', label: { ko: 'GOMEMLIMIT·GOGC와 컨테이너 메모리 limit', en: 'GOMEMLIMIT, GOGC, and container memory limits' } },
      { id: '24', label: { ko: 'sync.Pool과 버퍼 재사용', en: 'sync.Pool and buffer reuse' } },
      { id: '25', label: { ko: '고루틴 누수와 pprof', en: 'Goroutine leaks and pprof' } },
    ],
  },
  {
    title: { ko: 'CS 기본기 시리즈', en: 'CS fundamentals series' },
    // 요청 하나가 지나가는 길의 아홉 정거장 (32편 마지막 그림)
    parts: [
      { id: '32', label: { ko: '주소 찾기: DNS 동작 원리', en: 'Finding the address: how DNS works' } },
      { label: { ko: '연결하기: TCP · TLS', en: 'Connecting: TCP and TLS' } },
      { label: { ko: '요청 보내기: HTTP', en: 'Sending the request: HTTP' } },
      { label: { ko: '받기: I/O 다중화', en: 'Receiving: I/O multiplexing' } },
      { label: { ko: 'CPU에 올리기: 프로세스 · 스케줄링', en: 'Running on a CPU: processes and scheduling' } },
      { label: { ko: '메모리 쓰기: 가상 메모리', en: 'Using memory: virtual memory' } },
      { label: { ko: '함께 쓰기: 동기화 · 락', en: 'Sharing: locks and synchronization' } },
      { label: { ko: '데이터 찾기: 자료구조 · 저장장치', en: 'Finding the data: data structures and disks' } },
      { label: { ko: '터졌을 때: 시그널 · 진단', en: 'When it breaks: signals and debugging' } },
    ],
  },
];

/** 이 글이 속한 시리즈 */
export const seriesOf = (id: string) => SERIES.find((s) => s.parts.some((p) => p.id === id));
