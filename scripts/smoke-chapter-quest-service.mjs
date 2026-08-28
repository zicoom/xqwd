import assert from "node:assert/strict";
import {
  ChapterQuestService,
  QINGYUN_INVESTIGATION_ID,
  QUEST_EVENTS,
  QUEST_STATUS,
  QINGYUN_QUEST_STEPS,
} from "../src/domain/quests/ChapterQuestService.js";

/**
 * 创建一份完全脱离 Phaser 的任务测试状态。
 * 这样任务接取、引路、完成和奖励规则可以直接在 Node.js 中验证。
 */
const createState = (overrides = {}) => ({
  chapter: {
    ancientJadeFound: false,
    eliteDefeated: false,
    qingyunInvestigation: QUEST_STATUS.NOT_STARTED,
    qingyunGuideEnabled: false,
    ...(overrides.chapter || {}),
  },
  player: {
    hasJade: false,
    hp: 60,
    maxHp: 60,
    qi: 30,
    maxQi: 30,
    ...(overrides.player || {}),
  },
});

const createService = (state, onSave = () => true) => new ChapterQuestService({
  chapter: state.chapter,
  player: state.player,
  save: onSave,
});

// 未接任务时不能开启引路，也不能用无效任务编号改变状态。
{
  const state = createState();
  let saveCount = 0;
  const service = createService(state, () => { saveCount += 1; return true; });
  assert.equal(service.setGuideEnabled(QINGYUN_INVESTIGATION_ID, true).ok, false);
  assert.equal(service.acceptQuest("unknown-quest").ok, false);
  assert.equal(saveCount, 0);
}

// 接取任务后进入进行中；重复接取保持幂等，不重复写档。
{
  const state = createState();
  let saveCount = 0;
  const service = createService(state, () => { saveCount += 1; return true; });
  const accepted = service.acceptQuest(QINGYUN_INVESTIGATION_ID);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.changed, true);
  assert.equal(state.chapter.qingyunInvestigation, QUEST_STATUS.ACTIVE);
  assert.equal(state.chapter.qingyunInvestigationStep, QINGYUN_QUEST_STEPS.GATHER_HERB);
  assert.equal(state.chapter.qingyunGuideEnabled, false);
  assert.equal(saveCount, 1);
  assert.equal(service.acceptQuest(QINGYUN_INVESTIGATION_ID).alreadyActive, true);
  assert.equal(saveCount, 1);

  assert.equal(service.setGuideEnabled(QINGYUN_INVESTIGATION_ID, true).ok, true);
  // 第一站是灵草，不应该误显示终点古玉的地图光圈。
  assert.equal(service.shouldShowTargetMarker(QINGYUN_INVESTIGATION_ID), false);
  assert.equal(service.shouldShowGuide(QINGYUN_INVESTIGATION_ID), true);
  assert.equal(saveCount, 2);

  const abandoned = service.abandonQuest(QINGYUN_INVESTIGATION_ID);
  assert.equal(abandoned.ok, true);
  assert.equal(state.chapter.qingyunInvestigation, QUEST_STATUS.NOT_STARTED);
  assert.equal(state.chapter.qingyunGuideEnabled, false);
  assert.equal(saveCount, 3);
}

// 主线必须依次经历“采集 → 抉择 → 风险/绕路 → 古玉”，不能从地图事件直接跳关。
{
  const state = createState();
  let saveCount = 0;
  const service = createService(state, () => { saveCount += 1; return true; });
  assert.equal(service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.ANCIENT_JADE_FOUND).ok, false);
  service.acceptQuest(QINGYUN_INVESTIGATION_ID);
  service.setGuideEnabled(QINGYUN_INVESTIGATION_ID, true);
  assert.equal(service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.ANCIENT_JADE_FOUND).ok, false);
  assert.equal(service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.HERB_GATHERED).ok, true);
  assert.equal(state.chapter.qingyunInvestigationStep, QINGYUN_QUEST_STEPS.CHOOSE_PATH);
  const safe = service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.SAFE_PATH_CHOSEN);
  assert.equal(safe.ok, true);
  assert.equal(state.chapter.qingyunInvestigationStep, QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE);
  assert.equal(service.canDiscoverAncientJade(), true);
  const completed = service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.ANCIENT_JADE_FOUND);
  assert.equal(completed.ok, true);
  assert.equal(completed.completed, true);
  assert.deepEqual(completed.rewards, [{
    rewardId: "quest-clue-ancient-jade",
    quantity: 1,
    label: "古玉线索",
  }]);
  assert.equal(state.chapter.qingyunInvestigation, QUEST_STATUS.COMPLETED);
  assert.equal(state.chapter.qingyunGuideEnabled, false);
  assert.equal(state.chapter.ancientJadeFound, true);
  assert.equal(state.player.hasJade, true);
  assert.equal(saveCount, 5);

  const repeated = service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.ANCIENT_JADE_FOUND);
  assert.equal(repeated.ok, false);
  assert.equal(repeated.alreadyCompleted, true);
  assert.equal(saveCount, 5);
  assert.equal(service.canRepeatJadeInteraction(), true);
}

