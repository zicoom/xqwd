import { getPlayerPortrait, PLAYER_PORTRAITS } from "../../core/PortraitCatalog.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/character-archive";
const COVER_PATH = "./public/assets/images/covers/xuanqiong-wendao-cover-2048.jpg";
const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const SHARP_UI_FONT = '"Microsoft YaHei", "Noto Sans SC", sans-serif';
const AVATAR_IMAGE_OFFSET_Y = 15;

export const CHARACTER_ARCHIVE_ASSETS = Object.freeze({
  cover: "xuanqiong-wendao-cover",
  board: "pixso-character-archive-board",
  card: "pixso-character-archive-card",
  createEmblem: "pixso-character-archive-create-emblem",
  titleBackground: "pixso-character-archive-title-background",
  slotLabel: "pixso-character-archive-slot-label",
  avatarFrame: "pixso-character-archive-avatar-frame",
  dangerButton: "pixso-character-archive-danger-button",
  primaryButton: "pixso-character-archive-primary-button",
  backButtonBackground: "pixso-character-archive-back-button-background",
});

const LAYOUT = Object.freeze({
  title: Object.freeze({ x: 960, y: 112, width: 345, height: 102 }),
  board: Object.freeze({ x: 960, y: 540, width: 1775, height: 662 }),
  cardCenters: Object.freeze([272, 617, 962, 1307, 1652]),
  cardY: 537,
  cardWidth: 306,
  cardHeight: 558,
  slotLabelY: 290,
  avatarY: 432,
  footer: Object.freeze({ x: 960, y: 947, width: 319, height: 104 }),
  subtitleY: 1015,
});

/** 角色档案场景自行调用此函数预加载全部界面素材。 */
export function preloadCharacterArchiveAssets(scene) {
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.cover, COVER_PATH);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.board, `${ASSET_ROOT}/archive-board.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.card, `${ASSET_ROOT}/archive-card.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.createEmblem, `${ASSET_ROOT}/create-slot-emblem.png`);
  // 用户实机反馈确认：原先辨认的顶部与底部背景用途正好相反。
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.titleBackground, `${ASSET_ROOT}/footer-plaque.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.slotLabel, `${ASSET_ROOT}/slot-label.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.avatarFrame, `${ASSET_ROOT}/avatar-frame.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.dangerButton, `${ASSET_ROOT}/button-danger.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.primaryButton, `${ASSET_ROOT}/button-primary.png`);
  scene.load.image(CHARACTER_ARCHIVE_ASSETS.backButtonBackground, `${ASSET_ROOT}/title-plaque.png`);
  PLAYER_PORTRAITS.forEach((portrait) => scene.load.image(portrait.textureKey, portrait.imagePath));
}

const addCenteredText = (scene, root, x, y, value, size, color, extra = {}) => {
  const text = addText(scene, x, y, value, size, color, {
    origin: 0.5,
    align: "center",
    fontFamily: UI_FONT,
    strokeThickness: 0,
    ...extra,
  });
  root.add(text);
  return text;
};

/**
 * Pixso“改版 / 角色档案”纯 UI 视图。
 *
 * 这里只绘制五个档位并转发点击；读取、创建、删除和进入角色的规则都由场景传入的回调处理。
 */
