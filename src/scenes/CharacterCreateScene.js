import {
  gameState,
  prepareNewCharacter,
  saveFirstChapterProgress
} from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { DEFAULT_PLAYER_PORTRAIT_ID, getPlayerPortrait, PLAYER_PORTRAITS } from "../core/PortraitCatalog.js";
import { CharacterCreationService, FIVE_ELEMENTS } from "../domain/character/CharacterCreationService.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";

/**
 * 角色创建场景。
 * 第一章仅实现性别、名字和五行 10 点分配；立绘从统一目录中选择并写入角色档案。
 */
export class CharacterCreateScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.CREATE);
  }

  init(data) {
    this.isCreatingNewCharacter = Boolean(data?.newCharacter);
    this.slotIndex = data?.slotIndex;
  }

  create() {
    configureFullHdScene(this);
    if (this.isCreatingNewCharacter) prepareNewCharacter(this.slotIndex);

    this.rootTexts = {};
    this.genderButtonBackgrounds = {};
    this.creationService = new CharacterCreationService({
      player: gameState.player,
      portraits: PLAYER_PORTRAITS,
      defaultPortraitId: DEFAULT_PLAYER_PORTRAIT_ID,
    });
    this.remainingPoints = this.creationService.getRemainingPoints();
    this.portraitSelectionIndex = Math.max(0, PLAYER_PORTRAITS.findIndex((portrait) => portrait.id === gameState.player.portraitId));

    this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);
    this.add.rectangle(960, 540, 1920, 1080, 0x07110f, 0.7);
    this.add.rectangle(960, 96, 1920, 192, 0x102522, 0.94);
    this.add.rectangle(960, 191, 1920, 2, 0xb9974f, 0.48);

    addText(this, 960, 66, "创建角色", 42, "#f7dc97", {
      fontStyle: "bold",
      stroke: "#1c1710",
      strokeThickness: 6
    }).setOrigin(0.5);
    addText(this, 960, 124, "第一章 · 栖霞村的古玉", 20, "#e9d5a0", {
      stroke: "#1c1710",
      strokeThickness: 4
    }).setOrigin(0.5);
    addText(this, 960, 156, "完成基础信息后，即可踏入修行之路", 15, "#b8ab85").setOrigin(0.5);

    this.createButton(168, 104, 238, "返回角色档案", () => {
      this.scene.start(SceneKeys.SLOT_SELECT);
    }, { height: 54, size: 19, accent: "secondary" });

    this.drawMainPanels();
    this.createPortraitArea();
    this.createIdentityArea();
    this.createRootsArea();
    this.createButton(1490, 925, 338, "踏入栖霞村", () => this.enterVillage(), {
      height: 66,
      size: 25,
      accent: "primary"
    });

    this.messageText = addText(this, 1260, 972, "", 16, "#f4d991", {
      stroke: "#1b160f",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(20);
    this.createPortraitPicker();
  }

  drawMainPanels() {
    this.add.rectangle(960, 602, 1710, 790, 0x151612, 0.9)
      .setStrokeStyle(2, 0xb9974f, 0.9).setDepth(1);
    this.add.rectangle(408, 602, 520, 730, 0x122621, 0.88)
      .setStrokeStyle(1, 0x806737, 0.9).setDepth(2);
    this.add.rectangle(1247, 602, 1130, 730, 0x1c1a15, 0.86)
      .setStrokeStyle(1, 0x806737, 0.9).setDepth(2);
    this.add.rectangle(692, 602, 2, 648, 0xb9974f, 0.62).setDepth(3);
    this.add.rectangle(1247, 509, 1010, 1, 0xb9974f, 0.42).setDepth(3);

    addText(this, 408, 273, "角色立绘", 26, "#f3d88d", {
      fontStyle: "bold", stroke: "#231b11", strokeThickness: 4
    }).setOrigin(0.5).setDepth(4);
    addText(this, 1247, 273, "修行者信息", 26, "#f3d88d", {
      fontStyle: "bold", stroke: "#231b11", strokeThickness: 4
    }).setOrigin(0.5).setDepth(4);
  }

  createPortraitArea() {
    this.portraitFrame = this.add.rectangle(408, 515, 384, 398, 0x0d1715, 0.92)
      .setStrokeStyle(2, 0xb9974f, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add.rectangle(408, 727, 350, 28, 0x312518, 0.92).setDepth(3);
    this.portraitTitle = addText(this, 408, 727, "初始散修立绘", 16, "#ead69d", {
      stroke: "#1b160f", strokeThickness: 3
    }).setOrigin(0.5).setDepth(5);
    this.drawPortraitPreview();
    this.portraitFrame.on("pointerdown", () => this.openPortraitPicker());
    this.portraitFrame.on("pointerover", () => this.portraitFrame.setStrokeStyle(3, 0xf0cf77, 1));
    this.portraitFrame.on("pointerout", () => this.portraitFrame.setStrokeStyle(2, 0xb9974f, 0.9));

    this.createButton(408, 784, 268, "选择立绘", () => this.openPortraitPicker(), {
      height: 52, size: 20, accent: "secondary"
    });
    addText(this, 408, 827, "点击立绘或按钮即可切换形象", 15, "#bdb08c").setOrigin(0.5).setDepth(4);
    addText(this, 408, 870, "所选立绘会同步生成地图头像", 15, "#8d9478").setOrigin(0.5).setDepth(4);
  }

  drawPortraitPreview() {
    this.portraitObjects?.forEach((object) => object.destroy());
    const portrait = getPlayerPortrait(gameState.player.portraitId);
    const source = this.textures.get(portrait.textureKey).getSourceImage();
    const scale = Math.min(332 / source.width, 370 / source.height);
    const backdrop = this.add.circle(408, 510, 158, 0x17352f, 0.8).setStrokeStyle(1, 0x806737, 0.75).setDepth(4);
    const image = this.add.image(408, 518, portrait.textureKey)
      .setDisplaySize(source.width * scale, source.height * scale)
      .setDepth(5);
    this.portraitObjects = [backdrop, image];
    this.portraitTitle?.setText(`${portrait.name} · ${portrait.gender}`);
  }

  /**
   * 立绘选择层采用“中间大、两侧小”的轮播排版。
   * 切换时只改预览索引；点击“确认形象”后才写入角色档案，避免玩家误点覆盖当前选择。
   */
  createPortraitPicker() {
    this.portraitPicker = this.add.container(0, 0).setDepth(100).setVisible(false);
    this.portraitPickerCards = this.add.container(0, 0);
    const cover = this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);
    const shade = this.add.rectangle(960, 540, 1920, 1080, 0x050807, 0.84);
    const topPlate = this.add.rectangle(960, 170, 760, 112, 0x14221e, 0.9)
      .setStrokeStyle(1, 0xb9974f, 0.72);
    const title = addText(this, 960, 147, "选择你的定形象", 34, "#f7dc97", {
      fontStyle: "bold", stroke: "#1d160e", strokeThickness: 5
    }).setOrigin(0.5);
    const subtitle = addText(this, 960, 190, "中间为当前选择 · 点击两侧立绘或箭头切换", 17, "#d4c79f")
      .setOrigin(0.5);
    this.pickerSelectedText = addText(this, 960, 828, "", 21, "#f5dda0", {
      fontStyle: "bold", stroke: "#1d160e", strokeThickness: 3
    }).setOrigin(0.5);
    this.portraitPicker.add([cover, shade, topPlate, title, subtitle, this.portraitPickerCards, this.pickerSelectedText]);

    this.createPickerButton(126, 108, 186, "返回创建", () => this.closePortraitPicker(), { size: 19 });
    this.createPickerButton(120, 535, 76, "‹", () => this.shiftPortraitSelection(-1), { size: 46, circle: true });
    this.createPickerButton(1800, 535, 76, "›", () => this.shiftPortraitSelection(1), { size: 46, circle: true });
    this.createPickerButton(960, 902, 270, "确认形象", () => this.confirmPortraitSelection(), {
      size: 25, primary: true
    });
    this.renderPortraitPicker();
  }

  createPickerButton(x, y, width, label, action, options = {}) {
    const height = options.circle ? width : 58;
    const background = this.add.rectangle(x, y, width, height, options.primary ? 0x765c31 : 0x33271b, 0.98)
      .setStrokeStyle(options.primary ? 2 : 1, options.primary ? 0xe1bf68 : 0xb9974f, 0.96)
      .setInteractive({ useHandCursor: true });
    if (options.circle) background.setStrokeStyle(2, 0xdab65f, 0.96);
    const text = addText(this, x, y - 2, label, options.size ?? 18, "#fff0bd", {
      fontStyle: "bold", stroke: "#21180f", strokeThickness: 3
    }).setOrigin(0.5);
    background.on("pointerdown", () => {
      playUiClickSound(this);
      action();
    });
    background.on("pointerover", () => {
      background.setFillStyle(options.primary ? 0x96763e : 0x563d25);
      text.setScale(1.06);
    });
    background.on("pointerout", () => {
      background.setFillStyle(options.primary ? 0x765c31 : 0x33271b);
      text.setScale(1);
    });
    this.portraitPicker.add([background, text]);
  }

  renderPortraitPicker() {
    this.portraitPickerCards.removeAll(true);
    const layout = [
      { x: 300, y: 555, width: 184, height: 298, scale: 0.78, offset: -2 },
      { x: 602, y: 525, width: 236, height: 382, scale: 0.9, offset: -1 },
      { x: 960, y: 495, width: 308, height: 500, scale: 1, offset: 0 },
      { x: 1318, y: 525, width: 236, height: 382, scale: 0.9, offset: 1 },
      { x: 1620, y: 555, width: 184, height: 298, scale: 0.78, offset: 2 },
    ];
    const count = PLAYER_PORTRAITS.length;
    layout.forEach((slot) => {
      const index = (this.portraitSelectionIndex + slot.offset + count) % count;
      const portrait = PLAYER_PORTRAITS[index];
      const selected = slot.offset === 0;
      const frame = this.add.rectangle(slot.x, slot.y, slot.width, slot.height, 0x10110f, selected ? 0.98 : 0.92)
        .setStrokeStyle(selected ? 3 : 1, selected ? 0xf0cf77 : 0xa58042, selected ? 1 : 0.75)
        .setInteractive({ useHandCursor: true });
      const source = this.textures.get(portrait.textureKey).getSourceImage();
      const scale = Math.min((slot.width - 24) / source.width, (slot.height - 20) / source.height) * slot.scale;
      const image = this.add.image(slot.x, slot.y + (selected ? 12 : 8), portrait.textureKey)
        .setDisplaySize(source.width * scale, source.height * scale)
        .setAlpha(selected ? 1 : 0.78);
      const namePlate = this.add.rectangle(slot.x, slot.y + slot.height / 2 - 24, slot.width - 16, 32, 0x211a12, 0.88);
      const label = addText(this, slot.x, slot.y + slot.height / 2 - 24, portrait.name, selected ? 19 : 15, selected ? "#f8df9d" : "#d2c29c", {
        fontStyle: "bold", stroke: "#17120e", strokeThickness: 3
      }).setOrigin(0.5);
      frame.on("pointerdown", () => {
        this.portraitSelectionIndex = index;
        this.renderPortraitPicker();
      });
      frame.on("pointerover", () => frame.setStrokeStyle(selected ? 3 : 2, 0xf0cf77, 1));
      frame.on("pointerout", () => frame.setStrokeStyle(selected ? 3 : 1, selected ? 0xf0cf77 : 0xa58042, selected ? 1 : 0.75));
      this.portraitPickerCards.add([frame, image, namePlate, label]);
    });
    const selected = PLAYER_PORTRAITS[this.portraitSelectionIndex];
    this.pickerSelectedText.setText(`当前选择 · ${selected.name}（${selected.gender}）`);
  }

  openPortraitPicker() {
    this.portraitSelectionIndex = Math.max(0, PLAYER_PORTRAITS.findIndex((portrait) => portrait.id === gameState.player.portraitId));
    this.renderPortraitPicker();
    this.portraitPicker.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.portraitPicker, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  closePortraitPicker() {
    this.tweens.add({
      targets: this.portraitPicker,
      alpha: 0,
      duration: 130,
      ease: "Sine.In",
      onComplete: () => this.portraitPicker.setVisible(false).setAlpha(1),
    });
  }

  shiftPortraitSelection(delta) {
    this.portraitSelectionIndex = (this.portraitSelectionIndex + delta + PLAYER_PORTRAITS.length) % PLAYER_PORTRAITS.length;
    this.renderPortraitPicker();
  }

  confirmPortraitSelection() {
    const portrait = PLAYER_PORTRAITS[this.portraitSelectionIndex];
    const result = this.creationService.selectPortrait(portrait.id);
    if (!result.ok) return;
    this.refreshGenderSelection();
    this.drawPortraitPreview();
    this.closePortraitPicker();
    this.showMessage(`已选择「${portrait.name}」，地图头像将同步更新。`);
  }

  createIdentityArea() {
    addText(this, 770, 327, "道号", 19, "#c9b57f").setOrigin(0, 0.5).setDepth(4);
    this.nameText = addText(this, 865, 327, gameState.player.name, 25, "#fff1c9", {
      fontStyle: "bold", stroke: "#261d12", strokeThickness: 4
    }).setOrigin(0, 0.5).setDepth(4);
    this.createButton(1418, 327, 206, "修改名字", () => this.askName(), {
      height: 48, size: 18, accent: "secondary"
    });

    addText(this, 770, 399, "性别", 19, "#c9b57f").setOrigin(0, 0.5).setDepth(4);
    this.genderStatus = addText(this, 865, 399, "当前：", 18, "#bdb08c").setOrigin(0, 0.5).setDepth(4);
    this.createGenderButton("男", 1112);
    this.createGenderButton("女", 1292);
    this.refreshGenderSelection();

    addText(this, 770, 458, "初始资质", 19, "#c9b57f").setOrigin(0, 0.5).setDepth(4);
    addText(this, 865, 458, "将由最高灵根属性决定", 18, "#bdb08c").setOrigin(0, 0.5).setDepth(4);
  }

  createGenderButton(gender, x) {
    const background = this.add.rectangle(x, 399, 154, 48, 0x312518, 0.98)
      .setStrokeStyle(1, 0x947643, 0.95).setInteractive({ useHandCursor: true }).setDepth(4);
    const label = addText(this, x, 399, gender === "男" ? "男性" : "女性", 18, "#e9d9ad", {
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    background.on("pointerdown", () => {
      playUiClickSound(this);
      this.setGender(gender);
    });
    background.on("pointerover", () => background.setScale(1.03));
    background.on("pointerout", () => background.setScale(1));
    this.genderButtonBackgrounds[gender] = { background, label };
  }

  refreshGenderSelection() {
    const selected = gameState.player.gender;
    this.genderStatus.setText(`当前：${selected}`);
    Object.entries(this.genderButtonBackgrounds).forEach(([gender, control]) => {
      const active = gender === selected;
      control.background.setFillStyle(active ? 0x796033 : 0x312518, active ? 1 : 0.98);
      control.background.setStrokeStyle(active ? 2 : 1, active ? 0xe1bd61 : 0x947643, 0.98);
      control.label.setColor(active ? "#fff0bc" : "#c9bb96");
    });
  }

  createRootsArea() {
    addText(this, 770, 536, "五行灵根", 25, "#f3d88d", {
      fontStyle: "bold", stroke: "#231b11", strokeThickness: 4
    }).setOrigin(0, 0.5).setDepth(4);
    addText(this, 770, 567, "分配 10 点灵根潜能，确定你的初始修行方向", 16, "#bdb08c")
      .setOrigin(0, 0.5).setDepth(4);
    this.add.rectangle(1576, 544, 228, 58, 0x251f18, 0.98)
      .setStrokeStyle(1, 0x806737, 0.95).setDepth(4);
    addText(this, 1576, 528, "剩余可分配点", 14, "#bdb08c").setOrigin(0.5).setDepth(5);
    this.remainingText = addText(this, 1576, 554, `${this.remainingPoints} / 10`, 22, "#f5d98d", {
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    FIVE_ELEMENTS.forEach((element, index) => this.createRootRow(element, 620 + index * 54));
    this.skillTip = addText(this, 770, 890, "初始技能：将根据最高灵根属性决定", 17, "#d4c594", {
      stroke: "#1b160f", strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(4);
  }

  createRootRow(element, y) {
    const rootColors = { 金: 0xd5b25b, 木: 0x77a964, 水: 0x6ba6c3, 火: 0xc36a51, 土: 0xb4885d };
    const color = rootColors[element] ?? 0xb9974f;
    this.add.rectangle(1190, y, 834, 46, 0x141411, 0.68).setDepth(3);
    this.add.circle(814, y, 17, color, 0.2).setStrokeStyle(1, color, 0.92).setDepth(4);
    addText(this, 814, y, element, 18, "#f5e2ac", { fontStyle: "bold" }).setOrigin(0.5).setDepth(5);
    addText(this, 850, y, `${element}灵根`, 18, "#e7d8b0").setOrigin(0, 0.5).setDepth(5);
    const value = addText(this, 1300, y, String(gameState.player.roots[element]), 22, "#fff0c2", { fontStyle: "bold" })
      .setOrigin(0.5).setDepth(5);
    this.rootTexts[element] = value;
    this.createStepButton(1410, y, "−", () => this.changeRoot(element, -1));
    this.createStepButton(1490, y, "+", () => this.changeRoot(element, 1));
  }

  createStepButton(x, y, label, callback) {
    const button = this.add.rectangle(x, y, 54, 38, 0x35291b, 0.98)
      .setStrokeStyle(1, 0xb9974f, 0.95).setInteractive({ useHandCursor: true }).setDepth(4);
    const text = addText(this, x, y - 1, label, 25, "#f3d88d", { fontStyle: "bold" })
      .setOrigin(0.5).setDepth(5);
    button.on("pointerdown", () => {
      playUiClickSound(this);
      callback();
    });
    button.on("pointerover", () => {
      button.setFillStyle(0x71552d);
      text.setScale(1.08);
    });
    button.on("pointerout", () => {
      button.setFillStyle(0x35291b);
      text.setScale(1);
    });
  }

  createButton(x, y, width, label, callback, options = {}) {
    const height = options.height ?? 52;
    const isPrimary = options.accent === "primary";
    const fill = isPrimary ? 0x6f5127 : 0x36271b;
    const hover = isPrimary ? 0x92703b : 0x503923;
    const button = this.add.rectangle(x, y, width, height, fill, 0.98)
      .setStrokeStyle(isPrimary ? 2 : 1, isPrimary ? 0xdab65f : 0xb9974f, 0.95)
      .setInteractive({ useHandCursor: true }).setDepth(8);
    const text = addText(this, x, y - 1, label, options.size ?? 18, "#fff0bd", {
      fontStyle: "bold", stroke: "#221910", strokeThickness: 3
    }).setOrigin(0.5).setDepth(9);
    button.on("pointerdown", () => {
      playUiClickSound(this);
      callback();
    });
    button.on("pointerover", () => {
      button.setFillStyle(hover);
      text.setScale(1.03);
    });
    button.on("pointerout", () => {
      button.setFillStyle(fill);
      text.setScale(1);
    });
    return button;
  }

  askName() {
    const name = window.prompt("请输入角色名字（最多 8 个字）", gameState.player.name);
    if (name === null) return;
    const result = this.creationService.setName(name);
    if (!result.ok) return this.showMessage("道号不能为空。");
    this.nameText.setText(result.name);
    this.showMessage("道号已更新。");
  }

  setGender(gender) {
    const result = this.creationService.setGender(gender);
    if (!result.ok) return;
    this.refreshGenderSelection();
    this.drawPortraitPreview();
  }

  changeRoot(element, delta) {
    const result = this.creationService.changeRoot(element, delta);
    if (!result.ok && result.reason === "no-points") {
      this.showMessage("灵根潜能已全部分配。");
      return;
    }
    if (!result.ok) return;
    this.remainingPoints = result.remaining;
    this.rootTexts[element].setText(String(result.value));
    this.remainingText.setText(`${this.remainingPoints} / 10`);
    this.skillTip.setText(`初始技能：${this.getSkillName()}`);
  }

  getSkillName() {
    const preview = this.creationService.getSkillPreview();
    return `将根据最高灵根属性「${preview.element}」学习 ${preview.skillName}`;
  }

  enterVillage() {
    const result = this.creationService.confirm();
    if (!result.ok) {
      const remaining = Math.max(0, result.remaining);
      this.showMessage(remaining > 0 ? `还需分配 ${remaining} 点灵根潜能。` : "灵根点数不符合创建规则。");
      return;
    }
    saveFirstChapterProgress();
    this.scene.start(SceneKeys.VILLAGE);
  }

  showMessage(message) {
    this.messageText.setText(message);
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.tweens.add({ targets: this.messageText, alpha: 0, delay: 1800, duration: 500 });
  }
}
