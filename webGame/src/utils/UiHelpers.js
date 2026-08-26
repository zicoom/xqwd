import { configureFullHdScene } from "../core/DisplayConfig.js";

// 大地图的背景乐不依赖外部版权音乐文件，而是用浏览器音频合成一段原创的
// 五声音阶旋律。这样离线打开游戏也能一直听到音乐。
let cultivationMusic = null;

/**
 * 创建统一风格文字。
 * Phaser 的文字样式参数较多，封装后每个场景都能复用，后期换字体/颜色也更方便。
 */
export function addText(scene, x, y, text, size = 24, color = "#fff7dc", extra = {}) {
  // origin 是显示对象属性而不是 TextStyle；旧实现把它直接塞进样式对象，
  // 导致所有声明了 origin: 0.5 的按钮文字实际上仍从左上角开始绘制。
  const { origin, ...style } = extra;
  const textObject = scene.add.text(x, y, text, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: `${size}px`,
    color,
    stroke: "#1c1914",
    strokeThickness: 4,
    ...style,
  });
  if (Array.isArray(origin)) textObject.setOrigin(origin[0] ?? 0, origin[1] ?? origin[0] ?? 0);
  else if (origin !== undefined) textObject.setOrigin(origin);
  return textObject;
}

/** 播放很短的界面点击声；使用浏览器内置音源，因此不需要额外下载音效文件。 */
export function playUiClickSound(scene) {
  try {
    const context = scene?.sound?.context || scene?.game?.sound?.context;
    if (!context || context.state === "closed") return;

    const emitTone = () => {
      if (context.state !== "running") return;
      const now = context.currentTime + 0.004;
      const output = scene?.sound?.destination || scene?.game?.sound?.destination || context.destination;
      // 恢复项目原本柔和的单一正弦上扬音色；只适度提高音量，避免再次被背景音乐盖住。
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(560, now);
      oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.055);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.start(now);
      oscillator.stop(now + 0.09);
    };

    if (context.state === "running") {
      emitTone();
      return;
    }

    // 浏览器在切换全屏、切回标签页或首次进入游戏时可能暂停 AudioContext。
    // 必须等待恢复完成后再创建短音；旧实现没有等待，导致声音在恢复前就被浏览器吞掉。
    scene?.sound?.unlock?.();
    const resumed = context.resume?.();
    if (resumed?.then) resumed.then(emitTone).catch(() => {});
  } catch (_) {
    // 浏览器禁止声音或设备不支持时，按钮功能仍照常可用。
  }
}

/**
 * 播放一段可循环的轻柔修仙纯音乐：古筝般的拨弦、远处笛音和低沉的山风底音。
 * 浏览器必须先收到一次玩家点击才能播放声音；若页面是刷新进入地图，会在第一次
 * 鼠标点击或按键后自动开始，不需要玩家额外操作。
 */
export function startCultivationBackgroundMusic(scene) {
  try {
    const context = scene?.sound?.context || scene?.game?.sound?.context;
    if (!context) return;
    if (cultivationMusic?.context === context) {
      cultivationMusic.startWhenReady();
      return;
    }
    stopCultivationBackgroundMusic();

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.connect(context.destination);

    const loopSeconds = 18;
    const melody = [
      [0.35, 293.66, 0.72], [1.30, 349.23, 0.62], [2.25, 440.0, 0.92], [3.65, 349.23, 0.60],
      [4.55, 329.63, 0.70], [5.65, 293.66, 1.15], [7.30, 261.63, 0.68], [8.25, 293.66, 0.58],
      [9.30, 392.0, 0.82], [10.50, 440.0, 1.12], [12.10, 392.0, 0.64], [13.05, 349.23, 0.70],
      [14.10, 329.63, 0.72], [15.20, 293.66, 1.25],
    ];
    const flute = [
      [2.35, 587.33, 1.65], [6.05, 523.25, 1.45], [10.55, 659.25, 1.72], [14.30, 587.33, 1.55],
    ];
    let timer = null;
    let started = false;

    const tone = (frequency, when, duration, volume, type, attack, release) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(when);
      oscillator.stop(when + duration + release + 0.05);
    };

    const scheduleLoop = (startAt) => {
      // 低沉的山风和弦，保持山林的空间感。
      [146.83, 220.0].forEach((frequency) => tone(frequency, startAt, loopSeconds - 0.1, 0.019, "sine", 0.8, 0.5));
      melody.forEach(([offset, frequency, duration]) => tone(frequency, startAt + offset, duration, 0.065, "triangle", 0.018, 0.34));
      flute.forEach(([offset, frequency, duration]) => tone(frequency, startAt + offset, duration, 0.022, "sine", 0.26, 0.65));
    };

    const begin = () => {
      if (started || context.state !== "running") return;
      started = true;
      const startAt = context.currentTime + 0.08;
      master.gain.exponentialRampToValueAtTime(0.22, startAt + 1.5);
      scheduleLoop(startAt);
      timer = window.setInterval(() => scheduleLoop(context.currentTime + 0.12), loopSeconds * 1000);
    };

    const startWhenReady = () => {
      if (context.state === "running") {
        begin();
        return;
      }
      const unlock = () => {
        context.resume?.().then(begin).catch(() => {});
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    };

    cultivationMusic = {
      context,
      master,
      startWhenReady,
      stop() {
        if (timer) window.clearInterval(timer);
        timer = null;
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0.0001, context.currentTime);
        master.disconnect();
      },
    };
    startWhenReady();
  } catch (_) {
    // 声音设备被浏览器禁用时，游戏仍可正常运行。
  }
}

/** 停止大地图背景乐，防止离开场景后仍与其他场景音乐叠加。 */
export function stopCultivationBackgroundMusic() {
  cultivationMusic?.stop?.();
  cultivationMusic = null;
}

/** 创建一个可点击的国风按钮，并返回按钮容器。 */
export function addButton(scene, x, y, width, label, onClick, options = {}) {
  const height = options.height ?? 48;
  const container = scene.add.container(x, y);
  const background = scene.add.rectangle(0, 0, width, height, 0x3e2d21, 0.96)
    .setStrokeStyle(2, 0xd9b66d)
    .setInteractive({ useHandCursor: true });
  const text = addText(scene, 0, 0, label, options.size ?? 19, "#ffe7a9", {
    origin: 0.5,
    align: "center",
  });
  container.add([background, text]);
  background.on("pointerover", () => background.setFillStyle(0x60432c));
  background.on("pointerout", () => background.setFillStyle(0x3e2d21));
  background.on("pointerdown", (...args) => {
    playUiClickSound(scene);
    onClick(...args);
  });
  return container;
}

/** 在场景顶部绘制统一的标题横幅。 */
export function addTitle(scene, title, subtitle = "") {
  configureFullHdScene(scene);
  scene.add.rectangle(960, 83, 1920, 165, 0x172c2a, 0.86);
  addText(scene, 960, 53, title, 51, "#f5d38a", { origin: 0.5 });
  if (subtitle) addText(scene, 960, 116, subtitle, 24, "#d6dfc5", { origin: 0.5 });
}
