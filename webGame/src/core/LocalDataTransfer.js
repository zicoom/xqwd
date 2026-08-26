/**
 * 本地数据备份模块。
 *
 * 角色档案与游戏设置仍保存在浏览器 localStorage；开发者控制台模板和图片已写入项目
 * 文件夹，会随整个 webGame 目录一起复制。本文件只备份玩家资料；导入旧版
 * “包含编辑器资料”的浏览器备份时会忽略其中的编辑器副本，避免再写回浏览器。
 */

// 只备份本游戏的资料，绝不把浏览器中其他网站的数据一并导出。
const GAME_STORAGE_PREFIX = "xuanqiong-wendao-";
const EDITOR_STORAGE_TYPES = Object.freeze({
  "xuanqiong-wendao-item-templates-v1": "items",
  "xuanqiong-wendao-monster-templates-v1": "monsters",
  "xuanqiong-wendao-npc-templates-v1": "npcs",
  "xuanqiong-wendao-building-templates-v1": "buildings",
  "xuanqiong-wendao-map-content-v1": "map-content",
});

/** 收集当前浏览器中属于本游戏的全部键值，供导出与导入失败回滚共用。 */
function collectGameStorage() {
  const storage = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(GAME_STORAGE_PREFIX) || EDITOR_STORAGE_TYPES[key]) continue;
    storage[key] = localStorage.getItem(key);
  }
  return storage;
}

/** 删除当前浏览器内的游戏资料，不会影响任何其他网站。 */
function clearGameStorage() {
  Object.keys(collectGameStorage()).forEach((key) => localStorage.removeItem(key));
}

/** 生成适合 Windows 文件名的本地时间，例如 2026-08-24_14-30-05。 */
function createFileTime() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * 导出当前浏览器内全部《玄穹问道》数据。
 * @returns {{ success: boolean, count?: number, fileName?: string, message?: string }} 导出结果，供设置面板显示提示。
 */
export function exportLocalGameData() {
  try {
    // 原样保存字符串，导入时可不损失数字、JSON、Base64 图片等内容。
    const storage = collectGameStorage();

    const fileName = `玄穹问道-数据备份-${createFileTime()}.json`;
    const backup = {
      format: "xuanqiong-wendao-local-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      description: "角色档案、游戏设置等浏览器本地备份；控制台模板和图片已保存在项目文件夹。",
      storage,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // 下载已由浏览器接管，稍后释放临时内存地址即可。
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    return { success: true, count: Object.keys(storage).length, fileName };
  } catch (error) {
    console.warn("游戏数据导出失败：", error);
    return { success: false, message: "浏览器拒绝创建备份文件，请检查下载权限。" };
  }
}

/**
 * 打开系统 JSON 文件选择窗口，并可靠地区分“已选文件”和“取消”。
 *
 * Windows 的 Chrome 可能先让网页恢复 focus，过一小段时间才触发 input.change。
 * 因此 focus 只能作为旧浏览器的延迟兜底，不能立刻判定取消；现代浏览器则直接
 * 使用 input.cancel 事件。参数可注入是为了在纯 JavaScript 测试中复现事件顺序。
 */
export function pickLocalBackupFile({
  documentObject = document,
  windowObject = window,
  focusFallbackDelay = 500,
} = {}) {
  const input = documentObject.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  documentObject.body.appendChild(input);

  return new Promise((resolve) => {
    let finished = false;
    let focusTimer = null;

    const cleanup = () => {
      if (focusTimer !== null) windowObject.clearTimeout(focusTimer);
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      windowObject.removeEventListener("focus", onWindowFocus);
      input.remove();
    };
    const finish = (file) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(file || null);
    };
    const onChange = () => finish(input.files?.[0] || null);
    const onCancel = () => finish(null);
    const onWindowFocus = () => {
      // focus 往往早于 change；留出时间让系统文件窗口把选择结果写回 input.files。
      if (focusTimer !== null) windowObject.clearTimeout(focusTimer);
      focusTimer = windowObject.setTimeout(() => finish(input.files?.[0] || null), focusFallbackDelay);
    };

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    windowObject.addEventListener("focus", onWindowFocus);
    input.click();
  });
}

/**
 * 让玩家选择一份“玄穹问道数据备份”JSON 文件。
 *
 * 导入会替换本机现有的游戏资料，因此必须由玩家在浏览器确认一次；确认后刷新网页，
 * 让 Phaser、地图编辑器与各个模板仓库都重新从新资料建立状态。
 * @returns {Promise<{success: boolean, cancelled?: boolean, count?: number, message?: string}>}
 */
export async function importLocalGameDataFromFile() {
  try {
    const selectedFile = await pickLocalBackupFile();
    if (!selectedFile) return { success: false, cancelled: true };

    let backup;
    try {
      backup = JSON.parse(await selectedFile.text());
    } catch (_error) {
      return { success: false, message: "所选文件不是有效的 JSON 备份文件。" };
    }

    // 严格校验格式和键名，防止误把其他程序的 JSON 写入本游戏存档。
    const importedStorage = backup?.storage;
    const valid = backup?.format === "xuanqiong-wendao-local-backup"
      && Number(backup?.version) === 1
      && importedStorage
      && typeof importedStorage === "object"
      && !Array.isArray(importedStorage)
      && Object.entries(importedStorage).every(([key, value]) => key.startsWith(GAME_STORAGE_PREFIX) && typeof value === "string");
    if (!valid) return { success: false, message: "这不是《玄穹问道》的有效数据备份。" };

    const browserEntries = Object.entries(importedStorage).filter(([key]) => !EDITOR_STORAGE_TYPES[key]);
    const count = browserEntries.length;
    if (!window.confirm(`导入会覆盖本机现有的玩家资料。\n将恢复 ${count} 项浏览器资料；旧备份中的控制台模板不会写回浏览器。\n\n确定导入吗？`)) {
      return { success: false, cancelled: true };
    }

    // 先留一份本机资料；若浏览器储存空间不足等异常导致导入失败，尽力自动恢复。
    const previousStorage = collectGameStorage();
    try {
      clearGameStorage();
      browserEntries.forEach(([key, value]) => localStorage.setItem(key, value));
      const importedCorrectly = browserEntries.every(([key, value]) => localStorage.getItem(key) === value);
      if (!importedCorrectly) throw new Error("浏览器未能完整写入备份资料");
    } catch (error) {
      clearGameStorage();
      Object.entries(previousStorage).forEach(([key, value]) => localStorage.setItem(key, value));
      console.warn("游戏数据导入失败：", error);
      return { success: false, message: "导入失败，本机原有资料已恢复；请检查浏览器储存空间。" };
    }
    return { success: true, count };
  } catch (error) {
    console.warn("游戏数据文件选择失败：", error);
    return { success: false, message: "浏览器无法读取所选文件，请检查文件访问权限后重试。" };
  }
}
