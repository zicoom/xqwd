import { getRetreatDurations } from "../../core/RetreatCatalog.js";

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteTime = (value) => Number.isFinite(Number(value)) ? Number(value) : Date.now();

/**
 * 普通清修领域服务。
 *
 * 与秘籍领悟不同，普通清修不学习法术或功法，只按真实经过的界面时间逐步增加修为。
 * UI 只负责定时调用 advanceMeditation；修为计算、提前出关和存档均由本服务处理。
 */
export class CultivationRetreatService {
  constructor({ player, world, sectId = "sect:tianjian", save = () => true }) {
    this.player = player;
    this.world = world;
    this.sectId = sectId;
    this.save = save;
    this.activeMeditation = null;
  }

  getState() {
    this.world.sectProgress = asRecord(this.world.sectProgress);
    const sect = asRecord(this.world.sectProgress[this.sectId]);
    const retreat = asRecord(sect.retreat);
    retreat.totalMonths = Math.max(0, Math.floor(Number(retreat.totalMonths) || 0));
    retreat.meditationSessions = Math.max(0, Math.floor(Number(retreat.meditationSessions) || 0));
    retreat.meditationCultivation = Math.max(0, Math.floor(Number(retreat.meditationCultivation) || 0));
    sect.retreat = retreat;
    this.world.sectProgress[this.sectId] = sect;
    return retreat;
  }

  listPlans() {
    return getRetreatDurations().map((duration) => ({
      ...duration,
      durationMs: Math.max(1000, Math.round(Number(duration.meditationSeconds) * 1000)),
      totalExp: Math.max(1, Math.round(Number(duration.meditationExp) || 1)),
    }));
  }

  getPlan(months) {
    return this.listPlans().find((entry) => entry.months === Number(months)) || null;
  }

  buildStatus(session = this.activeMeditation) {
    if (!session) return null;
    const progress = clamp(session.elapsedMs / session.plan.durationMs, 0, 1);
    return {
      ok: true,
      active: progress < 1,
      completed: progress >= 1,
      plan: { ...session.plan },
      progress,
      elapsedMs: session.elapsedMs,
      remainingMs: Math.max(0, session.plan.durationMs - session.elapsedMs),
      gainedExp: session.gainedExp,
      totalExp: session.plan.totalExp,
    };
  }

  getActiveMeditation() { return this.buildStatus(); }

  beginMeditation(months, nowMs = Date.now()) {
    if (this.activeMeditation) return { ok: false, message: "已经在清修闭关中。" };
    const plan = this.getPlan(months);
    if (!plan) return { ok: false, message: "闭关时长无效。" };
    // 开始行为显式建立闭关进度容器，旧档和空世界对象都能得到一致结构。
    this.getState();
    const now = finiteTime(nowMs);
    this.activeMeditation = {
      plan,
      elapsedMs: 0,
      gainedExp: 0,
      lastTickAt: now,
      lastSavedElapsedMs: 0,
    };
    return {
      ...this.buildStatus(),
      message: `开始清修闭关：${plan.label}，修为会随吐纳逐步增长。`,
    };
  }

  /**
   * 推进一次闭关。单次最多计算 1 秒，防止切到后台后靠系统卡顿瞬间跳完整段闭关。
   * 每经过约 1 秒保存一次，刷新页面最多只会损失不足 1 秒的尚未落盘进度。
   */
  advanceMeditation(nowMs = Date.now()) {
    const session = this.activeMeditation;
    if (!session) return { ok: false, message: "当前没有正在进行的清修闭关。" };
    const now = finiteTime(nowMs);
    const deltaMs = clamp(now - session.lastTickAt, 0, 1000);
    session.lastTickAt = Math.max(session.lastTickAt, now);
    session.elapsedMs = Math.min(session.plan.durationMs, session.elapsedMs + deltaMs);

    const progress = session.elapsedMs / session.plan.durationMs;
    const targetExp = Math.floor(session.plan.totalExp * progress);
    const gainedNow = Math.max(0, targetExp - session.gainedExp);
    if (gainedNow > 0) {
      this.player.cultivationExp = Math.max(0, Number(this.player.cultivationExp) || 0) + gainedNow;
      session.gainedExp += gainedNow;
    }

    const completed = session.elapsedMs >= session.plan.durationMs;
    if (completed) {
      const state = this.getState();
      state.totalMonths += session.plan.months;
      state.meditationSessions += 1;
      state.meditationCultivation += session.gainedExp;
      const status = this.buildStatus(session);
      this.activeMeditation = null;
      this.save();
      return {
        ...status,
        message: `闭关圆满，历时${session.plan.label}，修为 +${session.gainedExp}。`,
      };
    }

    if (session.elapsedMs - session.lastSavedElapsedMs >= 1000) {
      session.lastSavedElapsedMs = session.elapsedMs;
      this.save();
    }
    return { ...this.buildStatus(session), gainedNow };
  }

  abortMeditation() {
    const session = this.activeMeditation;
    if (!session) return { ok: false, message: "当前没有正在进行的清修闭关。" };
    const status = this.buildStatus(session);
    this.activeMeditation = null;
    this.save();
    return {
      ...status,
      active: false,
      aborted: true,
      message: session.gainedExp > 0
        ? `已提前出关，本次清修所得修为 +${session.gainedExp}。`
        : "已提前出关，入定时间太短，尚未获得修为。",
    };
  }
}
