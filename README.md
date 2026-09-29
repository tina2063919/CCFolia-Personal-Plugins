# CCFolia Personal Plugins

CCFolia 個人用 userscript 集合。所有腳本都可獨立安裝與啟用，適用於 `https://ccfolia.com/`。

## 插件列表

| 腳本 | 功能 |
| --- | --- |
| [ccf-room-folders.user.js](ccf-room-folders.user.js) | 在首頁房間列表加入資料夾，可分類、篩選、拖曳排序，並匯出或匯入分類資料。 |
| [ccf-char-switcher.user.js](ccf-char-switcher.user.js) | 在房間內顯示可拖曳的角色快速切換面板，快速切換聊天發言角色。 |
| [ccf-chat-palette.user.js](ccf-chat-palette.user.js) | 在房間內顯示可拖曳的常用對話面板，點選指令即可送出，並支援角色差分圖片預覽。 |
| [ccf-light-input.user.js](ccf-light-input.user.js) | 將聊天輸入區與訊息紀錄切換為明亮主題，並為各聊天頁籤分別保存輸入草稿。 |
| [ccf-tab-notify.user.js](ccf-tab-notify.user.js) | 偵測其他聊天頁籤的新訊息並播放提示音，可設定音量及各頁籤是否提示。 |

## 安裝

1. 在瀏覽器安裝 Tampermonkey 或其他 userscript 管理器。
2. 開啟要安裝的 `.user.js` 檔案，將全部內容複製到管理器的新增腳本頁面並儲存。
3. 重新載入 CCFolia。需要哪些功能就安裝哪些腳本，各腳本可以分別停用。

腳本會在 CCFolia 網站載入後執行；角色切換、常用對話、明亮輸入區與頁籤提示音的控制項位於房間內，房間資料夾列則位於首頁房間列表上方。

## 資料保存

偏好設定、房間分類與部分快取儲存在瀏覽器的 `localStorage`，不會自動同步到其他瀏覽器或裝置。房間資料夾腳本提供分類資料的匯出與匯入功能；其他腳本的資料可透過瀏覽器資料備份自行保留。

這些腳本會依賴目前 CCFolia 頁面中的表單與元件結構；若網站介面更新，部分功能可能需要調整。
