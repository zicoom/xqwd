import assert from "node:assert/strict";
import {
  MONSTER_APPEARANCE_MODES,
  getMonsterAppearanceTextureKey,
  resolveMonsterAppearance,
} from "../src/core/MonsterAppearance.js";

// 固定剧情敌人没有编辑器模板时会传入 null，必须安全回退，不能让战斗场景中断。
assert.deepEqual(resolveMonsterAppearance(null), {
  mode: MONSTER_APPEARANCE_MODES.STATIC,
  staticImageData: "",
  animation: null,
});

const custom = resolveMonsterAppearance({
  id: "mist-guardian",
  imageData: "/public/assets/images/monster.webp",
  appearance: {
    mode: MONSTER_APPEARANCE_MODES.ANIMATED,
    staticFallback: "/public/assets/images/fallback.webp",
    animation: { frameRate: 12 },
  },
});
assert.equal(custom.mode, MONSTER_APPEARANCE_MODES.ANIMATED);
assert.equal(custom.staticImageData, "/public/assets/images/monster.webp");
assert.deepEqual(custom.animation, { frameRate: 12 });

assert.match(getMonsterAppearanceTextureKey(null, "battle-monster"), /^battle-monster-unknown-/);

console.log("怪物外观冒烟测试通过：空模板回退、自定义立绘和纹理键生成正确。");
