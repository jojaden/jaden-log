// 화면 가까이 온 것만 준비한다 — 확인 문제·캐러셀·표처럼 페이지 한 곳에만 쓰이는 스크립트가 페이지를 열 때 한꺼번에 돌지 않게.
// 처음에 위치를 한 번만 재어(레이아웃 한 번) 위아래 한 화면 안에 있는 것은 바로, 나머지는 그 거리까지 오면 init 을 한 번 부른다.
//
// 준비하며 높이가 바뀌는 요소가 화면 맨 위보다 위에서 시작하면(위쪽에 있거나 걸쳐 있으면) 그 아래 읽던 글이 바뀐 높이만큼 밀린다.
// 먼저 브라우저의 scroll anchoring 이 막게 두고, 다음 프레임에 스크롤이 그대로면 — 막지 못했거나(Safari 27 에서 본 적 있다)
// 기능이 없으면(Safari 26 이하) — 같은 프레임에 준비한 요소들의 높이 변화를 더해 한 번에 되돌린다.
// 그 사이 스크롤이 바뀌었으면 브라우저가 맞췄거나 사람이 굴린 것이니 두고 본다
let above: { el: Element; h: number }[] = [];
let sy = 0;
const settle = () => {
  const grew = above.reduce((s, x) => s + x.el.getBoundingClientRect().height - x.h, 0);
  if (scrollY === sy && Math.abs(grew) > 1) scrollBy({ top: grew, behavior: 'instant' });
  above = [];
};

export function whenNear<E extends Element>(els: Iterable<E>, init: (el: E) => void) {
  const todo = new Set(els);
  const ready = (el: E) => {
    if (!todo.delete(el)) return;
    io.unobserve(el);
    const r = el.getBoundingClientRect();
    if (r.top < 0) {
      if (!above.length) { sy = scrollY; requestAnimationFrame(() => setTimeout(settle)); }
      above.push({ el, h: r.height });
    }
    init(el);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && ready(e.target as E)), { rootMargin: '100% 0px' });
  const near = [...todo].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > -innerHeight && r.top < 2 * innerHeight; });
  todo.forEach((el) => io.observe(el));
  near.forEach(ready);
}
