import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/DisplayConfig.js";

/**
 * 玄穹问道的统一弹窗视觉规范。
 *
 * 这是所有“小型弹窗”的公共底座，例如：游戏设置、确认提示、奖励说明、
 * 功能尚未开放提示、任务接取确认等。以后不再在各个场景重复画深色背景、
 * 金色边框和按钮，只需要传入标题、正文与按钮配置即可。
 */
const DIALOG_THEME = Object.freeze({
  // 全屏遮罩使用接近墨绿的颜色，既能聚焦弹窗，又不会把水墨地图压成纯黑。
  overlay: 0x07100e,
  // 弹窗主体由深木色、内层木色和金色描边组成，保持仙侠器物的质感。
  panel: 0x21140d,
  panelInner: 0x2f1b11,
  border: 0xc89643,
  borderSoft: 0x704621,
  gold: "#f5d77f",
  text: "#eadcc3",
  mutedText: "#c5b394",
  // 四种按钮颜色对应明确语义：主操作、普通操作、工具操作、危险操作。
  primary: { fill: 0x2f654b, hover: 0x3d8060, border: 0x73aa80 },
  secondary: { fill: 0x344258, hover: 0x465a76, border: 0x6f84a4 },
  utility: { fill: 0x6d5525, hover: 0x8a6d31, border: 0xb79953 },
  danger: { fill: 0x673b40, hover: 0x824b51, border: 0xb56c68 },
});

// 弹窗不使用花体、艺术字或粗黑描边。统一采用系统自带的清晰中文无衬线字体，
// 即使游戏按屏幕比例缩放，文字也会保持干净、稳定和容易阅读。
const DIALOG_FONT_FAMILY = "Microsoft YaHei, SimHei, Noto Sans SC, sans-serif";

/**
 * 可复用的仙侠风格弹窗。
 *
 * 使用示例：
 * const dialog = new XianxiaDialog(this);
 * dialog.open({
 *   title: "游戏设置",
 *   subtitle: "全屏、存档与数据同步",
 *   buttons: [{ label: "关闭", variant: "danger", onClick: () => dialog.close() }],
 * });
 */
export class XianxiaDialog {
  constructor(scene) {
    // 保存创建它的 Phaser 场景；按钮回调仍由各自场景决定，公共类只管外观和交互。
    this.scene = scene;
    this.isOpen = false;
    this.options = null;
    this.container = null;
    this.overlay = null;
    this.inputBlocker = null;
    this.closeArea = null;
    this.actionAreas = [];
    this.noticeText = null;
  }

  /**
   * 打开一个标准弹窗。
   * @param {object} options 弹窗内容与行为配置，具体字段请看文件顶部的使用示例。
   * @returns {XianxiaDialog} 返回自己，方便外部保存引用并在以后关闭或修改提示文字。
   */
  open(options = {}) {
    // 已经打开时不重复创建两层遮罩，避免按钮点击被旧弹窗覆盖。
    if (this.isOpen) return this;

    // 统一以 1920×1080 的设计坐标制作；DisplayConfig 会负责不同屏幕的等比缩放。
    const width = options.width ?? 720;
    const height = options.height ?? 420;
    const centerX = options.x ?? SCREEN_WIDTH / 2;
    const centerY = options.y ?? SCREEN_HEIGHT / 2;
    const depth = options.depth ?? 2100;
    const closable = options.closable ?? true;
    this.options = { ...options, width, height, centerX, centerY, depth, closable };
    this.isOpen = true;

    // 遮罩和所有按钮点击区都不加入 Container：这样 Container 动画、缩放或浏览器缩放
    // 都不会改变实际点击坐标，解决此前“显示正常但点击失效”的问题。
    this.overlay = this.scene.add.rectangle(centerX, centerY, SCREEN_WIDTH, SCREEN_HEIGHT, DIALOG_THEME.overlay, options.overlayAlpha ?? 0.68)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0);
    this.inputBlocker = this.scene.add.zone(centerX, centerY, SCREEN_WIDTH, SCREEN_HEIGHT)
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setInteractive();
    // 空白处只吸收点击，不执行关闭，避免玩家误点导致重要确认弹窗意外消失。
    this.inputBlocker.on("pointerdown", () => {});

