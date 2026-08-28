/**
 * 第一章主线任务编号。
 * 场景、HUD 和将来的任务编辑器都只传稳定编号，不直接依赖中文任务名称。
 */
export const QINGYUN_INVESTIGATION_ID = "chapter-1-qingyun-investigation";

/** 任务状态只有三种，避免各页面随意创造新的状态文本。 */
export const QUEST_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  COMPLETED: "completed",
});

/** 场景向任务领域报告的剧情事件。 */
export const QUEST_EVENTS = Object.freeze({
  HERB_GATHERED: "herb-gathered",
  SAFE_PATH_CHOSEN: "safe-path-chosen",
  RISK_PATH_CHOSEN: "risk-path-chosen",
  MIST_GUARDIAN_DEFEATED: "mist-guardian-defeated",
  ANCIENT_JADE_FOUND: "ancient-jade-found",
});

/**
 * 第一章不再是“走到古玉旁自动完成”的单点任务。
 * 这四个阶段是主线的最小可玩循环：发现线索 → 作出抉择 → 承担风险 → 取得古玉。
 * 状态仍然只存一个稳定字符串，后续加支线时不会把场景坐标或 UI 状态写进存档。
 */
export const QINGYUN_QUEST_STEPS = Object.freeze({
  GATHER_HERB: "gather-herb",
  CHOOSE_PATH: "choose-path",
  DEFEAT_GUARDIAN: "defeat-guardian",
  FIND_ANCIENT_JADE: "find-ancient-jade",
  COMPLETED: "completed",
});

const VALID_STEPS = new Set(Object.values(QINGYUN_QUEST_STEPS));

/**
 * 第一章目前唯一的任务定义。
 * 文案也集中放在领域层生成的普通视图数据里，HUD 不再根据状态拼接任务规则。
 */
const QINGYUN_QUEST_DEFINITION = Object.freeze({
  id: QINGYUN_INVESTIGATION_ID,
  type: "main",
  typeLabel: "主线任务",
  title: "主线:调查青云山异光",
  shortTitle: "调查青云山异光",
  activeDescription: "循着异光留下的灵气痕迹，查明青云山的异变。",
  completedDescription: "已寻得古玉，青云山异光真相初现。",
  activeGoal: "在山道旁采集带有异光的聚气草",
  completedGoal: "任务已完成",
  pendingRewardLabel: "聚气草、灵石与古玉线索",
  completedRewardLabel: "古玉线索",
  issuer: "栖霞村村长",
  recipient: "暂未确定",
});

const VALID_STATUSES = new Set(Object.values(QUEST_STATUS));

/**
 * 第一章章节任务领域服务。
 *
 * 它只接收普通 JavaScript 数据，不认识 Phaser、场景、图片或按钮。
 * 场景负责报告“玩家找到了古玉”，本服务负责判断能否推进、修改状态、
 * 发放古玉线索并保存；HUD 只展示本服务返回的视图数据。
 */
export class ChapterQuestService {
  constructor({ chapter, player, save = () => true }) {
    this.chapter = chapter || {};
    this.player = player || {};
    this.save = save;
  }

  /** 根据稳定编号返回任务定义；未知编号不会误改当前任务。 */
  getDefinition(questId) {
    return questId === QINGYUN_INVESTIGATION_ID ? QINGYUN_QUEST_DEFINITION : null;
  }

  /** 查询当前任务状态。查询方法不会修改存档。 */
  getStatus(questId = QINGYUN_INVESTIGATION_ID) {
    if (!this.getDefinition(questId)) return null;
    const status = this.chapter.qingyunInvestigation;
    return VALID_STATUSES.has(status) ? status : QUEST_STATUS.NOT_STARTED;
  }

  isActive(questId = QINGYUN_INVESTIGATION_ID) {
    return this.getStatus(questId) === QUEST_STATUS.ACTIVE;
  }

  isCompleted(questId = QINGYUN_INVESTIGATION_ID) {
    return this.getStatus(questId) === QUEST_STATUS.COMPLETED;
  }

  /** 当前进行中的具体步骤；旧进行中档案会在装配时显式补成第一步。 */
  getStep(questId = QINGYUN_INVESTIGATION_ID) {
    if (!this.getDefinition(questId)) return null;
    if (this.isCompleted(questId)) return QINGYUN_QUEST_STEPS.COMPLETED;
    const step = this.chapter.qingyunInvestigationStep;
    return VALID_STEPS.has(step) && step !== QINGYUN_QUEST_STEPS.COMPLETED
      ? step
      : QINGYUN_QUEST_STEPS.GATHER_HERB;
  }

