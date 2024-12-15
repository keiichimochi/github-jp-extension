// GitHubページの監視
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // ページ内容が変更されたときの処理
      highlightKeyElements();
    }
  });
});

// 監視の開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

function highlightKeyElements() {
  // 重要な要素にスタイルを適用
  const keyElements = document.querySelectorAll('.BorderGrid-cell');
  keyElements.forEach(element => {
    element.style.backgroundColor = '#f6f8fa';
    element.style.padding = '10px';
    element.style.margin = '5px 0';
    element.style.borderRadius = '6px';
  });
}