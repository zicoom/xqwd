import { deleteSaveSlot, getSaveSlots, loadFirstChapterProgress, MAX_SAVE_SLOTS } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { getPlayerPortrait } from "../core/PortraitCatalog.js";

/**
 * 角色档案选择场景。
 *
 * 角色数据仍由 GameState 负责；场景仅采用与游戏内存档页一致的深木卡片外观来展示、
 * 创建、读取和删除五个档案位。
 */
export class SaveSlotScene extends Phaser.Scene {
  constructor() { super(SceneKeys.SLOT_SELECT); }

  create() {
    configureFullHdScene(this);
    this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);
    this.add.rectangle(960, 540, 1920, 1080, 0x07100e, 0.7);
    this.add.rectangle(960, 106, 1920, 212, 0x11201d, 0.78);
    this.add.rectangle(960, 210, 1920, 1, 0x95703c, 0.8);

    addText(this, 960, 102, "角色档案", 54, "#f6d889", {
      fontStyle: "bold", stroke: "#17120d", strokeThickness: 5,
    }).setOrigin(0.5);
    addText(this, 960, 160, `选择已有角色继续仙途，或使用空档位创建新角色 · 最多 ${MAX_SAVE_SLOTS} 位`, 22, "#e7dbc4", {
      strokeThickness: 1,
    }).setOrigin(0.5);

    const slots = getSaveSlots();
    this.add.rectangle(960, 611, 1810, 640, 0x171411, 0.86).setStrokeStyle(1, 0x6d5230, 0.82);
    slots.forEach((slot, index) => this.createSlotCard(204 + index * 378, 590, index, slot));

