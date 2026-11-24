// 층 — 위층 글(쿠버네티스)이 기대는 아래층 글(기본기)은 여기 한 곳에만 적는다.
// 글 페이지가 위층 글에는 '기대는 기본기'를, 아래층 글에는 거꾸로 '이 원리를 쓰는 글'을 그린다. 영어판이 없는 글은 영어 목록에서 저절로 빠진다

/** 위층 글 번호 → 그 글이 기대는 기본기 글 번호 */
export const DOWN: Record<string, string[]> = {
  '34': ['33', '35'],
};

/** 이 글이 기대는 기본기 */
export const downOf = (id: string) => DOWN[id] ?? [];
/** 이 원리를 쓰는 위층 글 */
export const upOf = (id: string) => Object.keys(DOWN).filter((up) => DOWN[up].includes(id));
