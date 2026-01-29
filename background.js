// background.js

// 监听插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 打开独立窗口
  chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 600,
    height: 700,
    left: 100,
    top: 100,
    focused: true
  }, (window) => {
    // 窗口创建成功后的回调
    console.log('Replay-N window created:', window.id);
  });
});

// 监听窗口关闭事件（可选）
chrome.windows.onRemoved.addListener((windowId) => {
  console.log('Window closed:', windowId);
});
