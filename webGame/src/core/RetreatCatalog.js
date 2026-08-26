/**
 * 闭关学习配置。sourceBookId 对应背包中的秘籍，learnedItemId 对应学习后
 * 加入现有法术/功法系统的真实物品 ID。
 */
const STUDIES = Object.freeze([
  Object.freeze({
    id: "study-qingxin-jue", kind: "technique", name: "清心诀", seal: "心",
    sourceBookId: "book-qingxin-jue", learnedItemId: "technique-qingxin-jue",
    requiredMonths: 1, cultivationExp: 120, grade: "凡品", element: "无",
    description: "守心宁神，以一月闭关梳理经脉，领悟基础心法。",
  }),
  Object.freeze({
    id: "study-huoqiu", kind: "spell", name: "火球术", seal: "火",
    sourceBookId: "book-huoqiu-shu", learnedItemId: "technique-huoqiu",
    requiredMonths: 2, cultivationExp: 180, grade: "灵品", element: "火",
    description: "引火灵入体并铭刻术式，出关后可在法术系统中施展。",
  }),
]);

export const RETREAT_DURATIONS = Object.freeze([
  // Pixso 页面 2 使用 1 / 10 / 30 / 50 年四档。meditationSeconds 是玩家实际等待的
  // 压缩时间，studySeconds 是参悟秘籍遮罩的播放时间；两种流程都不会点击后瞬间结算。
  Object.freeze({ months: 12, years: 1, label: "1年", expMultiplier: 1, meditationSeconds: 12, meditationExp: 3600, studySeconds: 5 }),
  Object.freeze({ months: 120, years: 10, label: "10年", expMultiplier: 1.15, meditationSeconds: 24, meditationExp: 36000, studySeconds: 6 }),
  Object.freeze({ months: 360, years: 30, label: "30年", expMultiplier: 1.35, meditationSeconds: 40, meditationExp: 108000, studySeconds: 7 }),
  Object.freeze({ months: 600, years: 50, label: "50年", expMultiplier: 1.7, meditationSeconds: 60, meditationExp: 180000, studySeconds: 8 }),
]);

/**
 * Pixso 法术秘籍弹窗的稳定展示目录。只有带 studyId 的条目接入当前学习规则；
 * 其余条目保留境界门槛和素材接口，后续补齐真实物品时无需重做弹窗布局。
 */
const BOOK_PREVIEWS = Object.freeze({
  spell: Object.freeze([
    Object.freeze({ id: "preview-huoqiu", studyId: "study-huoqiu", name: "火球术", grade: "灵品", element: "火", requirement: "2月", artKey: "pixso-retreat-book-huoqiu" }),
    Object.freeze({ id: "preview-bengshan", name: "崩山拳意", grade: "凡品", element: "火", requirement: "1月", artKey: "pixso-retreat-book-bengshan", lockedMessage: "崩山拳意尚未接入秘籍与法术系统。" }),
    Object.freeze({ id: "preview-xuanbing", name: "玄冰碎玉手", grade: "仙品", element: "冰", requirement: "化神期", artKey: "pixso-retreat-book-xuanbing", lockedMessage: "达到化神期并获得对应秘籍后方可参悟。" }),
    Object.freeze({ id: "preview-fuhu", name: "伏虎金刚劲", grade: "地品", element: "土", requirement: "元婴期", artKey: "pixso-retreat-book-fuhu", lockedMessage: "达到元婴期并获得对应秘籍后方可参悟。" }),
    Object.freeze({ id: "preview-fentian", name: "焚天炎龙破", grade: "天品", element: "火", requirement: "金丹期", artKey: "pixso-retreat-book-fentian", lockedMessage: "达到金丹期并获得对应秘籍后方可参悟。" }),
    Object.freeze({ id: "preview-jiuxiao", name: "九霄神雷诀", grade: "仙品", element: "雷", requirement: "化神期", artKey: "pixso-retreat-book-jiuxiao", lockedMessage: "达到化神期并获得对应秘籍后方可参悟。" }),
  ]),
  technique: Object.freeze([
    Object.freeze({ id: "preview-qingxin", studyId: "study-qingxin-jue", name: "清心诀", grade: "凡品", element: "无", requirement: "1月", artKey: "pixso-retreat-book-bengshan" }),
  ]),
});

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getRetreatStudies() { return clone(STUDIES); }
export function getRetreatStudy(studyId) {
  const study = STUDIES.find((entry) => entry.id === studyId);
  return study ? clone(study) : null;
}
export function getRetreatDurations() { return clone(RETREAT_DURATIONS); }
export function getRetreatBookPreviews(kind = "spell") { return clone(BOOK_PREVIEWS[kind] || []); }
