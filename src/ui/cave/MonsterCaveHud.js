import { addText } from "../../utils/UiHelpers.js";

/** 幽晶兽窟的固定 HUD，只负责展示状态和把退出点击转发给场景。 */
export class MonsterCaveHud {
  constructor(scene, { onExit = () => {} } = {}) {
    this.scene = scene;
    this.onExit = onExit;
  }

  create({ player, runNumber, remaining, total, clearRewardLabel = "" }) {
    const { scene } = this;
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const titlePlate = scene.add.rectangle(960, 51, 430, 72, 0x10191a, 0.88)
      .setStrokeStyle(2, 0xb9904d, 0.9);
    const title = addText(scene, 960, 39, "幽晶兽窟", 30, "#f1ca75", {
      origin: 0.5, fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 3,
    });
    this.runText = addText(scene, 960, 70, `第一层 · 第 ${runNumber} 轮探索`, 14, "#9fc9c0", {
      origin: 0.5, strokeThickness: 1,
    });

    const statusPanel = scene.add.rectangle(26, 24, 360, 112, 0x0d1516, 0.9)
      .setOrigin(0).setStrokeStyle(2, 0x7d6841, 0.9);
    const nameText = addText(scene, 48, 40, player.name || "无名修士", 22, "#f2d18c", {
      fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 2,
    });
    this.statusText = addText(scene, 48, 75, "", 15, "#d5dfcf", { strokeThickness: 1, lineSpacing: 8 });

    const exitButton = scene.add.rectangle(1698, 35, 190, 58, 0x211a14, 0.94)
      .setOrigin(0).setStrokeStyle(2, 0xc39a4c)
      .setInteractive({ useHandCursor: true });
    const exitText = addText(scene, 1793, 64, "离开洞穴", 21, "#f0cd82", {
      origin: 0.5, fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 2,
    });
    exitButton.on("pointerover", () => exitButton.setFillStyle(0x49331e, 0.98));
    exitButton.on("pointerout", () => exitButton.setFillStyle(0x211a14, 0.94));
    exitButton.on("pointerdown", (_pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      this.onExit();
    });

    const objectivePanel = scene.add.rectangle(28, 888, 500, 150, 0x0c1415, 0.9)
      .setOrigin(0).setStrokeStyle(2, 0x6f8d82, 0.9);
    const objectiveTitle = addText(scene, 52, 906, "洞穴探索", 21, "#e7bc68", {
      fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 2,
    });
    this.remainingText = addText(scene, 52, 942, "", 16, "#d3ded5", { strokeThickness: 1 });
    const objectiveHint = addText(scene, 52, 976, "妖兽会巡逻与追击；接触后自动开战，击败可获经验和掉落。", 14, "#9fb8ae", {
      strokeThickness: 1, wordWrap: { width: 450 },
    });

    const hintPlate = scene.add.rectangle(960, 1018, 730, 54, 0x0a1112, 0.9)
      .setStrokeStyle(1, 0x9b7b42, 0.9);
    this.hintText = addText(scene, 960, 1018, "WASD / 方向键移动 · 点击地面自动前往", 17, "#f0dfb0", {
      origin: 0.5, strokeThickness: 2,
    });

    this.root.add([
      titlePlate, title, this.runText,
      statusPanel, nameText, this.statusText,
      exitButton, exitText,
      objectivePanel, objectiveTitle, this.remainingText, objectiveHint,
      hintPlate, this.hintText,
    ]);
    this.clearRewardLabel = clearRewardLabel;
    this.updatePlayer(player);
    this.updateRemaining(remaining, total);
    return this;
  }

  updatePlayer(player) {
    this.statusText?.setText(
      `生命  ${Math.round(player.hp)}/${Math.round(player.maxHp)}    灵气  ${Math.round(player.qi)}/${Math.round(player.maxQi)}\n`
      + `修为  ${Math.round(player.cultivationExp)}/${Math.round(player.cultivationExpTarget)}`,
    );
  }

  updateRemaining(remaining, total) {
    const cleared = Math.max(0, Number(total) - Number(remaining));
    this.remainingText?.setText(remaining > 0
      ? `本轮妖兽：${cleared} / ${total} 已击败    尚余 ${remaining} 只`
      : `本轮妖兽：${total} / ${total} 已击败    清剿完成`);
    if (remaining === 0) this.showClearNotice();
  }

  showClearNotice() {
    if (this.clearNotice?.active) return;
    const { scene } = this;
    this.clearNotice = scene.add.container(960, 310).setScrollFactor(0).setDepth(1100).setAlpha(0);
    const plate = scene.add.rectangle(0, 0, 620, 132, 0x0c1516, 0.96)
      .setStrokeStyle(3, 0xd1a755, 0.95);
    const title = addText(scene, 0, -25, "本轮清剿完成", 34, "#f4cb70", {
      origin: 0.5, fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 4,
    });
    const reward = addText(scene, 0, 27, `额外奖励：${this.clearRewardLabel}`, 18, "#c6ddd3", {
      origin: 0.5, strokeThickness: 2,
    });
    this.clearNotice.add([plate, title, reward]);
    scene.tweens.add({
      targets: this.clearNotice,
      alpha: 1,
      y: 300,
      duration: 260,
      ease: "Sine.Out",
    });
  }

  setHint(message, color = "#f0dfb0") {
    this.hintText?.setText(message).setColor(color);
  }
}
