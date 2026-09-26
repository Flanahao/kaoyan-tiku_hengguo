const http = require("http");
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
http.createServer((req, res) => {
  try {
    let u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/") u = "/最终笔记/index.html";
    const p = path.normalize(path.join(root, u));
    if (!p.startsWith(root)) { res.writeHead(403); res.end("forbidden"); return; }
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404); res.end("not found: " + p); return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(8765, "127.0.0.1", () => console.log("OK http://127.0.0.1:8765/最终笔记/index.html"));
