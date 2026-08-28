import {
  DEFAULT_CULTIVATION_EXP_TARGET,
  getCultivationProgress,
  getCultivationTarget,
  grantCultivationExp,
  isCultivationFull,
} from "../cultivation/CultivationProgressService.js";

const BASE_ROOTS = Object.freeze(["金", "木", "水", "火", "土"]);
const SPECIAL_ROOTS = Object.freeze(["风", "雷", "冰", "神", "魔"]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function itemName(catalog, itemId) {
  if (!itemId) return "未装备";
  return catalog?.getById?.(itemId)?.name || "未知功法";
}

// 保留原导出路径，避免已有 HUD、属性页和外部模块因为规则下沉而改动导入位置。
export {
  DEFAULT_CULTIVATION_EXP_TARGET,
  getCultivationProgress,
  getCultivationTarget,
  grantCultivationExp,
  isCultivationFull,
};

/**
 * 角色属性的只读查询服务。它把现有存档、功法、法术和法宝数据整合为 UI 可展示的资料，
 * 不在这里写入存档，也不虚构当前游戏尚不存在的年龄、门派等规则。
 */
export class CharacterProfileService {
  constructor({ player, catalog, spellService, techniqueService, artifactService }) {
    this.player = player || {};
    this.catalog = catalog;
    this.spellService = spellService;
    this.techniqueService = techniqueService;
    this.artifactService = artifactService;
  }

  getPrimaryRoots() {
    const roots = this.player.roots || {};
    const highest = Math.max(...BASE_ROOTS.map((element) => number(roots[element])));
    if (highest <= 0) return [this.player.selectedElement || "未定"];
    return BASE_ROOTS.filter((element) => number(roots[element]) === highest);
  }

  getProfile() {
    const loadout = this.techniqueService?.getLoadout?.() || {};
    const artifacts = this.artifactService?.getLoadout?.() || {};
    const roots = this.player.roots || {};
    const resistanceTypes = Array.isArray(this.player.resistanceTypes) ? this.player.resistanceTypes : [];
    const cultivationProgress = getCultivationProgress(this.player);
    return {
      identity: {
        name: this.player.name || "无名修士",
        gender: this.player.gender || "未定",
        realm: this.player.realm || "炼气·初期",
        primaryRoots: this.getPrimaryRoots(),
        spiritStones: number(this.player.spiritStones),
      },
      battle: {
        hp: number(this.player.hp), maxHp: Math.max(1, number(this.player.maxHp, 1)),
        qi: number(this.player.qi), maxQi: Math.max(1, number(this.player.maxQi, 1)),
        attack: number(this.player.attack), defense: number(this.player.defense),
        resistance: number(this.player.resistance), resistanceTypes,
      },
      cultivation: {
        ...cultivationProgress,
        roots: BASE_ROOTS.map((element) => ({ element, value: number(roots[element]) })),
        // 特殊灵根虽然开局通常为 0，也必须返回稳定数值，属性页才能用与五行灵根
        // 相同的组件展示。后续奇遇或血脉把数值写入 roots 后，界面会自动显示最新结果。
        specialRoots: SPECIAL_ROOTS.map((element) => ({
          element,
          value: number(roots[element]),
          state: number(roots[element]) > 0 ? "已觉醒" : "未觉醒",
        })),
      },
      loadout: {
        mainTechnique: itemName(this.catalog, loadout.main),
        speedTechnique: itemName(this.catalog, loadout.speed),
        spellCount: this.spellService?.listAvailable?.().length || 0,
        artifactCount: Object.values(artifacts).filter(Boolean).length,
        activeEffectCount: Array.isArray(this.player.activeItemEffects) ? this.player.activeItemEffects.length : 0,
      },
    };
  }
}
