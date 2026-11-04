// 본문 글꼴 JdSans — Pretendard Variable 에서 사이트에 쓰인 글자만 남긴 한 벌을 빌드 때 만든다 (astro.config.mjs 의 통합).
//
// 왜: Pretendard 를 글자 범위별 조각 92개(dynamic subset)로 받으면 페이지마다 조각 20~30개를 따로 받고,
//     글자마다 맞는 조각을 찾느라 레이아웃이 무거워진다(느린 CPU 에서 메인 스레드 작업이 두 배). 한 벌이면 한 번 받아 모든 페이지가 쓴다.
// 이름: 원본 글자를 다 담지 않은 글꼴은 OFL 이 말하는 '고친 버전'이라 예약 이름(Pretendard)을 쓰지 못한다.
//     글꼴 안 이름(name 테이블)의 Pretendard 를 JdSans 로 바꾸고, 저작권·라이선스·만든 사람 항목(0, 7~14)은 그대로 둔다.
//     라이선스 전문은 public/fonts/jdsans-OFL.txt.
//
// 빌드: dist 의 HTML·JS·CSS 에 나온 글자를 모아 잘라 내고, 내용 해시를 붙여 dist/_astro/ 에 쓴다(public/_headers 가 1년 캐시).
//     Base.astro 의 자리표시 주소(PLACEHOLDER)를 모든 HTML 에서 그 파일로 바꾼다. @font-face 를 CSS 파일이 아니라 HTML 에 두는 까닭 —
//     새 글자가 생겨 글꼴이 바뀌어도 CSS 파일 이름은 그대로라, 1년 캐시된 옛 CSS 가 옛 글꼴을 가리키게 된다.
// 개발 서버: 자리표시 주소로 원본 글꼴 전체를 내준다.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import wawoff2 from 'wawoff2';

export const PLACEHOLDER = '/__jd-sans.woff2';
const require = createRequire(import.meta.url);
const SOURCE = require.resolve('pretendard/dist/web/variable/woff2/PretendardVariable.woff2');
const WASM = require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm');
const KEEP_NAME_IDS = new Set([0, 7, 8, 9, 10, 11, 12, 13, 14]); // 저작권·상표·만든 사람·설명·주소·라이선스

/** 브라우저가 실행 중에 만드는 글자 — 나라 이름(Intl.DisplayNames, Popular·Drawer), 상대 시간(Intl.RelativeTimeFormat, Quiz) */
function runtimeText() {
  let s = '';
  for (const lang of ['ko', 'en']) {
    const region = new Intl.DisplayNames([lang], { type: 'region' });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) s += region.of(String.fromCharCode(a, b));
    const rel = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    for (const u of ['second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']) for (const n of [-2, -1, 0, 1, 2, 10]) s += rel.format(n, u);
  }
  return s;
}

/** dist 의 HTML·JS·CSS 에 나온 글자와 실행 중에 만드는 글자 — 화면에 나오지 않는 것(스크립트 속 문자열 등)도 섞이지만 빠지는 것보다 낫다 */
function collectCodepoints(dir) {
  const cps = new Set();
  for (let c = 0x20; c < 0x7f; c++) cps.add(c); // ASCII 는 늘 넣는다 (검색창에 치는 글자)
  const add = (text) => { for (const ch of text) { const cp = ch.codePointAt(0); if (cp >= 0x80) cps.add(cp); } };
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : /\.(html|js|css)$/.test(e.name) ? [new URL(e.name, d)] : []));
  for (const f of walk(dir)) add(readFileSync(f, 'utf8'));
  add(runtimeText());
  return cps;
}