    this.container = this.scene.add.container(centerX, centerY)
      .setScrollFactor(0)
      .setDepth(depth + 2)
      .setScale(0.94)
      .setAlpha(0);

    // 面板外框、内框与四角纹样构成统一的“鎏金木匣”样式。
    const shell = this.scene.add.graphics();
    this.drawPanelShell(shell, width, height);

    // 标题下方绘制一条玉璧般的装饰分割线，所有弹窗因此拥有一致的视觉重心。
    const header = this.scene.add.graphics();
    const headerY = -height / 2 + 77;
    header.lineStyle(1, DIALOG_THEME.borderSoft, 0.9);
    header.lineBetween(-width / 2 + 54, headerY, width / 2 - 54, headerY);
    // 分割线只保留一个菱形，避免小圆点在缩小后被误看成标题文字的一部分。
    header.fillStyle(DIALOG_THEME.border, 0.95);
    header.fillRect(-3, headerY - 3, 6, 6);

    const title = this.createCenteredText(0, -height / 2 + 42, options.title ?? "提示", width - 150, options.titleSize ?? 31, DIALOG_THEME.gold, {
      // 标题不再套黑色描边；描边经过浏览器缩放后会造成用户截图中的重影/发糊。
      fontFamily: DIALOG_FONT_FAMILY,
      fontStyle: "normal",
      strokeThickness: 0,
      align: "center",
    });
    const subtitle = this.createCenteredText(0, -height / 2 + 103, options.subtitle ?? "", width - 104, options.subtitleSize ?? 14, DIALOG_THEME.mutedText, {
      fontFamily: DIALOG_FONT_FAMILY,
      strokeThickness: 0,
      align: "center",
      wordWrap: { width: width - 104 },
    });
    this.container.add([shell, header, title, subtitle]);

    // 正文是可选的：设置类弹窗通常不需要，确认和说明弹窗则可直接传一段文字。
    if (options.body) {
      const body = this.createCenteredText(0, options.bodyY ?? -20, options.body, width - 118, options.bodySize ?? 20, DIALOG_THEME.text, {
        fontFamily: DIALOG_FONT_FAMILY,
        align: "center",
        strokeThickness: 0,
        wordWrap: { width: width - 118 },
        lineSpacing: 9,
      });
      this.container.add(body);
    }

    // 给复杂弹窗预留内容插槽。以后如做“选择存档”“领取奖励”等，可在这里放列表、图标，
    // 仍然沿用同一个框架、遮罩与按钮风格。
    options.buildContent?.({ dialog: this, scene: this.scene, container: this.container, width, height });

    // 每个按钮在视觉层和透明点击层上各有一份：视觉层可整体淡入，点击层保持准确且稳定。
    const buttons = options.buttons ?? [];
    buttons.forEach((button, index) => this.createButton(button, index, buttons.length));

    // 提示文字固定在按钮区下方；导入、导出、保存等异步动作可调用 setNotice() 实时更新。
    this.noticeText = this.createCenteredText(0, options.noticeY ?? (height / 2 - 42), options.notice ?? "", width - 108, options.noticeSize ?? 14, options.noticeColor ?? "#c3ebba", {
      fontFamily: DIALOG_FONT_FAMILY,
      align: "center",
      strokeThickness: 0,
      wordWrap: { width: width - 108 },
    });
    this.container.add(this.noticeText);

    if (closable) this.createCloseButton();

