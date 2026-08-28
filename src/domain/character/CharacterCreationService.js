export const FIVE_ELEMENTS = Object.freeze(["金", "木", "水", "火", "土"]);

const GENDERS = Object.freeze(["男", "女"]);
const ROOT_POINT_LIMIT = 10;
const NAME_LENGTH_LIMIT = 8;
const INITIAL_ATTACK = 8;
const ATTACK_PER_PRIMARY_ROOT = 2;
const INITIAL_SKILLS = Object.freeze({
  金: "金刃诀",
  木: "回春术",
  水: "清心诀",
  火: "火球术",
  土: "土甲术",
});

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizedName(value) {
  return Array.from(String(value ?? "").trim()).slice(0, NAME_LENGTH_LIMIT).join("");
}

/**
 * 角色创建领域服务。
 *
 * 只负责角色创建规则，不依赖 Phaser、DOM 或存档实现。场景负责把结果画出来，
 * 最终存档仍由上层在 confirm() 成功后执行。
 */
export class CharacterCreationService {
  constructor({ player, portraits = [], defaultPortraitId } = {}) {
    if (!player || typeof player !== "object") throw new TypeError("角色创建需要 player 数据");
    this.player = player;
    this.portraits = Array.isArray(portraits) ? portraits : [];
    this.player.roots ||= {};
    FIVE_ELEMENTS.forEach((element) => {
      this.player.roots[element] = nonNegativeInteger(this.player.roots[element]);
    });
    const currentPortrait = this.portraits.find((portrait) => portrait?.id === this.player.portraitId);
    const fallbackPortrait = this.portraits.find((portrait) => portrait?.id === defaultPortraitId)
      ?? this.portraits[0];
    const portrait = currentPortrait ?? fallbackPortrait;
    if (portrait) {
      this.player.portraitId = portrait.id;
      this.player.gender = portrait.gender;
    }
  }

  setName(value) {
    const name = normalizedName(value);
    if (!name) return { ok: false, reason: "empty-name" };
    this.player.name = name;
    return { ok: true, name };
  }

  selectPortrait(portraitId) {
    const portrait = this.portraits.find((item) => item?.id === portraitId);
    if (!portrait) return { ok: false, reason: "invalid-portrait" };
    this.player.portraitId = portrait.id;
    this.player.gender = portrait.gender;
    return { ok: true, portrait };
  }

  setGender(gender) {
    if (!GENDERS.includes(gender)) return { ok: false, reason: "invalid-gender" };
    this.player.gender = gender;
    const current = this.portraits.find((portrait) => portrait?.id === this.player.portraitId);
    if (current?.gender !== gender) {
      const matchingPortrait = this.portraits.find((portrait) => portrait?.gender === gender);
      if (matchingPortrait) this.player.portraitId = matchingPortrait.id;
    }
    return { ok: true, gender, portraitId: this.player.portraitId };
  }

  getAllocatedPoints() {
    return FIVE_ELEMENTS.reduce((total, element) => total + nonNegativeInteger(this.player.roots[element]), 0);
  }

  getRemainingPoints() {
    return Math.max(0, ROOT_POINT_LIMIT - this.getAllocatedPoints());
  }

  changeRoot(element, delta) {
    if (!FIVE_ELEMENTS.includes(element)) return { ok: false, reason: "invalid-element" };
    if (delta !== 1 && delta !== -1) return { ok: false, reason: "invalid-delta" };
    const current = nonNegativeInteger(this.player.roots[element]);
    if (delta > 0 && this.getRemainingPoints() <= 0) return { ok: false, reason: "no-points" };
    if (delta < 0 && current <= 0) return { ok: false, reason: "minimum-root" };
    const value = current + delta;
    this.player.roots[element] = value;
    return { ok: true, value, remaining: this.getRemainingPoints() };
  }

  getHighestElement() {
    return FIVE_ELEMENTS.reduce((best, element) => (
      nonNegativeInteger(this.player.roots[element]) > nonNegativeInteger(this.player.roots[best]) ? element : best
    ), FIVE_ELEMENTS[0]);
  }

  getSkillPreview() {
    const element = this.getHighestElement();
    return { element, skillName: INITIAL_SKILLS[element] };
  }

  confirm() {
    const allocated = this.getAllocatedPoints();
    if (allocated !== ROOT_POINT_LIMIT) {
      return {
        ok: false,
        reason: allocated < ROOT_POINT_LIMIT ? "unallocated-points" : "too-many-points",
        remaining: ROOT_POINT_LIMIT - allocated,
      };
    }
    const selectedElement = this.getHighestElement();
    const attack = INITIAL_ATTACK + this.player.roots[selectedElement] * ATTACK_PER_PRIMARY_ROOT;
    this.player.selectedElement = selectedElement;
    this.player.attack = attack;
    return { ok: true, selectedElement, attack };
  }
}