  getActiveGoal(questId = QINGYUN_INVESTIGATION_ID) {
    if (!this.isActive(questId)) return this.getDefinition(questId)?.completedGoal || "任务已完成";
    const goals = {
      [QINGYUN_QUEST_STEPS.GATHER_HERB]: "在山道旁采集带有异光的聚气草",
      [QINGYUN_QUEST_STEPS.CHOOSE_PATH]: "前往雾岚岔路，决定如何追踪异光",
      [QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN]: "击败拦路的雾隐山魈",
      [QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE]: "前往山脚古潭的问道台，寻找古玉",
    };
    return goals[this.getStep(questId)] || QINGYUN_QUEST_DEFINITION.activeGoal;
  }

  /** 接取任务。重复点击进行中的任务保持幂等，不重复写档。 */
  acceptQuest(questId = QINGYUN_INVESTIGATION_ID) {
    if (!this.getDefinition(questId)) return this.failure("任务不存在。");
    if (this.isCompleted(questId)) {
      return { ...this.failure("任务已经完成。"), alreadyCompleted: true };
    }
    if (this.isActive(questId)) {
      return { ok: true, changed: false, alreadyActive: true, saved: true, quest: this.getQuestView(questId) };
    }

    this.chapter.qingyunInvestigation = QUEST_STATUS.ACTIVE;
    this.chapter.qingyunInvestigationStep = QINGYUN_QUEST_STEPS.GATHER_HERB;
    this.chapter.qingyunGuideEnabled = false;
    // 新任务开始前不应携带旧测试流程遗留的古玉完成标记。
    this.chapter.ancientJadeFound = false;
    this.player.hasJade = false;
    return this.success({ accepted: true, quest: this.getQuestView(questId) });
  }

  /**
   * 开启或关闭任务引路。
   * 只有进行中的任务允许引路，未接取和已完成任务不会出现导航箭头。
   */
  setGuideEnabled(questId = QINGYUN_INVESTIGATION_ID, enabled = true) {
    if (!this.getDefinition(questId)) return this.failure("任务不存在。");
    if (!this.isActive(questId)) return this.failure("只有进行中的任务可以设置引路。");
    const nextValue = Boolean(enabled);
    if (Boolean(this.chapter.qingyunGuideEnabled) === nextValue) {
      return { ok: true, changed: false, saved: true, guideEnabled: nextValue };
    }
    this.chapter.qingyunGuideEnabled = nextValue;
    return this.success({ guideEnabled: nextValue });
  }

  /** 放弃任务只允许发生在进行中；古玉完成奖励不会被这个入口反复重置。 */
  abandonQuest(questId = QINGYUN_INVESTIGATION_ID) {
    if (!this.getDefinition(questId)) return this.failure("任务不存在。");
    if (!this.isActive(questId)) return this.failure("当前任务不能放弃。");
    this.chapter.qingyunInvestigation = QUEST_STATUS.NOT_STARTED;
    this.chapter.qingyunInvestigationStep = null;
    this.chapter.qingyunGuideEnabled = false;
    return this.success({ abandoned: true, quest: this.getQuestView(questId) });
  }

  /**
   * 从章节结算页重新体验第一章。
   *
   * 这是一个明确的章节级事务：任务状态、引路、古玉、精英战斗标记与角色战斗资源必须
   * 一次性恢复并只保存一次。场景不能只清除其中几个字段，否则会形成“任务已完成，
   * 但古玉又不存在”的矛盾状态，导致重开后既不能重新接取也不能触发古玉剧情。
   */
  restartChapter() {
    this.chapter.qingyunInvestigation = QUEST_STATUS.NOT_STARTED;
    this.chapter.qingyunInvestigationStep = null;
    this.chapter.qingyunGuideEnabled = false;
    this.chapter.ancientJadeFound = false;
    this.chapter.eliteDefeated = false;
    this.player.hasJade = false;

    const maxHp = Number(this.player.maxHp);
    const maxQi = Number(this.player.maxQi);
    if (Number.isFinite(maxHp) && maxHp >= 0) this.player.hp = maxHp;
    if (Number.isFinite(maxQi) && maxQi >= 0) this.player.qi = maxQi;

    return this.success({ restarted: true, quest: this.getQuestView() });
  }