    // 轻微的淡入和缩放，比突然出现更像正式游戏界面，也不会占用明显性能。
    this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: 160, ease: "Sine.Out" });
    this.scene.tweens.add({ targets: this.container, alpha: 1, scale: 1, duration: 180, ease: "Back.Out" });
    return this;
  }

  /** 绘制统一面板的双层边框和角落装饰。 */
  drawPanelShell(graphics, width, height) {
    const left = -width / 2;
    const top = -height / 2;
    const right = width / 2;
    const bottom = height / 2;
    graphics.fillStyle(DIALOG_THEME.panel, 0.985);
    graphics.fillRoundedRect(left, top, width, height, 18);
    graphics.lineStyle(3, DIALOG_THEME.border, 1);
    graphics.strokeRoundedRect(left, top, width, height, 18);
    graphics.fillStyle(DIALOG_THEME.panelInner, 0.45);
    graphics.fillRoundedRect(left + 11, top + 11, width - 22, height - 22, 13);
    graphics.lineStyle(1, DIALOG_THEME.borderSoft, 0.96);
    graphics.strokeRoundedRect(left + 11, top + 11, width - 22, height - 22, 13);

    // 四角采用简洁回纹，而非过多贴图；小窗口和大窗口都能保持清爽、不会遮挡内容。
    const cornerLength = 38;
    const inset = 24;
    graphics.lineStyle(2, DIALOG_THEME.border, 0.82);
    graphics.lineBetween(left + inset, top + inset, left + inset + cornerLength, top + inset);
    graphics.lineBetween(left + inset, top + inset, left + inset, top + inset + cornerLength);
    graphics.lineBetween(right - inset, top + inset, right - inset - cornerLength, top + inset);
    graphics.lineBetween(right - inset, top + inset, right - inset, top + inset + cornerLength);
    graphics.lineBetween(left + inset, bottom - inset, left + inset + cornerLength, bottom - inset);
    graphics.lineBetween(left + inset, bottom - inset, left + inset, bottom - inset - cornerLength);
    graphics.lineBetween(right - inset, bottom - inset, right - inset - cornerLength, bottom - inset);
    graphics.lineBetween(right - inset, bottom - inset, right - inset, bottom - inset - cornerLength);
  }

  /**
   * 创建固定宽度的居中文字。
   *
   * Phaser 的自动换行文本若只设置 origin(0.5)，会以“实际字数宽度”而不是
   * “可用文字区域”作为中心，长短句切换后容易产生视觉偏移。这里先规定文字区
   * 的固定宽度，再让所有内容在该区域内居中，标题、正文、按钮和关闭符号都可复用。
   */
  createCenteredText(centerX, centerY, text, width, size, color, style = {}) {
    const display = addText(this.scene, centerX - width / 2, centerY, text, size, color, {
      ...style,
      align: "center",
    });
    // 左侧坐标固定为文字区域左边；文字区域本身固定宽度，内部再按 center 对齐。
    display.setFixedSize(width, 0);
    display.setOrigin(0, 0.5);
    return display;
  }

  /** 创建一个统一按钮，并建立同位置的可靠透明点击区。 */
  createButton(button, index, count) {
    const { width, height, centerX, centerY, depth } = this.options;
    const buttonWidth = button.width ?? Math.min(310, width - 150);
    const buttonHeight = button.height ?? 48;
    // 未单独指定 Y 坐标时，整组按钮围绕同一个中心自动排布。
    // 调用方只需给 buttonGroupY 指定按钮组中心，不再逐个手写坐标；这样组内间距统一，
    // 并能保证整组按钮在弹窗内容区上下居中。未指定时默认以弹窗正中心为组中心。
    const buttonGap = this.options.buttonGap ?? 58;
    const buttonGroupY = this.options.buttonGroupY ?? 0;
    const fallbackStartY = buttonGroupY - ((count - 1) * buttonGap) / 2;
    const localY = button.y ?? (fallbackStartY + index * buttonGap);
    const variant = DIALOG_THEME[button.variant ?? "primary"] ?? DIALOG_THEME.primary;
    const localX = button.x ?? 0;

    const background = this.scene.add.graphics();
    background.fillStyle(variant.fill, 1);
    background.fillRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    background.lineStyle(1.5, variant.border, 1);
    background.strokeRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    // 按钮中间的浅金线模拟器物镶边，提升层次但不依赖任何额外美术资产。
    background.lineStyle(1, 0xf1d08a, 0.19);
    background.lineBetween(localX - buttonWidth / 2 + 10, localY - buttonHeight / 2 + 6, localX + buttonWidth / 2 - 10, localY - buttonHeight / 2 + 6);
    // 按钮文字直接以按钮的几何中心为锚点，不使用正文的固定宽度排版。
    // 这样无论文字长短或浏览器如何缩放，文字都会同时保持水平、垂直居中。
    const text = addText(this.scene, localX, localY, button.label ?? "确认", button.size ?? 18, "#fff0c7", {
      // 按钮文字同样禁用粗描边，保证每个汉字在缩放后仍然清晰、居中。
      fontFamily: DIALOG_FONT_FAMILY,
      fontStyle: "normal",
      strokeThickness: 0,
      align: "center",
    }).setOrigin(0.5);
    this.container.add([background, text]);

    const area = this.scene.add.zone(centerX + localX, centerY + localY, buttonWidth + 12, buttonHeight + 10)
      .setScrollFactor(0)
      .setDepth(depth + 4)
      .setInteractive({ useHandCursor: true });
    area.on("pointerover", () => {
      background.clear();
      background.fillStyle(variant.hover, 1);
      background.fillRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
      background.lineStyle(2, 0xffda83, 1);
      background.strokeRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    });
    area.on("pointerout", () => {
      background.clear();
      background.fillStyle(variant.fill, 1);
      background.fillRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
      background.lineStyle(1.5, variant.border, 1);
      background.strokeRoundedRect(localX - buttonWidth / 2, localY - buttonHeight / 2, buttonWidth, buttonHeight, 6);
      background.lineStyle(1, 0xf1d08a, 0.19);
      background.lineBetween(localX - buttonWidth / 2 + 10, localY - buttonHeight / 2 + 6, localX + buttonWidth / 2 - 10, localY - buttonHeight / 2 + 6);
    });
    area.on("pointerdown", () => {
      playUiClickSound(this.scene);
      button.onClick?.(this);
    });
    this.actionAreas.push(area);
  }

  /** 创建右上角统一的关闭按钮；Esc 等快捷键可在具体场景按需要另行接入。 */
  createCloseButton() {
    const { width, height, centerX, centerY, depth } = this.options;
    const localX = width / 2 - 42;
    const localY = -height / 2 + 41;
    const icon = this.scene.add.graphics();
    icon.fillStyle(0x482f22, 1);
    icon.fillRoundedRect(localX - 19, localY - 19, 38, 38, 6);
    icon.lineStyle(1, DIALOG_THEME.borderSoft, 1);
    icon.strokeRoundedRect(localX - 19, localY - 19, 38, 38, 6);
    const text = addText(this.scene, localX, localY, "×", 26, "#f0dca5", {
      fontFamily: DIALOG_FONT_FAMILY,
      strokeThickness: 0,
      align: "center",
    }).setOrigin(0.5);
    this.container.add([icon, text]);
    this.closeArea = this.scene.add.zone(centerX + localX, centerY + localY, 48, 48)
      .setScrollFactor(0)
      .setDepth(depth + 5)
      .setInteractive({ useHandCursor: true });
    this.closeArea.on("pointerdown", () => {
      playUiClickSound(this.scene);
      this.close();
    });
  }

  /** 更新弹窗底部的状态文字，例如“保存成功”或“正在导入”。 */
  setNotice(message = "", color = "#c3ebba") {
    this.noticeText?.setText(message).setColor(color);
    return this;
  }

  /** 关闭并销毁弹窗；销毁透明点击区可避免它们残留在地图上挡住后续操作。 */
  close({ immediate = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    const finish = () => this.destroyObjects();
    // 先撤掉交互层：淡出期间用户已经可以继续操作后面的正常界面。
    this.inputBlocker?.destroy();
    this.inputBlocker = null;
    this.actionAreas.forEach((area) => area.destroy());
    this.actionAreas = [];
    this.closeArea?.destroy();
    this.closeArea = null;
    if (immediate) {
      finish();
      return;
    }
    this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: 130, ease: "Sine.In" });
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.96,
      duration: 150,
      ease: "Sine.In",
      onComplete: finish,
    });
  }

  /** 立刻清理对象，并通知调用场景把自己的“弹窗已打开”引用置空。 */
  destroyObjects() {
    this.overlay?.destroy();
    this.container?.destroy();
    this.overlay = null;
    this.container = null;
    this.noticeText = null;
    const onClose = this.options?.onClose;
    this.options = null;
    onClose?.();
  }

  /** 与 Phaser 常用 destroy 名称保持一致，方便场景 shutdown 时直接调用。 */
  destroy() {
    this.close({ immediate: true });
  }
}
