import { addText } from "../../utils/UiHelpers.js";

const CARD_WIDTH = 383;
const CARD_HEIGHT = 517;
const CARD_TOP = 318;
const CARD_LEFTS = [509, 985];

/**
 * 角色菜单中的社交子页。
 *
 * 当前章节还没有可持久化的好感与消息规则，所以这里严格展示设计稿中的空状态；
 * 等 NPC 社交领域服务落地后，只需要由该服务提供列表数据，不必改动角色菜单外壳。
 */
export class SocialPanel {
  constructor({ scene, parent }) {
    this.scene = scene;
    this.parent = parent;
    this.layer = null;
  }

  create() {
    if (this.layer) return;
    if (!this.parent) throw new Error("SocialPanel requires a parent container.");

    this.layer = this.scene.add.container(0, 0).setVisible(false);
    const cards = [
      {
        title: "好友列表",
        count: "(0人)",
        emptyTitle: "暂无好友",
        emptyHint: "与NPC交谈时可加为好友",
      },
      {
        title: "消息记录",
        count: "(0条)",
        emptyTitle: "暂无消息",
        emptyHint: "好友会偶尔发来问候消息",
      },
    ];

    cards.forEach((card, index) => this.createCard(CARD_LEFTS[index], card));
    this.parent.add(this.layer);
  }

  createCard(x, content) {
    const { scene } = this;
    const card = scene.add.graphics();
    card.fillStyle(0x2c2920, 1);
    card.fillRoundedRect(x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, 10);
    card.fillStyle(0x53473c, 1);
    card.fillRect(x + 28, CARD_TOP + 80, CARD_WIDTH - 55, 2);

    // 用矢量心形而非 Emoji，避免不同系统替换成彩色字体后产生尺寸偏移。
    const heartX = x + 46;
    const heartY = CARD_TOP + 45;
    card.fillStyle(0xffd20d, 1);
    card.fillCircle(heartX - 7, heartY - 4, 8);
    card.fillCircle(heartX + 7, heartY - 4, 8);
    card.fillTriangle(heartX - 15, heartY - 3, heartX + 15, heartY - 3, heartX, heartY + 14);

    const title = addText(scene, x + 70, heartY, content.title, 22, "#ffffff", { strokeThickness: 0 })
      .setOrigin(0, 0.5);
    const count = addText(scene, x + 70 + title.width + 9, heartY, content.count, 22, "#85817b", { strokeThickness: 0 })
      .setOrigin(0, 0.5);
    const emptyTitle = addText(scene, x + CARD_WIDTH / 2, CARD_TOP + 242, content.emptyTitle, 18, "#7b7672", { strokeThickness: 0 })
      .setOrigin(0.5);
    const emptyHint = addText(scene, x + CARD_WIDTH / 2, CARD_TOP + 279, content.emptyHint, 16, "#7b7672", { strokeThickness: 0 })
      .setOrigin(0.5);
    this.layer.add([card, title, count, emptyTitle, emptyHint]);
  }

  setVisible(visible) {
    if (!this.layer) this.create();
    this.layer.setVisible(visible);
  }
}
