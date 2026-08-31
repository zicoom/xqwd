# 游戏设置界面参考

- Pixso 页面：`改版`
- 设计画布：`1920 × 1080`
- 主视觉：浅色宣纸面板、墨金边框、青玉云纹和悬挂流苏
- 原始素材目录：`F:/游戏素材/素材/新UI/设置/`

## 关键坐标

- 全屏遮罩：`1920 × 1080`，黑色 `66%`
- 设置主面板：中心 `(960, 586)`，尺寸 `1115 × 688`
- 标题牌：中心 `(960, 290)`，尺寸 `347 × 93`
- 标题：中心 `(960, 292)`，字号 `38`
- 副标题：中心 `(960, 351)`，字号 `17`
- 关闭按钮：中心 `(1468, 278)`，尺寸 `70 × 72`
- 功能按钮：中心横坐标 `960`，首项中心纵坐标 `414`，纵向间距 `75`
- 深色按钮：`411 × 68`
- 金色按钮：`411 × 69`
- 红色按钮：`411 × 64`
- 状态提示：中心 `(960, 865)`，最大文本宽度 `820`

六个按钮依次为：进入全屏、窗口化、导出游戏数据、导入游戏数据、保存并退出到封面、关闭。按钮外观依次使用
深色、深色、金色、深色、深色、红色；所有文字都以图片中心为锚点绘制，不能用字体基线偏移代替居中。

## 素材映射

用户原始素材保持不变，项目运行使用复制并改成语义名称后的文件：

- `m1.png` → `public/assets/images/pixso/settings/settings-panel.png`
- `m2.png` → `public/assets/images/pixso/settings/title-plaque.png`
- `m3.png` → `public/assets/images/pixso/settings/close-button.png`
- `m5.png` → `public/assets/images/pixso/settings/button-danger.png`
- `m8.png` → `public/assets/images/pixso/settings/button-gold.png`
- `m11.png` → `public/assets/images/pixso/settings/button-dark.png`

## 实现边界

`src/ui/settings/GameSettingsDialog.js` 只负责素材预加载、绘制、点击转发和状态文字反馈。全屏切换、资料导入导出、
当前进度保存以及返回封面的行为继续由场景协调现有 `core` 服务完成；设置 UI 不读取、迁移或修改存档结构。

当前 Pixso 本地 MCP 端点不可连接，因此本轮通过已打开的 Pixso 桌面画板读取当前视觉，并以用户提供的原尺寸 PNG
作为运行时尺寸基准。连接恢复后若需要继续做像素级微调，应先补充当前画板节点 ID，再以节点原始坐标复核本表。
