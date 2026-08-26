/**
 * 把项目历史备份中的控制台资料恢复到项目文件。
 *
 * 默认只在 data/editor 尚不存在时执行，避免误覆盖已经保存的新资料。
 * 使用：node scripts/recover-editor-backup.cjs
 */
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { createEditorFileStorage } = require("../server/editorFileStorage.cjs");

const projectRoot = path.resolve(__dirname, "..");
const backupPathInGit = "玄穹问道-数据备份-2026-08-24_23-22-12.json";
const sourceKeys = Object.freeze({
  items: "xuanqiong-wendao-item-templates-v1",
  monsters: "xuanqiong-wendao-monster-templates-v1",
  npcs: "xuanqiong-wendao-npc-templates-v1",
  buildings: "xuanqiong-wendao-building-templates-v1",
  "map-content": "xuanqiong-wendao-map-content-v1",
});

(async () => {
  const dataRoot = path.join(projectRoot, "data", "editor");
  if (fs.existsSync(dataRoot) && fs.readdirSync(dataRoot).length > 0) {
    throw new Error("data/editor 已有资料；为防覆盖，恢复已取消。");
  }
  const rawBackup = childProcess.execFileSync("git", ["show", `HEAD:${backupPathInGit}`], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const backup = JSON.parse(rawBackup);
  const storage = createEditorFileStorage({
    dataRoot,
    imageRoot: path.join(projectRoot, "public", "assets", "images", "editor"),
  });
  for (const [type, key] of Object.entries(sourceKeys)) {
    const serialized = backup.storage?.[key];
    if (!serialized) continue;
    const restored = await storage.write(type, JSON.parse(serialized));
    console.log(`已恢复 ${type}：${Array.isArray(restored) ? restored.length : Object.keys(restored).length} 项`);
  }
  console.log("控制台历史资料已恢复到 data/editor 与 public/assets/images/editor。");
})().catch((error) => {
  console.error(`恢复失败：${error.message}`);
  process.exit(1);
});
