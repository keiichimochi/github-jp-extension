// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKeySection = document.getElementById('api-key-section');
  const mainSection = document.getElementById('main-section');

  if (geminiApiKey) {
    // APIキーが保存されている場合
    apiKeySection.classList.add('hidden');
    mainSection.classList.remove('hidden');
  } else {
    // APIキーが保存されていない場合
    apiKeySection.classList.remove('hidden');
    mainSection.classList.add('hidden');
  }
});

// APIキー保存のイベントリスナー
document.getElementById('save-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('gemini-key').value;
  const errorDiv = document.getElementById('key-error');
  
  if (!apiKey) {
    errorDiv.style.display = 'block';
    return;
  }
  
  errorDiv.style.display = 'none';
  await chrome.storage.local.set({ 'geminiApiKey': apiKey });
  
  // 画面の表示を切り替え
  document.getElementById('api-key-section').classList.add('hidden');
  document.getElementById('main-section').classList.remove('hidden');

  // APIキー保存後に解説表示機能を実行
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: analyzeRepository,
    args: [apiKey]
  });
});

// 解説表示ボタンのイベントリスナー
document.getElementById('translate').addEventListener('click', async () => {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  
  if (!geminiApiKey) {
    alert('APIキーを設定してください');
    return;
  }

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: analyzeRepository,
    args: [geminiApiKey]
  });
});

function analyzeRepository(apiKey) {
  // 既存の解説を削除
  const existingInfo = document.querySelector('.github-repo-analysis');
  if (existingInfo) {
    existingInfo.remove();
  }

  // リポジトリの情報を取得
  const repoTitle = document.querySelector('strong[itemprop="name"] a')?.innerText;
  const description = document.querySelector('.f4.my-3')?.innerText;
  const readmeContent = document.querySelector('#readme')?.innerText;
  const topics = Array.from(document.querySelectorAll('a[data-octo-click="topic_click"]')).map(topic => topic.innerText);
  const languages = Array.from(document.querySelectorAll('.d-inline span[itemprop="programmingLanguage"]')).map(lang => lang.innerText);

  // Gemini APIにリクエストを送信する関数
  async function getGeminiAnalysis(content) {
    const endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
    const prompt = `
      以下のGitHubリポジトリの情報を日本語で分かりやすく解説してください：
      
      リポジトリ名: ${repoTitle}
      説明: ${description}
      プログラミング言語: ${languages.join(', ')}
      トピック: ${topics.join(', ')}
      
      README内容:
      ${readmeContent}
      
      解説は以下の項目を含めてください：
      1. プロジェクトの概要と目的
      2. 主な機能や特徴
      3. 使用している技術やフレームワーク
      4. プロジェクトの価値や有用性
    `;

    try {
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '解説の生成中にエラーが発生しました');
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      return `解説の生成中にエラーが発生しました: ${error.message}`;
    }
  }

  // コピー機能の実装
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      const copyButton = document.querySelector('.copy-button');
      copyButton.textContent = 'コピーしました！';
      setTimeout(() => {
        copyButton.textContent = '解説をコピー';
      }, 2000);
    }).catch(err => {
      console.error('コピーに失敗しました:', err);
    });
  }

  // 解説を表示する要素を作成
  const infoDiv = document.createElement('div');
  infoDiv.className = 'github-repo-analysis';
  infoDiv.style.padding = '20px';
  infoDiv.style.backgroundColor = '#f6f8fa';
  infoDiv.style.margin = '20px';
  infoDiv.style.borderRadius = '6px';
  infoDiv.innerHTML = '<h3>🔄 解説を生成中...</h3>';

  // ページに要素を挿入
  const container = document.querySelector('.repository-content');
  if (container) {
    container.insertBefore(infoDiv, container.firstChild);
    
    // 解説を生成して表示
    getGeminiAnalysis().then(analysis => {
      infoDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>🎯 リポジトリの解説</h3>
          <button class="copy-button" style="padding: 8px 16px; background-color: #2ea44f; color: white; border: none; border-radius: 6px; cursor: pointer;">解説をコピー</button>
        </div>
        <div style="white-space: pre-wrap;" class="analysis-content">${analysis}</div>
      `;

      // コピーボタンのイベントリスナーを追加
      const copyButton = infoDiv.querySelector('.copy-button');
      copyButton.addEventListener('click', () => {
        const analysisText = infoDiv.querySelector('.analysis-content').textContent;
        copyToClipboard(analysisText);
      });
    });
  }
}