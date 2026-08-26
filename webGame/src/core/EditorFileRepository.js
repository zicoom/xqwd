/**
 * 开发者控制台资料仓库。
 *
 * 编辑器仍然使用同步接口，避免 Phaser 场景在切换模板时读到半份资料；实际资料由本地
 * 开发服务器写进项目文件夹，不再写入浏览器 localStorage。同步请求只用于 localhost
 * 离线编辑工具，游戏运行时不依赖远程网络。
 */
const API_PATH = "/api/editor-data";

function request(method, type, data) {
  if (typeof XMLHttpRequest === "undefined") {
    return { ok: false, unavailable: true, error: "当前环境没有本地开发服务器。" };
  }
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_PATH}?type=${encodeURIComponent(type)}`, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(method === "PUT" ? JSON.stringify({ data }) : null);
    const payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
    if (xhr.status >= 200 && xhr.status < 300 && payload.ok) return { ok: true, data: payload.data };
    return {
      ok: false,
      missing: xhr.status === 404,
      unavailable: xhr.status === 0,
      error: payload.error || "项目文件读写失败。",
    };
  } catch (error) {
    return { ok: false, unavailable: true, error: error.message || "无法连接本地开发服务器。" };
  }
}

export function loadEditorData(type) {
  return request("GET", type);
}

export function saveEditorData(type, data) {
  return request("PUT", type, data);
}

/**
 * 只在项目文件还不存在时读取一次旧浏览器资料，迁移成功后之后的保存都不再写浏览器。
 * 保留旧副本作为人工确认前的安全备份，避免升级时意外丢失旧编辑内容。
 */
export function getLegacyEditorData(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch (error) {
    console.warn("旧版编辑器资料读取失败：", error);
    return null;
  }
}
