const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BASE_STAGES = Object.freeze([
  Object.freeze({
    id: "warm", label: "温炉", seal: "温", durationMs: 6000,
    targetMin: 36, targetMax: 54, heatRate: 24, coolRate: 9,
    instruction: "长按催火升温，松开后炉温会缓慢下降。",
  }),
  Object.freeze({
    id: "infuse", label: "融药", seal: "融", durationMs: 7000,
    targetMin: 60, targetMax: 76, heatRate: 20, coolRate: 13,
    instruction: "药力开始交融，使用短按让炉温稳定在药性区。",
  }),
  Object.freeze({
    id: "condense", label: "凝丹", seal: "凝", durationMs: 7000,
    targetMin: 43, targetMax: 59, heatRate: 17, coolRate: 17,
    instruction: "先稳住炉温，待凝丹诀亮起后主动收诀。",
  }),
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * 炼丹控火小游戏的纯规则层。
 * Phaser 只负责按键、计时与动画；温度变化、阶段推进、评分和加成都由这里计算。
 */
export class AlchemyMinigameService {
  createSession({ difficulty = 0 } = {}) {
    const normalizedDifficulty = clamp(Number(difficulty) || 0, 0, 1);
    const stages = BASE_STAGES.map((stage, index) => {
      // 高阶丹方会把安全温区收窄，但至少保留 10 点宽度，避免变成纯碰运气。
      const shrink = Math.round(normalizedDifficulty * (index + 2));
      return { ...clone(stage), targetMin: stage.targetMin + shrink, targetMax: stage.targetMax - shrink };
    });
    return {
      active: true,
      expired: false,
      temperature: 20,
      stageIndex: 0,
      stageElapsedMs: 0,
      totalElapsedMs: 0,
      targetMs: stages.map(() => 0),
      observedMs: stages.map(() => 0),
      stages,
      difficulty: normalizedDifficulty,
    };
  }

  getStage(session) {
    return session?.stages?.[session.stageIndex] || session?.stages?.at?.(-1) || null;
  }

  tick(session, { deltaMs, heating = false } = {}) {
    if (!session?.active || session.expired) return { session, stageChanged: false, expired: Boolean(session?.expired) };
    const delta = clamp(Number(deltaMs) || 0, 0, 250);
    const stage = this.getStage(session);
    if (!stage || delta <= 0) return { session, stageChanged: false, expired: false };

    const seconds = delta / 1000;
    const temperatureDelta = (heating ? stage.heatRate : -stage.coolRate) * seconds;
    session.temperature = clamp(session.temperature + temperatureDelta, 0, 100);
    session.stageElapsedMs += delta;
    session.totalElapsedMs += delta;
    session.observedMs[session.stageIndex] += delta;
    if (session.temperature >= stage.targetMin && session.temperature <= stage.targetMax) {
      session.targetMs[session.stageIndex] += delta;
    }

    let stageChanged = false;
    if (session.stageElapsedMs >= stage.durationMs) {
      if (session.stageIndex < session.stages.length - 1) {
        session.stageIndex += 1;
        session.stageElapsedMs = 0;
        stageChanged = true;
      } else {
        session.expired = true;
      }
    }
    return { session, stageChanged, expired: session.expired };
  }

  canCondense(session) {
    const stage = this.getStage(session);
    return Boolean(session?.active && !session.expired && stage?.id === "condense" && session.stageElapsedMs >= 3000);
  }

  getLiveAccuracy(session) {
    if (!session?.stages) return 0;
    const ratios = session.stages.map((_stage, index) => {
      const observed = Math.max(1, Number(session.observedMs[index]) || 0);
      return clamp((Number(session.targetMs[index]) || 0) / observed, 0, 1);
    });
    return Math.round((ratios[0] * 0.25 + ratios[1] * 0.35 + ratios[2] * 0.4) * 100);
  }

  finish(session, { manual = true } = {}) {
    if (!session?.active) return { ok: false, message: "本次控火已经结束。" };
    if (manual && !this.canCondense(session)) return { ok: false, message: "凝丹诀尚未稳定，请继续控火。" };
    const finalStage = session.stages.at(-1);
    const center = (finalStage.targetMin + finalStage.targetMax) / 2;
    const halfWidth = Math.max(1, (finalStage.targetMax - finalStage.targetMin) / 2);
    const finalControl = clamp(1 - Math.abs(session.temperature - center) / (halfWidth * 1.6), 0, 1);
    const liveAccuracy = this.getLiveAccuracy(session);
    const timeoutPenalty = manual ? 0 : 18;
    const score = clamp(Math.round(liveAccuracy * 0.8 + finalControl * 20 - timeoutPenalty), 0, 100);
    session.active = false;

    let grade = "炸炉";
    let successBonus = -100;
    let yieldBonus = 0;
    if (score >= 88) { grade = "天成"; successBonus = 18; yieldBonus = 35; }
    else if (score >= 72) { grade = "上品"; successBonus = 10; yieldBonus = 15; }
    else if (score >= 52) { grade = "稳定"; successBonus = 3; yieldBonus = 5; }
    else if (score >= 32) { grade = "勉强"; successBonus = -12; }

    const forcedFailure = !manual || score < 32;
    return {
      ok: true,
      manual,
      score,
      grade,
      successBonus,
      yieldBonus,
      forcedFailure,
      accuracy: liveAccuracy,
      finalTemperature: Math.round(session.temperature),
      stageRatios: session.stages.map((_stage, index) => Math.round(
        clamp((session.targetMs[index] || 0) / Math.max(1, session.observedMs[index] || 0), 0, 1) * 100,
      )),
      message: forcedFailure ? "未能及时收诀，炉中药性已经散尽。" : `控火评分 ${score}，${grade}火候。`,
    };
  }
}
