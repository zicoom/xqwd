/**
 * 玄穹问道本地开发服务器。
 *
 * 作用：把当前项目文件夹中的 HTML、JavaScript、图片等文件提供给浏览器访问。
 * 使用方法：双击同目录的“启动游戏.bat”，然后浏览器访问 http://localhost:8000。
 * 注意：运行时请不要关闭弹出的黑色窗口，关闭后浏览器就无法打开游戏。
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

// __dirname 就是本文件所在目录，也就是整个游戏项目的根目录。
const projectRoot = __dirname;

// 浏览器需要知道每种文件是什么类型，图片、声音才能被正确显示和播放。
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer((request, response) => {
  // “/”代表首页，因此自动返回 index.html。
  const requestPath = new URL(request.url, "http://localhost").pathname;
  const relativePath = decodeURIComponent(requestPath === "/" ? "/index.html" : requestPath);
  const filePath = path.resolve(projectRoot, `.${relativePath}`);

  // 防止请求跳出游戏项目文件夹，保证本地文件安全。
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("禁止访问该文件。");
    return;
  }

  fs.readFile(filePath, (error, fileContent) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end(error.code === "ENOENT" ? "没有找到该文件。" : "读取文件失败。 ");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(fileContent);
  });
});

// 8000 是游戏当前使用的端口；只允许本机浏览器访问。
server.listen(8000, "127.0.0.1", () => {
  console.log("玄穹问道本地服务器已启动： http://localhost:8000");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("8000 端口已被占用：请直接刷新浏览器，或先关闭旧的服务器窗口。");
  } else {
    console.error("服务器启动失败：", error.message);
  }
});