/** HarfBuzz 로 글자를 잘라 낸다 — 글꼴의 가변 축(wght), 모든 이름·언어·OpenType 기능은 남긴다 */
async function subset(ttf, codepoints) {
  const { instance } = await WebAssembly.instantiate(readFileSync(WASM));
  const hb = instance.exports;
  const heap = () => new Uint8Array(hb.memory.buffer);
  const ptr = hb.malloc(ttf.byteLength);
  heap().set(ttf, ptr);
  const blob = hb.hb_blob_create(ptr, ttf.byteLength, 2 /* WRITABLE */, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);
  const input = hb.hb_subset_input_create_or_fail();
  for (const set of [4 /* NAME_ID */, 5 /* NAME_LANG_ID */, 6 /* LAYOUT_FEATURE_TAG */]) {
    const s = hb.hb_subset_input_set(input, set);
    hb.hb_set_clear(s);
    hb.hb_set_invert(s); // 전부
  }
  // 글리프 이름(post 형식 2)을 남긴다 — 빼면 macOS(CoreText)가 같은 글자를 조금 다르게 칠해 원본과 픽셀이 달라진다
  hb.hb_subset_input_set_flags(input, 0x40 /* NOTDEF_OUTLINE */ | 0x80 /* GLYPH_NAMES */);
  const uni = hb.hb_subset_input_unicode_set(input);
  for (const cp of codepoints) hb.hb_set_add(uni, cp);
  const out = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  if (!out) throw new Error('JdSans: HarfBuzz 가 글자를 잘라 내지 못했다');
  const res = hb.hb_face_reference_blob(out);
  const bytes = heap().slice(hb.hb_blob_get_data(res, 0), hb.hb_blob_get_data(res, 0) + hb.hb_blob_get_length(res));
  hb.hb_blob_destroy(res);
  hb.hb_face_destroy(out);
  hb.hb_face_destroy(face);
  hb.free(ptr);
  return bytes;
}

/** name 테이블의 이름(1~6, 16, 17, 25, 256~)에서 Pretendard 를 JdSans 로 바꾸고 글꼴 파일을 다시 묶는다 */
function rename(ttf) {
  const v = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const n = v.getUint16(4);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const tag = String.fromCharCode(...ttf.subarray(r, r + 4));
    tables.push({ tag, data: ttf.slice(v.getUint32(r + 8), v.getUint32(r + 8) + v.getUint32(r + 12)) });
  }
  const name = tables.find((t) => t.tag === 'name');
  const nv = new DataView(name.data.buffer);
  const [format, count, strOff] = [nv.getUint16(0), nv.getUint16(2), nv.getUint16(4)];
  const records = [];
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const [plat, enc, lang, id, len, off] = [0, 2, 4, 6, 8, 10].map((k) => nv.getUint16(r + k));
    let raw = name.data.slice(strOff + off, strOff + off + len);
    if (!KEEP_NAME_IDS.has(id)) {
      const utf16 = plat === 0 || plat === 3;
      const text = utf16 ? String.fromCharCode(...Array.from({ length: len / 2 }, (_, k) => (raw[2 * k] << 8) | raw[2 * k + 1])) : String.fromCharCode(...raw);
      const next = text.replaceAll('Pretendard', 'JdSans');
      if (next !== text) raw = utf16 ? Uint8Array.from([...next].flatMap((c) => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 0xff])) : Uint8Array.from([...next].map((c) => c.charCodeAt(0)));
    }
    records.push({ plat, enc, lang, id, raw });
  }
  // format 1 의 언어 태그는 이름과 같은 저장소에 있다 — 그대로 옮긴다
  const langTags = [];
  if (format === 1) {
    const at = 6 + count * 12;
    for (let i = 0, m = nv.getUint16(at); i < m; i++) {
      const [len, off] = [nv.getUint16(at + 2 + i * 4), nv.getUint16(at + 4 + i * 4)];
      langTags.push(name.data.slice(strOff + off, strOff + off + len));
    }
  }
  const head = 6 + count * 12 + (format === 1 ? 2 + langTags.length * 4 : 0);
  const strings = [...records.map((r) => r.raw), ...langTags];
  const out = new Uint8Array(head + strings.reduce((s, x) => s + x.length, 0));
  const ov = new DataView(out.buffer);
  ov.setUint16(0, format); ov.setUint16(2, count); ov.setUint16(4, head);
  let pos = 0;
  const put = (at, raw) => { ov.setUint16(at, raw.length); ov.setUint16(at + 2, pos); out.set(raw, head + pos); pos += raw.length; };
  records.forEach((r, i) => { const at = 6 + i * 12; [r.plat, r.enc, r.lang, r.id].forEach((x, k) => ov.setUint16(at + k * 2, x)); put(at + 8, r.raw); });
  if (format === 1) { const at = 6 + count * 12; ov.setUint16(at, langTags.length); langTags.forEach((raw, i) => put(at + 2 + i * 4, raw)); }
  name.data = out;
  return pack(v.getUint32(0), tables);
}

