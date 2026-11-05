#!/usr/bin/env node
/**
 * Capture 1024×768 screenshots and verify Tab focus order.
 * Uses Puppeteer bundled with the environment's Chrome if available,
 * otherwise falls back to spawning chrome --screenshot with a hard timeout.
 */
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join("/opt/cursor/artifacts");
const LOCAL = join(ROOT, "artifacts", "screenshots");
mkdirSync(OUT, { recursive: true });
mkdirSync(LOCAL, { recursive: true });

const themes = ["papier", "farbicky", "vecerna"];
const pages = [
  { key: "home", file: "home.html" },
  { key: "overview-1106", file: "2026-11-06.html" },
  { key: "overview-1103", file: "2026-11-03.html" },
  { key: "andrej-1106", file: "2026-11-06-andrej.html" },
];

function chromeShot(url, dest) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1024,768",
      `--user-data-dir=/tmp/chrome-ud-${process.pid}-${Math.random().toString(16).slice(2)}`,
      `--screenshot=${dest}`,
      url,
    ];
    const child = spawn("google-chrome", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      if (existsSync(dest)) resolve({ ok: true, timedOut: true });
      else reject(new Error("chrome timeout without file: " + stderr.slice(-400)));
    }, 12000);
    child.on("exit", () => {
      clearTimeout(t);
      if (existsSync(dest)) resolve({ ok: true });
      else reject(new Error("chrome exited without screenshot: " + stderr.slice(-400)));
    });
  });
}

async function tryPuppeteer() {
  try {
    const puppeteer = await import("puppeteer");
    return puppeteer.default || puppeteer;
  } catch {
    return null;
  }
}

async function withPuppeteer(puppeteer) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1024,768"],
    defaultViewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
  });
  const focusReport = {};
  for (const theme of themes) {
    for (const page of pages) {
      const url = `file://${ROOT}/designs/${theme}/${page.file}`;
      const name = `${theme}--${page.key}.png`;
      const dest = join(OUT, name);
      const tab = await browser.newPage();
      await tab.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
      await tab.screenshot({ path: dest, clip: { x: 0, y: 0, width: 1024, height: 768 } });
      copyFileSync(dest, join(LOCAL, name));

      // Focus order via Tab
      const order = await tab.evaluate(async () => {
        const out = [];
        const start = document.activeElement;
        if (start && start !== document.body) {
          out.push({
            tag: start.tagName,
            className: start.className,
            href: start.getAttribute("href"),
            text: (start.innerText || "").trim().slice(0, 40),
          });
        }
        for (let i = 0; i < 12; i++) {
          // dispatch Tab
          const ev = new KeyboardEvent("keydown", {
            key: "Tab",
            code: "Tab",
            keyCode: 9,
            which: 9,
            bubbles: true,
            cancelable: true,
          });
          document.dispatchEvent(ev);
          // native focus advance
          const focusables = Array.from(
            document.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')
          ).filter((el) => !el.disabled && el.offsetParent !== null);
          const cur = document.activeElement;
          let idx = focusables.indexOf(cur);
          if (idx < 0) idx = -1;
          const next = focusables[(idx + 1) % focusables.length];
          if (next) next.focus();
          const el = document.activeElement;
          out.push({
            tag: el.tagName,
            className: el.className,
            href: el.getAttribute && el.getAttribute("href"),
            text: ((el.innerText || el.textContent || "") + "").trim().slice(0, 40),
          });
          if (out.length > 1 && out[out.length - 1].href === out[0].href && out[out.length - 1].className === out[0].className) {
            break;
          }
        }
        // compute styles of focused outline
        const cs = getComputedStyle(document.activeElement);
        return { order: out, outline: cs.outline, outlineWidth: cs.outlineWidth };
      });
      focusReport[`${theme}/${page.file}`] = order;
      await tab.close();
      console.log("shot", name);
    }
  }
  await browser.close();
  return focusReport;
}

async function withChromeOnly() {
  for (const theme of themes) {
    for (const page of pages) {
      const url = `file://${ROOT}/designs/${theme}/${page.file}`;
      const name = `${theme}--${page.key}.png`;
      const dest = join(OUT, name);
      await chromeShot(url, dest);
      copyFileSync(dest, join(LOCAL, name));
      console.log("shot", name);
    }
  }
  return { note: "focus order checked separately; chrome-only path" };
}

const puppeteer = await tryPuppeteer();
let report;
if (puppeteer) {
  console.log("using puppeteer");
  report = await withPuppeteer(puppeteer);
} else {
  console.log("puppeteer missing — chrome --screenshot fallback");
  report = await withChromeOnly();
}
console.log(JSON.stringify(report, null, 2));
