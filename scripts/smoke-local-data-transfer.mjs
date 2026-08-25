import assert from "node:assert/strict";
import { pickLocalBackupFile } from "../src/core/LocalDataTransfer.js";

/** 创建一个最小文件选择环境，用来模拟 Windows 文件窗口与浏览器事件顺序。 */
function createPickerEnvironment(onClick) {
  class FakeInput extends EventTarget {
    constructor() {
      super();
      this.files = [];
      this.style = {};
      this.removed = false;
    }

    click() { onClick(this, fakeWindow); }
    remove() { this.removed = true; }
  }

  const fakeWindow = new EventTarget();
  fakeWindow.setTimeout = setTimeout;
  fakeWindow.clearTimeout = clearTimeout;
  const input = new FakeInput();
  const fakeDocument = {
    body: { appendChild() {} },
    createElement(type) {
      assert.equal(type, "input");
      return input;
    },
  };
  return { fakeDocument, fakeWindow, input };
}

// Windows 上常见的真实顺序：网页先恢复焦点，随后 input 才收到 change。
// 旧实现会在 focus 后 0ms 把这次有效选择误判成取消。
const selectedFile = { name: "backup.json" };
const delayedChange = createPickerEnvironment((input, pickerWindow) => {
  pickerWindow.dispatchEvent(new Event("focus"));
  setTimeout(() => {
    input.files = [selectedFile];
    input.dispatchEvent(new Event("change"));
  }, 5);
});
assert.equal(
  await pickLocalBackupFile({
    documentObject: delayedChange.fakeDocument,
    windowObject: delayedChange.fakeWindow,
    focusFallbackDelay: 30,
  }),
  selectedFile,
  "focus 先于 change 时仍必须返回玩家选择的文件",
);

// 支持 cancel 事件的现代浏览器应立即返回取消。
const nativeCancel = createPickerEnvironment((input) => input.dispatchEvent(new Event("cancel")));
assert.equal(
  await pickLocalBackupFile({
    documentObject: nativeCancel.fakeDocument,
    windowObject: nativeCancel.fakeWindow,
    focusFallbackDelay: 30,
  }),
  null,
  "浏览器 cancel 事件应返回空文件",
);

// 较旧浏览器没有 cancel 事件时，focus 延迟检查仍能结束等待。
const focusOnlyCancel = createPickerEnvironment((_input, pickerWindow) => pickerWindow.dispatchEvent(new Event("focus")));
assert.equal(
  await pickLocalBackupFile({
    documentObject: focusOnlyCancel.fakeDocument,
    windowObject: focusOnlyCancel.fakeWindow,
    focusFallbackDelay: 5,
  }),
  null,
  "旧浏览器取消选择后不能让导入流程永久等待",
);

console.log("本地数据文件选择测试通过：Windows focus/change 顺序与两种取消方式处理正确。");
