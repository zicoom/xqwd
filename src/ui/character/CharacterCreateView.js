import { getPlayerPortrait } from "../../core/PortraitCatalog.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/character-create";
const COVER_PATH = "./public/assets/images/covers/xuanqiong-wendao-cover-2048.jpg";
const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"Microsoft YaHei", "Noto Sans SC", sans-serif';
const PORTRAIT_IMAGE_OFFSET_Y = 40;
const PORTRAIT_MASK_RADIUS = 174;

export const CHARACTER_CREATE_ASSETS = Object.freeze({
  cover: "xuanqiong-wendao-cover",
  panel: "pixso-character-create-panel",
  smallButton: "pixso-character-create-small-button",
  enterButton: "pixso-character-create-enter-button",
  genderSelected: "pixso-character-create-gender-selected",
  genderDefault: "pixso-character-create-gender-default",
  nameField: "pixso-character-create-name-field",
  remainingPoints: "pixso-character-create-remaining-points",
  stepButton: "pixso-character-create-step-button",
  portraitDisc: "pixso-character-create-portrait-disc",
  portraitNext: "pixso-character-create-portrait-next",
  portraitPrevious: "pixso-character-create-portrait-previous",
  sectionPlaque: "pixso-character-create-section-plaque",
  portraitButton: "pixso-character-create-portrait-button",
  rootMetal: "pixso-character-create-root-metal",
  rootWood: "pixso-character-create-root-wood",
  rootWater: "pixso-character-create-root-water",
  rootFire: "pixso-character-create-root-fire",
  rootEarth: "pixso-character-create-root-earth",
});

const ROOT_TEXTURES = Object.freeze({
  金: CHARACTER_CREATE_ASSETS.rootMetal,
  木: CHARACTER_CREATE_ASSETS.rootWood,
  水: CHARACTER_CREATE_ASSETS.rootWater,
  火: CHARACTER_CREATE_ASSETS.rootFire,
  土: CHARACTER_CREATE_ASSETS.rootEarth,
});

const LAYOUT = Object.freeze({
  panel: Object.freeze({ x: 960, y: 563.15, width: 1701, height: 821 }),
  back: Object.freeze({ x: 170, y: 76, width: 253, height: 55 }),
  leftTitle: Object.freeze({ x: 502.58, y: 247.81 }),
  rightTitle: Object.freeze({ x: 1280.31, y: 247.81 }),
  portrait: Object.freeze({ x: 502.58, y: 503.87, width: 360, height: 361 }),
  previous: Object.freeze({ x: 270, y: 503.87, width: 50, height: 65 }),
  next: Object.freeze({ x: 735, y: 503.87, width: 50, height: 65 }),
  portraitButton: Object.freeze({ x: 502.58, y: 769.43, width: 324, height: 90 }),
  enterButton: Object.freeze({ x: 1280.31, y: 909.18, width: 432, height: 93 }),
  rootCenters: Object.freeze([1014.31, 1144.31, 1274.31, 1404.31, 1534.31]),
});

