import { getBreakthroughTrialForRealm } from "./BreakthroughTrialCatalog.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positiveModulo = (value, modulo) => ((value % modulo) + modulo) % modulo;
const circularDistance = (left, right) => Math.abs(positiveModulo(left - right + 0.5, 1) - 0.5);

const safeRandom = (random) => clamp(number(random?.(), 0.5), 0, 0.999999);

const buildOutcome = (attempt) => {
  const score = attempt.results.reduce((sum, entry) => sum + entry.score, 0);
  return {
    ok: true,
    finished: true,
    trialId: attempt.trial.id,
    title: attempt.trial.title,
    type: attempt.trial.type,
    score,
    maxScore: attempt.trial.rounds * 2,
    requiredScore: attempt.trial.passScore,
    success: score >= attempt.trial.passScore,
    results: attempt.results.map((entry) => ({ ...entry })),
  };
};

/**
 * “灵息凝旋”纯规则服务。
 *
 * UI 只把当前转盘位置（0～1）和时间差传入；命中宽度、评分、超时与成败都在这里，
 * 所以未来换画面或接入手柄时不会改变突破数值规则。
 */
export class BreakthroughTrialService {
  getTrialForPlayer(player) {
    return getBreakthroughTrialForRealm(player?.realm);
  }

  createTrial(player, { random = Math.random } = {}) {
    const trial = this.getTrialForPlayer(player);
    if (!trial) return { ok: false, message: "当前大境界的突破试炼尚未设计。" };
    if (trial.type !== "timing-ring") {
      return { ok: false, message: `${trial.title}正在布置中，暂不可发起突破。`, trial };
    }
    const targets = Array.from({ length: trial.rounds }, () => 0.08 + safeRandom(random) * 0.84);
    return {
      ok: true,
      trial: { ...trial },
      roundIndex: 0,
      roundElapsedMs: 0,
      targets,
      results: [],
      finished: false,
    };
  }

  getCurrentRound(attempt) {
    if (!attempt?.ok || attempt.finished || !attempt.trial) return null;
    const index = Math.max(0, Math.floor(number(attempt.roundIndex)));
    if (index >= attempt.trial.rounds) return null;
    return {
      index,
      target: attempt.targets[index],
      elapsedMs: clamp(number(attempt.roundElapsedMs), 0, attempt.trial.roundDurationMs),
      remainingMs: Math.max(0, attempt.trial.roundDurationMs - number(attempt.roundElapsedMs)),
    };
  }

  recordHit(attempt, position) {
    const round = this.getCurrentRound(attempt);
    if (!round) return { ok: false, message: "本次突破试炼已经结束。" };
    const normalizedPosition = positiveModulo(number(position), 1);
    const distance = circularDistance(normalizedPosition, round.target);
    const score = distance <= attempt.trial.perfectWindow ? 2 : distance <= attempt.trial.goodWindow ? 1 : 0;
    const quality = score === 2 ? "完美" : score === 1 ? "命中" : "偏离";
    attempt.results.push({ round: round.index + 1, score, quality, distance });
    attempt.roundIndex += 1;
    attempt.roundElapsedMs = 0;
    if (attempt.roundIndex >= attempt.trial.rounds) {
      attempt.finished = true;
      return { ...buildOutcome(attempt), hit: { score, quality, distance } };
    }
    return { ok: true, hit: { score, quality, distance }, nextRound: this.getCurrentRound(attempt) };
  }

  advanceTrial(attempt, deltaMs) {
    if (!attempt?.ok || attempt.finished) return attempt?.finished ? buildOutcome(attempt) : { ok: false, message: "没有进行中的突破试炼。" };
    let remainingDelta = clamp(number(deltaMs), 0, 500);
    const timedOutRounds = [];
    while (remainingDelta > 0 && !attempt.finished) {
      const untilTimeout = Math.max(0, attempt.trial.roundDurationMs - attempt.roundElapsedMs);
      if (remainingDelta < untilTimeout) {
        attempt.roundElapsedMs += remainingDelta;
        remainingDelta = 0;
        break;
      }
      remainingDelta -= untilTimeout;
      const round = this.getCurrentRound(attempt);
      if (!round) break;
      timedOutRounds.push(round.index + 1);
      attempt.results.push({ round: round.index + 1, score: 0, quality: "错失", distance: null });
      attempt.roundIndex += 1;
      attempt.roundElapsedMs = 0;
      if (attempt.roundIndex >= attempt.trial.rounds) attempt.finished = true;
    }
    if (attempt.finished) return { ...buildOutcome(attempt), timedOutRounds };
    return { ok: true, timedOutRounds, round: this.getCurrentRound(attempt) };
  }
}
