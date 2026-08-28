import assert from "node:assert/strict";
import {
  CharacterCreationService,
  FIVE_ELEMENTS,
} from "../src/domain/character/CharacterCreationService.js";

const portraits = [
  { id: "male-a", name: "青衣书生", gender: "男" },
  { id: "female-a", name: "紫衣散修", gender: "女" },
  { id: "male-b", name: "山野猎户", gender: "男" },
];

function createPlayer(overrides = {}) {
  return {
    name: "无名散修",
    gender: "女",
    portraitId: "female-a",
    roots: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 },
    selectedElement: "火",
    attack: 8,
    ...overrides,
  };
}

assert.deepEqual(FIVE_ELEMENTS, ["金", "木", "水", "火", "土"]);

{
  const player = createPlayer();
  const service = new CharacterCreationService({ player, portraits });
  assert.deepEqual(service.setName("  太初问道九重天外仙  "), {
    ok: true,
    name: "太初问道九重天外",
  });
  assert.equal(player.name, "太初问道九重天外");
  assert.deepEqual(service.setName("   "), { ok: false, reason: "empty-name" });
  assert.equal(player.name, "太初问道九重天外");
}

{
  const player = createPlayer({ gender: "男", portraitId: "missing" });
  new CharacterCreationService({ player, portraits, defaultPortraitId: "female-a" });
  assert.equal(player.portraitId, "female-a");
  assert.equal(player.gender, "女");
}

{
  const player = createPlayer();
  const service = new CharacterCreationService({ player, portraits });
  assert.deepEqual(service.selectPortrait("male-b"), {
    ok: true,
    portrait: portraits[2],
  });
  assert.equal(player.portraitId, "male-b");
  assert.equal(player.gender, "男");
  assert.equal(service.selectPortrait("missing").ok, false);

  const genderResult = service.setGender("女");
  assert.equal(genderResult.ok, true);
  assert.equal(player.gender, "女");
  assert.equal(player.portraitId, "female-a");
  assert.deepEqual(service.setGender("未知"), { ok: false, reason: "invalid-gender" });
}

{
  const player = createPlayer();
  const service = new CharacterCreationService({ player, portraits });
  assert.equal(service.getRemainingPoints(), 10);
  for (let index = 0; index < 10; index += 1) {
    assert.equal(service.changeRoot("火", 1).ok, true);
  }
  assert.equal(player.roots.火, 10);
  assert.equal(service.getRemainingPoints(), 0);
  assert.deepEqual(service.changeRoot("木", 1), { ok: false, reason: "no-points" });
  assert.deepEqual(service.changeRoot("火", -1), { ok: true, value: 9, remaining: 1 });
  assert.deepEqual(service.changeRoot("火", -20), { ok: false, reason: "invalid-delta" });
  assert.deepEqual(service.changeRoot("风", 1), { ok: false, reason: "invalid-element" });
}

{
  const player = createPlayer({ roots: { 金: 5, 木: 5, 水: 0, 火: 0, 土: 0 } });
  const service = new CharacterCreationService({ player, portraits });
  assert.equal(service.getRemainingPoints(), 0);
  assert.equal(service.getHighestElement(), "金");
  assert.equal(service.getSkillPreview().skillName, "金刃诀");
  assert.deepEqual(service.confirm(), {
    ok: true,
    selectedElement: "金",
    attack: 18,
  });
  assert.equal(player.selectedElement, "金");
  assert.equal(player.attack, 18);
}

{
  const player = createPlayer({ roots: { 金: 2, 木: 1, 水: 0, 火: 0, 土: 0 } });
  const service = new CharacterCreationService({ player, portraits });
  assert.deepEqual(service.confirm(), { ok: false, reason: "unallocated-points", remaining: 7 });
  assert.equal(player.selectedElement, "火");
  assert.equal(player.attack, 8);
}

console.log("角色创建领域服务冒烟验证通过。");