export class CharacterArchiveView {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setAlpha(0);
    this.avatarTextureKeys = [];
  }

  render({ slots = [], maxSlots = 5, onEnter, onCreate, onDelete, onBack } = {}) {
    this.addImage(960, 540, CHARACTER_ARCHIVE_ASSETS.cover, 1920, 1080);
    this.root.add(this.scene.add.rectangle(960, 540, 1920, 1080, 0x030706, 0.61));

    this.addImage(
      LAYOUT.title.x,
      LAYOUT.title.y,
      CHARACTER_ARCHIVE_ASSETS.titleBackground,
      LAYOUT.title.width,
      LAYOUT.title.height,
    );
    addCenteredText(this.scene, this.root, LAYOUT.title.x, LAYOUT.title.y - 2, "角色档案", 43, "#f3cf78", {
      fontFamily: TITLE_FONT,
      stroke: "#27180e",
      strokeThickness: 3,
    });

    this.addImage(
      LAYOUT.board.x,
      LAYOUT.board.y,
      CHARACTER_ARCHIVE_ASSETS.board,
      LAYOUT.board.width,
      LAYOUT.board.height,
    );

    for (let index = 0; index < maxSlots; index += 1) {
      const x = LAYOUT.cardCenters[index] ?? (272 + index * 345);
      this.createSlotCard(x, index, slots[index], { onEnter, onCreate, onDelete });
    }

    this.createFooter(onBack);
    addCenteredText(
      this.scene,
      this.root,
      960,
      LAYOUT.subtitleY,
      `选择已有角色继续仙途，或使用空档位创建新角色 · 最多 ${maxSlots} 位`,
      16,
      "#c9b992",
      { stroke: "#11110e", strokeThickness: 1 },
    );

    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 220, ease: "Sine.Out" });
    return this;
  }

  createSlotCard(x, index, slot, callbacks) {
    const hasCharacter = Boolean(slot?.player?.roots);
    const card = this.addImage(
      x,
      LAYOUT.cardY,
      CHARACTER_ARCHIVE_ASSETS.card,
      LAYOUT.cardWidth,
      LAYOUT.cardHeight,
    );

    this.addImage(x, LAYOUT.slotLabelY, CHARACTER_ARCHIVE_ASSETS.slotLabel, 280, 48);
    addCenteredText(this.scene, this.root, x, LAYOUT.slotLabelY, `档案位 ${index + 1}`, 19, "#49331f", {
      fontFamily: SHARP_UI_FONT,
      fontStyle: "bold",
      strokeThickness: 0,
    });

    if (hasCharacter) {
      this.createOccupiedSlot(x, index, slot, callbacks);
      card.setInteractive({ useHandCursor: false });
      card.on("pointerover", () => card.setTint(0xfff4d4));
      card.on("pointerout", () => card.clearTint());
      return;
    }

    this.createEmptySlot(x, index, card, callbacks.onCreate);
  }

  createOccupiedSlot(x, index, slot, { onEnter, onDelete }) {
    const player = slot.player;
    this.addImage(x, LAYOUT.avatarY, CHARACTER_ARCHIVE_ASSETS.avatarFrame, 204, 196);
    this.root.add(
      this.scene.add
        .image(x, LAYOUT.avatarY + AVATAR_IMAGE_OFFSET_Y, this.createAvatarTexture(player, index))
        .setDisplaySize(148, 148),
    );

    addCenteredText(this.scene, this.root, x, 565, player.name || "无名散修", 29, "#f6dfaa", {
      fontFamily: TITLE_FONT,
      stroke: "#24160d",
      strokeThickness: 2,
    });
    addCenteredText(this.scene, this.root, x, 604, player.realm || "炼气初期", 18, "#e5d0a0", {
      stroke: "#1c160f",
      strokeThickness: 1,
    });
    addCenteredText(
      this.scene,
      this.root,
      x,
      640,
      slot.chapter?.eliteDefeated ? "进度 · 第一章已完成" : "进度 · 青云山探索中",
      15,
      "#b8aa8c",
      { stroke: "#11110e", strokeThickness: 1 },
    );

    this.createImageButton(x, 696, "进入游戏", CHARACTER_ARCHIVE_ASSETS.primaryButton, 235, 55, () => onEnter?.(index), {
      size: 20,
    });
    this.createImageButton(x, 757, "删除角色", CHARACTER_ARCHIVE_ASSETS.dangerButton, 234, 56, () => onDelete?.(index, player.name), {
      size: 17,
      color: "#f0d4bf",
    });
  }

  createEmptySlot(x, index, card, onCreate) {
    const emblem = this.addImage(x, 452, CHARACTER_ARCHIVE_ASSETS.createEmblem, 137, 135);
    addCenteredText(this.scene, this.root, x, 585, "新建角色", 25, "#f0d49b", {
      fontFamily: TITLE_FONT,
      stroke: "#21150d",
      strokeThickness: 2,
    });
    addCenteredText(this.scene, this.root, x, 620, "空档位", 17, "#c9b892", {
      stroke: "#16120e",
      strokeThickness: 1,
    });
    addCenteredText(this.scene, this.root, x, 661, "创建后可在此继续游玩", 14, "#9e927c", {
      stroke: "#11110e",
      strokeThickness: 1,
    });

    this.createImageButton(x, 755, "创建角色", CHARACTER_ARCHIVE_ASSETS.primaryButton, 235, 55, () => onCreate?.(index), {
      size: 19,
    });

    card.setInteractive({ useHandCursor: true });
    card.on("pointerover", () => {
      card.setTint(0xffe9b0);
      emblem.setTint(0xffffcf);
    });
    card.on("pointerout", () => {
      card.clearTint();
      emblem.clearTint();
    });
    card.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onCreate?.(index);
    });
  }

  createFooter(onBack) {
    const footer = this.addImage(
      LAYOUT.footer.x,
      LAYOUT.footer.y,
      CHARACTER_ARCHIVE_ASSETS.backButtonBackground,
      LAYOUT.footer.width,
      LAYOUT.footer.height,
    ).setInteractive({ useHandCursor: true });
    // 此素材下方带透明区和垂坠流苏，文字要按上方主牌匾的可见区域居中。
    const label = addCenteredText(this.scene, this.root, LAYOUT.footer.x, LAYOUT.footer.y - 18, "返回封面", 24, "#f4d58f", {
      fontFamily: TITLE_FONT,
      stroke: "#21150d",
      strokeThickness: 2,
    });
    footer.on("pointerover", () => {
      footer.setTint(0xffdf90);
      label.setColor("#fff0bd");
    });
    footer.on("pointerout", () => {
      footer.clearTint();
      label.setColor("#f4d58f");
    });
    footer.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onBack?.();
    });
  }

  createImageButton(x, y, label, texture, width, height, onClick, options = {}) {
    const image = this.addImage(x, y, texture, width, height).setInteractive({ useHandCursor: true });
    const text = addCenteredText(this.scene, this.root, x, y, label, options.size ?? 18, options.color ?? "#f6e2b7", {
      fontFamily: TITLE_FONT,
      stroke: "#25170f",
      strokeThickness: 2,
    });
    image.on("pointerover", () => {
      image.setTint(0xffe7a8);
      text.setColor("#fff0bd");
    });
    image.on("pointerout", () => {
      image.clearTint();
      text.setColor(options.color ?? "#f6e2b7");
    });
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
    return image;
  }

  addImage(x, y, texture, width, height) {
    const image = this.scene.add.image(x, y, texture).setDisplaySize(width, height);
    this.root.add(image);
    return image;
  }

  /** 将完整立绘裁成圆形头像，叠放在 Pixso 的山水头像框内。 */
  createAvatarTexture(player, slotIndex) {
    const portrait = getPlayerPortrait(player.portraitId);
    const fallbackKey = "chapter-hud-profile-avatar";
    const texture = this.scene.textures.exists(portrait.textureKey)
      ? this.scene.textures.get(portrait.textureKey)
      : this.scene.textures.get(fallbackKey);
    const source = texture.getSourceImage();
    const key = `character-archive-avatar-${slotIndex}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);

    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    context.beginPath();
    context.arc(96, 96, 94, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    const cropSize = Math.min(source.width * 0.82, source.height * 0.72);
    const cropX = Math.max(0, (source.width - cropSize) / 2);
    const cropY = Math.max(0, source.height * 0.04);
    context.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
    this.scene.textures.addCanvas(key, canvas);
    this.avatarTextureKeys.push(key);
    return key;
  }

  destroy() {
    this.root?.destroy(true);
    this.root = null;
    this.avatarTextureKeys.forEach((key) => {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    });
    this.avatarTextureKeys = [];
  }
}
