export const SYSTEM_REWARD_DEFINITIONS = Object.freeze([
  { id: "system:spirit-stones", name: "灵石", kind: "currency", typeLabel: "系统货币" },
  { id: "system:cultivation-exp", name: "修炼经验", kind: "experience", typeLabel: "角色成长" },
]);

const toQuantity = (value) => {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
};

/** 兼容旧怪物模板沿用的“名称 × 数量”格式。 */
export function parseRewardText(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/^(.+?)\s*[×xX*]\s*(\d+)$/u);
  const name = String(match?.[1] || text).trim();
  const quantity = toQuantity(match?.[2] ?? 1);
  return name && quantity > 0 ? { name, quantity } : null;
}

/** 统一奖励目录：系统奖励与物品奖励共用同一套查询、解析和序列化规则。 */
export class RewardCatalog {
  constructor({ itemCatalog }) {
    this.itemCatalog = itemCatalog;
  }

  all() {
    const systemNames = new Set(SYSTEM_REWARD_DEFINITIONS.map((reward) => reward.name));
    const seenNames = new Set(systemNames);
    const items = (this.itemCatalog?.all?.() || [])
      .filter((item) => {
        if (!item?.id || !item?.name || seenNames.has(item.name)) return false;
        seenNames.add(item.name);
        return true;
      })
      .map((item) => ({
        id: `item:${item.id}`,
        itemId: item.id,
        name: item.name,
        kind: "item",
        typeLabel: `${item.type || "物品"} · ${item.grade || "凡品"}`,
      }));
    return [...SYSTEM_REWARD_DEFINITIONS.map((reward) => ({ ...reward })), ...items];
  }

  resolve(nameOrId) {
    const lookup = nameOrId === "经验" ? "修炼经验" : nameOrId;
    return this.all().find((reward) => (
      reward.name === lookup || reward.id === lookup || reward.itemId === lookup
    )) || null;
  }

  parseDrops(drops = []) {
    const parsed = (Array.isArray(drops) ? drops : []).map(parseRewardText).filter(Boolean).map((entry) => {
      const definition = this.resolve(entry.name);
      return definition
        ? { ...definition, quantity: entry.quantity, resolved: true }
        : { id: `legacy:${entry.name}`, name: entry.name, kind: "unknown", typeLabel: "旧版未登记文本", quantity: entry.quantity, resolved: false };
    });
    return parsed.reduce((entries, entry) => {
      const existing = entries.find((candidate) => candidate.id === entry.id);
      if (existing) existing.quantity += entry.quantity;
      else entries.push(entry);
      return entries;
    }, []);
  }

  serializeDrops(entries = []) {
    return entries
      .filter((entry) => entry?.name && toQuantity(entry.quantity) > 0)
      .map((entry) => `${entry.name} × ${toQuantity(entry.quantity)}`);
  }
}
