# -*- coding: utf-8 -*-
"""GitHub 프로필에서 실제 활동 기록을 그대로 캡처한다.

지어낸 그림이 아니라 공개 프로필의 실제 화면이다. 숫자가 바뀌면 다시 돌린다.

    python make_proof.py
"""
import io
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "assets" / "img"
URL = "https://github.com/kevin9327"


def main() -> int:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    from playwright.sync_api import sync_playwright

    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch()
        # 사이트가 밝은 톤이라 깃허브도 밝게 맞춘다
        page = b.new_page(viewport={"width": 1180, "height": 1000},
                          color_scheme="light", device_scale_factor=2)
        page.goto(URL, wait_until="networkidle", timeout=60000)

        graph = page.locator(".js-yearly-contributions").first
        graph.wait_for(timeout=30000)
        graph.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)

        path = OUT / "proof-github.png"
        graph.screenshot(path=str(path))

        text = graph.inner_text()
        m = re.search(r"([\d,]+)\s+contributions", text)
        print("캡처: %s" % path.name)
        print("문구: %s" % (m.group(0) if m else text.splitlines()[0]))

        # 외부 메인테이너가 실제로 머지한 PR 화면
        pr = b.new_page(viewport={"width": 1100, "height": 900},
                        color_scheme="light", device_scale_factor=2)
        pr.goto("https://github.com/CopilotKit/OpenBot/pull/116",
                wait_until="domcontentloaded", timeout=60000)
        pr.wait_for_timeout(3000)
        # 깃허브 DOM 이 자주 바뀌므로 선택자에 기대지 않고 상단을 잘라 찍는다
        pr.wait_for_selector("text=Merged", timeout=30000)
        pr.wait_for_timeout(1500)
        path2 = OUT / "proof-pr.png"
        pr.screenshot(path=str(path2), clip={"x": 0, "y": 60, "width": 1100, "height": 240})
        title = pr.title()
        print("캡처: %s" % path2.name)
        print("문구: %s" % title[:80])

        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
