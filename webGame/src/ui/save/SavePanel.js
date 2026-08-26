import { addText, playUiClickSound } from "../../utils/UiHelpers.js";
import { getPlayerPortrait } from "../../core/PortraitCatalog.js";

const CARD_WIDTH = 285;
const CARD_HEIGHT = 470;
const CARD_TOP = 305;
const CARD_CENTERS = Object.freeze([288, 624, 960, 1296, 1632]);

function formatSaveTime(timestamp) {
  if (!Number.isFinite(Number(timestamp))) return "--";
  const date = new Date(Number(timestamp));
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 角色菜单中的“存档”子页。
 * 这里只负责五张档案卡的绘制与点击反馈；保存、读取和自动存档规则全部交给 SaveArchiveService。
 */
export class SavePanel {
  constructor({ scene, parent, saveArchiveService, beforeSave = () => {}, onLoaded = () => {} }) {
    this.scene = scene;
    this.parent = parent;
    this.saveArchiveService = saveArchiveService;
    this.beforeSave = beforeSave;
    this.onLoaded = onLoaded;
    this.root = scene.add.container(0, 0).setVisible(false);
    parent.add(this.root);
    this.selectedSlotIndex = 0;
    this.intervalMenuOpen = false;
    this.deleteConfirmPending = false;
    this.notice = "";
    this.noticeColor = "#d8c99e";
    this.hitAreas = [];
  }

  create() { this.render(); }

  setVisible(visible) {
    this.root.setVisible(Boolean(visible));
    if (visible) this.render();
  }

  addHitArea(x, y, width, height, action) {
    this.hitAreas.push({ x, y, width, height, action });
  }

  addCenteredButton(x, y, width, height, label, action, variant = "primary") {
    const colors = variant === "danger"
      ? { fill: 0x56302b, border: 0xc17765, text: "#ffe0cf" }
      : variant === "secondary"
        ? { fill: 0x304b47, border: 0x8ca497, text: "#efe4c4" }
        : { fill: 0x4a361c, border: 0xb99a5d, text: "#f4e7c4" };
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(colors.fill, 0.96);
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, 5);
    graphics.lineStyle(2, colors.border, 1);
    graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 5);
    const text = addText(this.scene, x, y, label, 23, colors.text, { strokeThickness: 0 }).setOrigin(0.5);
    this.root.add([graphics, text]);
    this.addHitArea(x - width / 2, y - height / 2, width, height, action);
  }

  render() {
    this.root.removeAll(true);
    this.hitAreas = [];
    const state = this.saveArchiveService.getState();

    CARD_CENTERS.forEach((centerX, index) => this.renderCard(centerX, index, state.slots[index]));

    // 删除按钮固定在保存按钮左侧，始终保留相同操作位置；空档位点击只给出提示。
    const deleteLabel = this.deleteConfirmPending ? "确认删除" : "删 除 存 档";
    this.addCenteredButton(840, 855, 198, 62, deleteLabel, () => this.deleteSelectedSlot(), "danger");
    this.addCenteredButton(1080, 855, 198, 62, "保 存 游 戏", () => this.saveSelectedSlot());
    addText(
      this.scene,
      960,
      902,
      "选择档位后保存；已有存档位再次点击即可读取",
      16,
      "#685d45",
      { strokeThickness: 0 },
    ).setOrigin(0.5);

    this.renderAutoSaveControls(state);
    const notice = addText(this.scene, 960, 1020, this.notice, 16, this.noticeColor, { strokeThickness: 0 }).setOrigin(0.5);
    this.root.add(notice);
  }

  renderCard(centerX, index, slot) {
    const left = centerX - CARD_WIDTH / 2;
    const selected = index === this.selectedSlotIndex;
    const card = this.scene.add.graphics();
    card.fillStyle(selected ? 0x302719 : 0x241f15, 0.97);
    card.fillRoundedRect(left, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, 7);
    card.lineStyle(selected ? 3 : 1, selected ? 0xc5a35d : 0x674934, 1);
    card.strokeRoundedRect(left, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, 7);
    this.root.add(card);

    const slotTitle = addText(this.scene, left + 18, CARD_TOP + 18, `档位 ${index + 1}`, 16, selected ? "#d8ba74" : "#776c58", {
      strokeThickness: 0,
    }).setOrigin(0, 0);
    this.root.add(slotTitle);

    if (!slot) {
      const plus = addText(this.scene, centerX, CARD_TOP + 235, "+", 86, selected ? "#b89a62" : "#756344", { strokeThickness: 0 }).setOrigin(0.5);
      const empty = addText(this.scene, centerX, CARD_TOP + 307, "空档位", 18, "#766b57", { strokeThickness: 0 }).setOrigin(0.5);
      this.root.add([plus, empty]);
    } else {
      this.renderFilledCard(centerX, left, slot, selected);
    }

    this.addHitArea(left, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, () => this.selectOrLoadSlot(index, Boolean(slot)));
  }

  renderFilledCard(centerX, left, slot, selected) {
    const player = slot.snapshot?.player || {};
    // 存档卡必须和角色创建、地图 HUD 使用同一份 portraitId。
    // 地图场景会预加载当前角色的立绘；保留旧半身图作为异常情况下的安全回退。
    const selectedPortrait = getPlayerPortrait(player.portraitId);
    const portraitKey = this.scene.textures.exists(selectedPortrait.textureKey)
      ? selectedPortrait.textureKey
      : "player-dialogue-portrait";
    // 让立绘底部贴近信息分隔线，视觉上与下方角色资料形成一个整体。
    const portrait = this.scene.add.image(centerX, CARD_TOP + 162, portraitKey);
    const scale = Math.min(168 / portrait.width, 215 / portrait.height);
    portrait.setScale(scale).setOrigin(0.5, 0.5);
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x51442d, 1);
    divider.lineBetween(left + 16, CARD_TOP + 270, left + CARD_WIDTH - 16, CARD_TOP + 270);

    const name = addText(this.scene, left + 18, CARD_TOP + 292, String(player.name || "无名散修"), 21, "#f0d99b", {
      strokeThickness: 0,
    }).setOrigin(0, 0);
    const rows = [
      ["境界", player.realm || "炼气初期"],
      ["寿命", `${Number(player.age ?? 16)}/${Number(player.maxLifespan ?? 100)}岁`],
      ["宗门", player.sect || player.faction || "无门无派"],
      ["时间", formatSaveTime(slot.savedAt)],
    ];
    const rowObjects = rows.flatMap(([label, value], rowIndex) => [
      addText(this.scene, left + 18, CARD_TOP + 334 + rowIndex * 29, label, 14, "#887c66", { strokeThickness: 0 }).setOrigin(0, 0),
      addText(this.scene, left + CARD_WIDTH - 18, CARD_TOP + 334 + rowIndex * 29, String(value), 14, "#b9ad93", { strokeThickness: 0 }).setOrigin(1, 0),
    ]);
    const hint = addText(
      this.scene,
      centerX,
      CARD_TOP + 454,
      selected ? "再次点击读取此档" : "点击选择",
      14,
      selected ? "#dbbd72" : "#756c5b",
      { strokeThickness: 0 },
    ).setOrigin(0.5);
    this.root.add([portrait, divider, name, ...rowObjects, hint]);
  }

  renderAutoSaveControls(state) {
    const checkX = 740;
    const checkY = 956;
    const check = this.scene.add.graphics();
    check.fillStyle(state.autoSaveEnabled ? 0x6f5723 : 0x332b20, 1);
    check.fillRect(checkX, checkY, 18, 18);
    check.lineStyle(1, 0xa99158, 1);
    check.strokeRect(checkX, checkY, 18, 18);
    if (state.autoSaveEnabled) {
      check.lineStyle(3, 0xf2e0ad, 1);
      check.beginPath();
      check.moveTo(checkX + 4, checkY + 9);
      check.lineTo(checkX + 8, checkY + 13);
      check.lineTo(checkX + 15, checkY + 5);
      check.strokePath();
    }
    const label = addText(this.scene, 770, checkY + 9, "启用自动存档  间隔：", 21, "#55492f", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.root.add([check, label]);
    this.addHitArea(checkX - 5, checkY - 5, 290, 28, () => {
      this.saveArchiveService.setAutoSaveEnabled(!state.autoSaveEnabled);
      this.notice = state.autoSaveEnabled ? "自动存档已关闭。" : "自动存档已启用。";
      this.noticeColor = "#65583a";
      this.render();
    });

    const selectX = 1058;
    const selectY = 955;
    const selectWidth = 112;
    const select = this.scene.add.graphics();
    select.fillStyle(0x5a431f, 1);
    select.fillRoundedRect(selectX, selectY - 4, selectWidth, 30, 4);
    select.lineStyle(1, 0x9d7f45, 1);
    select.strokeRoundedRect(selectX, selectY - 4, selectWidth, 30, 4);
    const current = addText(this.scene, selectX + 14, selectY + 11, `${state.autoSaveIntervalMinutes}分钟`, 16, "#f0e2c1", { strokeThickness: 0 }).setOrigin(0, 0.5);
    const arrow = addText(this.scene, selectX + 94, selectY + 10, this.intervalMenuOpen ? "▲" : "▼", 13, "#f0e2c1", { strokeThickness: 0 }).setOrigin(0.5);
    this.root.add([select, current, arrow]);
    this.addHitArea(selectX, selectY - 4, selectWidth, 30, () => {
      this.intervalMenuOpen = !this.intervalMenuOpen;
      this.render();
    });

    if (!this.intervalMenuOpen) return;
    [5, 10, 15, 30].forEach((minutes, index) => {
      const top = selectY - 4 - (index + 1) * 31;
      const option = this.scene.add.graphics();
      option.fillStyle(minutes === state.autoSaveIntervalMinutes ? 0x79602b : 0x352a1c, 1);
      option.fillRect(selectX, top, selectWidth, 30);
      option.lineStyle(1, 0x8d7241, 1);
      option.strokeRect(selectX, top, selectWidth, 30);
      const optionLabel = addText(this.scene, selectX + selectWidth / 2, top + 15, `${minutes}分钟`, 15, "#f0e2c1", { strokeThickness: 0 }).setOrigin(0.5);
      this.root.add([option, optionLabel]);
      this.addHitArea(selectX, top, selectWidth, 30, () => {
        this.saveArchiveService.setAutoSaveInterval(minutes);
        this.intervalMenuOpen = false;
        this.notice = `自动存档间隔已设为 ${minutes} 分钟。`;
        this.noticeColor = "#65583a";
        this.render();
      });
    });
  }

  selectOrLoadSlot(index, hasSave) {
    playUiClickSound(this.scene);
    if (hasSave && this.selectedSlotIndex === index) {
      const result = this.saveArchiveService.loadSlot(index);
      this.notice = result.success ? `已读取档位 ${index + 1}。` : result.message;
      this.noticeColor = result.success ? "#4f7759" : "#a44f45";
      if (result.success) this.onLoaded(index);
      else this.render();
      return;
    }
    this.selectedSlotIndex = index;
    this.deleteConfirmPending = false;
    this.notice = hasSave ? `已选择档位 ${index + 1}；再次点击可读取。` : `已选择空档位 ${index + 1}。`;
    this.noticeColor = "#65583a";
    this.render();
  }

  saveSelectedSlot() {
    playUiClickSound(this.scene);
    this.beforeSave();
    this.deleteConfirmPending = false;
    const result = this.saveArchiveService.saveSlot(this.selectedSlotIndex);
    this.notice = result.success ? `档位 ${this.selectedSlotIndex + 1} 保存成功。` : result.message;
    this.noticeColor = result.success ? "#4f7759" : "#a44f45";
    this.render();
  }

  /**
   * 删除是不可恢复的操作，因此采用同一按钮的二次点击确认，而不是第一次点击就直接清空存档。
   */
  deleteSelectedSlot() {
    playUiClickSound(this.scene);
    const state = this.saveArchiveService.getState();
    if (!state.slots[this.selectedSlotIndex]) {
      this.notice = "当前档位为空，无法删除。";
      this.noticeColor = "#a44f45";
      this.deleteConfirmPending = false;
      this.render();
      return;
    }
    if (!this.deleteConfirmPending) {
      this.deleteConfirmPending = true;
      this.notice = "再次点击“确认删除”将永久清空该手动档案。";
      this.noticeColor = "#b55e4e";
      this.render();
      return;
    }
    const result = this.saveArchiveService.deleteSlot(this.selectedSlotIndex);
    this.deleteConfirmPending = false;
    this.notice = result.success ? `档位 ${this.selectedSlotIndex + 1} 已删除。` : result.message;
    this.noticeColor = result.success ? "#4f7759" : "#a44f45";
    this.render();
  }

  handlePointer(points) {
    const point = points[0] || { x: 0, y: 0 };
    // 后绘制的下拉选项应优先命中，因此从尾部向前查找。
    const hit = [...this.hitAreas].reverse().find((area) => (
      point.x >= area.x && point.x <= area.x + area.width
      && point.y >= area.y && point.y <= area.y + area.height
    ));
    if (hit) hit.action();
  }
}
