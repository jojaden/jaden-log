# 규칙의 근거 (2026-10-23 조사)

규칙을 바꾸거나 "왜 이 규칙이냐"는 질문을 받았을 때 읽는다. 많이 읽힌 개발 글 47편을 실제로 내려받아 인칭, 대시 수, 문장 길이, 소제목, 그림, 코드 개수를 셌다.

## 읽은 출처

| 묶음 | 출처 |
| --- | --- |
| 영어 기술 블로그(15편) | Julia Evans, Dan Luu, Simon Willison, Josh Comeau, Bartosz Ciechanowski, Russ Cox, Brendan Gregg, go.dev/blog(loopvar, Green Tea GC), Cloudflare 장애 회고(2025-11-18, 2019 정규식), Discord(Go→Rust), Figma |
| 한국어 기술 블로그(14편) | 토스, 우아한형제들(장애 회고), 카카오(CLOSE_WAIT), 카카오페이(JVM warm-up), 하이퍼커넥트(segfault), 당근, 인프랩(장애 회고), 향로, 44bits, Outsider |
| 에세이·인터뷰(18편) | Paul Graham, Dan Abramov, patio11, Charity Majors, Joel Spolsky, Hillel Wayne, 향로 회고, 테오, 요즘IT 칼럼·인터뷰, 브런치, Increment, The Pragmatic Engineer, Simon Willison 대담 정리, 토스피드 |

## 실측과 거기서 나온 규칙

| 관찰 | 규칙 |
| --- | --- |
| 대시: 한국어 14편 모두 천 자당 0~1.2개(토스, Outsider는 0). 영어는 천 단어당 0~2.7개(Simon만 12.8) | voice.md 대시 천 자당 1개 이하, english.md 천 단어당 3개 이하 |
| 경구 마무리는 다듬어진 회사 글에 글당 1개쯤 있었다. 개인 글은 사실, 수치, 겸손한 말로 닫았다 | 경구 마무리 금지 유지 |
| 셋째 문단 안에 짧은 답(Julia Evans "the short answer is"). 장애 회고는 둘째 문단에 원인(Cloudflare) | 요약형 "머리말"만 금지하고, 머리말 없는 짧은 답은 앞쪽에 허용 |
| h2 5~9개(Go 5, Cloudflare 6, Gregg 7, Discord 9). 단계는 h3로(카카오페이 가설 #1~#4, 인프랩 날짜별 h3) | h2 5~9개, 단계는 h3(목차에 안 들어간다) |
| 소제목은 대부분 명사형이나 주장형. 질문형은 글 중간에 가끔 | 질문형은 독자의 실제 질문일 때만 |
| 재현이 독립 절(카카오 "CLOSE_WAIT 재현", 당근 "재현: DDL 종류별로") | 트러블슈팅 3단계 "재현" |
| 처음 가설과 기각을 남긴다(카카오페이 "에러 로그에 꽂혀서", 당근 "기대고 있다는 걸 몰랐어요") | 가설을 1인칭 인용 블록으로 두고 바로 아래에 기각 근거 |
| 명령 → 출력 → 해석 1~2문장 되풀이(44bits 30번, Julia Evans `>>>` 18블록) | 출력 카드 뒤 "어디를 보라" 1~2문장 |
| 1차 자료를 단다(하이퍼커넥트 References, 카카오 커널 커밋 각주, 당근 릴리스 노트) | 글 끝 참고 자료 |
| "Update:" 절, Edit 각주, 정정 요청(Gregg, Discord, Russ Cox) | 고친 내용 절, 영어판 Updates |
| '알 수 있는 것/없는 것' 표를 둔 글은 없었다 | 그 표는 선택으로 |
| 지표 그래프 20장 이상(카카오페이, 인프랩), 단계 넘기기 그림 약 89장(Go Green Tea) | 시계열 그림, 단계 넘기기 그림 |
| 회고는 판정 한 문장으로 열고, 기간이나 영역별 h2, 숫자, 다음 할 일 한 줄(Dan Abramov, 향로) | 회고 유형 |
| 인터뷰 정리는 인용(타임스탬프) 뒤에 내 코멘트(Simon Willison, 향로 767). 진행자가 결론을 따로 내지 않는다 | 인터뷰·발표 보고 정리 유형, 인용 규칙 |
| 단상은 대부분 결론 대신 지금 상태 한 줄로 끝났다. 주장하는 에세이만 질문으로 끝났다(PG "Why not by you?") | 단상 닫는 법 |
| 이모지 0~3개, "안녕하세요 OO팀입니다"와 채용 꼬리는 회사 글 관습 | 이모지 규칙 유지, 인사말 없음 |

## 확인하지 못한 것

- 조회수는 어디서도 수치로 확인하지 못했다. 인기는 HN 점수, 공유, 인용 빈도로 짐작했다.
- 인터랙티브 요소(Ciechanowski, Comeau)는 JS를 실행하지 않고 개수만 셌다.
- 네이버 D2, LINE, 뱅크샐러드, Netflix, Uber, Stripe는 읽지 않았다.
