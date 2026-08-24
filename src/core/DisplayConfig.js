/**
 * 全项目统一使用 1920×1080 作为屏幕设计尺寸。
 *
 * 所有界面现在直接使用 Full HD 像素坐标，不再使用镜头倍率兼容旧尺寸。
 */
export const SCREEN_WIDTH = 1920;
export const SCREEN_HEIGHT = 1080;
/** 保证场景使用一对一镜头；应在场景 create() 开头调用。 */
export function configureFullHdScene(scene) {
  scene.cameras.main.setOrigin(0.5, 0.5).setZoom(1);
}
