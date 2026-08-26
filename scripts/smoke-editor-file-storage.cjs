const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createEditorFileStorage } = require("../server/editorFileStorage.cjs");

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xuanqiong-editor-files-"));
  const storage = createEditorFileStorage({
    dataRoot: path.join(root, "data"),
    imageRoot: path.join(root, "images"),
  });
  const saved = await storage.write("buildings", [{
    id: "test-house",
    name: "测试民居",
    imageData: "data:image/webp;base64,AA==",
  }]);
  assert.equal(saved[0].imageData, "/public/assets/images/editor/buildings/test-house-imageData.webp");
  assert.equal(fs.existsSync(path.join(root, "images", "buildings", "test-house-imageData.webp")), true);
  assert.deepEqual(await storage.read("buildings"), saved);
  await storage.write("map-content", { qixia: [{ id: "npc-1", type: "npc" }] });
  assert.equal((await storage.read("map-content")).qixia[0].id, "npc-1");
  fs.rmSync(root, { recursive: true, force: true });
  console.log("编辑器项目文件仓库冒烟验证通过");
})().catch((error) => { console.error(error); process.exit(1); });
