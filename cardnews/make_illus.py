# -*- coding: utf-8 -*-
"""기업 교육 과정 도식 이미지를 만든다 (assets/img/training-*.png).

실제 강의를 찍은 사진이 아니라 과정 내용을 나타내는 도식이다.
사진처럼 보이게 만들지 않는다.

    python make_illus.py
"""
import io
import json
import pathlib
import sys
import urllib.parse

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "assets" / "img"

CARDS = [
    ("training-basic", {
        "tag": "과정 1 · 입문",
        "art": "doc",
        "title": "보고서 초안을\n10분에",
        "sub": "챗GPT·클로드를 참석자 본인 업무로 실습합니다.",
    }),
    ("training-auto", {
        "tag": "과정 2 · 직무 실습",
        "art": "sheet",
        "title": "매달 며칠씩 걸리던\n작업을 하나",
        "sub": "교육 중에 실제 업무 하나를 끝까지 돌립니다.",
    }),
    ("training-agent", {
        "tag": "과정 3 · 심화",
        "art": "flow",
        "title": "묻는 것을 넘어\n맡기는 방식",
        "sub": "파일 처리와 반복 작업 파이프라인까지 다룹니다.",
    }),
]


def main() -> int:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)
    tpl = (HERE / "illus.html").as_uri()

    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1200, "height": 675},
                          device_scale_factor=1)
        for name, data in CARDS:
            page.goto(tpl + "?d=" + urllib.parse.quote(
                json.dumps(data, ensure_ascii=False)))
            page.wait_for_function("document.title === 'ready'")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(350)
            path = OUT / (name + ".png")
            page.screenshot(path=str(path))
            print("  %-22s %s" % (name + ".png", data["title"].replace("\n", " ")))
        b.close()

    print("\n%d장 → %s" % (len(CARDS), OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
