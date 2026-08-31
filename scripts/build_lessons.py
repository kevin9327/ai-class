# -*- coding: utf-8 -*-
"""scripts/lesson-1~8.md 를 읽어 assets/lessons-content.js 를 만든다.

원고가 곧 사이트 본문이다. 원고를 고치면 이걸 다시 돌리고 커밋한다.

    python scripts/build_lessons.py
"""
import io
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
OUT = ROOT / "assets" / "lessons-content.js"

QUOTE_HEADS = ('"', '“')  # 곧은 따옴표와 둥근 따옴표 둘 다
QUOTE_TAILS = ('"', '”')


def is_quote_block(lines) -> bool:
    """통째로 따옴표에 싸인 덩어리만 인용구로 본다.

    문장 중간에 따옴표가 들어간 평범한 문단(예: "프롬프트 잘 쓰는 법"을 …)이
    인용구로 잡히지 않게 앞뒤를 모두 본다.
    """
    first = lines[0].lstrip()
    last = lines[-1].rstrip()
    return bool(first[:1] in QUOTE_HEADS and last[-1:] in QUOTE_TAILS)


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def blocks(md: str):
    """빈 줄로 끊어 문단 단위로 넘긴다. 제목 줄은 그 자체로 한 덩어리."""
    buf = []
    for line in md.splitlines():
        line = line.rstrip()
        if not line:
            if buf:
                yield buf
                buf = []
            continue
        if line.startswith("#"):
            if buf:
                yield buf
                buf = []
            yield [line]
            continue
        buf.append(line)
    if buf:
        yield buf


def to_html(md: str) -> str:
    out = []
    for b in blocks(md):
        head = b[0]

        if head.startswith("### "):
            out.append("<h4>%s</h4>" % esc(head[4:].strip()))
        elif head.startswith("## "):
            out.append("<h3>%s</h3>" % esc(head[3:].strip()))
        elif head.startswith("# "):
            continue  # 문서 제목은 카드 헤더가 이미 보여준다
        elif head.lstrip().startswith("-"):
            items = "".join("<li>%s</li>" % esc(x.lstrip("- ").strip()) for x in b)
            out.append("<ul>%s</ul>" % items)
        elif is_quote_block(b):
            # 프롬프트 예시는 줄바꿈이 의미를 갖는다. 그대로 살린다.
            out.append("<blockquote>%s</blockquote>" % "<br />".join(esc(x) for x in b))
        else:
            # 원고는 읽기 좋게 하드랩돼 있다. 화면에서는 한 문단으로 붙인다.
            out.append("<p>%s</p>" % esc(" ".join(b)))
    return "".join(out)


def main() -> int:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    bodies = {}
    files = sorted(HERE.glob("lesson-*.md"),
                   key=lambda p: int(re.search(r"\d+", p.stem).group()))
    if not files:
        print("원고를 찾지 못했습니다: %s" % HERE)
        return 1

    for f in files:
        n = int(re.search(r"\d+", f.stem).group())
        html = to_html(f.read_text(encoding="utf-8"))
        bodies[n] = html
        print("  %d강  %s  %5d자" % (n, f.name, len(html)))

    js = ("/* scripts/build_lessons.py 가 만든 파일입니다. 직접 고치지 마세요.\n"
          "   내용을 바꾸려면 scripts/lesson-N.md 를 고치고 다시 돌리세요. */\n"
          "window.LESSON_BODIES = %s;\n"
          % json.dumps(bodies, ensure_ascii=False, indent=0))
    OUT.write_text(js, encoding="utf-8")

    print("\n%d편 → %s" % (len(bodies), OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
