import assert from "node:assert/strict";
import { normalizeNpc } from "../src/core/WorldTemplateStore.js";

const malformedLegacyTree = normalizeNpc({
  id: "npc-old-guide",
  name: "旧接引人",
  dialogue: [],
  dialogueTree: {
    startId: "line-1",
    nodes: [
      { id: "line-1", text: "第一句", choices: [{ id: "draft", text: "", nextId: "" }] },
      { id: "line-2", text: "第二句", choices: [] },
      { id: "line-3", text: "第三句", choices: [] },
    ],
  },
});
assert.equal(malformedLegacyTree.dialogueMode, "simple");
assert.deepEqual(malformedLegacyTree.dialogue, ["第一句", "第二句", "第三句"]);
assert.equal(malformedLegacyTree.dialogueTree, null, "无真实玩家选项的旧节点应迁移为连续台词");

const branch = normalizeNpc({
  id: "npc-branch",
  dialogueTree: {
    startId: "start",
    nodes: [{
      id: "start",
      text: "你为何而来？",
      choices: [
        { id: "ask", text: "我想拜师。", nextId: "accept" },
        { id: "draft", text: "", nextId: "" },
      ],
    }, { id: "accept", text: "先去试剑。", choices: [] }],
  },
});
assert.equal(branch.dialogueMode, "branch");
assert.equal(branch.dialogueTree.nodes[0].choices.length, 1, "空白草稿选项不得进入正式分支");

const explicitSingleEnding = normalizeNpc({
  id: "npc-explicit-branch",
  dialogueMode: "branch",
  dialogueTree: { startId: "end", nodes: [{ id: "end", text: "到此为止。", choices: [] }] },
});
assert.equal(explicitSingleEnding.dialogueMode, "branch");
assert.equal(explicitSingleEnding.dialogueTree.nodes[0].text, "到此为止。");

const simple = normalizeNpc({ id: "npc-simple", dialogue: ["第一句", "", "第二句"] });
assert.equal(simple.dialogueMode, "simple");
assert.deepEqual(simple.dialogue, ["第一句", "第二句"]);

console.log("NPC 对话模板冒烟测试通过：旧节点迁移、顺序台词、真实分支与空白选项清理正确。");
