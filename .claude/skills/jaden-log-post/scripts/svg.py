# 그림 생성기 도우미 — 칸은 % 폭(중첩 svg), 글자는 px 고정. 좁은 화면에서도 13px 이상이 들어가게 위아래로 쌓는다 (figures.md)
#   import sys; sys.path.insert(0, '<저장소>/.claude/skills/jaden-log-post/scripts'); from svg import *
FONT = 'font-family="Pretendard Variable, sans-serif"'
MONO = 'font-family="JetBrains Mono, SF Mono, ui-monospace, Menlo, monospace"'
ACC, WARN, OK, BAD = '#64D2FF', '#FFB340', '#30D158', '#FF8A80'  # ACC 는 Go 카테고리 색 — 다른 카테고리 글이면 바꾼다
T1, T2, T3 = '#F5F5F7', '#A1A1A6', '#86868B'
NEUTRAL = ('rgba(255,255,255,.05)', 'rgba(255,255,255,.16)')
BLUE = ('rgba(100,210,255,.10)', 'rgba(100,210,255,.55)')
AMBER = ('rgba(255,159,10,.10)', 'rgba(255,159,10,.5)')
GREEN = ('rgba(48,209,88,.08)', 'rgba(48,209,88,.45)')
RED = ('rgba(255,69,58,.10)', 'rgba(255,69,58,.45)')
BOLD = ' font-weight="700"'
DASH = ' stroke-dasharray="4 3"'


def esc(s):
    """MDX 안 SVG 글자 — 중괄호와 < 를 엔티티로"""
    return s.replace('{', '&#123;').replace('}', '&#125;').replace('<', '&lt;')


def svg(h, label, body, mid=None):
    """바깥 svg. mid 를 주면 그 id 로 화살표 marker 를 만든다 (그림마다 다른 id)"""
    defs = (f'  <defs><marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{T3}"/></marker></defs>\n' if mid else '')
    return (f'<svg width="640" height="{h}" style="height:{h}px" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg" {FONT}>\n'
            + defs + '\n'.join(body) + '\n</svg>')


def t(x, y, s, size=13.5, fill=T1, bold=False, mono=False, anchor=None):
    """글자. x 는 px 숫자 또는 '95%' 같은 문자열"""
    a = f' text-anchor="{anchor}"' if anchor else ''
    return f'<text x="{x}" y="{y}"{a} fill="{fill}" font-size="{size}"{BOLD if bold else ""}{" " + MONO if mono else ""}>{s}</text>'


def box(x, y, w, h, tone, inner, rx=12):
    """카드 — x·w 는 %, y·h 는 px. inner 의 글자 좌표는 카드 안 기준"""
    fill, stroke = tone
    return f'  <svg x="{x}%" y="{y}" width="{w}%" height="{h}" overflow="visible"><rect width="100%" height="100%" rx="{rx}" fill="{fill}" stroke="{stroke}"/>{"".join(inner)}</svg>'


def fx(inner, d, dur=None):
    """차례 효과 — 그림이 화면에 들어오고 d 초 뒤에 dur 초 동안 나타난다"""
    style = f'--d:{d:.2f}s' + (f';--t:{dur}s' if dur else '')
    return f'  <g class="fx-in" style="{style}">{inner.strip()}</g>'


def arrow(x1, y1, x2, y2, mid, dash=False):
    return f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{T3}" stroke-width="1.4"{DASH if dash else ""} marker-end="url(#{mid})"/>'


def line(x1, y1, x2, y2, color=T3, dash=False):
    return f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.4"{DASH if dash else ""}/>'


def fill(tpl_path, out_path, figs):
    """템플릿의 {{키}} 자리에 그림을 끼워 글 파일을 만든다"""
    src = open(tpl_path).read()
    for k, v in figs.items():
        src = src.replace('{{' + k + '}}', v)
    assert '{{' not in src, '채우지 않은 자리가 남았다'
    open(out_path, 'w').write(src)
