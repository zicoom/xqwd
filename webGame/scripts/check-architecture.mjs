import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectJavaScriptFiles(fullPath) : entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

const failures = [];
for (const file of collectJavaScriptFiles(sourceRoot)) {
  const relativePath = path.relative(projectRoot, file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");
  // 只检查可执行代码，注释中用于解释边界的“Phaser”等词不应造成误报。
  const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  if (relativePath.startsWith("src/domain/")) {
    if (/\bPhaser\b/.test(executableSource)) failures.push(`${relativePath}: 领域模块不能依赖 Phaser`);
    if (/from\s+["'][^"']*\/(ui|scenes)\//.test(executableSource)) failures.push(`${relativePath}: 领域模块不能反向导入 UI 或场景`);
    if (/\b(document|window)\./.test(executableSource)) failures.push(`${relativePath}: 领域模块不能直接访问 DOM 或 window`);
  }
  if (relativePath === "src/core/GameState.js") {
    if (!/from\s+["']\.\/save\/SaveMigrations\.js["']/.test(executableSource)) {
      failures.push(`${relativePath}: 游戏状态读写必须通过统一存档迁移模块`);
    }
    if (/\bversion\s*:\s*1\b/.test(executableSource)) {
      failures.push(`${relativePath}: GameState 不能继续写死旧版存档版本`);
    }
  }
  if (relativePath === "src/scenes/MonsterEditorScene.js") {
    if (!/from\s+["'][^"']*\/ui\/editor\/MonsterDropEditorPanel\.js["']/.test(executableSource)) {
      failures.push(`${relativePath}: 怪物掉落必须交给独立 MonsterDropEditorPanel 编辑`);
    }
    if (/window\.prompt\s*\([^\n]*(?:掉落|drop)/i.test(executableSource)) {
      failures.push(`${relativePath}: 怪物掉落不能继续使用自由文本 prompt`);
    }
  }
  if (relativePath === "src/ui/editor/MonsterDropEditorPanel.js" && /\b(?:localStorage|gameState|ItemCatalog)\b/.test(executableSource)) {
    failures.push(`${relativePath}: 掉落编辑面板只能消费 RewardCatalog，不能直接读取存档或物品仓库`);
  }
  if (relativePath.startsWith("src/ui/") && /\.getMerchantItems\s*\(/.test(executableSource)) {
    failures.push(`${relativePath}: UI 不能通过商店页面接口读取通用物品`);
  }
  if (relativePath.startsWith("src/scenes/") && /\bthis\.merchant(?:Mode|Items|Carts?|SelectedItem|BuyQuantity|Category|ProductScroll|CartScroll|QuantityInput|PurchaseConfirm|ShopNotice)\b/.test(executableSource)) {
    failures.push(`${relativePath}: 场景不能持有商店页面或交易会话状态，应交给 MerchantPanel`);
  }
  if (relativePath.startsWith("src/scenes/") && /^\s*(?:open|close|render|select|purchase|confirm|cancel|change|refresh|format|show|update|get|set)[A-Za-z]*Merchant[A-Za-z]*\s*\(/m.test(executableSource)) {
    failures.push(`${relativePath}: 场景不能重新声明商店页面方法，应直接调用 MerchantPanel`);
  }
  if (relativePath === "src/ui/StorageBagPanel.js") {
    if (/from\s+["'][^"']*\/(?:artifacts|techniques)\//.test(executableSource)) {
      failures.push(`${relativePath}: 储物袋子页不能装配法宝或功法页面`);
    }
    if (/\b(?:activeTab|navEntries|navSelection)\b/.test(executableSource)) {
      failures.push(`${relativePath}: 一级导航状态必须由 CharacterMenuPanel 持有`);
    }
  }
  if (relativePath === "src/ui/spells/SpellPanel.js") {
    if (/from\s+["'][^"']*\/(?:techniques|artifacts|inventory)\//.test(executableSource)) {
      failures.push(`${relativePath}: 法术页不能依赖功法、法宝或背包页面实现`);
    }
    if (/\b(?:equippedTechniques|learnedTechniques|gameState)\b/.test(executableSource)) {
      failures.push(`${relativePath}: 法术页只能通过 SpellService 查询法术状态`);
    }
  }
  if (relativePath === "src/ui/artifacts/ArtifactPanel.js") {
    if (/\b(?:gameState|equippedArtifacts|player\.inventory|catalog\.)\b/.test(executableSource)) {
      failures.push(`${relativePath}: 法宝页只能通过 ArtifactLoadoutService 查询或修改配装`);
    }
  }
  if (relativePath === "src/scenes/BattleScene.js") {
    if (!/from\s+["'][^"']*\/domain\/combat\/CombatEngine\.js["']/.test(executableSource)) {
      failures.push(`${relativePath}: 战斗场景必须通过 CombatEngine 执行战斗规则`);
    }
    if (/Phaser\.(?:Math\.Between|Utils\.Array\.GetRandom)/.test(executableSource)) {
      failures.push(`${relativePath}: 战斗随机数与技能选择必须由 CombatEngine 负责`);
    }
    if (/(?:gameState\.player|this\.enemy)\.(?:hp|qi)\s*(?:=|\+=|-=|\+\+|--)/.test(executableSource)) {
      failures.push(`${relativePath}: 战斗场景不能直接修改双方生命或灵气`);
    }
    if (!/from\s+["'][^"']*\/domain\/rewards\/BattleRewardService\.js["']/.test(executableSource)) {
      failures.push(`${relativePath}: 战斗胜利必须通过 BattleRewardService 结算奖励与进度`);
    }
    if (/(?:gameState\.player\.(?:spiritStones|cultivationExp)|gameState\.player\.inventory(?:\s*\[[^\]]+\])?|gameState\.world\.defeatedMonsterIds|gameState\.chapter\.eliteDefeated)\s*(?:=|\+=|-=)|gameState\.world\.defeatedMonsterIds\.(?:push|splice)\s*\(/.test(executableSource)) {
      failures.push(`${relativePath}: 战斗场景不能直接发放奖励或推进击败进度`);
    }
  }
  if (relativePath === "src/scenes/VillageScene.js") {
    if (!/from\s+["'][^"']*\/domain\/quests\/ChapterQuestService\.js["']/.test(executableSource)) {
      failures.push(`${relativePath}: 第一章场景必须通过 ChapterQuestService 推进章节任务`);
    }
    if (/gameState\.(?:chapter\.(?:qingyunInvestigation|qingyunGuideEnabled|ancientJadeFound)|player\.hasJade)\b/.test(executableSource)) {
      failures.push(`${relativePath}: 场景不能直接读取或修改章节任务状态，应调用 ChapterQuestService`);
    }
  }
  if (relativePath === "src/ui/ChapterMapHud.js") {
    if (/\bsaveFirstChapterProgress\b/.test(executableSource)) {
      failures.push(`${relativePath}: HUD 不能直接保存章节任务，应由 ChapterQuestService 负责`);
    }
    if (/gameState\.(?:chapter\.(?:qingyunInvestigation|qingyunGuideEnabled|ancientJadeFound)|player\.hasJade)\b/.test(executableSource)) {
      failures.push(`${relativePath}: HUD 不能直接读取或修改章节任务状态，应消费任务视图数据`);
    }
  }
}

if (failures.length) {
  console.error("架构检查失败：\n" + failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("架构检查通过：领域依赖方向和跨页面边界正确；未设置代码行数限制。");
