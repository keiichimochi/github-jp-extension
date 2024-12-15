// インストール時に自動的にピン留めする
chrome.runtime.onInstalled.addListener(async () => {
  // 現在のピン留め状態を確認
  const extensions = await chrome.management.getAll();
  const thisExtension = extensions.find(ext => ext.id === chrome.runtime.id);
  
  if (thisExtension && !thisExtension.enabled) {
    // 拡張機能を有効化
    await chrome.management.setEnabled(chrome.runtime.id, true);
  }
});