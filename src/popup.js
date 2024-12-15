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
    function: analyzePage,
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
    function: analyzePage,
    args: [geminiApiKey]
  });
});

function analyzePage(apiKey) {
  // 既存の解説を削除
  const existingInfo = document.querySelector('.jp-page-analysis');
  if (existingInfo) {
    existingInfo.remove();
  }

  // ページの情報を取得
  const pageTitle = document.title;
  const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  const h1Text = Array.from(document.querySelectorAll('h1')).map(h1 => h1.innerText).join('\n');
  
  // メインコンテンツを取得
  const mainContent = (() => {
    const article = document.querySelector('article');
    if (article) return article.innerText;
    
    const main = document.querySelector('main');
    if (main) return main.innerText;
    
    const mainClass = document.querySelector('.main');
    if (mainClass) return mainClass.innerText;
    
    const mainId = document.querySelector('#main');
    if (mainId) return mainId.innerText;
    
    const mainRole = document.querySelector('[role="main"]');
    if (mainRole) return mainRole.innerText;
    
    // メインコンテンツが特定できない場合は、visible textを取得
    const bodyText = document.body.innerText;
    return bodyText.substring(0, 5000); // 長すぎる場合は制限
  })();

  // Gemini APIにリクエストを送信する関数
  async function getGeminiAnalysis() {
    const endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';
    const prompt = `
      以下のウェブページの内容を日本語で分かりやすく解説してください：
      
      ページタイトル: ${pageTitle}
      説明: ${metaDescription}
      見出し: ${h1Text}
      
      ページ内容:
      ${mainContent}
      
      解説は以下の項目を含めてください：
      1. ページの概要と目的
      2. 主なトピックや内容
      3. 重要なポイントや特徴
      4. このページの価値や有用性
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

  // 解説を表示する要素を作成
  const infoDiv = document.createElement('div');
  infoDiv.className = 'jp-page-analysis';
  infoDiv.style.position = 'fixed';
  infoDiv.style.top = '20px';
  infoDiv.style.right = '20px';
  infoDiv.style.width = '400px';
  infoDiv.style.maxHeight = '80vh';
  infoDiv.style.overflowY = 'auto';
  infoDiv.style.padding = '20px';
  infoDiv.style.backgroundColor = '#f6f8fa';
  infoDiv.style.border = '1px solid #d0d7de';
  infoDiv.style.borderRadius = '6px';
  infoDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  infoDiv.style.zIndex = '9999';
  infoDiv.innerHTML = '<h3>🔄 解説を生成中...</h3>';

  // 閉じるボタンを追加
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '✕';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.border = 'none';
  closeButton.style.background = 'none';
  closeButton.style.fontSize = '16px';
  closeButton.style.cursor = 'pointer';
  closeButton.onclick = () => infoDiv.remove();
  infoDiv.appendChild(closeButton);

  // ページに要素を挿入
  document.body.appendChild(infoDiv);
  
  // 解説を生成して表示
  getGeminiAnalysis().then(analysis => {
    infoDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3>🎯 ページの解説</h3>
        <button class="copy-button" style="padding: 8px 16px; background-color: #2ea44f; color: white; border: none; border-radius: 6px; cursor: pointer;">解説をコピー</button>
        <button style="border: none; background: none; font-size: 16px; cursor: pointer;" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
      <div style="white-space: pre-wrap;" class="analysis-content">${analysis}</div>
    `;

    // コピーボタンのイベントリスナーを追加
    const copyButton = infoDiv.querySelector('.copy-button');
    copyButton.addEventListener('click', () => {
      const analysisText = infoDiv.querySelector('.analysis-content').textContent;
      navigator.clipboard.writeText(analysisText).then(() => {
        copyButton.textContent = 'コピーしました！';
        setTimeout(() => {
          copyButton.textContent = '解説をコピー';
        }, 2000);
      }).catch(err => {
        console.error('コピーに失敗しました:', err);
      });
    });
  });
}
