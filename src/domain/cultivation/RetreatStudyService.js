import { getRetreatDurations, getRetreatStudies, getRetreatStudy } from "../../core/RetreatCatalog.js";

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finiteTime = (value) => Number.isFinite(Number(value)) ? Number(value) : Date.now();

/** 闭关学习领域服务：把秘籍学习结果接入现有法术、功法、修为和存档字段。 */
export class RetreatStudyService {
  constructor({
    player,
    world,
    inventoryService,
    itemCatalog,
    sectId = "sect:tianjian",
    save = () => true,
  }) {
    this.player = player;
    this.world = world;
    this.inventory = inventoryService;
    this.itemCatalog = itemCatalog;
    this.sectId = sectId;
    this.save = save;
    this.activeAttempt = null;
  }

  getState() {
    this.world.sectProgress = asRecord(this.world.sectProgress);
    const sect = asRecord(this.world.sectProgress[this.sectId]);
    const retreat = asRecord(sect.retreat);
    retreat.totalMonths = Math.max(0, Math.floor(Number(retreat.totalMonths) || 0));
    retreat.lastStudyId = typeof retreat.lastStudyId === "string" ? retreat.lastStudyId : "";
    retreat.bestMindScore = clamp(Math.floor(Number(retreat.bestMindScore) || 0), 0, 100);
    retreat.lastMindScore = clamp(Math.floor(Number(retreat.lastMindScore) || 0), 0, 100);
    retreat.lastMindGrade = typeof retreat.lastMindGrade === "string" ? retreat.lastMindGrade : "";
    sect.retreat = retreat;
    this.world.sectProgress[this.sectId] = sect;
    return retreat;
  }

  listDurations() { return getRetreatDurations(); }

  listStudies(kind = null) {
    const learned = new Set(Array.isArray(this.player.learnedTechniques) ? this.player.learnedTechniques : []);
    return getRetreatStudies()
      .filter((study) => !kind || study.kind === kind)
      .map((study) => ({
        ...study,
        sourceBook: this.itemCatalog.getById(study.sourceBookId),
        learnedItem: this.itemCatalog.getById(study.learnedItemId),
        owned: this.inventory.getQuantity(study.sourceBookId) > 0,
        learned: learned.has(study.learnedItemId),
      }));
  }

  validateAttempt(studyId, months, { practice = false } = {}) {
    const study = getRetreatStudy(studyId);
    if (!study) return { ok: false, message: "没有找到这份闭关法门。" };
    const duration = getRetreatDurations().find((entry) => entry.months === Number(months));
    if (!duration) return { ok: false, message: "闭关时长无效。" };
    if (duration.months < study.requiredMonths) {
      return { ok: false, message: `领悟${study.name}至少需要闭关${study.requiredMonths}个月。` };
    }
    if (!practice && this.inventory.getQuantity(study.sourceBookId) <= 0) {
      const book = this.itemCatalog.getById(study.sourceBookId);
      return { ok: false, message: `需要先获得《${book?.name || "对应秘籍"}》。` };
    }
    const learned = Array.isArray(this.player.learnedTechniques) ? this.player.learnedTechniques : [];
    if (!practice && learned.includes(study.learnedItemId)) {
      return { ok: false, alreadyLearned: true, message: `${study.name}已经铭刻于心。` };
    }
    return { ok: true, study, duration };
  }

  /** 开始真实闭关；此时不学习秘籍，必须等待心境小游戏完成。 */
  beginStudy(studyId, months) {
    if (this.activeAttempt) return { ok: false, message: "已有一次闭关正在进行。" };
    const validation = this.validateAttempt(studyId, months);
    if (!validation.ok) return validation;
    this.activeAttempt = { ...validation, mode: "minigame", practice: false, startedAt: Date.now() };
    return { ok: true, attempt: { ...this.activeAttempt }, message: "闭关开始，请依次完成调息、守心与铭法。" };
  }

  /** 不消耗时间、没有奖励的静心演练；已领悟或暂时缺书也可以重复练习。 */
  beginPractice(studyId, months) {
    if (this.activeAttempt) return { ok: false, message: "已有一次闭关正在进行。" };
    const validation = this.validateAttempt(studyId, months, { practice: true });
    if (!validation.ok) return validation;
    this.activeAttempt = { ...validation, mode: "practice", practice: true, startedAt: Date.now() };
    return { ok: true, attempt: { ...this.activeAttempt }, message: "静心演练开始，本次不消耗闭关时间，也不会获得修为或秘籍。" };
  }

  completeStudy(mindResult) {
    const attempt = this.activeAttempt;
    if (!attempt) return { ok: false, message: "当前没有正在进行的闭关。" };
    if (attempt.practice) return { ok: false, message: "演练结果不能结算真实闭关。" };
    if (attempt.mode === "timed") return { ok: false, message: "秘籍尚在参悟中，不能提前结算。" };
    return this.settleStudy(mindResult);
  }

  /**
   * Pixso 闭关室的定时参悟流程。界面只能推进计时，学习奖励仍由本领域服务结算；
   * 单次推进最多记 1 秒，切换标签页不会让秘籍瞬间学完。
   */
  beginTimedStudy(studyId, months, nowMs = Date.now()) {
    if (this.activeAttempt) return { ok: false, message: "已有一次闭关正在进行。" };
    const validation = this.validateAttempt(studyId, months);
    if (!validation.ok) return validation;
    const now = finiteTime(nowMs);
    const learningDurationMs = Math.max(1000, Math.round(Number(validation.duration.studySeconds) * 1000));
    this.activeAttempt = {
      ...validation,
      mode: "timed",
      practice: false,
      startedAt: now,
      lastTickAt: now,
      elapsedMs: 0,
      learningDurationMs,
    };
    return {
      ...this.buildTimedStudyStatus(),
      attempt: { ...this.activeAttempt },
      message: `开始参悟《${validation.study.name}》。`,
    };
  }

