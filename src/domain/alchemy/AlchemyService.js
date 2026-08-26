import {
  getAlchemyFurnace,
  getAlchemyFurnaces,
  getAlchemyRecipe,
  getAlchemyRecipes,
} from "../../core/AlchemyCatalog.js";

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 炼丹领域服务：负责丹炉、丹方、材料扣除、成丹与存档，不依赖任何界面。 */
export class AlchemyService {
  constructor({
    player,
    world,
    inventoryService,
    itemCatalog,
    sectId = "sect:tianjian",
    save = () => true,
    random = Math.random,
  }) {
    this.player = player;
    this.world = world;
    this.inventory = inventoryService;
    this.itemCatalog = itemCatalog;
    this.sectId = sectId;
    this.save = save;
    this.random = random;
    this.activeAttempt = null;
  }

  getState() {
    this.world.sectProgress = asRecord(this.world.sectProgress);
    const sect = asRecord(this.world.sectProgress[this.sectId]);
    const alchemy = asRecord(sect.alchemy);
    alchemy.furnaceId = typeof alchemy.furnaceId === "string" ? alchemy.furnaceId : "";
    alchemy.refinementCount = Math.max(0, Math.floor(Number(alchemy.refinementCount) || 0));
    alchemy.successCount = Math.max(0, Math.floor(Number(alchemy.successCount) || 0));
    alchemy.bestControlScore = clamp(Math.floor(Number(alchemy.bestControlScore) || 0), 0, 100);
    alchemy.lastControlScore = clamp(Math.floor(Number(alchemy.lastControlScore) || 0), 0, 100);
    alchemy.lastControlGrade = typeof alchemy.lastControlGrade === "string" ? alchemy.lastControlGrade : "";
    sect.alchemy = alchemy;
    this.world.sectProgress[this.sectId] = sect;
    return alchemy;
  }

  getSelectedFurnace() { return getAlchemyFurnace(this.getState().furnaceId); }

  listFurnaces() {
    const selectedId = this.getState().furnaceId;
    return getAlchemyFurnaces().map((furnace) => ({ ...furnace, selected: furnace.id === selectedId }));
  }

  selectFurnace(furnaceId) {
    const furnace = getAlchemyFurnace(furnaceId);
    if (!furnace) return { ok: false, message: "没有找到这座丹炉。" };
    this.getState().furnaceId = furnace.id;
    this.save();
    return { ok: true, furnace, message: `已安置${furnace.name}` };
  }

  listRecipes() {
    const known = new Set(Array.isArray(this.player.knownRecipes) ? this.player.knownRecipes : []);
    return getAlchemyRecipes().map((recipe) => {
      const book = recipe.bookItemId ? this.itemCatalog.getById(recipe.bookItemId) : null;
      const result = this.itemCatalog.getById(recipe.resultItemId);
      const ingredients = recipe.ingredients.map((entry) => {
        const item = this.itemCatalog.getById(entry.itemId);
        const owned = this.inventory.getQuantity(entry.itemId);
        return { ...entry, item, owned, enough: owned >= entry.quantity };
      });
      return {
        ...recipe,
        book,
        result,
        ingredients,
        learned: known.has(recipe.id),
        canLearn: !recipe.bookItemId || this.inventory.getQuantity(recipe.bookItemId) > 0,
        canRefine: known.has(recipe.id) && ingredients.every((entry) => entry.enough),
      };
    });
  }

  learnRecipe(recipeId) {
    const recipe = getAlchemyRecipe(recipeId);
    if (!recipe) return { ok: false, message: "丹方不存在。" };
    const known = Array.isArray(this.player.knownRecipes) ? this.player.knownRecipes : [];
    if (known.includes(recipe.id)) return { ok: true, alreadyKnown: true, recipe, message: `已经掌握${recipe.name}` };
    if (recipe.bookItemId && this.inventory.getQuantity(recipe.bookItemId) <= 0) {
      const book = this.itemCatalog.getById(recipe.bookItemId);
      return { ok: false, message: `需要先获得《${book?.name || "对应丹方"}》。` };
    }
    known.push(recipe.id);
    this.player.knownRecipes = known;
    this.save();
    return { ok: true, recipe, message: `已学会${recipe.name}` };
  }

  /**
   * 开炉时只校验并扣除材料，不能直接产出丹药。
   * UI 必须完成控火小游戏，再把领域评分交给 completeRefinement 结算。
   */
  beginRefinement(recipeId) {
    if (this.activeAttempt) return { ok: false, message: "已有一炉丹药正在炼制。" };
    const furnace = this.getSelectedFurnace();
    if (!furnace) return { ok: false, message: "请先添加一座丹炉。" };
    const recipe = getAlchemyRecipe(recipeId);
    if (!recipe) return { ok: false, message: "丹方不存在。" };
    const known = new Set(Array.isArray(this.player.knownRecipes) ? this.player.knownRecipes : []);
    if (!known.has(recipe.id)) return { ok: false, message: "请先学习这份丹方。" };
    const missing = recipe.ingredients.filter((entry) => this.inventory.getQuantity(entry.itemId) < entry.quantity);
    if (missing.length) {
      const names = missing.map((entry) => this.itemCatalog.getById(entry.itemId)?.name || entry.itemId);
      return { ok: false, message: `药材不足：${names.join("、")}` };
    }

    recipe.ingredients.forEach((entry) => this.inventory.consume(entry.itemId, entry.quantity));
    const state = this.getState();
    state.refinementCount += 1;
    this.activeAttempt = {
      recipe,
      furnace,
      startedAt: Date.now(),
      // 基础成功率越低，小游戏安全温区越窄；难度只影响操作，不在 UI 中私自计算。
      difficulty: clamp((82 - recipe.baseSuccessRate) / 50, 0, 1),
    };
    this.save();
    return {
      ok: true,
      consumed: true,
      attempt: { ...this.activeAttempt },
      message: "药材已经入炉，请完成温炉、融药与凝丹。",
    };
  }

