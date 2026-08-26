import assert from "node:assert/strict";
import { CombatEngine, calculatePlayerInitiative } from "../src/domain/combat/CombatEngine.js";

const makePlayer = (overrides = {}) => ({
  name: "测试修士", hp: 30, maxHp: 30, qi: 10, maxQi: 20, attack: 10, defense: 2,
  equippedTechniques: {}, ...overrides,
});
const makeEnemy = (overrides = {}) => ({
  name: "测试妖兽", hp: 20, maxHp: 20, qi: 10, maxQi: 10, attack: 8, defense: 3, skills: [], ...overrides,
});

assert.equal(calculatePlayerInitiative(
  { equippedTechniques: { speed: "swift" } },
  { getById: () => ({ techniqueInitiative: 18 }) },
), 18);

const attackEngine = new CombatEngine({ player: makePlayer(), enemy: makeEnemy(), random: () => 0 });
assert.equal(attackEngine.turn, "player", "先手相同时玩家先行动");
const normal = attackEngine.preparePlayerNormalAttack();
assert.equal(normal.ok, true);
assert.equal(attackEngine.canPlayerAct(), false, "动作准备后必须锁定玩家输入");
assert.equal(attackEngine.enemy.hp, 20, "动画命中前不能提前扣血");
assert.equal(attackEngine.resolvePlayerAction(normal.action).damage, 7);
assert.equal(attackEngine.enemy.hp, 13);

const insufficient = new CombatEngine({ player: makePlayer({ qi: 3 }), enemy: makeEnemy(), random: () => 0 });
assert.equal(insufficient.preparePlayerSkill({ qiCost: 8 }).ok, false);
assert.equal(insufficient.turn, "player", "施法失败不能消耗回合");

const defendEngine = new CombatEngine({
  player: makePlayer({ qi: 5 }),
  enemy: makeEnemy({ skills: [{ name: "重击", damage: 10, qiCost: 2, cooldown: 2 }] }),
  random: () => 0,
});
assert.equal(defendEngine.preparePlayerDefend().ok, true);
assert.equal(defendEngine.player.qi, 10);
const enemyAction = defendEngine.prepareEnemyAction();
assert.equal(enemyAction.action.name, "重击");
assert.equal(enemyAction.action.damage, 4, "防御应将扣除防御后的伤害减半并向上取整");
defendEngine.resolveEnemyAction(enemyAction.action);
assert.equal(defendEngine.player.hp, 26);
assert.equal(defendEngine.finishEnemyTurn().round, 2);
assert.equal(defendEngine.turn, "player");

const victoryEngine = new CombatEngine({ player: makePlayer({ attack: 99 }), enemy: makeEnemy({ hp: 3 }), random: () => 0 });
const lethal = victoryEngine.preparePlayerNormalAttack();
victoryEngine.resolvePlayerAction(lethal.action);
assert.equal(victoryEngine.winner, "player");
assert.equal(victoryEngine.battleOver, true);
victoryEngine.player.hp = 1;
victoryEngine.player.qi = 0;
assert.deepEqual(victoryEngine.restorePlayer(), { hp: 30, qi: 20 });

const defeatEngine = new CombatEngine({
  player: makePlayer({ hp: 3 }),
  enemy: makeEnemy({ attack: 20 }),
  playerInitiative: 0,
  enemyInitiative: 10,
  random: () => 0,
});
const finishingBlow = defeatEngine.prepareEnemyAction();
defeatEngine.resolveEnemyAction(finishingBlow.action);
assert.equal(defeatEngine.winner, "enemy");
assert.equal(defeatEngine.battleOver, true);

console.log("战斗引擎冒烟测试通过：先手、动作锁、灵气、防御、伤害、回合和胜负正确。");