  /**
   * 接收场景事件并推进任务。
   * 事件和阶段必须匹配，不能靠 UI 或场景坐标跳过“采集—抉择—风险”循环。
   */
  advanceQuest(questId = QINGYUN_INVESTIGATION_ID, eventId) {
    if (!this.getDefinition(questId)) return this.failure("任务不存在。");
    if (this.isCompleted(questId)) {
      return { ...this.failure("任务已经完成。"), alreadyCompleted: true };
    }
    if (!this.isActive(questId)) return this.failure("任务尚未接取。");

    const step = this.getStep(questId);
    const transitions = {
      [QUEST_EVENTS.HERB_GATHERED]: {
        from: QINGYUN_QUEST_STEPS.GATHER_HERB,
        to: QINGYUN_QUEST_STEPS.CHOOSE_PATH,
        message: "异光在雾岚岔路分成了两缕。",
      },
      [QUEST_EVENTS.SAFE_PATH_CHOSEN]: {
        from: QINGYUN_QUEST_STEPS.CHOOSE_PATH,
        to: QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE,
        message: "你绕开了危险，沿着较弱的灵息抵达古潭。",
        rewards: [{ rewardId: "quest-safe-route-spirit-stones", quantity: 4, label: "灵石" }],
      },
      [QUEST_EVENTS.RISK_PATH_CHOSEN]: {
        from: QINGYUN_QUEST_STEPS.CHOOSE_PATH,
        to: QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN,
        message: "浓雾深处传来低吼，雾隐山魈挡住了去路。",
      },
      [QUEST_EVENTS.MIST_GUARDIAN_DEFEATED]: {
        from: QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN,
        to: QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE,
        message: "雾隐山魈退去，古潭方向的灵息重新清晰起来。",
      },
    };
    const transition = transitions[eventId];
    if (transition) {
      if (step !== transition.from) return this.failure("当前不能这样推进任务。");
      this.chapter.qingyunInvestigationStep = transition.to;
      if (eventId === QUEST_EVENTS.SAFE_PATH_CHOSEN) {
        this.player.spiritStones = Math.max(0, Number(this.player.spiritStones) || 0) + 4;
      }
      return this.success({ advanced: true, step: transition.to, message: transition.message, rewards: transition.rewards || [], quest: this.getQuestView(questId) });
    }

    if (eventId !== QUEST_EVENTS.ANCIENT_JADE_FOUND) return this.failure("该事件不能推进此任务。");
    if (step !== QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE) return this.failure("异光的线索尚未追查完毕。");

    this.chapter.ancientJadeFound = true;
    this.player.hasJade = true;
    this.chapter.qingyunInvestigation = QUEST_STATUS.COMPLETED;
    this.chapter.qingyunInvestigationStep = QINGYUN_QUEST_STEPS.COMPLETED;
    this.chapter.qingyunGuideEnabled = false;
    return this.success({
      completed: true,
      rewards: [{ rewardId: "quest-clue-ancient-jade", quantity: 1, label: "古玉线索" }],
      quest: this.getQuestView(questId),
    });
  }

  /** 地图目标光圈只在任务进行中、玩家主动开启引路且正追踪古玉时显示。 */
  shouldShowTargetMarker(questId = QINGYUN_INVESTIGATION_ID) {
    return this.isActive(questId)
      && Boolean(this.chapter.qingyunGuideEnabled)
      && this.getStep(questId) === QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE
      && !Boolean(this.chapter.ancientJadeFound);
  }

  /** 屏幕方向箭头与地图目标使用同一条领域判断，避免两处状态不一致。 */
  shouldShowGuide(questId = QINGYUN_INVESTIGATION_ID) {
    return this.isActive(questId) && Boolean(this.chapter.qingyunGuideEnabled);
  }

  /** 只有完成前置探索、进行中的主线能触发第一次古玉剧情。 */
  canDiscoverAncientJade() {
    return this.isActive()
      && this.getStep() === QINGYUN_QUEST_STEPS.FIND_ANCIENT_JADE
      && !Boolean(this.chapter.ancientJadeFound);
  }

  /** 完成后古玉位置保留为可重复进入的战斗测试入口。 */
  canRepeatJadeInteraction() {
    return this.isCompleted() && Boolean(this.chapter.ancientJadeFound);
  }

