/**
 * 修为经验的统一规则。
 *
 * 当前“炼气初期”的上限是 1000。未来突破系统完成后，只需要把角色的
 * `cultivationExpTarget` 改成新境界的目标值；战斗、丹药、闭关等来源都无需各自修改。
 */
export const DEFAULT_CULTIVATION_EXP_TARGET = 1000;

const toNonNegativeInteger = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

/** 读取当前境界要求的修为上限。 */
export function getCultivationTarget(player = {}) {
  return Math.max(1, toNonNegativeInteger(player.cultivationExpTarget, DEFAULT_CULTIVATION_EXP_TARGET));
}

/**
 * 读取已裁切的修为进度。即使旧存档曾经保存过超出上限的数值，界面也只显示当前境界可拥有的最大值。
 */
export function getCultivationProgress(player = {}) {
  const target = getCultivationTarget(player);
  const experience = Math.min(target, toNonNegativeInteger(player.cultivationExp));
  return { experience, target, isFull: experience >= target };
}

/** 修为是否已到当前境界瓶颈。 */
export function isCultivationFull(player = {}) {
  return getCultivationProgress(player).isFull;
}

/**
 * 为角色增加修为经验，并严格截断在当前境界上限。
 * 返回实际获得数量而非请求数量，调用者据此显示“已达上限，需要突破”的真实反馈。
 */
export function grantCultivationExp(player, amount = 0) {
  const current = getCultivationProgress(player);
  const requested = toNonNegativeInteger(amount);
  const gained = Math.min(requested, Math.max(0, current.target - current.experience));
  const experience = current.experience + gained;
  if (player && typeof player === "object") player.cultivationExp = experience;
  return {
    requested,
    gained,
    overflow: Math.max(0, requested - gained),
    experience,
    target: current.target,
    isFull: experience >= current.target,
    reachedCap: current.experience < current.target && experience >= current.target,
  };
}
