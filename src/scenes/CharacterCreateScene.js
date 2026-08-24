import { FIVE_ELEMENTS, gameState, getHighestElement, prepareNewCharacter, saveFirstChapterProgress } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText, addTitle } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";

/**
 * 角色创建场景。
 * 第一章仅实现性别、名字和五行 10 点分配；外观素材会在后续资源编辑器阶段扩展。
 */
export class CharacterCreateScene extends Phaser.Scene {
  constructor() { super(SceneKeys.CREATE); }

  /** CoverScene 传入 newCharacter 时，表示玩家主动要创建一名新角色。 */
  init(data) {
    this.isCreatingNewCharacter = Boolean(data?.newCharacter);
    this.slotIndex = data?.slotIndex;
  }

  create() {
    configureFullHdScene(this);
    if (this.isCreatingNewCharacter) prepareNewCharacter(this.slotIndex);
    this.cameras.main.setBackgroundColor("#769384");
    this.remainingPoints = 10;
    this.rootTexts = {};
    addTitle(this, "玄穹问道", "第一章 · 栖霞村的古玉");
    // 返回不会保存正在填写的内容，避免玩家误创建不满意的角色。
    addButton(this, 158, 138, 225, "返回角色档案", () => this.scene.start(SceneKeys.SLOT_SELECT), { height: 63, size: 24 });

    // 左侧是简化的原创水墨人物轮廓，占位图可被未来正式立绘替换。
    this.add.circle(390, 578, 249, 0xe9dfbd, 0.35).setStrokeStyle(5, 0x544332);
    this.add.circle(390, 443, 78, 0xf2cfaf).setStrokeStyle(5, 0x4b392d);
    this.add.triangle(390, 633, 240, 930, 540, 930, 390, 503, 0x33566b).setStrokeStyle(5, 0x263742);
    this.portraitLabel = addText(this, 390, 938, "散修立绘（原型）", 27, "#263d3c", { origin: 0.5 });

    addText(this, 720, 218, "一、为角色取名", 38, "#fff0bd");
    this.nameText = addText(this, 720, 285, `姓名：${gameState.player.name}`, 35, "#ffffff");
    addButton(this, 1185, 285, 240, "输入名字", () => this.askName(), { height: 72, size: 29 });

    addText(this, 720, 375, "二、选择性别", 38, "#fff0bd");
    this.genderText = addText(this, 720, 443, "当前：男", 33, "#ffffff");
    addButton(this, 1035, 443, 150, "男性", () => this.setGender("男"), { height: 72, size: 29 });
    addButton(this, 1215, 443, 150, "女性", () => this.setGender("女"), { height: 72, size: 29 });

    addText(this, 720, 533, "三、分配 10 点五行灵根潜能", 38, "#fff0bd");
    this.remainingText = addText(this, 720, 593, "剩余可分配点：10", 33, "#f8e0a3");
    FIVE_ELEMENTS.forEach((element, index) => this.createRootRow(element, 668 + index * 78));

    this.skillTip = addText(this, 720, 923, "初始技能：将根据最高灵根属性决定", 29, "#dfe8ca");
    addButton(this, 1485, 983, 330, "踏入栖霞村", () => this.enterVillage(), { height: 87, size: 35 });
  }

  /** 通过浏览器原生输入框收集名字，输入后立即刷新场景文字。 */
  askName() {
    const value = window.prompt("请输入主角名字（最多 8 个字）", gameState.player.name);
    if (value && value.trim()) {
      gameState.player.name = value.trim().slice(0, 8);
      this.nameText.setText(`姓名：${gameState.player.name}`);
    }
  }

  setGender(gender) {
    gameState.player.gender = gender;
    this.genderText.setText(`当前：${gender}`);
    this.portraitLabel.setText(`${gender}性散修立绘（原型）`);
  }

  createRootRow(element, y) {
    addText(this, 750, y, `${element}灵根`, 32, "#fff7dc");
    this.rootTexts[element] = addText(this, 1035, y, "0", 35, "#ffffff", { origin: 0.5 });
    addButton(this, 1140, y, 66, "-", () => this.changeRoot(element, -1), { height: 51, size: 33 });
    addButton(this, 1230, y, 66, "+", () => this.changeRoot(element, 1), { height: 51, size: 33 });
  }

  changeRoot(element, delta) {
    const current = gameState.player.roots[element];
    if (delta > 0 && this.remainingPoints <= 0) return;
    if (delta < 0 && current <= 0) return;
    gameState.player.roots[element] += delta;
    this.remainingPoints -= delta;
    this.rootTexts[element].setText(String(gameState.player.roots[element]));
    this.remainingText.setText(`剩余可分配点：${this.remainingPoints}`);
    this.skillTip.setText(`初始技能：${getHighestElement()}系 · ${this.getSkillName(getHighestElement())}`);
  }

  getSkillName(element) {
    return { 金: "金刃术", 木: "青藤术", 水: "水箭术", 火: "火弹术", 土: "岩甲术" }[element];
  }

  enterVillage() {
    if (this.remainingPoints !== 0) {
      this.showMessage("请先把 10 点灵根潜能分配完。", "#ffdf9b");
      return;
    }
    gameState.player.selectedElement = getHighestElement();
    // 灵根越专注，第一章原型中的术法伤害略高，展示“单灵根流派更强”的规则。
    gameState.player.attack = 8 + gameState.player.roots[gameState.player.selectedElement];
    // 角色创建完成立即写入本地存档；下次刷新会跳过创建界面，直接进入栖霞村。
    saveFirstChapterProgress();
    this.scene.start(SceneKeys.VILLAGE);
  }

  showMessage(message, color) {
    const text = addText(this, 960, 998, message, 30, color, { origin: 0.5 });
    this.time.delayedCall(1800, () => text.destroy());
  }
}
