import { getSectTemplates } from "./SectCatalog.js";

const GENERAL_SECT_OPTIONS = Object.freeze([
  Object.freeze({ value: "", label: "请选择门派" }),
  Object.freeze({ value: "散修", label: "散修（无门派）" }),
]);

const IDENTITY_OPTIONS = Object.freeze([
  Object.freeze({ value: "", label: "请选择身份" }),
  ...[
    "村民", "散修", "商人", "接引人", "外门弟子", "内门弟子", "核心弟子",
    "守山弟子", "执事", "长老", "掌门", "炼丹师", "炼器师", "任务发布者",
  ].map((value) => Object.freeze({ value, label: value })),
]);

const cloneOptions = (options) => options.map((option) => ({ ...option }));

/** NPC 编辑器使用的门派目录；新增门派只需维护 SectCatalog。 */
export function getNpcSectOptions() {
  const options = cloneOptions(GENERAL_SECT_OPTIONS);
  const knownValues = new Set(options.map((option) => option.value));
  getSectTemplates().forEach((sect) => {
    const value = String(sect.name || "").trim();
    if (!value || knownValues.has(value)) return;
    knownValues.add(value);
    options.push({ value, label: value });
  });
  return options;
}

/** 身份是稳定的普通数据，不依赖 Phaser；旧存档里的自定义身份仍由编辑器保留。 */
export function getNpcIdentityOptions() {
  return cloneOptions(IDENTITY_OPTIONS);
}
