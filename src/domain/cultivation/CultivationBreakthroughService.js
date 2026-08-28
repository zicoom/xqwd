import { getCultivationProgress } from "./CultivationProgressService.js";
import { getBreakthroughTrialForRealm } from "./BreakthroughTrialCatalog.js";

/**
 * 当前已开放的小境界突破表。
 *
 * 每次突破都会清空本阶段已经圆满的修为，并启用下一阶段的修为上限。
 * 突破小游戏会将结算结果传给本服务；角色境界、修为和失败惩罚仍必须在这里变更。
 */
export const CULTIVATION_REALM_STEPS = Object.freeze([
  Object.freeze({ realm: "炼气初期", nextRealm: "炼气中期", nextTarget: 1000 }),
  Object.freeze({ realm: "炼气中期", nextRealm: "炼气后期", nextTarget: 1000 }),
  Object.freeze({ realm: "炼气后期", nextRealm: "炼气大圆满", nextTarget: 1000 }),
  Object.freeze({ realm: "炼气大圆满", nextRealm: "筑基初期", nextTarget: 2000 }),
]);

const normalizeRealm = (value) => String(value || "炼气初期").replace(/[·・]/g, "");

/** 只读查询：供 UI 判断现在显示“开始闭关”还是“突破修为”。 */
export function getBreakthroughInfo(player = {}) {
  const realm = normalizeRealm(player.realm);
  const step = CULTIVATION_REALM_STEPS.find((entry) => entry.realm === realm) || null;
  const cultivation = getCultivationProgress(player);
  const trial = getBreakthroughTrialForRealm(realm);
  return {
    realm,
    cultivation,
    nextRealm: step?.nextRealm || null,
    nextTarget: step?.nextTarget || null,
    trial: trial ? { ...trial } : null,
    canBreakthrough: Boolean(step && cultivation.isFull),
    message: !step
      ? "当前境界的后续突破尚未开放。"
      : cultivation.isFull
        ? `${realm}修为已圆满，可以突破至${step.nextRealm}。`
        : `修为尚未圆满，还需 ${cultivation.target - cultivation.experience} 修为。`,
  };
}

/**
 * 小境界突破的最终结算入口。
 * 无论 UI 使用何种大境界小游戏，都必须传入对应试炼的已完成结果，避免按钮点击绕过玩法直接成功。
 */
export class CultivationBreakthroughService {
  constructor({ player, save = () => true }) {
    this.player = player || {};
    this.save = save;
  }

  getInfo() {
    return getBreakthroughInfo(this.player);
  }

  resolveTrial(trialResult) {
    const info = this.getInfo();
    if (!info.nextRealm) return { ok: false, ...info };
    if (!info.cultivation.isFull) return { ok: false, ...info };
    const score = Number(trialResult?.score);
    const requiredScore = Number(trialResult?.requiredScore);
    const completedTrial = trialResult?.finished
      && trialResult.trialId === info.trial?.id
      && Number.isFinite(score)
      && Number.isFinite(requiredScore)
      && requiredScore === info.trial?.passScore;
    if (!completedTrial) {
      return { ok: false, ...info, message: "突破试炼尚未完成，不能直接冲关。" };
    }

    if (score < requiredScore) {
      const lostExp = Math.max(1, Math.ceil(info.cultivation.target * (info.trial.failureExpLossRatio || 0.1)));
      this.player.cultivationExp = Math.max(0, info.cultivation.target - lostExp);
      const saved = this.save();
      return {
        ok: true,
        success: false,
        saved: saved !== false,
        lostExp,
        cultivationExp: this.player.cultivationExp,
        cultivationExpTarget: info.cultivation.target,
        message: `突破失败，灵息反噬，修为 -${lostExp}。重新积累至圆满后可再次冲关。`,
      };
    }

    const previousRealm = info.realm;
    this.player.realm = info.nextRealm;
    this.player.cultivationExp = 0;
    this.player.cultivationExpTarget = info.nextTarget;
    const saved = this.save();
    return {
      ok: true,
      success: true,
      saved: saved !== false,
      previousRealm,
      realm: info.nextRealm,
      cultivationExp: 0,
      cultivationExpTarget: info.nextTarget,
      message: `突破成功：${previousRealm} → ${info.nextRealm}。新的修为上限为 ${info.nextTarget}。`,
    };
  }
}
