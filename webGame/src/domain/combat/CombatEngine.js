const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizeActor(actor = {}, defaults = {}) {
  const maxHp = Math.max(1, toNumber(actor.maxHp, defaults.maxHp || 1));
  const maxQi = Math.max(0, toNumber(actor.maxQi ?? actor.qi, defaults.maxQi || 0));
  return {
    ...actor,
    name: String(actor.name || defaults.name || "未命名角色"),
    maxHp,
    hp: clamp(toNumber(actor.hp, maxHp), 0, maxHp),
    maxQi,
    qi: clamp(toNumber(actor.qi, maxQi), 0, maxQi),
    attack: Math.max(0, toNumber(actor.attack, defaults.attack || 0)),
    defense: Math.max(0, toNumber(actor.defense, defaults.defense || 0)),
    skills: Array.isArray(actor.skills) ? actor.skills.map((skill) => ({
      name: String(skill.name || "攻击"),
      damage: Math.max(1, toNumber(skill.damage, 1)),
      qiCost: Math.max(0, toNumber(skill.qiCost, 0)),
      cooldown: Math.max(0, Math.floor(toNumber(skill.cooldown, 0))),
    })) : [],
  };
}

/** 速度位功法提供战斗先手；目录查询与数值解释集中在领域层。 */
export function calculatePlayerInitiative(player, catalog) {
  const techniqueId = player?.equippedTechniques?.speed;
  const technique = techniqueId ? catalog?.getById(techniqueId) : null;
  return Math.max(0, toNumber(technique?.techniqueInitiative, 0));
}

/**
 * 纯回合战斗规则引擎。
 * 不依赖 Phaser、音频、定时器或场景；页面只负责播放返回动作对应的表现。
 */
export class CombatEngine {
  constructor({ player, enemy, playerInitiative = 0, enemyInitiative = 0, random = Math.random }) {
    this.player = player;
    const normalizedPlayer = normalizeActor(player, { name: "主角", maxHp: 1 });
    delete normalizedPlayer.skills;
    Object.assign(this.player, normalizedPlayer);
    this.enemy = normalizeActor(enemy, { name: "敌人", maxHp: 1 });
    this.random = random;
    this.playerInitiative = Math.max(0, toNumber(playerInitiative, 0));
    this.enemyInitiative = Math.max(0, toNumber(enemyInitiative, 0));
    this.turn = this.playerInitiative >= this.enemyInitiative ? "player" : "enemy";
    this.round = 1;
    this.battleOver = false;
    this.winner = null;
    this.defending = false;
    this.enemySkillCooldowns = {};
    this.pendingAction = null;
  }

  canPlayerAct() {
    return !this.battleOver && this.turn === "player" && !this.pendingAction;
  }

  preparePlayerNormalAttack() {
    if (!this.canPlayerAct()) return { ok: false, message: "当前不能行动。" };
    return this.preparePlayerDamageAction({
      kind: "normal",
      name: "普通攻击",
      damage: Math.max(1, this.player.attack - this.enemy.defense + this.rollBonus()),
    });
  }

  preparePlayerSkill({ name = "术法", qiCost = 8, damageBonus = 8 } = {}) {
    if (!this.canPlayerAct()) return { ok: false, message: "当前不能行动。" };
    if (this.player.qi < qiCost) return { ok: false, message: "灵气不足，无法施放术法！请防御恢复灵气或普通攻击。" };
    this.player.qi -= qiCost;
    return this.preparePlayerDamageAction({
      kind: "skill",
      name,
      qiCost,
      damage: Math.max(1, this.player.attack + damageBonus - this.enemy.defense),
    });
  }

  preparePlayerDefend({ qiRecovery = 5 } = {}) {
    if (!this.canPlayerAct()) return { ok: false, message: "当前不能行动。" };
    this.player.qi = Math.min(this.player.maxQi, this.player.qi + qiRecovery);
    this.defending = true;
    this.turn = "enemy";
    return { ok: true, action: { actor: "player", kind: "defend", qiRecovery } };
  }

  preparePlayerDamageAction(action) {
    this.turn = "enemy";
    this.pendingAction = { actor: "player", ...action };
    return { ok: true, action: this.pendingAction };
  }

  resolvePlayerAction(action) {
    if (!action || action !== this.pendingAction || action.actor !== "player") {
      return { ok: false, message: "没有可结算的玩家动作。" };
    }
    this.enemy.hp = Math.max(0, this.enemy.hp - action.damage);
    this.pendingAction = null;
    if (this.enemy.hp <= 0) this.endBattle("player");
    return { ok: true, action, damage: action.damage, defeated: this.battleOver };
  }

  prepareEnemyAction() {
    if (this.battleOver || this.turn !== "enemy" || this.pendingAction) {
      return { ok: false, message: "当前不是敌方行动阶段。" };
    }
    Object.keys(this.enemySkillCooldowns).forEach((name) => {
      this.enemySkillCooldowns[name] = Math.max(0, this.enemySkillCooldowns[name] - 1);
    });
    const usableSkills = this.enemy.skills.filter((skill) => (
      this.enemy.qi >= skill.qiCost && (this.enemySkillCooldowns[skill.name] || 0) === 0
    ));
    const skill = usableSkills.length ? usableSkills[this.rollIndex(usableSkills.length)] : null;
    if (skill) {
      this.enemy.qi -= skill.qiCost;
      this.enemySkillCooldowns[skill.name] = skill.cooldown;
    }
    const rawDamage = Math.max(1, (skill?.damage ?? this.enemy.attack) - this.player.defense + this.rollBonus());
    const damage = this.defending ? Math.ceil(rawDamage * 0.5) : rawDamage;
    this.pendingAction = {
      actor: "enemy",
      kind: skill ? "skill" : "normal",
      name: skill?.name || "普通攻击",
      skill,
      damage,
    };
    return { ok: true, action: this.pendingAction };
  }

  resolveEnemyAction(action) {
    if (!action || action !== this.pendingAction || action.actor !== "enemy") {
      return { ok: false, message: "没有可结算的敌方动作。" };
    }
    this.player.hp = Math.max(0, this.player.hp - action.damage);
    this.defending = false;
    this.pendingAction = null;
    if (this.player.hp <= 0) this.endBattle("enemy");
    return { ok: true, action, damage: action.damage, defeated: this.battleOver };
  }

  finishEnemyTurn() {
    if (this.battleOver) return { ok: false, winner: this.winner };
    if (this.pendingAction) return { ok: false, message: "敌方动作尚未结算。" };
    this.round += 1;
    this.turn = "player";
    return { ok: true, round: this.round };
  }

  endBattle(winner) {
    this.battleOver = true;
    this.winner = winner;
  }

  restorePlayer() {
    this.player.hp = this.player.maxHp;
    this.player.qi = this.player.maxQi;
    return { hp: this.player.hp, qi: this.player.qi };
  }

  rollBonus() {
    return Math.floor(clamp(toNumber(this.random(), 0), 0, 0.999999) * 4);
  }

  rollIndex(length) {
    return Math.floor(clamp(toNumber(this.random(), 0), 0, 0.999999) * length);
  }
}
