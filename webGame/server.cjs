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
const { EDITOR_TYPES, createEditorFileStorage } = require("./server/editorFileStorage.cjs");

// __dirname 就是本文件所在目录，也就是整个游戏项目的根目录。
const projectRoot = __dirname;
const editorStorage = createEditorFileStorage({
  dataRoot: path.join(projectRoot, "data", "editor"),
  imageRoot: path.join(projectRoot, "public", "assets", "images", "editor"),
});

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

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > 64 * 1024 * 1024) {
        reject(new Error("单次保存资料过大，请分批上传图片。"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function handleEditorData(request, response, url) {
  const type = url.searchParams.get("type");
  if (!EDITOR_TYPES[type]) {
    sendJson(response, 400, { ok: false, error: "未知的编辑器资料类型。" });
    return;
  }
  try {
    if (request.method === "GET") {
      const data = await editorStorage.read(type);
      if (data === undefined) {
        sendJson(response, 404, { ok: false, error: "项目中尚未建立这类编辑资料。" });
        return;
      }
      sendJson(response, 200, { ok: true, data });
      return;
    }
    if (request.method === "PUT") {
      const rawBody = await readRequestBody(request);
      const payload = JSON.parse(rawBody || "{}");
      const data = await editorStorage.write(type, payload.data);
      sendJson(response, 200, { ok: true, data });
      return;
    }
    sendJson(response, 405, { ok: false, error: "只支持读取或保存编辑器资料。" });
  } catch (error) {
    console.error("编辑器资料保存失败：", error.message);
    sendJson(response, 500, { ok: false, error: error.message || "写入项目文件失败。" });
  }
}

const server = http.createServer(async (request, response) => {
  // “/”代表首页，因此自动返回 index.html。
  const requestUrl = new URL(request.url, "http://localhost");
  const requestPath = requestUrl.pathname;
  if (requestPath === "/api/editor-data") {
    await handleEditorData(request, response, requestUrl);
    return;
  }
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
const port = Number(process.env.PORT) || 8000;
server.listen(port, "127.0.0.1", () => {
  console.log(`玄穹问道本地服务器已启动： http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`${port} 端口已被占用：请直接刷新浏览器，或先关闭旧的服务器窗口。`);
  } else {
    console.error("服务器启动失败：", error.message);
  }
});
