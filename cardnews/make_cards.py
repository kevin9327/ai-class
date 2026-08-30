# -*- coding: utf-8 -*-
"""cards.json -> out/card-01.png ... 1080x1080 카드뉴스를 뽑는다.

실행:  python make_cards.py [세트이름]
       세트이름을 주면 cards-<세트이름>.json 을 읽고 out/<세트이름>/ 에 넣는다.
       생략하면 cards.json → out/
결과:  *.png  +  preview.html (한 화면에서 전부 보기)
"""
import json, pathlib, urllib.parse, sys, io

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"


def main() -> int:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright 가 없습니다:  pip install playwright && playwright install chromium")
        return 1

    which = sys.argv[1] if len(sys.argv) > 1 else ""
    src = HERE / ("cards-%s.json" % which if which else "cards.json")
    if not src.exists():
        print("파일이 없습니다: %s" % src)
        return 1
    out = OUT / which if which else OUT

    data = json.loads(src.read_text(encoding="utf-8"))
    cards = data["cards"]
    out.mkdir(parents=True, exist_ok=True)
    tpl = (HERE / "template.html").as_uri()

    names = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1080},
                                device_scale_factor=1)
        for i, c in enumerate(cards):
            payload = urllib.parse.quote(
                json.dumps({"card": c, "i": i, "n": len(cards)}, ensure_ascii=False))
            page.goto(tpl + "?d=" + payload)
            # 웹폰트가 다 뜬 뒤에 찍는다. 안 그러면 한글이 대체 글꼴로 나온다.
            page.wait_for_function("document.title === 'ready'")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(350)
            name = "card-%02d.png" % (i + 1)
            page.screenshot(path=str(out / name))
            names.append(name)
            print("  %s  %s" % (name, c["title"].replace("\n", " ")[:40]))
        browser.close()

    print()
    prev = ["<!doctype html><meta charset=utf-8><title>카드뉴스 미리보기</title>",
            "<style>body{margin:0;background:#eef2f7;font-family:Pretendard,sans-serif;padding:28px;}",
            "h1{font-size:18px;color:#334155}",
            ".g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}",
            "img{width:100%;display:block;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12)}</style>",
            "<h1>카드뉴스 %d장 — 1080×1080</h1><div class=g>" % len(names)]
    prev += ['<img src="%s" alt="">' % n for n in names]
    prev.append("</div>")
    (out / "preview.html").write_text("\n".join(prev), encoding="utf-8")

    print("\n%d장 생성 → %s" % (len(names), out))
    print("미리보기: %s" % (out / "preview.html"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
