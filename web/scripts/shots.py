"""Screenshots of the main pages. Needs Google Chrome and python playwright.

  python3 web/scripts/shots.py /tmp/seed.json docs/screenshots
"""
import json, sys, time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

seed = json.load(open(sys.argv[1]))
out = sys.argv[2]
base = seed["base"]
host = urlparse(base).hostname
pairs = [c.split("=", 1) for c in seed["cookie"].split("; ") if "=" in c]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": 1360, "height": 900}, device_scale_factor=2, color_scheme="dark")
    ctx.add_cookies([{"name": k, "value": v, "domain": host, "path": "/"} for k, v in pairs])

    page = ctx.new_page()
    page.goto(base + "/", wait_until="networkidle")
    time.sleep(1.5)
    page.screenshot(path=f"{out}/home.png", full_page=True)

    page.get_by_role("button", name="Get a prompt for your Grok Bot").click()
    page.get_by_test_id("bot-prompt").wait_for()
    page.get_by_text("or run it yourself").click()
    time.sleep(0.8)
    page.screenshot(path=f"{out}/home-prompt.png", full_page=False)
    page.get_by_test_id("bot-prompt-card").screenshot(path=f"{out}/prompt-card.png")

    page.goto(seed["dashboard"], wait_until="networkidle")
    time.sleep(2.5)
    page.screenshot(path=f"{out}/dashboard.png", full_page=True)

    page.goto(seed["share"], wait_until="networkidle")
    time.sleep(2.5)
    page.screenshot(path=f"{out}/share.png", full_page=True)

    r = page.request.get(seed["share"] + "/opengraph-image")
    open(f"{out}/og.png", "wb").write(r.body())

    page.goto(base + "/nope-this-is-not-a-page", wait_until="networkidle")
    page.screenshot(path=f"{out}/not-found.png", full_page=False)
    browser.close()
print("ok")
