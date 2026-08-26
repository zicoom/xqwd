import { getSectTemplates } from "./SectCatalog.js";

/** 系统任务物品不会出现在编辑器模板里，也不会被误删或出售。 */
export function getSystemItemTemplates() {
  return getSectTemplates()
    .filter((sect) => sect.access?.tokenItemId)
    .map((sect) => ({
      id: sect.access.tokenItemId,
      name: `${sect.name}令牌`,
      type: "其他",
      grade: "凡品",
      description: `${sect.name}接引凭证。持有此令牌可进入${sect.name}，不会在入门时消耗。`,
      price: 0,
      stock: 0,
      texture: "system-item-sect-tianjian-token",
      imageData: "",
      canUse: false,
      sellable: false,
      otherKind: "任务物品",
      otherTaskId: `access:${sect.id}`,
      otherTradable: "不可交易",
    }));
}