// 日志与 HUD 消费普通视图数据，不应自行解释底层状态字段。
{
  const state = createState();
  const service = createService(state);
  assert.equal(service.getJournalView("active").hasTask, false);
  service.acceptQuest(QINGYUN_INVESTIGATION_ID);
  const active = service.getJournalView("active");
  assert.equal(active.hasTask, true);
  assert.equal(active.quest.badgeLabel, "进行中");
  assert.equal(active.quest.canEnableGuide, true);
  assert.match(service.getHudView().text, /调查青云山异光/);
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.HERB_GATHERED);
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.RISK_PATH_CHOSEN);
  assert.equal(service.getQuestView().goal, "击败拦路的雾隐山魈");
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.MIST_GUARDIAN_DEFEATED);
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.ANCIENT_JADE_FOUND);
  assert.equal(service.getJournalView("active").hasTask, false);
  assert.equal(service.getJournalView("completed").quest.badgeLabel, "已完成");
}

// 兼容旧档：进行中却已持有古玉时恢复任务事件；完成档缺少奖励标记时补齐。
{
  const activeLegacy = createState({
    chapter: { qingyunInvestigation: QUEST_STATUS.ACTIVE, qingyunGuideEnabled: true, ancientJadeFound: true },
    player: { hasJade: true },
  });
  let activeSaveCount = 0;
  const activeService = createService(activeLegacy, () => { activeSaveCount += 1; return true; });
  assert.equal(activeService.reconcileLegacyState().changed, true);
  assert.equal(activeLegacy.chapter.ancientJadeFound, false);
  assert.equal(activeLegacy.player.hasJade, false);
  assert.equal(activeLegacy.chapter.qingyunInvestigationStep, QINGYUN_QUEST_STEPS.GATHER_HERB);
  assert.equal(activeSaveCount, 1);

  const completedLegacy = createState({
    chapter: { qingyunInvestigation: QUEST_STATUS.COMPLETED, ancientJadeFound: true },
    player: { hasJade: false },
  });
  const completedService = createService(completedLegacy);
  assert.equal(completedService.reconcileLegacyState().changed, true);
  assert.equal(completedLegacy.player.hasJade, true);

  const invalidLegacy = createState({
    chapter: { qingyunInvestigation: "broken", qingyunGuideEnabled: true },
  });
  const invalidService = createService(invalidLegacy);
  invalidService.reconcileLegacyState();
  assert.equal(invalidLegacy.chapter.qingyunInvestigation, QUEST_STATUS.NOT_STARTED);
  assert.equal(invalidLegacy.chapter.qingyunGuideEnabled, false);
}

// “重新体验第一章”必须通过领域服务一次性恢复任务、章节战斗标记和角色战斗资源。
{
  const state = createState({
    chapter: {
      qingyunInvestigation: QUEST_STATUS.COMPLETED,
      qingyunGuideEnabled: true,
      ancientJadeFound: true,
      eliteDefeated: true,
    },
    player: { hasJade: true, hp: 7, qi: 2 },
  });
  let saveCount = 0;
  const service = createService(state, () => { saveCount += 1; return true; });
  const restarted = service.restartChapter();

  assert.equal(restarted.ok, true);
  assert.equal(restarted.restarted, true);
  assert.equal(state.chapter.qingyunInvestigation, QUEST_STATUS.NOT_STARTED);
  assert.equal(state.chapter.qingyunGuideEnabled, false);
  assert.equal(state.chapter.ancientJadeFound, false);
  assert.equal(state.chapter.eliteDefeated, false);
  assert.equal(state.chapter.qingyunInvestigationStep, null);
  assert.equal(state.player.hasJade, false);
  assert.equal(state.player.hp, state.player.maxHp);
  assert.equal(state.player.qi, state.player.maxQi);
  assert.equal(saveCount, 1);

  // 重开后先回到“未接取”；重新接取后必须先完成前置探索，不能直接触发古玉。
  assert.equal(service.canDiscoverAncientJade(), false);
  service.acceptQuest();
  assert.equal(service.canDiscoverAncientJade(), false);
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.HERB_GATHERED);
  service.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.SAFE_PATH_CHOSEN);
  assert.equal(service.canDiscoverAncientJade(), true);
}

console.log("章节任务领域冒烟测试通过：接取、引路、放弃、推进、完成、重开、奖励和旧档修复正确。");
