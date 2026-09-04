import assert from "node:assert/strict";

// BattleScene 继承 Phaser.Scene；此测试只验证场景复用时的临时状态，
// 不需要启动画布、加载素材或进入真实战斗循环。
globalThis.Phaser = { Scene: class {} };

const { BattleScene } = await import("../src/scenes/BattleScene.js");

const scene = new BattleScene();
scene.init({ mapId: "monster-cave-1", mapMonster: { id: "first-monster" } });

// 模拟第一只怪胜利并返回洞穴后，Phaser 复用了同一个 Scene 实例。
Object.assign(scene, {
  isReturningToVillage: true,
  isResolvingDefeat: true,
  isVictoryResolved: true,
  isLeavingVictory: true,
  victoryDestination: "MonsterCaveScene",
  victoryDialog: { isOpen: true },
  defeatDialog: { isOpen: true },
});

scene.init({ mapId: "monster-cave-1", mapMonster: { id: "second-monster" } });

assert.equal(scene.isReturningToVillage, false);
assert.equal(scene.isResolvingDefeat, false);
assert.equal(scene.isVictoryResolved, false);
assert.equal(scene.isLeavingVictory, false);
assert.equal(scene.victoryDestination, null);
assert.equal(scene.victoryDialog, null);
assert.equal(scene.defeatDialog, null);
assert.equal(scene.battleResumeData.mapMonsterId, "second-monster");

console.log("连续战斗场景冒烟测试通过：上一场胜负与切场锁不会污染第二只怪。");
