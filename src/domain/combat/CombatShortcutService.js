const SHORTCUT_KEYS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);

const ACTIONS = Object.freeze([
  { key: "action:normal-attack", kind: "action", id: "normal-attack", name: "普通攻击", description: "不消耗灵气的基础攻击。" },
  { key: "action:defend", kind: "action", id: "defend", name: "防御", description: "降低本回合承受的伤害，并恢复少量灵气。" },
]);

const toReference = (candidate) => candidate ? { kind: candidate.kind, id: candidate.id } : null;
const referenceKey = (reference) => reference?.kind && reference?.id ? `${reference.kind}:${reference.id}` : "";

/**
 * 战斗快捷栏领域服务。
 *
 * 这里统一管理键盘 1～0 的十个位置以及可装备内容。UI 只负责展示和点击，
 * 战斗场景以后也通过同一份引用读取行动，避免各自维护一套快捷栏规则。
 */
export class CombatShortcutService {
  constructor({ player, catalog, spellService, save = () => {} }) {
    this.player = player;
    this.catalog = catalog;
    this.spellService = spellService;
    this.save = save;
  }

  getKeys() {
    return [...SHORTCUT_KEYS];
  }

  listCandidates() {
    const spells = this.spellService.listAvailable().map((spell) => ({
      ...spell,
      key: `spell:${spell.id}`,
      kind: "spell",
      description: spell.description || "可在战斗中施放的法术。",
    }));
    const pills = this.catalog.ownedBy(this.player, (item) => item.type === "丹药").map((item) => ({
      ...item,
      key: `item:${item.id}`,
      kind: "item",
      description: item.description || "可在战斗中使用的丹药。",
    }));
    return [...ACTIONS.map((action) => ({ ...action })), ...spells, ...pills];
  }

  getSlots() {
    const candidates = new Map(this.listCandidates().map((candidate) => [candidate.key, candidate]));
    const references = this.readReferences();
    return SHORTCUT_KEYS.map((key, index) => {
      const reference = references[index];
      return { index, key, reference, candidate: candidates.get(referenceKey(reference)) || null };
    });
  }

  assign(index, candidateKey) {
    if (!Number.isInteger(index) || index < 0 || index >= SHORTCUT_KEYS.length) {
      return { ok: false, message: "快捷栏位置无效" };
    }
    const candidate = this.listCandidates().find((entry) => entry.key === candidateKey);
    if (!candidate) return { ok: false, message: "该法术或物品当前不可装备" };

    const references = this.readReferences();
    const nextReference = toReference(candidate);
    const nextKey = referenceKey(nextReference);
    references.forEach((reference, slotIndex) => {
      if (slotIndex !== index && referenceKey(reference) === nextKey) references[slotIndex] = null;
    });
    references[index] = nextReference;
    this.player.combatShortcuts = references;
    this.save();
    return { ok: true, message: `已将「${candidate.name}」装备到 ${SHORTCUT_KEYS[index]} 键`, candidate };
  }

  unequip(index) {
    if (!Number.isInteger(index) || index < 0 || index >= SHORTCUT_KEYS.length) {
      return { ok: false, message: "快捷栏位置无效" };
    }
    const references = this.readReferences();
    if (!references[index]) return { ok: false, message: "该位置没有可卸下的内容" };
    references[index] = null;
    this.player.combatShortcuts = references;
    this.save();
    return { ok: true, message: `已清空 ${SHORTCUT_KEYS[index]} 键` };
  }

  readReferences() {
    const source = Array.isArray(this.player.combatShortcuts)
      ? this.player.combatShortcuts
      : this.createDefaultReferences();
    return Array.from({ length: SHORTCUT_KEYS.length }, (_, index) => {
      const entry = source[index];
      return entry?.kind && entry?.id ? { kind: String(entry.kind), id: String(entry.id) } : null;
    });
  }

  createDefaultReferences() {
    const innateSpell = this.spellService.listAvailable().find((spell) => spell.innate)
      || this.spellService.listAvailable()[0];
    return [
      { kind: "action", id: "normal-attack" },
      innateSpell ? { kind: "spell", id: innateSpell.id } : null,
      { kind: "action", id: "defend" },
      null, null, null, null, null, null, null,
    ];
  }
}
