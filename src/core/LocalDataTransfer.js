/**
 * 本地数据备份模块。
 *
 * 当前游戏是离线网页游戏，角色档案、编辑器模板、地图摆放内容都放在浏览器的
 * localStorage 中；它们不会跟随 webGame 文件夹一起复制。
 * 本文件把所有以 xuanqiong-wendao- 开头的游戏资料打包为一个 JSON 下载文件，
 * 并支持在另一台电脑选择备份文件后完整恢复。
 */

// 只备份本游戏的资料，绝不把浏览器中其他网站的数据一并导出。
const GAME_STORAGE_PREFIX = "xuanqiong-wendao-";

/** 收集当前浏览器中属于本游戏的全部键值，供导出与导入失败回滚共用。 */
function collectGameStorage() {
  const storage = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(GAME_STORAGE_PREFIX)) continue;
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
      description: "角色档案、地图编辑器、NPC、怪物、建筑与物品模板的浏览器本地备份。",
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
 * 让玩家选择一份“玄穹问道数据备份”JSON 文件。
 *
 * 导入会替换本机现有的游戏资料，因此必须由玩家在浏览器确认一次；确认后刷新网页，
 * 让 Phaser、地图编辑器与各个模板仓库都重新从新资料建立状态。
 * @returns {Promise<{success: boolean, cancelled?: boolean, count?: number, message?: string}>}
 */
export async function importLocalGameDataFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  document.body.appendChild(input);

  try {
    const selectedFile = await new Promise((resolve) => {
      let finished = false;
      const finish = (file) => {
        if (finished) return;
        finished = true;
        window.removeEventListener("focus", onWindowFocus);
        resolve(file);
      };
      const onWindowFocus = () => {
        // 用户在系统文件选择框点击“取消”时，部分浏览器不会触发 change。
        // 回到网页后稍等一帧再检查，可以把这种情况正常视作取消而不是卡住设置界面。
        window.setTimeout(() => finish(input.files?.[0] || null), 0);
      };
      input.addEventListener("change", () => finish(input.files?.[0] || null), { once: true });
      window.addEventListener("focus", onWindowFocus, { once: true });
      input.click();
    });
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

    const count = Object.keys(importedStorage).length;
    if (!window.confirm(`导入会覆盖本机现有的游戏数据。\n将恢复 ${count} 项资料（角色、物品、NPC、怪物、地图等）。\n\n确定导入吗？`)) {
      return { success: false, cancelled: true };
    }

    // 先留一份本机资料；若浏览器储存空间不足等异常导致导入失败，尽力自动恢复。
    const previousStorage = collectGameStorage();
    try {
      clearGameStorage();
      Object.entries(importedStorage).forEach(([key, value]) => localStorage.setItem(key, value));
      const importedCorrectly = Object.entries(importedStorage)
        .every(([key, value]) => localStorage.getItem(key) === value);
      if (!importedCorrectly) throw new Error("浏览器未能完整写入备份资料");
    } catch (error) {
      clearGameStorage();
      Object.entries(previousStorage).forEach(([key, value]) => localStorage.setItem(key, value));
      console.warn("游戏数据导入失败：", error);
      return { success: false, message: "导入失败，本机原有资料已恢复；请检查浏览器储存空间。" };
    }

    return { success: true, count };
  } finally {
    input.remove();
  }
}
