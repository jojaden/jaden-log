#!/usr/bin/env python3
# 티스토리 원문 한 편을 읽기 좋게 뽑는다 — 속성(style·class·data-*·id)을 지우고, 인라인 SVG 는 [SVG: 설명 | 글자들] 한 줄로 줄인다
#   python3 .claude/skills/jaden-log-post/scripts/dump.py <글 id> <나갈 파일>
import html, json, re, sys
from pathlib import Path

pid, out = sys.argv[1], sys.argv[2]
repo = Path(__file__).resolve().parents[4]
posts = json.loads((repo / 'migration/jaden-tistory-export.json').read_text())['posts']
post = next((p for p in posts if str(p['id']) == pid), None)
if not post:
    sys.exit(f'{pid}: 원문이 없다')


def svg_line(m):
    s = m.group(0)
    label = re.search(r'aria-label="([^"]*)"', s)
    texts = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in re.findall(r'<text[^>]*>.*?</text>', s, re.S)]
    return f"\n[SVG: {label.group(1) if label else '-'} | {' / '.join(t for t in texts if t)}]\n"


h = post['html']
h = re.sub(r'<svg\b.*?</svg>', svg_line, h, flags=re.S)
h = re.sub(r'\s(style|class|id|data-[\w-]+)="[^"]*"', '', h)
h = re.sub(r'<(/?)(span|div)>', '', h)
head = '\n'.join(f'{k}: {post[k]}' for k in ('id', 'title', 'category', 'published', 'description', 'tags'))
Path(out).write_text(f'{head}\n\n{h}')
print(f'{out} ({len(h):,}자) — {post["title"]}')
