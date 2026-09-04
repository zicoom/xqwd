import { addText } from "../../utils/UiHelpers.js";

const DIALOGUE_ASSET_PATH = "./public/assets/images/pixso/chapter-map/dialogue";

export const CHAPTER_DIALOGUE_ASSETS = Object.freeze({
  frame: "chapter-dialogue-pixso-frame",
  nameplate: "chapter-dialogue-pixso-nameplate",
});

export const CHAPTER_DIALOGUE_LAYOUT = Object.freeze({
  frameX: 500,
  frameY: 694,
  frameWidth: 978,
  frameBodyHeight: 315,
  npcNameX: 636,
  playerNameX: 1370,
  nameY: 710,
  nameplateWidth: 100,
  nameplateHeight: 43,
  portraitX: 590,
  portraitBottomY: 760,
  bodyX: 570,
  bodyY: 760,
  bodyWidth: 850,
  choiceX: 570,
  choiceY: 850,
  choiceGap: 34,
});

/** 预加载第一章地图对话框素材；完整框保持原尺寸，姓名牌按效果图缩放。 */
export function preloadChapterDialogueAssets(scene) {
  scene.load.image(CHAPTER_DIALOGUE_ASSETS.frame, `${DIALOGUE_ASSET_PATH}/dialogue-frame.png`);
  scene.load.image(CHAPTER_DIALOGUE_ASSETS.nameplate, `${DIALOGUE_ASSET_PATH}/speaker-nameplate.png`);
}

/**
 * 第一章地图对话层。
 *
 * 本组件只负责素材绘制、立绘适配和选项命中；剧情节点与任务推进仍由场景和领域服务处理。
 */
export class ChapterDialoguePanel {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.portraitRequestId = 0;
  }

  get visible() { return Boolean(this.root?.visible); }

  create() {
    const { scene } = this;
    const layout = CHAPTER_DIALOGUE_LAYOUT;
    const bodyFont = "Microsoft YaHei, Noto Sans SC, sans-serif";

    this.root = scene.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(1500);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x0b120c, 0.48).setOrigin(0).setInteractive();

    // 人物先绘制，随后由宣纸框遮住下缘，保持人物自然站在对话框后的层级。
    this.npcPortrait = scene.add.image(layout.portraitX, layout.portraitBottomY, "player-idle-5dir", 0)
      .setOrigin(0.5, 1)
      .setScale(0.58)
      .setVisible(false);
    this.playerPortrait = scene.add.image(1370, layout.portraitBottomY, "player-dialogue-portrait")
      .setOrigin(0.5, 1)
      .setDisplaySize(210, 330)
      .setVisible(false)
      .setAlpha(0.92);

    this.frame = scene.add.image(layout.frameX, layout.frameY, CHAPTER_DIALOGUE_ASSETS.frame).setOrigin(0);
    this.nameplate = scene.add.image(layout.npcNameX, layout.nameY, CHAPTER_DIALOGUE_ASSETS.nameplate)
      .setDisplaySize(layout.nameplateWidth, layout.nameplateHeight);
    this.nameText = addText(scene, layout.npcNameX, layout.nameY, "", 18, "#fff4df", {
      fontFamily: bodyFont,
      stroke: "#5a2d17",
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.bodyText = addText(scene, layout.bodyX, layout.bodyY, "", 20, "#3b291d", {
      fontFamily: bodyFont,
      wordWrap: {
        width: layout.bodyWidth,
        useAdvancedWrap: true,
      },
      lineSpacing: 6,
      strokeThickness: 0,
    });
    this.choiceLayer = scene.add.container(0, 0);

    this.root.add([
      shade,
      this.npcPortrait,
      this.playerPortrait,
      this.frame,
      this.nameplate,
      this.nameText,
      this.bodyText,
      this.choiceLayer,
    ]);
    return this;
  }

  show() { this.root.setVisible(true); }

  hide() {
    this.portraitRequestId += 1;
    this.root.setVisible(false);
    this.npcPortrait.setVisible(false);
    this.playerPortrait.setVisible(false);
    this.clearChoices();
  }

  setSpeaker({ speaker, npcName, playerName }) {
    const playerSpeaking = speaker === "player";
    const centerX = playerSpeaking ? CHAPTER_DIALOGUE_LAYOUT.playerNameX : CHAPTER_DIALOGUE_LAYOUT.npcNameX;
    this.npcPortrait.setAlpha(playerSpeaking ? 0.28 : 1);
    this.playerPortrait.setVisible(playerSpeaking).setAlpha(1);
    this.nameplate.setPosition(centerX, CHAPTER_DIALOGUE_LAYOUT.nameY);
    this.nameText
      .setPosition(centerX, CHAPTER_DIALOGUE_LAYOUT.nameY)
      .setText(playerSpeaking ? playerName : npcName);
  }

  setBodyText(value) { this.bodyText.setText(value); }

  /** NPC 编辑器上传的任意比例立绘均等比放入效果图规定的 260×360 区域。 */
  setNpcPortrait(portraitData) {
    const requestId = this.portraitRequestId + 1;
    this.portraitRequestId = requestId;
    if (!portraitData) {
      this.npcPortrait.setVisible(false);
      return;
    }

    const textureKey = "npc-dialogue-portrait";
    const applyPortrait = () => {
      if (!this.visible || requestId !== this.portraitRequestId) return;
      const source = this.scene.textures.get(textureKey).getSourceImage();
      const scale = Math.min(260 / source.width, 360 / source.height);
      this.npcPortrait
        .setTexture(textureKey)
        .setOrigin(0.5, 1)
        .setPosition(CHAPTER_DIALOGUE_LAYOUT.portraitX, CHAPTER_DIALOGUE_LAYOUT.portraitBottomY)
        .setDisplaySize(source.width * scale, source.height * scale)
        .setVisible(true);
    };

    const image = new Image();
    image.onload = () => {
      if (!this.visible || requestId !== this.portraitRequestId) return;
      if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);
      this.scene.textures.addImage(textureKey, image);
      applyPortrait();
    };
    image.onerror = () => {
      if (requestId === this.portraitRequestId) this.npcPortrait.setVisible(false);
    };
    image.src = portraitData;
  }

  renderChoices(choices = []) {
    this.clearChoices();
    choices.slice(0, 4).forEach((choice, index) => {
      const y = CHAPTER_DIALOGUE_LAYOUT.choiceY + index * CHAPTER_DIALOGUE_LAYOUT.choiceGap;
      const hitArea = this.scene.add.zone(CHAPTER_DIALOGUE_LAYOUT.choiceX + 440, y, 880, 32)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => this.callbacks.onChoice?.(choice));
      const label = addText(this.scene, CHAPTER_DIALOGUE_LAYOUT.choiceX, y, `${index + 1}.  ${choice.text}`, 20, "#4d3326", {
        fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
        strokeThickness: 0,
      }).setOrigin(0, 0.5);
      this.choiceLayer.add([hitArea, label]);
    });
  }

  clearChoices() { this.choiceLayer?.removeAll(true); }

  containsBodyPoint(pointer) {
    const layout = CHAPTER_DIALOGUE_LAYOUT;
    return pointer.x >= layout.frameX
      && pointer.x <= layout.frameX + layout.frameWidth
      && pointer.y >= layout.frameY
      && pointer.y <= layout.frameY + layout.frameBodyHeight;
  }
}
