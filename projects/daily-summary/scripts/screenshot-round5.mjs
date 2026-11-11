#!/usr/bin/env node
/**
 * Round 5 screenshots: 1024×768 day page, light/dark × views + top-bar crop.
 * Serves designs/ over HTTP and captures via Chrome DevTools Protocol.
 */
import { spawn } from "node:child_process";
import {
  createWriteStream,
  copyFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import WebSocket from "ws";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "/opt/cursor/artifacts";
const LOCAL = join(ROOT, "artifacts", "screenshots");
mkdirSync(OUT, { recursive: true });
mkdirSync(LOCAL, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "/index.html" : urlPath;
      const file = join(rootDir, rel);
      if (!file.startsWith(rootDir) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

async function launchChrome(debugPort) {
  const ud = `/tmp/chrome-ud-r5-${process.pid}`;
  const child = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${ud}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  for (let i = 0; i < 50; i++) {
    try {
      await httpGet(`http://127.0.0.1:${debugPort}/json/version`);
      return child;
    } catch {
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  throw new Error("Chrome CDP did not start");
}

function connectCdp(debugPort) {
  return new Promise(async (resolve, reject) => {
    try {
      const { data } = await httpGet(`http://127.0.0.1:${debugPort}/json/list`);
      const tabs = JSON.parse(data);
      const wsUrl = tabs[0] && tabs[0].webSocketDebuggerUrl;
      if (!wsUrl) return reject(new Error("no CDP tab"));
      const ws = new WebSocket(wsUrl);
      const pending = new Map();
      let nextId = 1;
      const send = (method, params = {}) =>
        new Promise((res, rej) => {
          const id = nextId++;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      ws.on("open", () => resolve({ ws, send, close: () => ws.close() }));
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
        }
      });
      ws.on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function shot(send, url, name, clip) {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url });
  // Wait for load + theme/view JS
  await new Promise((r) => setTimeout(r, 900));
  await send("Runtime.evaluate", {
    expression:
      "document.fonts && document.fonts.ready ? document.fonts.ready.then(function(){return 1}) : 1",
    awaitPromise: true,
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, 200));

  const params = {
    format: "png",
    clip: clip
      ? { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 }
      : { x: 0, y: 0, width: 1024, height: 768, scale: 1 },
  };
  const { data } = await send("Page.captureScreenshot", params);
  const buf = Buffer.from(data, "base64");
  writeFileSync(join(OUT, name), buf);
  writeFileSync(join(LOCAL, name), buf);
  console.log("shot", name, buf.length);
}

const shots = [
  { name: "r5-light-rodina-1106.png", q: "theme=light&view=rodina&now=09:30" },
  { name: "r5-light-brano-1106.png", q: "theme=light&view=branislav&now=09:30" },
  { name: "r5-dark-rodina-1106.png", q: "theme=dark&view=rodina&now=09:30" },
  { name: "r5-dark-andrej-1106.png", q: "theme=dark&view=andrej&now=09:30" },
  {
    name: "r5-light-topbar-1106.png",
    q: "theme=light&view=rodina&now=09:30",
    clip: { x: 0, y: 0, w: 1024, h: 90 },
  },
];

const { server, port: httpPort } = await startStaticServer(join(ROOT, "designs"));
const debugPort = 9229;
const chrome = await launchChrome(debugPort);
try {
  await new Promise((r) => setTimeout(r, 300));
  const { send, close } = await connectCdp(debugPort);
  for (const s of shots) {
    const url = `http://127.0.0.1:${httpPort}/2026-11-06.html?${s.q}`;
    await shot(send, url, s.name, s.clip);
  }
  close();
} finally {
  try {
    chrome.kill("SIGKILL");
  } catch {}
  server.close();
}
console.log("done");
