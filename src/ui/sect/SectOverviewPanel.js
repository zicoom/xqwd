import { addButton, addText } from "../../utils/UiHelpers.js";
import { PlayerTopToolbar } from "../PlayerTopToolbar.js";

/** 门派内部总览 UI；门派数据与功能回调都由场景注入。 */
export class SectOverviewPanel {
  constructor(scene, { sect, onBack, onFeature, onToolbarAction }) {
    this.scene = scene;
    this.sect = sect;
    this.onFeature = onFeature;
    this.drawBackground();
    this.drawPlayerToolbar(onToolbarAction);
    this.drawMembers();
    this.drawFeatures();
    this.drawRightRail();
    this.drawBackButton(onBack);
    this.createFeatureDialog();
  }

  drawBackground() {
    const scene = this.scene;
    scene.add.image(960, 540, "sect-mountain-background").setDisplaySize(1920, 1080);
    scene.add.rectangle(960, 540, 1920, 1080, 0xf6f0db, 0.08);
    // Pixso 使用独立宗门名牌。文字保持动态，新增门派时仍然只需维护 SectCatalog。
    const titlePlaque = scene.add.image(1540, 22, "sect-overview-title-plaque")
      .setOrigin(0)
      .setDepth(905);
    const title = addText(scene, 1719, 66, this.sect.name, 36, "#e9bd65", { origin: 0.5, strokeThickness: 2 })
      .setDepth(910);
    const subtitle = addText(scene, 1719, 108, this.sect.subtitle, 16, "#e8dfcf", { origin: 0.5, strokeThickness: 2 })
      .setDepth(910);
    this.titleElements = [titlePlaque, title, subtitle];
  }

  setTitleVisible(visible) {
    this.titleElements?.forEach((element) => element.setVisible(Boolean(visible)));
  }

  drawPlayerToolbar(onToolbarAction) {
    const call = (id) => () => onToolbarAction?.(id);
    this.playerTopToolbar = new PlayerTopToolbar(this.scene, {
      actions: {
        storage: call("storage"),
        spells: call("spells"),
        techniques: call("techniques"),
        artifacts: call("artifacts"),
        save: call("save"),
        settings: call("settings"),
      },
    }).create();
  }

  drawMembers() {
    const scene = this.scene;
    // 左栏严格按 Pixso 画板坐标摆放：外框只承担分组，成员数据仍来自门派目录。
    scene.add.image(44, 362, "sect-overview-members-panel").setOrigin(0);
    addText(scene, 85, 405, "门内修士", 24, "#e9bd65", { strokeThickness: 2 });
    const rowYs = [454, 541, 629, 716];
    this.sect.members.forEach((member, index) => {
      const y = rowYs[index] ?? (454 + index * 87);
      scene.add.image(83, y, "sect-overview-member-card").setOrigin(0);
      scene.add.image(94, y + 12, "sect-overview-member-seal").setOrigin(0);
      addText(scene, 124.5, y + 43, member.seal || member.name.slice(0, 1), 30, "#f4df9b", { origin: 0.5, strokeThickness: 1 });
      addText(scene, 169, y + 12, member.name, 17, "#e9bd65", { strokeThickness: 1 });
      addText(scene, 169, y + 39, `${member.realm} · ${member.role}`, 14, "#e7e1d8", { strokeThickness: 0 });
    });
  }

  drawFeatures() {
    const scene = this.scene;
    const positions = [{ x: 552, y: 239 }, { x: 1014, y: 362 }];
    this.sect.features.filter((feature) => feature.enabled).forEach((feature, index) => {
      const position = positions[index] || { x: 552 + (index % 2) * 462, y: 239 + Math.floor(index / 2) * 123 };
      const panel = scene.add.container(position.x, position.y);
      const bg = scene.add.image(0, 0, "sect-overview-feature-panel")
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      // 圆章与入口名作为一个整体落在横牌的视觉中心。
      const seal = scene.add.circle(104, 42, 23, 0x96702f, 0.96).setStrokeStyle(2, 0xd7b15c);
      const sealText = addText(scene, 104, 42, feature.seal, 23, "#f8e2a3", { origin: 0.5, strokeThickness: 1 });
      const label = addText(scene, 104, 84, feature.label, 22, "#e9bd65", { origin: 0.5, strokeThickness: 2 });
      panel.add([bg, seal, sealText, label]);
      bg.on("pointerover", () => bg.setAlpha(0.9));
      bg.on("pointerout", () => bg.setAlpha(1));
      bg.on("pointerdown", (_pointer, _x, _y, event) => {
        event?.stopPropagation?.();
        this.onFeature(feature);
      });
    });
  }

  drawRightRail() {
    const scene = this.scene;
    scene.add.image(1559, 362, "sect-overview-affairs-panel").setOrigin(0).setDisplaySize(318, 380);
    addText(scene, 1603, 407, "宗门事务", 22, "#e9bd65", { strokeThickness: 2 });
    addText(scene, 1603, 465, "当前身份：外门访客", 16, "#e7e1d8", { strokeThickness: 0 });
    addText(scene, 1603, 497, "准入方式：令牌 / 任务", 16, "#e7e1d8", { strokeThickness: 0 });
    addText(scene, 1603, 528, "任务：门人、宝库与传送接口已按门派配置预留。", 15, "#d2cec5", { wordWrap: { width: 235, useAdvancedWrap: true }, lineSpacing: 8, strokeThickness: 0 });
  }

  drawBackButton(onBack) {
    const scene = this.scene;
    const button = scene.add.container(835, 977);
    const background = scene.add.image(0, 0, "sect-overview-back-button")
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const label = addText(scene, 125.5, 29, "返回大地图", 18, "#f2d07a", { origin: 0.5, strokeThickness: 2 });
    button.add([background, label]);
    background.on("pointerover", () => background.setAlpha(0.9));
    background.on("pointerout", () => background.setAlpha(1));
    background.on("pointerdown", (_pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      onBack();
    });
  }

  createFeatureDialog() {
    const scene = this.scene;
    this.dialog = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x07100c, 0.58).setOrigin(0).setInteractive();
    const panel = scene.add.rectangle(960, 560, 700, 360, 0x15201a, 0.98).setStrokeStyle(2, 0xb28b4b);
    this.dialogSeal = addText(scene, 960, 455, "", 44, "#f2c85e", { origin: 0.5, strokeThickness: 2 });
    this.dialogTitle = addText(scene, 960, 515, "", 30, "#f5dda1", { origin: 0.5, strokeThickness: 2 });
    this.dialogBody = addText(scene, 960, 590, "", 18, "#d7dfd0", { origin: 0.5, align: "center", wordWrap: { width: 570 }, lineSpacing: 8, strokeThickness: 0 });
    const close = addButton(scene, 960, 690, 180, "返回宗门", () => this.dialog.setVisible(false), { height: 46, size: 17 });
    this.dialog.add([shade, panel, this.dialogSeal, this.dialogTitle, this.dialogBody, close]);
  }

  showFeature(feature, detail) {
    this.dialogSeal.setText(feature.seal);
    this.dialogTitle.setText(feature.label);
    this.dialogBody.setText(detail || feature.description);
    this.dialog.setVisible(true);
  }
}
