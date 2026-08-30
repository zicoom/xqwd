import assert from "node:assert/strict";
import {
  clearSceneResumeRoute,
  getBattleResumeRoute,
  getSectResumeRoute,
  rememberBattleRoute,
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

assert.equal(rememberBattleRoute({
  saveSlot: 1,
  adventureBattle: "qingyun-mist-guardian",
}, storage), true);
assert.deepEqual(getBattleResumeRoute(1, storage), {
  resumeBattle: true,
  testBattle: false,
  adventureBattle: "qingyun-mist-guardian",
  mapId: "",
  mapMonsterId: "",
  monsterTemplateId: "",
});
assert.equal(getBattleResumeRoute(2, storage), null, "其他角色档位不能复用当前战斗");
assert.equal(getSectResumeRoute(1, storage), null, "战斗恢复记录不能被误认成门派页面");

rememberBattleRoute({
  saveSlot: 1,
  mapId: "qingyun-mountain",
  mapMonsterId: "monster-123",
  monsterTemplateId: "monster:mist-spider",
}, storage);
assert.deepEqual(getBattleResumeRoute(1, storage), {
  resumeBattle: true,
  testBattle: false,
  adventureBattle: "",
  mapId: "qingyun-mountain",
  mapMonsterId: "monster-123",
  monsterTemplateId: "monster:mist-spider",
});

rememberSectRoute({ sectId: "sect:tianjian", saveSlot: 1 }, storage);
assert.equal(getBattleResumeRoute(1, storage), null, "门派页面记录不能被误认成战斗");

assert.equal(rememberSectRoute({ sectId: "../../bad", saveSlot: 1 }, storage), false);
assert.deepEqual(getSectResumeRoute(1, storage), { sectId: "sect:tianjian", featureId: "" });

storage.setItem("xuanqiong-wendao-scene-resume-v1", "{bad json");
assert.equal(getSectResumeRoute(1, storage), null, "损坏记录必须安全忽略");
assert.equal(getBattleResumeRoute(1, storage), null, "损坏战斗记录必须安全忽略");

rememberSectRoute({ sectId: "sect:tianjian", saveSlot: 1 }, storage);
assert.equal(clearSceneResumeRoute(storage), true);
assert.equal(getSectResumeRoute(1, storage), null);
assert.equal(getBattleResumeRoute(1, storage), null);

console.log("页面刷新恢复冒烟测试通过：战斗、门派页面、档位隔离与损坏保护正确。");
