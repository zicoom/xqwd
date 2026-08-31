# 闭关室学习中界面参考

- Pixso 页面：`改版`
- Pixso 节点：`73:482`（闭关室-学习中）
- 设计画布：`1920 × 1080`
- 原节点截图：`73-482.png`
- Pixso 生成参考：`73-482.html`

## 关键坐标

- 全屏遮罩：`1920 × 1080`，黑色 `50%`
- 引气光环：左上 `(565, 188)`，尺寸 `840 × 576`
- 打坐人物：左上 `(705, 350.246338)`，尺寸 `500 × 500`
- 标题“引气入体...”：中心 `(955, 838.195313)`，字号 `58`，颜色 `#DDAC4F`
- 进度轨道：左上 `(556.5, 878.342285)`，尺寸 `807 × 67`
- 进度滑标：尺寸 `77 × 71`，纵向中心 `913.842285`
- 进度文字：中心 `(960, 979.489258)`，字号 `30`，颜色 `#EECA8A`
- 说明文字：中心 `(955, 1027.63623)`，字号 `18`，颜色 `#C2BEBB`

进度填充使用轨道内侧可用区 `x = 638.29 ～ 1281.71`，颜色由左侧绿色 `#277B3C` 渐变到右侧金色
`#E5A800`。Phaser Graphics 的渐变顶点顺序与 CSS 不同，代码端点必须反向传入，最终画面才是正确的左绿右金。
填充宽度和滑标横坐标必须使用领域服务返回的真实进度，不能在 UI 中计算闭关规则。

标题使用 `Alimama DongFangDaKai`，并按单字加入轻微的字号、基线、倾斜、横纵比例、金色深浅与墨影变化；
变化只用于打破机械排字感，标题整体中心仍固定在 `(960, 838.195313)`。

## 素材映射

用户素材 `F:/游戏素材/素材/新UI/闭关/学习中/` 保持原样，项目运行使用复制后的语义文件：

- `l6.png` → `public/assets/images/pixso/retreat-room/learning/section-divider.png`
- `l7.png` → `public/assets/images/pixso/retreat-room/learning/progress-track.png`
- `l8.png` → `public/assets/images/pixso/retreat-room/learning/progress-marker.png`
- `l9.png` → `public/assets/images/pixso/retreat-room/learning/qi-circulation-aura.png`

当前节点没有显示 `section-divider.png`，该文件仅为用户本次提供素材的完整归档。打坐人物继续复用
`public/assets/images/pixso/retreat-room/meditating-cultivator.png`。

## 实现边界

`src/ui/sect/RetreatLearningOverlay.js` 只负责绘制学习中界面和接受进度数据。
`RetreatRoomPanel` 仍通过原 `RetreatStudyService` 开始、推进和完成学习；秘籍消耗、参悟结果、奖励与存档均未迁入 UI。

附带截图来自较早的蓝色圆环方案；实现以当前 Pixso 节点 `73:482` 的墨金引气光环方案为准。
