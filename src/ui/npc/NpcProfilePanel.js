import { addText } from "../../utils/UiHelpers.js";

const PROFILE_ASSET_PATH = "./public/assets/images/pixso/chapter-map/npc-profile";

export const NPC_PROFILE_ASSETS = Object.freeze({
  frame: "npc-profile-pixso-frame",
  nameplate: "npc-profile-pixso-nameplate",
  columnDivider: "npc-profile-pixso-column-divider",
  divider: "npc-profile-pixso-divider",
  statsPanel: "npc-profile-pixso-stats-panel",
  close: "npc-profile-pixso-close",
  chatButton: "npc-profile-pixso-chat-button",
  friendButton: "npc-profile-pixso-friend-button",
  actionButton: "npc-profile-pixso-action-button",
});

/** 预加载个人信息弹窗素材；原始像素会在 1920×1080 画布上一对一显示。 */
export function preloadNpcProfilePanelAssets(scene) {
  scene.load.image(NPC_PROFILE_ASSETS.frame, `${PROFILE_ASSET_PATH}/profile-frame.png`);
  scene.load.image(NPC_PROFILE_ASSETS.nameplate, `${PROFILE_ASSET_PATH}/nameplate.png`);
  scene.load.image(NPC_PROFILE_ASSETS.columnDivider, `${PROFILE_ASSET_PATH}/detail-column-divider.png`);
  scene.load.image(NPC_PROFILE_ASSETS.divider, `${PROFILE_ASSET_PATH}/section-divider.png`);
  scene.load.image(NPC_PROFILE_ASSETS.statsPanel, `${PROFILE_ASSET_PATH}/stats-panel.png`);
  scene.load.image(NPC_PROFILE_ASSETS.close, `${PROFILE_ASSET_PATH}/close-button.png`);
  scene.load.image(NPC_PROFILE_ASSETS.chatButton, `${PROFILE_ASSET_PATH}/chat-button.png`);
  scene.load.image(NPC_PROFILE_ASSETS.friendButton, `${PROFILE_ASSET_PATH}/friend-button.png`);
  scene.load.image(NPC_PROFILE_ASSETS.actionButton, `${PROFILE_ASSET_PATH}/action-button.png`);
}

/**
 * 第一章地图的 NPC 个人信息弹窗。
 *
 * 组件只负责显示、鼠标命中和视觉反馈；交谈、好友、购物及战斗仍由场景回调处理。
 */
