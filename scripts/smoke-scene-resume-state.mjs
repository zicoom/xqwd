import assert from "node:assert/strict";
import {
  clearSceneResumeRoute,
  getSectResumeRoute,
  rememberSectRoute,
} from "../src/core/SceneResumeState.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new MemoryStorage();

assert.equal(rememberSectRoute({ sectId: "sect:tianjian", saveSlot: 1 }, storage), true);
assert.deepEqual(getSectResumeRoute(1, storage), { sectId: "sect:tianjian", featureId: "" });
assert.equal(getSectResumeRoute(2, storage), null, "其他角色档位不能复用当前门派页面");

rememberSectRoute({ sectId: "sect:tianjian", featureId: "alchemy", saveSlot: 1 }, storage);
assert.deepEqual(getSectResumeRoute(1, storage), { sectId: "sect:tianjian", featureId: "alchemy" });

rememberSectRoute({ sectId: "sect:tianjian", featureId: "retreat", saveSlot: 1 }, storage);
assert.deepEqual(getSectResumeRoute(1, storage), { sectId: "sect:tianjian", featureId: "retreat" });

assert.equal(rememberSectRoute({ sectId: "../../bad", saveSlot: 1 }, storage), false);
assert.deepEqual(getSectResumeRoute(1, storage), { sectId: "sect:tianjian", featureId: "retreat" });

storage.setItem("xuanqiong-wendao-scene-resume-v1", "{bad json");
assert.equal(getSectResumeRoute(1, storage), null, "损坏记录必须安全忽略");

rememberSectRoute({ sectId: "sect:tianjian", saveSlot: 1 }, storage);
assert.equal(clearSceneResumeRoute(storage), true);
assert.equal(getSectResumeRoute(1, storage), null);

console.log("页面刷新恢复冒烟测试通过：门派总览、炼丹房、闭关室、档位隔离与损坏保护正确。");
