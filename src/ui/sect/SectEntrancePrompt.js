import { BuildingEntrancePrompt } from "../world/BuildingEntrancePrompt.js";

/** 旧门派入口接口的兼容层；实际绘制已经统一交给通用建筑入口按钮。 */
export class SectEntrancePrompt extends BuildingEntrancePrompt {
  constructor(scene, onEnter) {
    super(scene, (entry) => onEnter(entry.sect, entry.buildingObject));
  }

  show({ sect, buildingObject, x = buildingObject.x, y }) {
    super.show({ entry: { kind: "sect", sect, buildingObject }, x, y });
  }
}