// sfnt 다시 묶기 — 표마다 4바이트 정렬·체크섬, head 의 checkSumAdjustment
const checksum = (b) => { let s = 0; const p = new Uint8Array(Math.ceil(b.length / 4) * 4); p.set(b); const d = new DataView(p.buffer); for (let i = 0; i < p.length; i += 4) s = (s + d.getUint32(i)) >>> 0; return s; };
function pack(version, tables) {
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const head = tables.find((t) => t.tag === 'head');
  new DataView(head.data.buffer).setUint32(8, 0);
  const n = tables.length, es = Math.floor(Math.log2(n)), sr = 2 ** es * 16;
  let off = 12 + n * 16;
  const at = tables.map((t) => { const o = off; off += Math.ceil(t.data.length / 4) * 4; return o; });
  const out = new Uint8Array(off);
  const v = new DataView(out.buffer);
  v.setUint32(0, version); v.setUint16(4, n); v.setUint16(6, sr); v.setUint16(8, es); v.setUint16(10, n * 16 - sr);
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[r + k] = t.tag.charCodeAt(k);
    v.setUint32(r + 4, checksum(t.data)); v.setUint32(r + 8, at[i]); v.setUint32(r + 12, t.data.length);
    out.set(t.data, at[i]);
  });
  v.setUint32(at[tables.indexOf(head)] + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

/** 글자 집합으로 JdSans woff2 를 만든다 */
export async function buildJdSans(codepoints) {
  const ttf = await wawoff2.decompress(readFileSync(SOURCE));
  return wawoff2.compress(rename(await subset(ttf, codepoints)));
}

export default function jdSans() {
  return {
    name: 'jd-sans',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if (command !== 'dev') return;
        updateConfig({ vite: { plugins: [{ name: 'jd-sans-dev', configureServer(server) {
          server.middlewares.use(PLACEHOLDER, (_req, res) => { res.setHeader('content-type', 'font/woff2'); res.end(readFileSync(SOURCE)); });
        } }] } });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const cps = collectCodepoints(dir);
        const woff2 = await buildJdSans(cps);
        const file = `jd-sans.${createHash('sha256').update(woff2).digest('hex').slice(0, 10)}.woff2`;
        writeFileSync(new URL(`_astro/${file}`, dir), woff2);
        const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : e.name.endsWith('.html') ? [new URL(e.name, d)] : []));
        let pages = 0;
        for (const f of walk(dir)) {
          const s = readFileSync(f, 'utf8');
          if (!s.includes(PLACEHOLDER)) continue;
          writeFileSync(f, s.replaceAll(PLACEHOLDER, `/_astro/${file}`));
          pages++;
        }
        if (!pages) throw new Error(`JdSans: HTML 에서 자리표시 주소 ${PLACEHOLDER} 를 찾지 못했다 (Base.astro)`);
        logger.info(`${file} — 글자 ${cps.size}개, ${(woff2.length / 1024).toFixed(0)}KB, HTML ${pages}개`);
      },
    },
  };
}
