// 화면 검사 — 폭 390·1280 에서 그림 글자가 칸이나 그림 밖으로 넘치는지, 표 상자가 얼마나 가로로 스크롤되는지,
// 페이지 전체가 가로로 넘치는지, 페이지 오류가 있는지 본다. 빌드한 사이트를 띄워 두고 돌린다.
//
//   npx astro build && npx astro preview --port 4329 &
//   npm run check:layout -- 31 en/31                    (기본 주소 http://localhost:4329)
//   npm run check:layout -- --shots /tmp/shots 31       화면 높이 단위 스크린샷도 남긴다
//   BASE=http://localhost:4321 npm run check:layout -- 31
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';

const base = process.env.BASE ?? 'http://localhost:4329';
const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots');
const shots = shotsAt >= 0 ? args.splice(shotsAt, 2)[1] : null;
if (!args.length) {
  console.log('사용법: npm run check:layout -- [--shots <폴더>] <글 id> [en/<글 id> ...]');
  process.exit(0);
}

// playwright-core 는 브라우저를 받지 않는다 — 설치된 Chromium(ms-playwright 캐시)을 찾아 쓴다
function chromePath() {
  const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
  if (!existsSync(cache)) return undefined;
  const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const app = `${cache}/${dir}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
  return dir && existsSync(app) ? app : undefined;
}
const browser = await chromium.launch({ executablePath: chromePath() });

for (const id of args) {
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const mobile = w < 500;
    const p = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && !/\/api\/views/.test(m.location().url) && errs.push(m.text()));
    await p.goto(`${base}/${id}`, { waitUntil: 'networkidle' });

    // 그림 — 글자 bbox 가 자기 칸(svg[overflow]) 안, 그림 안에 있는지. 음수면 넘친 것
    const figs = await p.$$eval('.jd-fig svg[role=img]', (svgs) =>
      svgs.map((s) => {
        const sr = s.getBoundingClientRect();
        let worst = 1e9;
        const over = [];
        for (const t of s.querySelectorAll('text')) {
          const tr = t.getBoundingClientRect();
          const cell = t.closest('svg[overflow]')?.getBoundingClientRect() ?? sr;
          const room = Math.min(tr.left - cell.left, cell.right - tr.right, tr.left - sr.left, sr.right - tr.right);
          worst = Math.min(worst, room);
          if (room < 0) over.push(`${Math.round(room)}px 「${t.textContent}」`);
        }
        return { worst: Math.round(worst), over };
      }),
    );
    const tables = await p.$$eval('.jd-table', (ts) => ts.map((t) => t.scrollWidth - t.clientWidth));
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);

    const bad = figs.some((f) => f.worst < 0) || sw > w;
    console.log(`${bad ? '⚠' : ' '} ${id} @${w}  그림 여유 ${figs.map((f) => f.worst).join(' ') || '-'}  표 스크롤 ${tables.join(' ') || '-'}  페이지 폭 ${sw}${sw > w ? ' (넘침)' : ''}  오류 ${errs.length ? errs.join(' | ').slice(0, 200) : 0}`);
    figs.forEach((f, i) => f.over.forEach((o) => console.log(`    그림 ${i + 1}: ${o}`)));

    if (shots) {
      const dir = `${shots}/${id.replace('/', '-')}-${w}`;
      mkdirSync(dir, { recursive: true });
      // 화면에 들어올 때 나타나는 효과가 끝나도록 한 번 훑어 내린 뒤 본문을 화면 높이 단위로 찍는다
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 250) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } });
      const top = await p.$eval('.prose', (n) => n.getBoundingClientRect().top + scrollY);
      const len = await p.$eval('.prose', (n) => n.offsetHeight);
      let i = 0;
      for (let y = top - 40; y < top + len; y += h - 120) {
        await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${dir}/${String(i++).padStart(2, '0')}.png` });
      }
      console.log(`    스크린샷 ${i}장 → ${dir}`);
    }
    await p.close();
  }
}
await browser.close();
