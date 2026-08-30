# Pixso 闭关室画板参考

- Pixso 页面：`改版`
- 画板：`闭关室`
- 节点：`70:1601`
- 设计尺寸：`1920 × 1080`
- 原画板快照：`70-1601.png`

## 主素材与原始坐标

| 元素 | 项目素材 | Pixso 坐标与尺寸 |
| --- | --- | --- |
| 洞府背景 | `public/assets/images/pixso/retreat-room/background.jpg` | `x=0, y=-0.5, 1920×1081` |
| 法术入口 | `spell-entry.png` | `x=452, y=452.25, 244×292` |
| 功法入口 | `technique-entry.png` | `x=1222.23, y=452.25, 243×292` |
| 打坐人物 | `meditating-cultivator.png` | `x=708, y=311.5, 500×500` |
| 时长底板 | `duration-panel.png` | `x=630.5, y=750.8, 640×167` |
| 四档时长按钮 | `duration-option.png` | `108×47`；左坐标依次为 `723.51 / 846.51 / 969.51 / 1092.52` |
| 开始闭关按钮 | `start-retreat-button.png` | `x=777.51, y=951.86, 350×134` |
| 返回门派按钮 | `return-sect-button.png` | `x=1596.25, y=944.71, 276×81` |
| 闭关室名牌 | `room-plaque.png` | `x=1671.25, y=37, 201×156` |

坐标为 1920×1080 设计坐标。Phaser 继续使用 Full HD 画布，浏览器仅负责等比例缩放，禁止按当前浏览器窗口尺寸重算这些布局常量。
