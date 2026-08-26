const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const LEGACY_EFFECTS = Object.freeze({
  baixiangye: { hp: 4 }, juqicao: { qi: 8 }, xingyingguo: { qi: 18 },
  ninglutai: { hp: 8, qi: 4 }, linggugen: { hp: 20 }, yuyazhi: { hp: 16, qi: 16 },
  qingmaiteng: { hp: 8 }, qinglinghua: { qi: 12 }, chiyangshen: { hp: 10, qi: 20 },
});

/** 背包领域服务：统一处理物品使用、丢弃和临时效果，不依赖 Phaser 或任何 UI。 */
export class InventoryService {
  constructor({ player, save = () => true, random = Math.random, now = Date.now }) {
    this.player = player;
    this.save = save;
    this.random = random;
    this.now = now;
  }

  getQuantity(itemId) {
    return Math.max(0, Number(this.player.inventory?.[itemId]) || 0);
  }

  grant(itemId, quantity = 1) {
    const amount = Math.max(0, Math.floor(Number(quantity) || 0));
    if (!itemId || amount <= 0) return { ok: false, message: "奖励物品或数量无效。" };
    const inventory = this.player.inventory || (this.player.inventory = {});
    inventory[itemId] = this.getQuantity(itemId) + amount;
    this.save();
    return { ok: true, itemId, quantity: amount, total: inventory[itemId] };
  }

  consume(itemId, quantity = 1) {
    const inventory = this.player.inventory || (this.player.inventory = {});
    const available = this.getQuantity(itemId);
    if (available < quantity) return false;
    inventory[itemId] = available - quantity;
    if (inventory[itemId] <= 0) delete inventory[itemId];
    return true;
  }

  discard(item, quantity = 1) {
    if (!item || !this.consume(item.id, quantity)) return { ok: false, message: "物品数量不足。" };
    this.save();
    return { ok: true, message: `已丢弃 ${item.name} × ${quantity}` };
  }

  getUseEffect(item) {
    if (!item || item.canUse === false) return null;
    const effect = {
      hp: Math.max(0, Number(item.restoreHp) || 0),
      qi: Math.max(0, Number(item.restoreQi) || 0),
      attack: Math.max(0, Number(item.attackBonus) || 0),
      defense: Math.max(0, Number(item.defenseBonus) || 0),
      resistance: Math.max(0, Number(item.resistance) || 0),
      resistanceType: String(item.resistanceType || "无"),
      cultivationExp: Math.max(0, Number(item.cultivationExp) || 0),
      duration: Math.max(0, Number(item.duration) || 0),
      successRate: clamp(Number(item.successRate ?? 100) || 0, 0, 100),
      skillText: String(item.skillText || "").trim(),
    };
    const configured = effect.hp || effect.qi || effect.attack || effect.defense || effect.resistance
      || effect.resistanceType !== "无" || effect.cultivationExp || effect.duration || effect.skillText;
    const legacy = LEGACY_EFFECTS[item.id];
    return configured || !legacy ? (configured ? effect : null) : {
      hp: 0, qi: 0, attack: 0, defense: 0, resistance: 0, resistanceType: "无",
      cultivationExp: 0, duration: 0, successRate: 100, skillText: "", ...legacy,
    };
  }

  describeEffect(item) {
    const effect = this.getUseEffect(item);
    if (!effect) return "该物品暂时不能直接使用";
    const entries = [];
    if (effect.hp) entries.push(`生命 +${effect.hp}`);
    if (effect.qi) entries.push(`修为 +${effect.qi}`);
    if (effect.attack) entries.push(`攻击 +${effect.attack}`);
    if (effect.defense) entries.push(`防御 +${effect.defense}`);
    if (effect.resistanceType && effect.resistanceType !== "无") entries.push(`抗性：${effect.resistanceType}`);
    else if (effect.resistance) entries.push(`抗性 +${effect.resistance}`);
    if (effect.cultivationExp) entries.push(`修炼经验 +${effect.cultivationExp}`);
    if (effect.skillText) entries.push("习得技能");
    if (effect.duration) entries.push(`持续 ${effect.duration} 秒`);
    return entries.length ? entries.join("，") : "暂无可用效果";
  }

