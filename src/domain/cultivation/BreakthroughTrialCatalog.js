/**
 * 大境界突破试炼目录。
 *
 * 同一大境界内的小境界共用同一种核心玩法；进入新的大境界时必须切换玩法类型。
 * 本目录只声明规则和未来玩法方向，具体输入绘制属于 ui/，结算属于 domain/。
 */
export const BREAKTHROUGH_TRIALS = Object.freeze([
  Object.freeze({
    majorRealm: "炼气",
    id: "spirit-orbit",
    title: "灵息凝旋",
    type: "timing-ring",
    description: "在灵机穿过金色气穴时凝神，五次吐纳聚成一线。",
    rounds: 5,
    roundDurationMs: 2600,
    perfectWindow: 0.022,
    goodWindow: 0.075,
    passScore: 6,
    failureExpLossRatio: 0.1,
  }),
  Object.freeze({
    majorRealm: "筑基",
    id: "foundation-array",
    title: "地脉筑阵",
    type: "path-weaving",
    description: "按地脉流向连结阵眼，错误连接会令根基出现裂纹。",
    failureExpLossRatio: 0.15,
  }),
  Object.freeze({
    majorRealm: "金丹",
    id: "golden-core",
    title: "丹火淬核",
    type: "heat-control",
    description: "同时维持丹火、药液与灵压平衡，过热或过冷都会碎丹。",
    failureExpLossRatio: 0.2,
  }),
  Object.freeze({
    majorRealm: "元婴",
    id: "nascent-soul",
    title: "元神定魄",
    type: "memory-sequence",
    description: "记住神魂印记的显现顺序，在心魔干扰中重构元婴。",
    failureExpLossRatio: 0.25,
  }),
  Object.freeze({
    majorRealm: "化神",
    id: "spirit-rift",
    title: "破界问神",
    type: "directional-dodge",
    description: "驾驭神识穿越天劫裂隙，躲避雷痕并把握破界一瞬。",
    failureExpLossRatio: 0.3,
  }),
]);

const normalizeRealm = (value) => String(value || "").replace(/[·・]/g, "");

/** 根据“炼气初期 / 筑基后期”等完整境界读取对应大境界的试炼。 */
export function getBreakthroughTrialForRealm(realm) {
  const normalized = normalizeRealm(realm);
  return BREAKTHROUGH_TRIALS.find((entry) => normalized.startsWith(entry.majorRealm)) || null;
}
