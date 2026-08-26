/**
 * 门派目录只保存稳定配置，不处理 Phaser、存档写入或具体界面。
 * 后续新增门派时，在这里追加配置即可复用地图入口、准入判定和门派总览。
 */
export const SECT_IDS = Object.freeze({
  TIANJIAN: "sect:tianjian",
});

const SECTS = Object.freeze([
  Object.freeze({
    id: SECT_IDS.TIANJIAN,
    name: "天剑宗",
    subtitle: "剑心问道 · 云巅仙门",
    building: Object.freeze({
      targetIds: Object.freeze([SECT_IDS.TIANJIAN]),
      templateIds: Object.freeze(["building-qixia-house"]),
      names: Object.freeze(["天剑宗", "天剑宗01"]),
      // 从建筑碰撞边缘向外计算，而不是从建筑中心计算；320 能让玩家提前看到入口，
      // 同时又不会隔着大半张地图误触发。
      autoPromptRange: 320,
    }),
    access: Object.freeze({
      questIds: Object.freeze(["quest:tianjian-introduction"]),
      tokenItemId: "sect:tianjian-token",
      deniedText: "需完成天剑宗接引任务，或持有天剑宗令牌方可进入。",
    }),
    guide: Object.freeze({
      npcTemplateIds: Object.freeze(["npc-qixia-elder"]),
      radius: 560,
      title: "天剑宗接引人",
      dialogue: Object.freeze([
        "我奉天剑宗之命，在山门外接引有缘修士。",
        "这枚天剑宗令牌赠予你。持令牌点击宗门建筑，便可进入山门。",
      ]),
      repeatDialogue: Object.freeze([
        "令牌既已交给你，天剑宗山门会为你开启。",
        "点击宗门建筑上方的“进入”即可入内。",
      ]),
    }),
    members: Object.freeze([
      Object.freeze({ name: "执剑长老", realm: "金丹期", role: "传功" }),
      Object.freeze({ name: "炼丹执事", realm: "筑基期", role: "丹房" }),
      Object.freeze({ name: "守山弟子", realm: "炼气后期", role: "接引" }),
    ]),
    features: Object.freeze([
      Object.freeze({ id: "alchemy", label: "炼丹房", seal: "丹", description: "炼制丹药、查看丹方与宗门丹炉。", enabled: true }),
      Object.freeze({ id: "retreat", label: "闭关室", seal: "修", description: "闭关修炼与突破境界的专用场所。", enabled: true }),
    ]),
    extensionFeatures: Object.freeze([
      Object.freeze({ id: "quests", label: "宗门任务", serviceId: "sect-quest-service" }),
      Object.freeze({ id: "members", label: "门人名录", serviceId: "sect-member-service" }),
      Object.freeze({ id: "shop", label: "宗门宝库", serviceId: "sect-shop-service" }),
      Object.freeze({ id: "transfer", label: "门派传送", serviceId: "sect-transfer-service" }),
    ]),
  }),
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getSectTemplates() {
  return clone(SECTS);
}

export function getSectTemplate(sectId) {
  const sect = SECTS.find((entry) => entry.id === sectId);
  return sect ? clone(sect) : null;
}