  use(item) {
    const effect = this.getUseEffect(item);
    if (!effect) return { ok: false, consumed: false, message: "该物品暂时不能直接使用" };
    if (this.getQuantity(item.id) <= 0) return { ok: false, consumed: false, message: "物品数量不足" };
    if (this.random() * 100 >= (effect.successRate ?? 100)) {
      this.consume(item.id);
      this.save();
      return { ok: false, consumed: true, message: "使用失败，物品已消耗" };
    }

    const oldHp = Number(this.player.hp) || 0;
    const oldQi = Number(this.player.qi) || 0;
    const nextHp = clamp(oldHp + (effect.hp || 0), 0, Number(this.player.maxHp) || oldHp);
    const nextQi = clamp(oldQi + (effect.qi || 0), 0, Number(this.player.maxQi) || oldQi);
    const gainedHp = nextHp - oldHp;
    const gainedQi = nextQi - oldQi;
    const hasOtherEffect = effect.attack || effect.defense || effect.resistance
      || effect.resistanceType !== "无" || effect.cultivationExp || effect.skillText;
    if (gainedHp <= 0 && gainedQi <= 0 && !hasOtherEffect) {
      return { ok: false, consumed: false, message: "生命与修为均已圆满，无需使用" };
    }

    this.consume(item.id);
    this.player.hp = nextHp;
    this.player.qi = nextQi;
    this.player.cultivationExp = Math.max(0, Number(this.player.cultivationExp) || 0) + (effect.cultivationExp || 0);
    this.applyResistanceType(effect.resistanceType);
    const bonus = this.applyBonuses(effect);
    const temporaryEffect = effect.duration > 0 && Object.values(bonus).some((value) => value > 0)
      ? this.addTemporaryEffect(item, bonus, effect.duration)
      : null;
    this.applyLearnedSkill(effect.skillText);
    const messages = this.buildUseMessages({ effect, bonus, gainedHp, gainedQi });
    this.save();
    return { ok: true, consumed: true, message: messages.join("，") || this.describeEffect(item), temporaryEffect };
  }

  applyResistanceType(resistanceType) {
    if (!resistanceType || resistanceType === "无") return;
    const current = Array.isArray(this.player.resistanceTypes) ? this.player.resistanceTypes : [];
    this.player.resistanceTypes = Array.from(new Set([...current, resistanceType]));
  }

  applyBonuses(effect) {
    const bonus = { attack: effect.attack || 0, defense: effect.defense || 0, resistance: effect.resistance || 0 };
    this.player.attack = Math.max(0, Number(this.player.attack) || 0) + bonus.attack;
    this.player.defense = Math.max(0, Number(this.player.defense) || 0) + bonus.defense;
    this.player.resistance = Math.max(0, Number(this.player.resistance) || 0) + bonus.resistance;
    return bonus;
  }

  applyLearnedSkill(skillText) {
    if (!skillText) return;
    const learned = Array.isArray(this.player.learnedSkills) ? this.player.learnedSkills : [];
    if (!learned.includes(skillText)) learned.push(skillText);
    this.player.learnedSkills = learned;
  }

  addTemporaryEffect(item, bonus, duration) {
    const effects = Array.isArray(this.player.activeItemEffects) ? this.player.activeItemEffects : [];
    const effect = {
      id: `${item.id}-${this.now()}-${Math.floor(this.random() * 10000)}`,
      itemName: item.name,
      ...bonus,
      expiresAt: this.now() + duration * 1000,
    };
    effects.push(effect);
    this.player.activeItemEffects = effects;
    return effect;
  }

  buildUseMessages({ effect, bonus, gainedHp, gainedQi }) {
    const messages = [];
    if (gainedHp > 0) messages.push(`生命 +${gainedHp}`);
    if (gainedQi > 0) messages.push(`修为 +${gainedQi}`);
    if (bonus.attack > 0) messages.push(`攻击 +${bonus.attack}`);
    if (bonus.defense > 0) messages.push(`防御 +${bonus.defense}`);
    if (effect.resistanceType && effect.resistanceType !== "无") messages.push(`抗性：${effect.resistanceType}`);
    else if (bonus.resistance > 0) messages.push(`抗性 +${bonus.resistance}`);
    if (effect.cultivationExp > 0) messages.push(`修炼经验 +${effect.cultivationExp}`);
    if (effect.skillText) messages.push("已习得技能");
    if (effect.duration > 0 && Object.values(bonus).some((value) => value > 0)) messages.push(`持续 ${effect.duration} 秒`);
    return messages;
  }

  clearExpiredEffects(now = this.now()) {
    const effects = Array.isArray(this.player.activeItemEffects) ? this.player.activeItemEffects : [];
    const expired = effects.filter((effect) => Number(effect.expiresAt) <= now);
    expired.forEach((effect) => {
      this.player.attack = Math.max(0, (Number(this.player.attack) || 0) - (Number(effect.attack) || 0));
      this.player.defense = Math.max(0, (Number(this.player.defense) || 0) - (Number(effect.defense) || 0));
      this.player.resistance = Math.max(0, (Number(this.player.resistance) || 0) - (Number(effect.resistance) || 0));
    });
    this.player.activeItemEffects = effects.filter((effect) => Number(effect.expiresAt) > now);
    if (expired.length) this.save();
    return { expired, active: this.player.activeItemEffects };
  }
}