  /** 无材料消耗、无产出的控火演练，用于熟悉三阶段操作。 */
  beginPractice(recipeId) {
    if (this.activeAttempt) return { ok: false, message: "已有一炉丹药正在炼制。" };
    const furnace = this.getSelectedFurnace();
    if (!furnace) return { ok: false, message: "请先添加一座丹炉。" };
    const recipe = getAlchemyRecipe(recipeId);
    if (!recipe) return { ok: false, message: "丹方不存在。" };
    const known = new Set(Array.isArray(this.player.knownRecipes) ? this.player.knownRecipes : []);
    if (!known.has(recipe.id)) return { ok: false, message: "请先学习这份丹方。" };
    this.activeAttempt = {
      recipe,
      furnace,
      practice: true,
      startedAt: Date.now(),
      difficulty: clamp((82 - recipe.baseSuccessRate) / 50, 0, 1),
    };
    return { ok: true, consumed: false, attempt: { ...this.activeAttempt }, message: "控火演练开始，本次不消耗药材，也不会获得丹药。" };
  }

  completeRefinement(controlResult) {
    const attempt = this.activeAttempt;
    if (!attempt) return { ok: false, message: "当前没有正在炼制的丹药。" };
    if (attempt.practice) return { ok: false, message: "演练结果不能结算真实丹药。" };
    if (!controlResult?.ok) return { ok: false, message: "控火结果无效，不能结算成丹。" };
    this.activeAttempt = null;
    const { recipe, furnace } = attempt;
    const state = this.getState();
    state.lastControlScore = clamp(Math.round(Number(controlResult.score) || 0), 0, 100);
    state.bestControlScore = Math.max(state.bestControlScore, state.lastControlScore);
    state.lastControlGrade = String(controlResult.grade || "未知");

    const successRate = clamp(
      recipe.baseSuccessRate + furnace.successBonus + (Number(controlResult.successBonus) || 0),
      0,
      100,
    );
    const success = !controlResult.forcedFailure && this.random() * 100 < successRate;
    if (!success) {
      this.save();
      return {
        ok: false,
        consumed: true,
        controlResult,
        successRate,
        message: controlResult.forcedFailure
          ? `${controlResult.grade}火候，药性散尽，本次炼制失败。`
          : `${controlResult.grade}火候，但成丹时药性冲突，炼制失败。`,
      };
    }

    const totalYieldBonus = clamp(furnace.yieldBonus + (Number(controlResult.yieldBonus) || 0), 0, 100);
    const bonusQuantity = this.random() * 100 < totalYieldBonus ? 1 : 0;
    const quantity = recipe.resultQuantity + bonusQuantity;
    state.successCount += 1;
    const granted = this.inventory.grant(recipe.resultItemId, quantity);
    const result = this.itemCatalog.getById(recipe.resultItemId);
    return {
      ok: granted.ok,
      consumed: true,
      controlResult,
      successRate,
      totalYieldBonus,
      recipe,
      result,
      quantity,
      bonusQuantity,
      message: granted.ok
        ? `${controlResult.grade}火候，炼制成功！获得${result?.name || "丹药"} ×${quantity}`
        : granted.message,
    };
  }

  completePractice(controlResult) {
    const attempt = this.activeAttempt;
    if (!attempt?.practice) return { ok: false, message: "当前没有正在进行的控火演练。" };
    if (!controlResult?.ok) return { ok: false, message: "控火结果无效。" };
    this.activeAttempt = null;
    return {
      ok: true,
      practice: true,
      successful: !controlResult.forcedFailure,
      controlResult,
      message: controlResult.forcedFailure
        ? `演练结束：${controlResult.grade}火候。需要在凝丹阶段主动收诀。`
        : `演练完成：${controlResult.grade}火候，控火评分 ${controlResult.score}。本次未消耗药材。`,
    };
  }

  abortRefinement() {
    if (!this.activeAttempt) return { ok: false, message: "当前没有正在炼制的丹药。" };
    const attempt = this.activeAttempt;
    this.activeAttempt = null;
    if (attempt.practice) return { ok: true, consumed: false, attempt, message: "已结束控火演练，没有消耗药材。" };
    const state = this.getState();
    state.lastControlScore = 0;
    state.lastControlGrade = "放弃";
    this.save();
    return { ok: true, consumed: true, attempt, message: "已放弃本炉炼制，入炉药材无法取回。" };
  }

  /** 防止旧页面绕过控火玩法直接结算。 */
  refine() {
    return { ok: false, message: "炼丹必须完成控火小游戏，不能直接结算。" };
  }
}
