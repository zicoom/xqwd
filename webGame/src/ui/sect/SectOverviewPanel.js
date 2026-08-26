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
    addButton(scene, 960, 1036, 220, "返回大地图", onBack, { height: 48, size: 18 });
    this.createFeatureDialog();
  }

  drawBackground() {
    const scene = this.scene;
    scene.add.image(960, 540, "sect-mountain-background").setDisplaySize(1920, 1080);
    scene.add.rectangle(960, 540, 1920, 1080, 0xf6f0db, 0.08);
    // 门派名不再占据整条顶部横栏；右对齐后，左侧状态栏与六个图标可以完整复用大地图排版。
    addText(scene, 1872, 38, this.sect.name, 36, "#f1cf72", { strokeThickness: 4 })
      .setOrigin(1, 0.5)
      .setDepth(910);
    addText(scene, 1872, 78, this.sect.subtitle, 16, "#eee2c5", { strokeThickness: 3 })
      .setOrigin(1, 0.5)
      .setDepth(910);
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
    scene.add.rectangle(150, 560, 260, 520, 0x111914, 0.78).setStrokeStyle(2, 0x806638);
    addText(scene, 42, 325, "门内修士", 22, "#efcc68", { strokeThickness: 2 });
    this.sect.members.forEach((member, index) => {
      const y = 390 + index * 108;
      scene.add.rectangle(150, y, 224, 82, 0x1d2921, 0.88).setStrokeStyle(1, 0x665433);
      scene.add.circle(77, y, 27, 0x50635b, 1).setStrokeStyle(2, 0xb99a59);
      addText(scene, 77, y, member.name.slice(0, 1), 22, "#fff1c4", { origin: 0.5, strokeThickness: 1 });
      addText(scene, 118, y - 21, member.name, 17, "#f5e1ad", { strokeThickness: 1 });
      addText(scene, 118, y + 8, `${member.realm} · ${member.role}`, 13, "#b9c8b8", { strokeThickness: 0 });
    });
  }

  drawFeatures() {
    const scene = this.scene;
    const positions = [{ x: 1110, y: 500 }, { x: 1515, y: 590 }];
    this.sect.features.filter((feature) => feature.enabled).forEach((feature, index) => {
      const position = positions[index] || { x: 1110 + (index % 2) * 405, y: 500 + Math.floor(index / 2) * 190 };
      const panel = scene.add.container(position.x, position.y);
      const bg = scene.add.rectangle(0, 0, 270, 132, 0x222827, 0.94)
        .setStrokeStyle(2, 0x8f7445)
        .setInteractive({ useHandCursor: true });
      const seal = scene.add.circle(0, -22, 28, 0xb47a24, 1).setStrokeStyle(2, 0xf0c567);
      const sealText = addText(scene, 0, -22, feature.seal, 24, "#fff2c1", { origin: 0.5, strokeThickness: 1 });
      const label = addText(scene, 0, 38, feature.label, 22, "#f0d49b", { origin: 0.5, strokeThickness: 2 });
      panel.add([bg, seal, sealText, label]);
      bg.on("pointerover", () => bg.setFillStyle(0x3a342a));
      bg.on("pointerout", () => bg.setFillStyle(0x222827));
      bg.on("pointerdown", () => this.onFeature(feature));
    });
  }

  drawRightRail() {
    const scene = this.scene;
    scene.add.rectangle(1735, 260, 320, 260, 0x111914, 0.76).setStrokeStyle(2, 0x806638);
    addText(scene, 1600, 160, "宗门事务", 22, "#efcc68", { strokeThickness: 2 });
    addText(scene, 1600, 210, "当前身份：外门访客", 16, "#d8ddcb", { strokeThickness: 0 });
    addText(scene, 1600, 250, "准入方式：令牌 / 任务", 16, "#d8ddcb", { strokeThickness: 0 });
    addText(scene, 1600, 304, "任务、门人、宝库与传送接口\n已按门派配置预留。", 15, "#aeb9ac", { wordWrap: { width: 260 }, lineSpacing: 8, strokeThickness: 0 });
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
