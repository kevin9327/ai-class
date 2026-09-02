# -*- coding: utf-8 -*-
"""data/*.json → PDF 견적서.

    python quote/make_quote.py            # data/ 안의 전부
    python quote/make_quote.py standard   # 하나만

data/_common.json 이 공통값(단가표·조건·강사)이고, 각 파일이 그 위에 덮어쓴다.
결과는 quote/out/ (git 제외) 과 Downloads/leads_0902/ 두 곳에 남긴다.
"""
import base64
import io
import json
import pathlib
import shutil
import sys
import urllib.parse

HERE = pathlib.Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "out"
DELIVER = pathlib.Path.home() / "Downloads" / "leads_0902"
LESSONS_URL = "https://kevin9327.github.io/ai-class/lessons.html"


def qr_data_uri(url: str) -> str:
    """무료 강의 링크 QR. 라이브러리가 없으면 빈 문자열(템플릿이 알아서 숨김)."""
    try:
        import qrcode
    except ImportError:
        return ""
    img = qrcode.make(url, border=1, box_size=6)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def merged(name: str) -> dict:
    base = json.loads((DATA / "_common.json").read_text(encoding="utf-8"))
    lead = json.loads((DATA / (name + ".json")).read_text(encoding="utf-8"))
    d = dict(base)
    d.update(lead)
    # 안쪽 사전은 얕게 한 단계만 합친다 (to/from/who/online)
    for k in ("to", "from", "who", "online"):
        if k in base and k in lead and isinstance(base[k], dict):
            m = dict(base[k]); m.update(lead[k]); d[k] = m
    return d


def main() -> int:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    from playwright.sync_api import sync_playwright

    names = [sys.argv[1]] if len(sys.argv) > 1 else sorted(
        p.stem for p in DATA.glob("*.json") if not p.stem.startswith("_"))
    if not names:
        print("data/ 에 견적 데이터가 없습니다.")
        return 1

    OUT.mkdir(exist_ok=True)
    DELIVER.mkdir(parents=True, exist_ok=True)
    qr = qr_data_uri(LESSONS_URL)
    tpl = (HERE / "template.html").as_uri()

    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        for name in names:
            d = merged(name)
            d["qr"] = qr
            page.goto(tpl + "?d=" + urllib.parse.quote(json.dumps(d, ensure_ascii=False)))
            page.wait_for_function("document.title === 'ready'")
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)

            fname = "견적서_실무AI클래스_%s.pdf" % d.get("slug", name)
            out = OUT / fname
            page.pdf(path=str(out), format="A4", print_background=True,
                     prefer_css_page_size=True)
            shutil.copy2(out, DELIVER / fname)
            print("  %-42s ← %s" % (fname, d["to"]["org"]))
        b.close()

    print("\n%d건 → %s" % (len(names), DELIVER))
    return 0


if __name__ == "__main__":
    sys.exit(main())