export class NpcProfilePanel {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.object = null;
    this.isMerchant = false;
  }

  get visible() { return Boolean(this.panel?.visible); }

  create() {
    const { scene } = this;
    const bodyFont = "Microsoft YaHei, Noto Sans SC, sans-serif";
    this.panel = scene.add.container(960, 540).setScrollFactor(0).setVisible(false).setDepth(1600);

    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x071009, 0.58).setInteractive();
    const frame = scene.add.image(0, 0, NPC_PROFILE_ASSETS.frame);

    // 立绘放在宣纸山水区内，底部由黑色姓名牌覆盖，形成自然的前后层级。
    this.portrait = scene.add.image(0, -66, "player-idle-5dir", 0).setOrigin(0.5, 1).setScale(0.7);
    const nameplate = scene.add.image(0, -46, NPC_PROFILE_ASSETS.nameplate);
    this.nameText = addText(scene, 0, -46, "", 24, "#f1d59a", {
      fontFamily: bodyFont,
      stroke: "#17120d",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.closeButton = scene.add.image(174, -378, NPC_PROFILE_ASSETS.close).setInteractive({ useHandCursor: true });
    this.closeButton.on("pointerover", () => this.closeButton.setTint(0xffe5a2));
    this.closeButton.on("pointerout", () => this.closeButton.clearTint());

    // b10 是原始宽度仅 1px 的竖向分隔线，必须保持 1×65，不能横向拉伸成整块渐变。
    const columnDivider = scene.add.image(0, 31, NPC_PROFILE_ASSETS.columnDivider);
    const detailLayout = [
      { label: "境界", labelX: -148, valueX: -103, y: 10, valueOrigin: 0 },
      { label: "性别", labelX: 12, valueX: 148, y: 10, valueOrigin: 1 },
      { label: "宗门", labelX: -148, valueX: -103, y: 43, valueOrigin: 0 },
      { label: "身份", labelX: 12, valueX: 148, y: 43, valueOrigin: 1 },
    ];
    this.rowLabels = detailLayout.map(({ label, labelX, y }) => addText(scene, labelX, y, label, 14, "#756650", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }));
    this.rowValues = detailLayout.map(({ valueX, y, valueOrigin }) => addText(scene, valueX, y, "", 14, "#3b2b1d", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }).setOrigin(valueOrigin, 0));

    const detailDivider = scene.add.image(0, 88, NPC_PROFILE_ASSETS.divider);
    const statsPanel = scene.add.image(0, 156, NPC_PROFILE_ASSETS.statsPanel);
    const statLayout = [
      { label: "✦ 气血", labelX: -142, valueX: -27, y: 116 },
      { label: "✦ 灵力", labelX: 18, valueX: 143, y: 116 },
      { label: "⚔ 攻击", labelX: -142, valueX: -27, y: 151 },
      { label: "○ 防御", labelX: 18, valueX: 143, y: 151 },
      { label: "↯ 身法", labelX: -142, valueX: -27, y: 186 },
      { label: "◇ 灵根", labelX: 18, valueX: 143, y: 186 },
    ];
    this.statLabels = statLayout.map(({ label, labelX, y }) => addText(scene, labelX, y, label, 13, "#8c806c", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }));
    this.statValues = statLayout.map(({ valueX, y }) => addText(scene, valueX, y, "", 13, "#e8c46c", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }).setOrigin(1, 0));
    const actionDivider = scene.add.image(0, 224, NPC_PROFILE_ASSETS.divider);

    this.chatButton = scene.add.image(-86, 256, NPC_PROFILE_ASSETS.chatButton).setInteractive({ useHandCursor: true });
    const chatText = addText(scene, -86, 256, "交谈", 18, "#fff1d2", {
      fontFamily: bodyFont,
      stroke: "#2d2419",
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.friendButton = scene.add.image(86, 256, NPC_PROFILE_ASSETS.friendButton).setInteractive({ useHandCursor: true });
    const friendText = addText(scene, 86, 256, "加为好友", 17, "#4b3522", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }).setOrigin(0.5);

    this.actionButton = scene.add.image(0, 318, NPC_PROFILE_ASSETS.actionButton).setInteractive({ useHandCursor: true });
    this.actionText = addText(scene, 0, 318, "战斗", 19, "#fff0d8", {
      fontFamily: bodyFont,
      stroke: "#421d17",
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.noticeText = addText(scene, 0, 360, "", 12, "#7b5633", {
      fontFamily: bodyFont,
      strokeThickness: 0,
    }).setOrigin(0.5);

    [this.chatButton, this.friendButton, this.actionButton].forEach((button) => {
      button.on("pointerover", () => button.setTint(0xffedbd));
      button.on("pointerout", () => button.clearTint());
    });

    this.panel.add([
      shade, frame, this.portrait, nameplate, this.nameText, this.closeButton,
      columnDivider, ...this.rowLabels, ...this.rowValues, detailDivider, statsPanel,
      ...this.statLabels, ...this.statValues, actionDivider, this.chatButton, chatText,
      this.friendButton, friendText, this.actionButton, this.actionText, this.noticeText,
    ]);
  }

  open({ object, isMerchant, name, profile = {}, portraitData = "" }) {
    this.object = object;
    this.isMerchant = Boolean(isMerchant);
    this.nameText.setText(name || "未命名修士");

    const rowValues = [
      profile.realm || "炼气初期",
      profile.gender || "未知",
      profile.sect || "无门派",
      profile.identity || "散修",
    ];
    this.rowValues.forEach((text, index) => text.setText(rowValues[index]));

    const roots = Object.values(profile.roots || {}).filter((value) => Number(value) > 0).join("、") || "无";
    const stats = [
      `${profile.lifespan || 0}/100`, `${profile.spirit || 0}/50`,
      `${profile.attack || 0}`, `${profile.defense || 0}`,
      `${profile.agility || 0}`, roots,
    ];
    this.statValues.forEach((text, index) => text.setText(stats[index]));
    this.noticeText.setText("");

    if (this.isMerchant) {
      this.portrait.setTexture("merchant-profile-portrait").setOrigin(0.5, 1).setPosition(0, -66).setDisplaySize(225, 300);
      this.actionText.setText("购物");
    } else {
      this.setPortrait(portraitData, object?.id);
      this.actionText.setText("战斗");
    }

    this.panel.setAlpha(0).setVisible(true);
    this.scene.tweens.killTweensOf(this.panel);
    this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  /** 上传立绘只在山水展示区内等比缩放，不改变外框尺寸。 */
  setPortrait(imageData, objectId) {
    if (!imageData) {
      this.portrait.setTexture("player-idle-5dir", 0).setOrigin(0.5, 1).setPosition(0, -66).setScale(0.7);
      return;
    }
    const textureKey = `npc-profile-${objectId}`;
    const apply = () => {
      if (!this.visible || this.object?.id !== objectId) return;
      const source = this.scene.textures.get(textureKey).getSourceImage();
      const scale = Math.min(270 / source.width, 300 / source.height);
      this.portrait.setTexture(textureKey).setOrigin(0.5, 1).setPosition(0, -66)
        .setDisplaySize(source.width * scale, source.height * scale);
    };
    if (this.scene.textures.exists(textureKey)) { apply(); return; }
    const image = new Image();
    image.onload = () => { this.scene.textures.addImage(textureKey, image); apply(); };
    image.onerror = () => this.portrait.setTexture("player-idle-5dir", 0).setOrigin(0.5, 1).setPosition(0, -66).setScale(0.7);
    image.src = imageData;
  }

  close() {
    this.panel?.setVisible(false);
    this.object = null;
    this.isMerchant = false;
  }

  showNotice(message) { this.noticeText?.setText(message); }

  /** 统一处理容器内点击，避免遮罩点击穿透到地图。 */
  handlePointer(pointer) {
    const x = pointer.x - 960;
    const y = pointer.y - 540;
    if (x >= 146 && x <= 202 && y >= -406 && y <= -350) {
      this.callbacks.onClose?.();
      return true;
    }
    if (x >= -167 && x <= -5 && y >= 229 && y <= 283) {
      this.callbacks.onChat?.(this.object);
      return true;
    }
    if (x >= 5 && x <= 167 && y >= 229 && y <= 283) {
      this.callbacks.onFriend?.(this.object);
      return true;
    }
    if (x >= -167 && x <= 167 && y >= 291 && y <= 345) {
      this.callbacks.onAction?.(this.object, this.isMerchant);
      return true;
    }
    return true;
  }
}