  /**
   * 返回任务日志所需的普通数据。
   * UI 可以决定坐标和颜色，但不再判断什么状态属于“进行中”或“已完成”。
   */
  getQuestView(questId = QINGYUN_INVESTIGATION_ID) {
    const definition = this.getDefinition(questId);
    if (!definition) return null;
    const status = this.getStatus(questId);
    const active = status === QUEST_STATUS.ACTIVE;
    const completed = status === QUEST_STATUS.COMPLETED;
    return {
      ...definition,
      status,
      active,
      completed,
      guideEnabled: active && Boolean(this.chapter.qingyunGuideEnabled),
      badgeLabel: completed ? "已完成" : (active ? "进行中" : "未接取"),
      step: completed ? QINGYUN_QUEST_STEPS.COMPLETED : this.getStep(questId),
      description: completed ? definition.completedDescription : definition.activeDescription,
      goal: completed ? definition.completedGoal : this.getActiveGoal(questId),
      rewardLabel: completed ? definition.completedRewardLabel : definition.pendingRewardLabel,
      canEnableGuide: active,
      canAbandon: active,
    };
  }

  /** 按任务日志页签筛选。未接取任务暂不显示在玩家日志中。 */
  getJournalView(filter = "active") {
    const quest = this.getQuestView();
    const hasTask = filter === "all"
      ? Boolean(quest?.active || quest?.completed)
      : (filter === "completed" ? Boolean(quest?.completed) : Boolean(quest?.active));
    return { filter, hasTask, quest: hasTask ? quest : null };
  }

  /** 返回右侧当前任务栏的显示数据。 */
  getHudView() {
    const quest = this.getQuestView();
    return quest?.active
      ? { hasActiveQuest: true, text: `主线：${quest.shortTitle}\n目标：${quest.goal}` }
      : { hasActiveQuest: false, text: "暂无进行中的任务" };
  }

  /**
   * 一次性修复历史版本可能产生的矛盾状态。
   * 该方法由场景装配阶段主动调用，查询或 render() 不会暗中迁移存档。
   */
  reconcileLegacyState() {
    let changed = false;
    let status = this.chapter.qingyunInvestigation;
    if (!VALID_STATUSES.has(status)) {
      status = Boolean(this.chapter.ancientJadeFound) ? QUEST_STATUS.COMPLETED : QUEST_STATUS.NOT_STARTED;
      this.chapter.qingyunInvestigation = status;
      changed = true;
    }

    if (status === QUEST_STATUS.ACTIVE && (this.chapter.ancientJadeFound || this.player.hasJade)) {
      this.chapter.ancientJadeFound = false;
      this.player.hasJade = false;
      changed = true;
    }
    if (status === QUEST_STATUS.ACTIVE && !VALID_STEPS.has(this.chapter.qingyunInvestigationStep)) {
      this.chapter.qingyunInvestigationStep = QINGYUN_QUEST_STEPS.GATHER_HERB;
      changed = true;
    }
    if (status === QUEST_STATUS.COMPLETED) {
      if (!this.chapter.ancientJadeFound) { this.chapter.ancientJadeFound = true; changed = true; }
      if (!this.player.hasJade) { this.player.hasJade = true; changed = true; }
      if (this.chapter.qingyunGuideEnabled) { this.chapter.qingyunGuideEnabled = false; changed = true; }
      if (this.chapter.qingyunInvestigationStep !== QINGYUN_QUEST_STEPS.COMPLETED) {
        this.chapter.qingyunInvestigationStep = QINGYUN_QUEST_STEPS.COMPLETED;
        changed = true;
      }
    }
    if (status === QUEST_STATUS.NOT_STARTED && this.chapter.qingyunGuideEnabled) {
      this.chapter.qingyunGuideEnabled = false;
      changed = true;
    }
    if (status === QUEST_STATUS.NOT_STARTED && this.chapter.qingyunInvestigationStep) {
      this.chapter.qingyunInvestigationStep = null;
      changed = true;
    }

    const saved = changed ? this.save() !== false : true;
    return { ok: true, changed, saved, quest: this.getQuestView() };
  }

  success(extra = {}) {
    const saved = this.save() !== false;
    return { ok: true, changed: true, saved, ...extra };
  }

  failure(message) {
    return { ok: false, changed: false, saved: true, message };
  }
}
