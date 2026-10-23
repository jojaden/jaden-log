// 문체 검사 — AI가 다듬은 티가 나는 패턴 찾기. 티스토리 때 tistory_voice_check.py 를 MDX 용으로 옮긴 것.
// 기준은 티스토리 발행 글 25편 실측 (jaden-log-post 스킬 voice.md).
//   7월 글(직접 쓴 회고·도구 글)   대시 2.6/천자 · 1인칭 1.0/천자
//   AI 단상 「AI를 쓸수록 커지던 회의감에 대해」   대시 1.8/천자 · 1인칭 3.1/천자 · 문장 길이 표준편차 39
//   9~10월 글(AI 편집 많음)        대시 5.0/천자 · 1인칭 0.5/천자 · 표준편차 17~19(4편)
//
//   npm run check:voice -- 31          글 id
//   npm run check:voice -- 31 en/31    영어판은 en/<id> (영어 기준으로 센다)
//
// 코드 펜스·SVG·표·컴포넌트 속성·각주 정의는 빼고 본문 문장만 센다. 기준을 넘으면 ⚠ 를 붙이고 해당 문장을 보여 준다.
import { readFileSync, existsSync } from 'node:fs';

// 대시 기준은 인기 글 실측(2026-10 조사): 한국어 천 자당 0~1.2, 영어 천 단어당 0~2.7
const LIMIT = { dash: 1.0, dashEnWords: 3.0, reverse: 1.0, bold: 4.0 };
const POSTS = new URL('../src/content/posts/', import.meta.url);

