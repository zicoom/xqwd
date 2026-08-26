const ELEMENTAL_SPELLS = Object.freeze({
  金: { id: "element-metal", name: "金刃术", element: "金", description: "凝聚金灵气化作锋锐刃光。" },
  木: { id: "element-wood", name: "青藤术", element: "木", description: "催生青藤束缚并侵扰敌手。" },
  水: { id: "element-water", name: "水箭术", element: "水", description: "汇聚水灵气射出凝练水箭。" },
  火: { id: "element-fire", name: "火弹术", element: "火", description: "压缩火灵气形成炽热火弹。" },
  土: { id: "element-earth", name: "岩甲术", element: "土", description: "引动土灵气凝成护体岩甲。" },
});

/** 法术查询独立于功法配装；功法中的“法术类”只作为法术来源之一。 */
export class SpellService {
  constructor({ player, catalog }) {
    this.player = player;
    this.catalog = catalog;
  }

  getInnateSpell() {
    const spell = ELEMENTAL_SPELLS[this.player.selectedElement] || ELEMENTAL_SPELLS.火;
    return { ...spell, source: "灵根天赋", grade: "先天", innate: true };
  }

  listAvailable() {
    const learnedIds = new Set(Array.isArray(this.player.learnedTechniques) ? this.player.learnedTechniques : []);
    const equipped = this.player.equippedTechniques || {};
    [equipped.main, equipped.speed, ...(equipped.auxiliary || [])].filter(Boolean).forEach((id) => learnedIds.add(id));
    const techniqueSpells = this.catalog.all().filter((item) => (
      item.type === "功法" && item.techniqueKind === "法术" && learnedIds.has(item.id)
    )).map((item) => ({ ...item, element: item.techniqueElement || "无", source: "功法", innate: false }));
    return [this.getInnateSpell(), ...techniqueSpells];
  }

  getSummary() {
    const spells = this.listAvailable();
    return `当前主灵根：${this.player.selectedElement}\n已掌握法术：${spells.map((spell) => spell.name).join("、")}`;
  }
}