export function preloadCharacterCreateAssets(scene) {
  scene.load.image(CHARACTER_CREATE_ASSETS.cover, COVER_PATH);
  scene.load.image(CHARACTER_CREATE_ASSETS.panel, `${ASSET_ROOT}/creation-panel.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.smallButton, `${ASSET_ROOT}/button-small.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.enterButton, `${ASSET_ROOT}/button-enter.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.genderSelected, `${ASSET_ROOT}/gender-selected.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.genderDefault, `${ASSET_ROOT}/gender-default.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.nameField, `${ASSET_ROOT}/name-field.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.remainingPoints, `${ASSET_ROOT}/remaining-points.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.stepButton, `${ASSET_ROOT}/step-button.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.portraitDisc, `${ASSET_ROOT}/portrait-disc.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.portraitNext, `${ASSET_ROOT}/portrait-next.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.portraitPrevious, `${ASSET_ROOT}/portrait-previous.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.sectionPlaque, `${ASSET_ROOT}/section-plaque.png`);
  scene.load.image(CHARACTER_CREATE_ASSETS.portraitButton, `${ASSET_ROOT}/button-portrait.png`);
  Object.entries(ROOT_TEXTURES).forEach(([element, textureKey]) => {
    scene.load.image(textureKey, `${ASSET_ROOT}/root-${({ 金: "metal", 木: "wood", 水: "water", 火: "fire", 土: "earth" })[element]}.png`);
  });
}

/**
 * Pixso“改版 / 创建角色”的纯 UI 视图。
 *
 * 这里只绘制素材、维护选中态并转发输入；名字校验、性别与立绘同步、灵根点数和
 * 最终创建规则仍由 CharacterCreationService 负责。
 */
export class CharacterCreateView {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0);
    this.rootControls = {};
    this.genderControls = {};
    this.selectedElement = "金";
  }

  render(state, callbacks = {}) {
    this.callbacks = callbacks;
    this.addImage(960, 540, CHARACTER_CREATE_ASSETS.cover, 1920, 1080);
    this.root.add(this.scene.add.rectangle(960, 540, 1920, 1080, 0x04110f, 0.61));
    this.addImage(
      LAYOUT.panel.x,
      LAYOUT.panel.y,
      CHARACTER_CREATE_ASSETS.panel,
      LAYOUT.panel.width,
      LAYOUT.panel.height,
    );

    this.createImageButton({
      ...LAYOUT.back,
      texture: CHARACTER_CREATE_ASSETS.enterButton,
      label: "返回角色档案",
      fontSize: 19,
      fontFamily: UI_FONT,
      textColor: "#6b471f",
      hoverTextColor: "#3f2913",
      strokeColor: "#f7e3b5",
      strokeThickness: 1,
      onClick: callbacks.onBack,
    });
    this.createSectionTitle(LAYOUT.leftTitle.x, LAYOUT.leftTitle.y, "角色立绘");
    this.createSectionTitle(LAYOUT.rightTitle.x, LAYOUT.rightTitle.y, "修行者信息");
    this.createPortraitArea(callbacks);
    this.createIdentityArea(callbacks);
    this.createRootsArea(callbacks);
    this.createImageButton({
      ...LAYOUT.enterButton,
      texture: CHARACTER_CREATE_ASSETS.enterButton,
      label: "踏入栖霞村",
      fontSize: 26,
      fontFamily: UI_FONT,
      textColor: "#6b471f",
      hoverTextColor: "#3f2913",
      strokeColor: "#f7e3b5",
      strokeThickness: 1,
      onClick: callbacks.onEnter,
    });

    this.messageText = this.addCenteredText(1280.31, 838, "", 15, "#9a4b2d", {
      fontFamily: UI_FONT,
      stroke: "#f2dfb2",
      strokeThickness: 1,
    }).setDepth(20);
    this.update(state);
    this.root.setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 200, ease: "Sine.Out" });
    return this;
  }

  createSectionTitle(x, y, label) {
    this.addImage(x, y, CHARACTER_CREATE_ASSETS.sectionPlaque, 308, 52);
    this.addCenteredText(x, y - 1, label, 22, "#eae3bc", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      stroke: "#090806",
      strokeThickness: 1,
    });
  }

  createPortraitArea(callbacks) {
    const portrait = LAYOUT.portrait;
    this.addImage(portrait.x, portrait.y, CHARACTER_CREATE_ASSETS.portraitDisc, portrait.width, portrait.height);
    this.portraitImage = this.scene.add.image(
      portrait.x,
      portrait.y + PORTRAIT_IMAGE_OFFSET_Y,
      "player-portrait-cultivator-female",
    );
    this.root.add(this.portraitImage);

    // 圆形遮罩贴合相框的真实内沿；立绘本身只做统一的向下平移，保留完整人物比例。
    this.portraitMaskShape = this.scene.make.graphics({ add: false });
    this.portraitMaskShape
      .fillStyle(0xffffff, 1)
      .fillCircle(portrait.x, portrait.y, PORTRAIT_MASK_RADIUS);
    this.portraitMask = this.portraitMaskShape.createGeometryMask();
    this.portraitImage.setMask(this.portraitMask);

    this.portraitName = this.addCenteredText(portrait.x, 703, "", 19, "#49311f", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });

    this.createIconButton(LAYOUT.previous, CHARACTER_CREATE_ASSETS.portraitPrevious, callbacks.onPreviousPortrait);
    this.createIconButton(LAYOUT.next, CHARACTER_CREATE_ASSETS.portraitNext, callbacks.onNextPortrait);
    this.createImageButton({
      ...LAYOUT.portraitButton,
      texture: CHARACTER_CREATE_ASSETS.portraitButton,
      label: "选择立绘",
      fontSize: 25,
      fontFamily: UI_FONT,
      strokeThickness: 1,
      onClick: callbacks.onPortraitPicker,
    });
    this.addCenteredText(portrait.x, 839, "点击立绘或左右箭头即可切换形象", 16, "#514331", {
      fontFamily: UI_FONT,
      strokeThickness: 0,
    });
    this.addCenteredText(portrait.x, 869, "所选立绘会同步生成地图头像", 16, "#66553e", {
      fontFamily: UI_FONT,
      strokeThickness: 0,
    });

    const portraitHitArea = this.scene.add.zone(portrait.x, portrait.y, 330, 350)
      .setInteractive({ useHandCursor: true });
    portraitHitArea.on("pointerdown", () => {
      playUiClickSound(this.scene);
      callbacks.onPortraitPicker?.();
    });
    this.root.add(portraitHitArea);
  }

  createIdentityArea(callbacks) {
    this.addLeftText(1000, 339, "道号", 19, "#503820", { fontStyle: "bold" });
    this.nameFieldImage = this.addImage(1200, 339, CHARACTER_CREATE_ASSETS.nameField, 262, 51)
      .setInteractive({ useHandCursor: true });
    this.nameText = this.addCenteredText(1200, 338, "", 22, "#f4dfb1", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });
    this.createImageButton({
      x: 1450,
      y: 339,
      width: 186,
      height: 52,
      texture: CHARACTER_CREATE_ASSETS.smallButton,
      label: "修改名字",
      fontSize: 18,
      fontFamily: UI_FONT,
      strokeThickness: 1,
      onClick: () => this.startNameEditing(true),
    });
    this.nameFieldImage.on("pointerover", () => this.nameFieldImage.setTint(0xffe3a0));
    this.nameFieldImage.on("pointerout", () => this.nameFieldImage.clearTint());
    this.nameFieldImage.on("pointerdown", () => {
      playUiClickSound(this.scene);
      this.startNameEditing(false);
    });
    this.createHiddenNameInput(callbacks);

    this.addLeftText(1000, 421, "性别", 19, "#503820", { fontStyle: "bold" });
    this.createGenderButton("男", 1130, 421, callbacks.onGender);
    this.createGenderButton("女", 1275, 421, callbacks.onGender);
  }

  createGenderButton(gender, x, y, onGender) {
    const image = this.addImage(x, y, CHARACTER_CREATE_ASSETS.genderDefault, 117, 51)
      .setInteractive({ useHandCursor: true });
    const label = this.addCenteredText(x, y - 1, gender === "男" ? "男性" : "女性", 18, "#e4d1a6", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      stroke: "#25170f",
      strokeThickness: 1,
    });
    image.on("pointerover", () => image.setTint(0xffe7a8));
    image.on("pointerout", () => image.clearTint());
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onGender?.(gender);
    });
    this.genderControls[gender] = { image, label };
  }

  createRootsArea(callbacks) {
    this.addLeftText(908, 510, "五行灵根", 24, "#75501f", {
      fontFamily: TITLE_FONT,
      fontStyle: "bold",
      stroke: "#ead8aa",
      strokeThickness: 1,
    });
    this.addLeftText(908, 542, "分配 10 点灵根潜能，确定你的初始修行方向", 16, "#5f4b35");
    this.selectedRootText = this.addCenteredText(1400, 524, "当前：金灵根", 18, "#5b3d26", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });
    this.addImage(1560, 524, CHARACTER_CREATE_ASSETS.remainingPoints, 192, 76);
    this.addCenteredText(1560, 511, "剩余可分配点", 14, "#5d432b", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });
    this.remainingText = this.addCenteredText(1560, 536, "10 / 10", 21, "#6a451b", {
      fontFamily: TITLE_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });

    Object.entries(ROOT_TEXTURES).forEach(([element, texture], index) => {
      this.createRootControl(element, texture, LAYOUT.rootCenters[index], 662, callbacks.onSelectRoot);
    });

    this.createStepButton(1232, 789, "−", () => callbacks.onStepRoot?.(-1));
    this.createStepButton(1317, 789, "+", () => callbacks.onStepRoot?.(1));
    this.skillTip = this.addCenteredText(1280, 838, "初始技能：", 17, "#5b4934", {
      fontFamily: UI_FONT,
      strokeThickness: 0,
    });
  }

  createRootControl(element, texture, x, y, onSelectRoot) {
    const image = this.addImage(x, y, texture, 73, 74).setInteractive({ useHandCursor: true });
    const label = this.addCenteredText(x, y - 1, element, 22, "#f2dda5", {
      fontFamily: TITLE_FONT,
      fontStyle: "bold",
      stroke: "#4b2d12",
      strokeThickness: 2,
    });
    const value = this.addCenteredText(x, y + 62, "0", 22, "#50371f", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });
    const hitArea = this.scene.add.zone(x, y + 22, 104, 134).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => image.setTint(0xffffc8));
    hitArea.on("pointerout", () => image.clearTint());
    hitArea.on("pointerdown", () => {
      playUiClickSound(this.scene);
      this.selectElement(element);
      onSelectRoot?.(element);
    });
    this.root.add(hitArea);
    this.rootControls[element] = { image, label, value };
  }

  createStepButton(x, y, label, onClick) {
    const image = this.addImage(x, y, CHARACTER_CREATE_ASSETS.stepButton, 75, 52)
      .setInteractive({ useHandCursor: true });
    const text = this.addCenteredText(x, y - 2, label, 27, "#f0d28d", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      stroke: "#25170f",
      strokeThickness: 1,
    });
    image.on("pointerover", () => {
      image.setTint(0xffdb83);
      text.setScale(1.08);
    });
    image.on("pointerout", () => {
      image.clearTint();
      text.setScale(1);
    });
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
  }

  createIconButton(layout, texture, onClick) {
    const image = this.addImage(layout.x, layout.y, texture, layout.width, layout.height)
      .setInteractive({ useHandCursor: true });
    image.on("pointerover", () => image.setTint(0xffe6a2).setScale(1.06));
    image.on("pointerout", () => image.clearTint().setScale(1));
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
    return image;
  }

  createImageButton({
    x,
    y,
    width,
    height,
    texture,
    label,
    fontSize,
    fontFamily = TITLE_FONT,
    textColor = "#f1d796",
    hoverTextColor = "#fff0bd",
    strokeColor = "#2b190e",
    strokeThickness = 2,
    onClick,
  }) {
    const image = this.addImage(x, y, texture, width, height).setInteractive({ useHandCursor: true });
    const labelOffset = texture === CHARACTER_CREATE_ASSETS.portraitButton ? -2 : 0;
    const text = this.addCenteredText(x, y + labelOffset, label, fontSize, textColor, {
      fontFamily,
      fontStyle: "bold",
      stroke: strokeColor,
      strokeThickness,
    });
    image.on("pointerover", () => {
      image.setTint(0xffe39a);
      text.setColor(hoverTextColor);
    });
    image.on("pointerout", () => {
      image.clearTint();
      text.setColor(textColor);
    });
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
    return image;
  }

  update(state = {}) {
    this.currentName = state.name || "无名散修";
    if (!this.isNameEditing) {
      this.nameText?.setText(this.currentName);
      if (this.nameInput) this.nameInput.value = this.currentName;
    }
    Object.entries(this.genderControls).forEach(([gender, control]) => {
      const active = gender === state.gender;
      control.image.setTexture(active ? CHARACTER_CREATE_ASSETS.genderSelected : CHARACTER_CREATE_ASSETS.genderDefault);
      control.image.setDisplaySize(active ? 122 : 117, active ? 55 : 51);
      control.label.setColor(active ? "#fff0bd" : "#d4c29b");
    });

    const portrait = getPlayerPortrait(state.portraitId);
    if (portrait && this.scene.textures.exists(portrait.textureKey)) {
      const source = this.scene.textures.get(portrait.textureKey).getSourceImage();
      const scale = Math.min(282 / source.width, 326 / source.height);
      this.portraitImage
        .setTexture(portrait.textureKey)
        .setDisplaySize(source.width * scale, source.height * scale)
        .setPosition(LAYOUT.portrait.x, LAYOUT.portrait.y + PORTRAIT_IMAGE_OFFSET_Y);
      this.portraitName.setText(`${portrait.name} · ${portrait.gender}`);
    }

    Object.entries(this.rootControls).forEach(([element, control]) => {
      control.value.setText(String(state.roots?.[element] ?? 0));
    });
    this.remainingText?.setText(`${state.remaining ?? 10} / 10`);
    this.skillTip?.setText(state.skillPreview
      ? `初始技能：最高灵根「${state.skillPreview.element}」将学习 ${state.skillPreview.skillName}`
      : "初始技能：将根据最高灵根属性决定");
    this.selectElement(state.selectedElement || this.selectedElement || "金");
  }

  selectElement(element) {
    if (!this.rootControls[element]) return;
    this.selectedElement = element;
    Object.entries(this.rootControls).forEach(([name, control]) => {
      const active = name === element;
      control.image.setScale(active ? 1.12 : 1);
      control.label.setScale(active ? 1.08 : 1);
      control.value.setColor(active ? "#9a5d16" : "#654529");
    });
    this.selectedRootText?.setText(`当前：${element}灵根`);
  }

  createHiddenNameInput(callbacks) {
    if (typeof document === "undefined") return;
    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.autocomplete = "off";
    this.nameInput.spellcheck = false;
    this.nameInput.setAttribute("aria-label", "角色道号");
    Object.assign(this.nameInput.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(this.nameInput);

    this.nameInput.addEventListener("compositionstart", () => {
      this.isNameComposing = true;
    });
    this.nameInput.addEventListener("compositionend", () => {
      this.isNameComposing = false;
      this.applyNameInput(callbacks);
    });
    this.nameInput.addEventListener("input", () => {
      if (this.isNameComposing) {
        this.nameText.setText(`${this.nameInput.value || "请输入道号"}|`);
        return;
      }
      this.applyNameInput(callbacks);
    });
    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.finishNameEditing(true, callbacks);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.finishNameEditing(false, callbacks);
      }
    });
    this.nameInput.addEventListener("blur", () => {
      if (this.isNameEditing) this.finishNameEditing(true, callbacks);
    });
  }

  startNameEditing(selectAll) {
    if (!this.nameInput) return;
    if (!this.isNameEditing) this.nameBeforeEditing = this.currentName;
    this.isNameEditing = true;
    this.nameInput.value = this.currentName || "";
    this.nameInput.focus({ preventScroll: true });
    if (selectAll) this.nameInput.select();
    else this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);
    this.nameText.setText(`${this.nameInput.value || "请输入道号"}|`);
    this.nameFieldImage?.setTint(0xffe3a0);
  }

  applyNameInput(callbacks) {
    const rawValue = this.nameInput?.value ?? "";
    const result = callbacks.onNameInput?.(rawValue);
    if (result?.ok) {
      this.currentName = result.name;
      if (this.nameInput.value !== result.name) this.nameInput.value = result.name;
      this.nameText.setText(`${result.name}|`);
      return result;
    }
    this.nameText.setText(`${rawValue || "请输入道号"}|`);
    return result;
  }

  finishNameEditing(commit, callbacks) {
    if (!this.isNameEditing) return;
    const value = this.nameInput?.value ?? "";
    this.isNameEditing = false;
    this.isNameComposing = false;
    this.nameInput?.blur();
    this.nameFieldImage?.clearTint();
    if (commit) callbacks.onNameCommit?.(value);
    else callbacks.onNameCancel?.(this.nameBeforeEditing);
  }

  showMessage(message) {
    if (!this.messageText) return;
    this.skillTip?.setAlpha(0);
    this.messageText.setText(message);
    this.scene.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.scene.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: 1800,
      duration: 500,
      onComplete: () => this.skillTip?.setAlpha(1),
    });
  }

  addImage(x, y, texture, width, height) {
    const image = this.scene.add.image(x, y, texture).setDisplaySize(width, height);
    this.root.add(image);
    return image;
  }

  addCenteredText(x, y, value, size, color, extra = {}) {
    const text = addText(this.scene, x, y, value, size, color, extra).setOrigin(0.5);
    text.setResolution?.(2);
    this.root.add(text);
    return text;
  }

  addLeftText(x, y, value, size, color, extra = {}) {
    const text = addText(this.scene, x, y, value, size, color, {
      fontFamily: UI_FONT,
      strokeThickness: 0,
      ...extra,
    }).setOrigin(0, 0.5);
    text.setResolution?.(2);
    this.root.add(text);
    return text;
  }

  destroy() {
    this.nameInput?.remove();
    this.nameInput = null;
    this.portraitImage?.clearMask(true);
    this.portraitMaskShape?.destroy();
    this.portraitMask = null;
    this.portraitMaskShape = null;
    this.root?.destroy(true);
    this.root = null;
  }
}