// 격언·공식처럼 읽히는 문장 — 섹션 마지막 문장에서 특히 본다
const FORMULA = {
  ko: [
    [/까지다\./, "'~까지다' 한정 공식"],
    [/(다른|별개의) (이야기|것|질문|문제)(이)?다\./, "'A와 B는 다른 이야기다' 대구"],
    [/(는|은) 하나다/, "'규칙은 하나다' 선언"],
    [/답은 (한 줄|하나|간단)/, "'답은 한 줄이다' 선언"],
    [/절반만 맞/, "'절반만 맞다' 반전"],
    [/정리하면 이렇다/, "'정리하면 이렇다' 상투구"],
    [/(?<!뿐 )(아니라|아니고) [^.,]{1,30}(다|이다|였다)\.$/, "'A가 아니라 B다' 반전"],
    [/이 필요하다\.$/, "다음 절을 예고하는 '~가 필요하다.'"],
    [/^문제는 .+ 생긴다\.$/, "'문제는 ~때 생긴다' 예고"],
    [/(이|가) 곧 [^.]{1,25}(이)?다\.$/, "'X가 곧 Y다' 경구"],
    [/(얻은|남은|배운) (건|것은) .{1,30}(하나|한 줄|그림)/, "'얻은 건 ~하나였다' 회고 경구"],
    [/(말해 주지|알려 주지) 않는다\.$/, "'코드가 대신 말해 주지 않는다' 경구"],
  ],
  en: [
    [/\b(isn't|aren't|wasn't) [^.;]{1,50}; (it's|they're|it was)/, "'X isn't A; it's B' reversal"],
    [/\bnot [^.,]{1,40}\bbut\b/, "'not A but B' reversal"],
    [/\b(comes|came) down to\b/, "'comes down to' formula"],
    [/\bthe (real|whole) (point|story|lesson)\b/, "'the real point' formula"],
    [/\b(is|are) a (different|separate) (question|story|matter)\b/, "'a different question' couplet"],
    [/\bwon't (say|tell) (it|you)\b/, "'the code won't tell you' aphorism"],
    [/^(In short|Put simply|The answer is simple)/, 'summary opener'],
  ],
};
const FIRST = { ko: /(내가|나는|난 |내 |나도|제가|저는)/g, en: /\b(I|I'm|I've|I'd|my|me)\b/g };
const REVERSE = { ko: /(?<!뿐 )아니라/g, en: /, not |\bnot\b[^.]{0,60}\bbut\b|n't [^.;]{0,50}; (it|they)|rather than/g };

/** MDX → 본문 문장만 */
function strip(src) {
  let s = src.replace(/^---[\s\S]*?^---$/m, ' '); // frontmatter
  s = s.replace(/^```[\s\S]*?^```/gm, ' '); // 코드 카드
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, ' ');
  s = s.replace(/^\|.*\|\s*$/gm, ' '); // 표
  s = s.replace(/^\[\^[^\]]+\]:.*$/gm, ' '); // 각주 정의
  s = s.replace(/\[\^[^\]]+\]/g, ''); // 각주 참조
  s = s.replace(/<(Bars|Stats)\b[\s\S]*?\/>/g, ' '); // 데이터만 있는 컴포넌트
  s = s.replace(/<[A-Za-z][^>]*>|<\/[A-Za-z]+>/g, '\n'); // 나머지 태그는 껍데기만 (안의 글은 센다)
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // 링크
  return s;
}

const split = (text) => text.split(/(?<=[.!?])\s+|\n/).map((x) => x.trim()).filter((x) => [...x].length > 8);

function check(id) {
  const file = ['mdx', 'md'].map((e) => new URL(`${id}.${e}`, POSTS)).find((u) => existsSync(u));
  if (!file) return console.log(`\n  ${id}: 글을 찾을 수 없다`);
  const lang = id.startsWith('en/') ? 'en' : 'ko';
  const src = readFileSync(file, 'utf8');
  const doc = strip(src);
  const bold = (doc.match(/\*\*[^*]+\*\*/g) ?? []).length;
  const body = doc.replace(/\*\*/g, '').replace(/`/g, '').replace(/^#{1,6}\s.*$/gm, '\n').replace(/^>\s?/gm, '').replace(/^\s*(\d+\.|[-*])\s+/gm, '').replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
  const n = Math.max([...body].length, 1);
  const per = (k) => (k * 1000) / n;
  const sents = split(body);
  const lens = sents.map((x) => [...x].length);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1));
  const dash = (body.match(/—/g) ?? []).length;
  const rev = (body.match(REVERSE[lang]) ?? []).length;
  const first = (body.match(FIRST[lang]) ?? []).length;

  const h2 = (src.replace(/^```[\s\S]*?^```/gm, '').match(/^##\s/gm) ?? []).length;
  console.log(`\n===== ${id}  (본문 ${n}자, 문장 ${sents.length}개, h2 ${h2}개${h2 > 10 ? ' ⚠ 큰 흐름은 5~9개, 단계는 h3' : ''})`);
  const words = body.split(/\s+/).length;
  const dashRow = lang === 'en'
    ? ['대시 —', (dash * 1000) / words, `≤ ${LIMIT.dashEnWords} /천 단어`, (dash * 1000) / words > LIMIT.dashEnWords, false]
    : ['대시 —', per(dash), `≤ ${LIMIT.dash}`, per(dash) > LIMIT.dash, true];
  const rows = [
    dashRow,
    ['반전', per(rev), `≤ ${LIMIT.reverse}`, per(rev) > LIMIT.reverse, true],
    ['볼드', per(bold), `≤ ${LIMIT.bold}`, per(bold) > LIMIT.bold, true],
    ['1인칭', per(first), '회고·도구 글 ≥ 1.5', false, true],
    ['문장 길이 표준편차', sd, lang === 'ko' ? '≥ 25 (리듬이 고르면 낮다)' : '참고값', lang === 'ko' && sd < 25, false],
  ];
  for (const [name, v, ref, bad, perK] of rows) {
    console.log(`  ${bad ? '⚠' : ' '} ${String(name).padEnd(12)} ${v.toFixed(2).padStart(6)}   기준 ${ref}${perK ? '   /천자' : ''}`);
  }
  const hits = [];
  for (const x of sents) {
    const f = FORMULA[lang].find(([re]) => re.test(x));
    if (f) hits.push([f[1], x]);
  }
  console.log(`  ${hits.length > 3 ? '⚠' : ' '} 공식·경구 문장 ${hits.length}개 (글당 3개 이하)`);
  for (const [label, x] of hits.slice(0, 12)) console.log(`      · [${label}] ${x.slice(0, 110)}`);

  // h2 로 자른 절의 마지막 문장
  const ends = strip(src)
    .split(/^##\s.*$/m)
    .slice(1)
    .map((part) => part.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((x) => [...x].length > 8).at(-1))
    .filter(Boolean);
  const endHits = ends.flatMap((e) => FORMULA[lang].filter(([re]) => re.test(e)).slice(0, 1).map(([, label]) => [label, e]));
  console.log(`  ${endHits.length ? '⚠' : ' '} 섹션 끝이 경구로 닫힌 곳 ${endHits.length}/${ends.length}`);
  for (const [label, e] of endHits.slice(0, 8)) console.log(`      · [${label}] ${e.slice(0, 110)}`);

  // 같은 박자 — 한 문단 안에서 이어진 세 문장이 길이가 ±20% 안이고 끝맺음이 같다
  const beats = [];
  for (const para of doc.replace(/\*\*/g, '').split(/\n\s*\n/)) {
    const ss = split(para.replace(/\s+/g, ' '));
    for (let i = 0; i + 2 < ss.length; i++) {
      const tri = ss.slice(i, i + 3);
      const ls = tri.map((x) => [...x].length);
      if (Math.max(...ls) <= Math.min(...ls) * 1.2 && new Set(tri.map((x) => x.slice(-3))).size === 1) beats.push(tri);
    }
  }
  console.log(`  ${beats.length ? '⚠' : ' '} 같은 박자 세 번 ${beats.length}곳`);
  for (const tri of beats.slice(0, 6)) console.log(`      · ${tri.map((x) => x.slice(0, 36)).join(' / ')}`);
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log('사용법: npm run check:voice -- <글 id> [en/<글 id> ...]');
  process.exit(0);
}
args.forEach(check);
console.log();