    const occupied = slots.filter((slot) => Boolean(slot?.player?.roots)).length;
    addText(this, 960, 948, `已创建 ${occupied} / ${MAX_SAVE_SLOTS} 位角色`, 18, "#cdb98c", { strokeThickness: 1 }).setOrigin(0.5);
    this.createButton(960, 1004, 238, "返回封面", () => this.scene.start(SceneKeys.COVER), {
      height: 52, fill: 0x4b3627, hover: 0x65482f, stroke: 0xc99f55, size: 19,
    });
  }

  /** 所有卡片都共享同一尺寸、金边和标题区，避免已有档案与空档位看起来像两套界面。 */
  createSlotCard(x, y, index, slot) {
    const hasCharacter = Boolean(slot?.player?.roots);
    const cardWidth = 330;
    const cardHeight = 530;
    const normal = hasCharacter ? 0x242a25 : 0x211b16;
    const hover = hasCharacter ? 0x2d372d : 0x312719;
    const border = hasCharacter ? 0xb99452 : 0x6a5740;
    const card = this.add.rectangle(x, y, cardWidth, cardHeight, normal, 0.98)
      .setStrokeStyle(2, border)
      .setInteractive({ useHandCursor: !hasCharacter });
    const inner = this.add.rectangle(x, y, cardWidth - 18, cardHeight - 18, 0x10130f, 0.25)
      .setStrokeStyle(1, hasCharacter ? 0x87683d : 0x4d4033, 0.75);
    const topRule = this.add.rectangle(x, y - 205, cardWidth - 48, 1, 0xc69d54, hasCharacter ? 0.62 : 0.3);
    addText(this, x - 138, y - 236, `档案位 ${index + 1}`, 16, hasCharacter ? "#e6c67e" : "#988775", { strokeThickness: 1 });

    if (!hasCharacter) {
      this.createEmptyCard(x, y, index, card);
      return;
    }

    this.createCharacterCard(x, y, index, slot, card, normal, hover);
    // 视觉内框和标题线不需要输入；将它们置于卡片底部，按钮始终保持可点。
    inner.setDepth(card.depth - 1);
    topRule.setDepth(card.depth - 1);
  }

  createEmptyCard(x, y, index, card) {
    const plus = addText(this, x, y - 92, "＋", 82, "#c9ad72", { strokeThickness: 0 }).setOrigin(0.5);
    addText(this, x, y + 10, "新建角色", 28, "#e7d4a2", { strokeThickness: 1 }).setOrigin(0.5);
    addText(this, x, y + 55, "空档位", 18, "#9d8f7b", { strokeThickness: 0 }).setOrigin(0.5);
    addText(this, x, y + 98, "创建后可在此继续游玩", 15, "#887d6f", { strokeThickness: 0 }).setOrigin(0.5);
    this.createButton(x, y + 180, 238, "创建角色", () => this.createNewCharacter(index), {
      height: 52, fill: 0x4a3925, hover: 0x654a2c, stroke: 0xbf9751, size: 19,
    });
    card.on("pointerover", () => { card.setFillStyle(0x312719); plus.setColor("#f1cf7f"); });
    card.on("pointerout", () => { card.setFillStyle(0x211b16); plus.setColor("#c9ad72"); });
    card.on("pointerdown", () => this.createNewCharacter(index));
    // 点击卡片与点击按钮都会进入同一个创建流程，缩放后仍有充足的可点击区域。
  }

  createCharacterCard(x, y, index, slot, card, normal, hover) {
    const player = slot.player;
    // 档案页和地图共用同一张角色立绘：这里裁成圆形头像，玩家无需另传头像文件。
    this.add.circle(x, y - 130, 66, 0xdec79f).setStrokeStyle(4, 0xc39b57);
    this.add.circle(x, y - 130, 58, 0x16322e, 0.96);
    this.add.image(x, y - 130, this.createArchiveAvatarTexture(player, index)).setDisplaySize(116, 116);
    addText(this, x, y - 30, player.name, 31, "#fff0c7", { fontStyle: "bold", strokeThickness: 2 }).setOrigin(0.5);
    addText(this, x, y + 16, player.realm || "炼气初期", 20, "#9fceb2", { strokeThickness: 0 }).setOrigin(0.5);
    this.add.rectangle(x, y + 55, 210, 1, 0x89663a, 0.75);
    addText(this, x, y + 84, `主灵根 · ${player.selectedElement || "未定"}`, 18, "#dfd0b0", { strokeThickness: 0 }).setOrigin(0.5);
    addText(this, x, y + 118, slot.chapter?.eliteDefeated ? "进度 · 第一章已完成" : "进度 · 青云山探索中", 16, "#bcb59f", { strokeThickness: 0 }).setOrigin(0.5);
    this.createButton(x, y + 172, 238, "进入游戏", () => this.enterSlot(index), {
      height: 50, fill: 0x365d39, hover: 0x477849, stroke: 0x73a678, size: 19,
    });
    this.createButton(x, y + 230, 238, "删除角色", () => this.deleteSlot(index, player.name), {
      height: 42, fill: 0x573033, hover: 0x713f43, stroke: 0xac6c67, color: "#ffd0c8", size: 16,
    });
    card.on("pointerover", () => card.setFillStyle(hover));
    card.on("pointerout", () => card.setFillStyle(normal));
  }

  /** 将完整立绘裁为带透明圆角的头像纹理，避免档案卡显示一整张长立绘或纯色占位。 */
  createArchiveAvatarTexture(player, slotIndex) {
    const portrait = getPlayerPortrait(player.portraitId);
    const fallbackKey = "chapter-hud-profile-avatar";
    const texture = this.textures.exists(portrait.textureKey)
      ? this.textures.get(portrait.textureKey)
      : this.textures.get(fallbackKey);
    const source = texture.getSourceImage();
    const key = `save-slot-avatar-${slotIndex}`;
    if (this.textures.exists(key)) this.textures.remove(key);

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
    this.textures.addCanvas(key, canvas);
    return key;
  }

  /** 统一角色档案操作按钮；文字以按钮中心为锚点，避免不同字数产生视觉偏移。 */
  createButton(x, y, width, label, onClick, options = {}) {
    const height = options.height ?? 48;
    const normal = options.fill ?? 0x4b3627;
    const hover = options.hover ?? 0x65482f;
    const button = this.add.rectangle(x, y, width, height, normal)
      .setStrokeStyle(1.5, options.stroke ?? 0xd5ad62)
      .setInteractive({ useHandCursor: true });
    addText(this, x, y, label, options.size ?? 18, options.color ?? "#fff0c7", {
      fontStyle: "bold", stroke: "#1a130d", strokeThickness: 2, align: "center",
    }).setOrigin(0.5);
    button.on("pointerover", () => button.setFillStyle(hover));
    button.on("pointerout", () => button.setFillStyle(normal));
    button.on("pointerdown", () => { playUiClickSound(this); onClick(); });
    return button;
  }

  enterSlot(index) {
    if (loadFirstChapterProgress(index)) this.scene.start(SceneKeys.VILLAGE);
  }

  createNewCharacter(index) {
    this.scene.start(SceneKeys.CREATE, { newCharacter: true, slotIndex: index });
  }

  deleteSlot(index, name) {
    if (!window.confirm(`确定删除角色“${name}”吗？删除后无法恢复。`)) return;
    if (deleteSaveSlot(index)) this.scene.restart();
  }
}
