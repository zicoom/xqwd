/**
 * 炼丹配置只保存稳定 ID 和数值，不读取存档，也不依赖 Phaser。
 * 以后新增宗门丹炉或丹方时，只需扩充这里，炼丹领域服务和界面无需改结构。
 */
const FURNACES = Object.freeze([
  Object.freeze({
    id: "furnace-iron", name: "玄铁丹炉", grade: "凡品", seal: "铁",
    successBonus: 0, yieldBonus: 0, color: 0x8c8071,
    description: "宗门丹房的入门丹炉，炉火平稳，适合熟悉炼丹手法。",
  }),
  Object.freeze({
    id: "furnace-spirit-fire", name: "灵火丹炉", grade: "灵品", seal: "火",
    successBonus: 5, yieldBonus: 10, color: 0x4f9a78,
    description: "炉膛自聚灵火，小幅提高成丹稳定性与额外成丹机会。",
  }),
  Object.freeze({
    id: "furnace-mystic-ice", name: "玄冰丹炉", grade: "玄品", seal: "冰",
    successBonus: 10, yieldBonus: 20, color: 0x4f86bd,
    description: "以玄冰调和猛烈药性，适合多种灵草共同入炉。",
  }),
  Object.freeze({
    id: "furnace-earth-heart", name: "地心丹炉", grade: "地品", seal: "地",
    successBonus: 15, yieldBonus: 30, color: 0xa46a9d,
    description: "引地心灵火淬炼药液，火力厚重而持久。",
  }),
  Object.freeze({
    id: "furnace-nine-sun", name: "九阳神炉", grade: "天品", seal: "阳",
    successBonus: 20, yieldBonus: 50, color: 0xd19a39,
    description: "天剑宗珍藏丹炉，九阳轮转，能显著提升成丹品质。",
  }),
]);

const RECIPES = Object.freeze([
  Object.freeze({
    id: "recipe-low-qi", name: "回灵丹方", grade: "凡品", resultItemId: "pill-low-qi",
    resultQuantity: 1, baseSuccessRate: 82, bookItemId: null,
    ingredients: Object.freeze([
      Object.freeze({ itemId: "juqicao", quantity: 2 }),
      Object.freeze({ itemId: "qinglinghua", quantity: 1 }),
    ]),
    description: "天剑宗入门丹方，以聚气草为主药，炼成后可恢复少量灵气。",
  }),
  Object.freeze({
    id: "recipe-lianqi", name: "炼气丹方", grade: "凡品", resultItemId: "baixiangye",
    resultQuantity: 1, baseSuccessRate: 74, bookItemId: "book-juqi-danfang",
    ingredients: Object.freeze([
      Object.freeze({ itemId: "juqicao", quantity: 3 }),
      Object.freeze({ itemId: "qingmaiteng", quantity: 1 }),
    ]),
    description: "凝聚温和药力，辅助炼气期修士稳固气息与破阶。",
  }),
  Object.freeze({
    id: "recipe-foundation", name: "筑基丹方", grade: "灵品", resultItemId: "item-1787442336014-6631",
    resultQuantity: 1, baseSuccessRate: 62, bookItemId: "item-1787471589463-930106",
    ingredients: Object.freeze([
      Object.freeze({ itemId: "juqicao", quantity: 4 }),
      Object.freeze({ itemId: "linggugen", quantity: 1 }),
      Object.freeze({ itemId: "yuyazhi", quantity: 1 }),
    ]),
    description: "药力凝元归一，是炼气圆满修士冲击筑基的重要丹药。",
  }),
  Object.freeze({
    id: "recipe-golden-core", name: "结金丹方", grade: "玄品", resultItemId: "item-1787442379119-6104",
    resultQuantity: 1, baseSuccessRate: 48, bookItemId: "item-1787471363889-928409",
    ingredients: Object.freeze([
      Object.freeze({ itemId: "xingyingguo", quantity: 3 }),
      Object.freeze({ itemId: "ninglutai", quantity: 2 }),
      Object.freeze({ itemId: "chiyangshen", quantity: 1 }),
    ]),
    description: "调和阴阳药性，帮助筑基修士凝结金丹。",
  }),
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

export function getAlchemyFurnaces() { return clone(FURNACES); }
export function getAlchemyRecipes() { return clone(RECIPES); }
export function getAlchemyFurnace(furnaceId) {
  const furnace = FURNACES.find((entry) => entry.id === furnaceId);
  return furnace ? clone(furnace) : null;
}
export function getAlchemyRecipe(recipeId) {
  const recipe = RECIPES.find((entry) => entry.id === recipeId);
  return recipe ? clone(recipe) : null;
}