  buildTimedStudyStatus(attempt = this.activeAttempt) {
    if (!attempt || attempt.mode !== "timed") return null;
    const progress = clamp(attempt.elapsedMs / attempt.learningDurationMs, 0, 1);
    return {
      ok: true,
      active: progress < 1,
      completed: progress >= 1,
      progress,
      elapsedMs: attempt.elapsedMs,
      remainingMs: Math.max(0, attempt.learningDurationMs - attempt.elapsedMs),
      learningDurationMs: attempt.learningDurationMs,
      study: { ...attempt.study },
      duration: { ...attempt.duration },
    };
  }

  getActiveTimedStudy() { return this.buildTimedStudyStatus(); }

  advanceTimedStudy(nowMs = Date.now()) {
    const attempt = this.activeAttempt;
    if (!attempt || attempt.mode !== "timed") {
      return { ok: false, message: "当前没有正在进行的秘籍参悟。" };
    }
    const now = finiteTime(nowMs);
    const deltaMs = clamp(now - attempt.lastTickAt, 0, 1000);
    attempt.lastTickAt = Math.max(attempt.lastTickAt, now);
    attempt.elapsedMs = Math.min(attempt.learningDurationMs, attempt.elapsedMs + deltaMs);
    return this.buildTimedStudyStatus(attempt);
  }

  completeTimedStudy() {
    const attempt = this.activeAttempt;
    if (!attempt || attempt.mode !== "timed") {
      return { ok: false, message: "当前没有正在进行的秘籍参悟。" };
    }
    const status = this.buildTimedStudyStatus(attempt);
    if (!status.completed) return { ...status, ok: false, message: "秘籍尚未参悟完成。" };
    return this.settleStudy({
      ok: true,
      score: 100,
      grade: "澄明",
      expMultiplier: 1,
      forcedFailure: false,
    });
  }

  settleStudy(mindResult) {
    const attempt = this.activeAttempt;
    if (!mindResult?.ok) return { ok: false, message: "心境试炼结果无效，不能结算闭关。" };
    this.activeAttempt = null;
    const { study, duration } = attempt;
    const state = this.getState();
    state.totalMonths += duration.months;
    state.lastStudyId = study.id;
    state.lastMindScore = clamp(Math.round(Number(mindResult.score) || 0), 0, 100);
    state.bestMindScore = Math.max(state.bestMindScore, state.lastMindScore);
    state.lastMindGrade = String(mindResult.grade || "未知");

    const expMultiplier = clamp(Number(mindResult.expMultiplier) || 0.15, 0.1, 1.5);
    const gainedExp = Math.max(1, Math.round(study.cultivationExp * duration.expMultiplier * expMultiplier));
    this.player.cultivationExp = Math.max(0, Number(this.player.cultivationExp) || 0) + gainedExp;
    if (mindResult.forcedFailure) {
      this.save();
      return {
        ok: false,
        consumedTime: true,
        learned: false,
        study,
        duration,
        mindResult,
        gainedExp,
        message: `${mindResult.grade}心境，未能领悟${study.name}；静修所得修为 +${gainedExp}`,
      };
    }

    const learned = Array.isArray(this.player.learnedTechniques) ? this.player.learnedTechniques : [];
    learned.push(study.learnedItemId);
    this.player.learnedTechniques = learned;
    const studiedBooks = Array.isArray(this.player.studiedBooks) ? this.player.studiedBooks : [];
    if (!studiedBooks.includes(study.sourceBookId)) studiedBooks.push(study.sourceBookId);
    this.player.studiedBooks = studiedBooks;
    let grantResult = { ok: true };
    if (this.inventory.getQuantity(study.learnedItemId) <= 0) {
      grantResult = this.inventory.grant(study.learnedItemId, 1);
    } else {
      this.save();
    }
    return {
      ok: grantResult.ok,
      consumedTime: true,
      learned: grantResult.ok,
      study,
      duration,
      mindResult,
      gainedExp,
      learnedItem: this.itemCatalog.getById(study.learnedItemId),
      message: grantResult.ok ? `${mindResult.grade}心境，${study.name}已铭刻于心，修为 +${gainedExp}` : grantResult.message,
    };
  }

  completePractice(mindResult) {
    const attempt = this.activeAttempt;
    if (!attempt?.practice) return { ok: false, message: "当前没有正在进行的静心演练。" };
    if (!mindResult?.ok) return { ok: false, message: "心境试炼结果无效。" };
    this.activeAttempt = null;
    return {
      ok: true,
      practice: true,
      successful: !mindResult.forcedFailure,
      mindResult,
      study: attempt.study,
      duration: attempt.duration,
      message: mindResult.forcedFailure
        ? `演练结束：${mindResult.grade}心境，尚未达到领悟要求。本次没有消耗时间。`
        : `演练完成：${mindResult.grade}心境，心境评分 ${mindResult.score}。本次没有获得奖励。`,
    };
  }

  abortStudy() {
    if (!this.activeAttempt) return { ok: false, message: "当前没有正在进行的闭关。" };
    const attempt = this.activeAttempt;
    this.activeAttempt = null;
    return {
      ok: true,
      practice: attempt.practice,
      consumedTime: false,
      message: attempt.practice ? "已结束静心演练。" : "已提前出关，本次没有消耗闭关时间。",
    };
  }

  /** 防止旧界面绕过心境小游戏直接学习。 */
  study() {
    return { ok: false, message: "闭关领悟必须完成心境小游戏，不能直接结算。" };
  }
}
