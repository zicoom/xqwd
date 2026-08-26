const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const FOCUS_ROUNDS = Object.freeze([
  Object.freeze({ target: "静", hint: "摒除躁念，只留静意", options: Object.freeze(["妄", "静", "躁"]), correctIndex: 1 }),
  Object.freeze({ target: "定", hint: "心神不移，方能入定", options: Object.freeze(["乱", "惧", "定"]), correctIndex: 2 }),
  Object.freeze({ target: "明", hint: "照见灵台，不受迷障", options: Object.freeze(["明", "迷", "执"]), correctIndex: 0 }),
  Object.freeze({ target: "真", hint: "褪去欲念，守住本真", options: Object.freeze(["欲", "真", "嗔"]), correctIndex: 1 }),
]);

const MEMORY_RUNES = Object.freeze(["心", "气", "神", "法"]);
const MEMORY_PATTERN = Object.freeze([0, 2, 1, 3, 2, 0]);

const STAGES = Object.freeze([
  Object.freeze({ id: "breath", label: "调息", seal: "息", durationMs: 12000, instruction: "呼吸环收拢到金色心环时点击吐纳，共完成三次。" }),
  Object.freeze({ id: "focus", label: "守心", seal: "定", durationMs: 15000, instruction: "依照心诀提示，从三道杂念中选出正确心念。" }),
  Object.freeze({ id: "inscribe", label: "铭法", seal: "铭", durationMs: 18000, instruction: "记住依次闪现的符文，然后按原顺序重新点出。" }),
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * 闭关心境小游戏规则。只负责计时、输入判定和评分，不依赖 Phaser、DOM 或存档。
 */
export class RetreatMinigameService {
  createSession({ months = 1 } = {}) {
    const normalizedMonths = [1, 3, 6, 12].includes(Number(months)) ? Number(months) : 1;
    const sequenceLength = normalizedMonths >= 12 ? 6 : normalizedMonths >= 6 ? 5 : normalizedMonths >= 3 ? 4 : 3;
    return {
      active: true,
      stages: clone(STAGES),
      stageIndex: 0,
      stageElapsedMs: 0,
      totalElapsedMs: 0,
      months: normalizedMonths,
      breath: { taps: [], cooldownMs: 0 },
      focus: { roundIndex: 0, answers: [] },
      memory: {
        runes: [...MEMORY_RUNES],
        sequence: MEMORY_PATTERN.slice(0, sequenceLength),
        answers: [],
        showDelayMs: 650,
        flashDurationMs: 820,
      },
      expired: false,
    };
  }

  getStage(session) { return session?.stages?.[session.stageIndex] || null; }

  getFocusRound(session) {
    return clone(FOCUS_ROUNDS[session?.focus?.roundIndex] || null);
  }

  getBreathPhase(session) {
    const cycle = (Math.max(0, Number(session?.stageElapsedMs) || 0) % 2400) / 2400;
    return cycle <= 0.5 ? cycle * 2 : (1 - cycle) * 2;
  }

  getMemoryShowDuration(session) {
    return session.memory.showDelayMs + session.memory.sequence.length * session.memory.flashDurationMs;
  }

  isMemoryInputReady(session) {
    return this.getStage(session)?.id === "inscribe" && session.stageElapsedMs >= this.getMemoryShowDuration(session);
  }

  getVisibleMemoryRune(session) {
    if (this.getStage(session)?.id !== "inscribe" || this.isMemoryInputReady(session)) return null;
    const elapsed = session.stageElapsedMs - session.memory.showDelayMs;
    if (elapsed < 0) return null;
    const index = Math.floor(elapsed / session.memory.flashDurationMs);
    if (index < 0 || index >= session.memory.sequence.length) return null;
    return session.memory.runes[session.memory.sequence[index]];
  }

  tick(session, { deltaMs = 50 } = {}) {
    if (!session?.active) return { ok: false, expired: Boolean(session?.expired), message: "本次闭关已经结束。" };
    const delta = clamp(Number(deltaMs) || 0, 0, 1000);
    session.stageElapsedMs += delta;
    session.totalElapsedMs += delta;
    session.breath.cooldownMs = Math.max(0, session.breath.cooldownMs - delta);
    const stage = this.getStage(session);
    if (session.stageElapsedMs < stage.durationMs) return { ok: true, stageChanged: false, expired: false };

    if (stage.id === "breath") return this.advanceStage(session);
    if (stage.id === "focus") {
      while (session.focus.answers.length < FOCUS_ROUNDS.length) session.focus.answers.push(false);
      return this.advanceStage(session);
    }
    session.expired = true;
    session.active = false;
    return { ok: true, stageChanged: false, expired: true };
  }

  tapBreath(session) {
    if (!session?.active || this.getStage(session)?.id !== "breath") return { ok: false, message: "当前不是调息阶段。" };
    if (session.breath.cooldownMs > 0) return { ok: false, message: "吐纳过急，请顺应下一次呼吸。" };
    const phase = this.getBreathPhase(session);
    const quality = clamp(1 - Math.abs(phase - 0.5) / 0.42, 0, 1);
    session.breath.taps.push(quality);
    session.breath.cooldownMs = 420;
    const complete = session.breath.taps.length >= 3;
    const transition = complete ? this.advanceStage(session) : { stageChanged: false };
    return {
      ok: true,
      quality: Math.round(quality * 100),
      count: session.breath.taps.length,
      complete,
      ...transition,
      message: quality >= 0.8 ? "气息相合。" : quality >= 0.45 ? "气息稍乱。" : "吐纳时机偏离心环。",
    };
  }

  chooseFocus(session, optionIndex) {
    if (!session?.active || this.getStage(session)?.id !== "focus") return { ok: false, message: "当前不是守心阶段。" };
    const round = FOCUS_ROUNDS[session.focus.roundIndex];
    if (!round) return { ok: false, message: "守心试炼已经完成。" };
    const correct = Number(optionIndex) === round.correctIndex;
    session.focus.answers.push(correct);
    session.focus.roundIndex += 1;
    const complete = session.focus.roundIndex >= FOCUS_ROUNDS.length;
    const transition = complete ? this.advanceStage(session) : { stageChanged: false };
    return { ok: true, correct, complete, ...transition, message: correct ? "心念澄明。" : "杂念扰心。" };
  }

  chooseMemoryRune(session, runeIndex) {
    if (!session?.active || this.getStage(session)?.id !== "inscribe") return { ok: false, message: "当前不是铭法阶段。" };
    if (!this.isMemoryInputReady(session)) return { ok: false, message: "符文仍在显现，请先记住顺序。" };
    const answerIndex = session.memory.answers.length;
    const expected = session.memory.sequence[answerIndex];
    const correct = Number(runeIndex) === expected;
    session.memory.answers.push(correct);
    const complete = session.memory.answers.length >= session.memory.sequence.length;
    return {
      ok: true,
      correct,
      complete,
      progress: session.memory.answers.length,
      expectedRune: session.memory.runes[expected],
      message: correct ? "符文铭刻成功。" : "符序出现偏差。",
    };
  }

  advanceStage(session) {
    if (session.stageIndex >= session.stages.length - 1) return { ok: true, stageChanged: false };
    session.stageIndex += 1;
    session.stageElapsedMs = 0;
    return { ok: true, stageChanged: true, stage: this.getStage(session) };
  }

  finish(session, { manual = true } = {}) {
    if (!session) return { ok: false, message: "闭关心境无效。" };
    if (manual && (this.getStage(session)?.id !== "inscribe" || session.memory.answers.length < session.memory.sequence.length)) {
      return { ok: false, message: "铭法尚未完成。" };
    }
    const breathAccuracy = session.breath.taps.reduce((sum, value) => sum + value, 0) / 3;
    const focusAccuracy = session.focus.answers.filter(Boolean).length / FOCUS_ROUNDS.length;
    const memoryAccuracy = session.memory.answers.filter(Boolean).length / session.memory.sequence.length;
    const score = clamp(Math.round(breathAccuracy * 30 + focusAccuracy * 35 + memoryAccuracy * 35), 0, 100);
    session.active = false;

    let grade = "走火";
    let expMultiplier = 0.15;
    if (score >= 88) { grade = "澄明"; expMultiplier = 1.35; }
    else if (score >= 72) { grade = "入定"; expMultiplier = 1.15; }
    else if (score >= 55) { grade = "凝神"; expMultiplier = 1; }
    else if (score >= 35) { grade = "心乱"; expMultiplier = 0.35; }

    const forcedFailure = !manual || score < 55;
    return {
      ok: true,
      manual,
      score,
      grade,
      expMultiplier,
      forcedFailure,
      breathAccuracy: Math.round(clamp(breathAccuracy, 0, 1) * 100),
      focusAccuracy: Math.round(clamp(focusAccuracy, 0, 1) * 100),
      memoryAccuracy: Math.round(clamp(memoryAccuracy, 0, 1) * 100),
      message: forcedFailure ? "心境未稳，本次未能领悟秘籍。" : `${grade}心境，秘籍已可铭刻于心。`,
    };
  }
}
