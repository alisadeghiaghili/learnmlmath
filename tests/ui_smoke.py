"""Headless UI smoke test for LearnMLMath."""

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4188/"
OUT = r"C:\Users\alisa\Desktop\Projects\learn-mlmath\docs\ui-smoke.png"


def main() -> int:
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
        page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}")
                if msg.type == "error" else None)

        page.goto(BASE, wait_until="networkidle")
        assert page.title() == "LearnMLMath", page.title()
        assert page.locator("#commandInput").is_visible()
        assert page.locator("#visCanvas").is_visible()
        assert page.locator("#goalPanel").is_visible()

        # sandbox command
        page.fill("#commandInput", "vec a 3 4")
        page.press("#commandInput", "Enter")
        page.wait_for_timeout(200)
        body = page.locator("#terminal").inner_text()
        assert "a = [3, 4]" in body, body[-500:]

        # levels modal
        page.evaluate("document.getElementById('modalRoot').hidden = true")
        page.click("#btnLevels")
        page.wait_for_timeout(200)
        assert page.locator(".modal-card").is_visible()
        assert page.locator(".level-row").count() >= 3

        # open first level
        page.locator(".level-row").first.click()
        page.wait_for_timeout(200)
        assert page.locator("#levelToolbar").is_visible()
        assert "intro-vec-1" in page.locator("#levelToolbar").inner_text()

        # solve level 1
        page.fill("#commandInput", "reset")
        page.press("#commandInput", "Enter")
        page.wait_for_timeout(150)
        page.fill("#commandInput", "vec a 3 4")
        page.press("#commandInput", "Enter")
        page.wait_for_timeout(250)
        status = page.locator("#goalStatus").inner_text()
        assert "solved" in status.lower() or "ready" in status.lower(), status

        # optimization level deep link
        page.goto(BASE + "?level=opt-train-2", wait_until="networkidle")
        page.wait_for_timeout(200)
        page.fill("#commandInput", "train 80 0.1")
        page.press("#commandInput", "Enter")
        page.wait_for_timeout(300)
        status = page.locator("#goalStatus").inner_text()
        assert "converged" in status.lower() or "solved" in status.lower(), status

        page.screenshot(path=OUT, full_page=True)
        browser.close()

    if errors:
        print("BROWSER ERRORS:")
        for e in errors:
            print(" ", e)
        return 1
    print("UI smoke OK")
    print("screenshot:", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
