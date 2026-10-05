# CCFolia Personal Plugins

CCFolia 個人用 userscript 集合。所有腳本都可獨立安裝與啟用，適用於 `https://ccfolia.com/`。

## 插件列表

| 腳本 | 功能 |
| --- | --- |
| [ccf-room-folders.user.js](ccf-room-folders.user.js) | 在首頁房間列表加入資料夾，可分類、篩選、拖曳排序，並匯出或匯入分類資料。 |
| [ccf-external-rooms.user.js](ccf-external-rooms.user.js) | 在首頁加入「其他房間」頁籤，輸入非自己建立的房間網址即可保存，與自己的房間分開顯示；進房時自動記錄上次進入時間。 |
| [ccf-char-switcher.user.js](ccf-char-switcher.user.js) | 在房間內顯示可拖曳的角色快速切換面板，快速切換聊天發言角色。 |
| [ccf-chat-palette.user.js](ccf-chat-palette.user.js) | 在房間內顯示可拖曳的常用對話面板，點選指令即可送出，並支援角色差分圖片預覽。 |
| [ccf-light-input.user.js](ccf-light-input.user.js) | 將聊天輸入區與訊息紀錄切換為明亮主題，並為各聊天頁籤分別保存輸入草稿。 |
| [ccf-tab-notify.user.js](ccf-tab-notify.user.js) | 偵測其他聊天頁籤的新訊息並播放提示音，可設定音量及各頁籤是否提示。 |

## Log 檢視器

[log-viewer/](log-viewer/) 是不需建置的靜態網頁（`index.html` + `css/` + `js/`），用來讀取與展示 CCFolia 匯出的 HTML 紀錄（含舊版格式），也支援 Discord 機器人匯出的頻道 HTML。

- 上傳（按鈕或拖曳，可一次多檔）、已上傳檔案列表與搜尋
- 明暗主題切換、多頻道紀錄的頻道篩選
- 編輯模式：修改標題、發言者名稱與顏色、訊息內容，刪除訊息；或直接編輯原始碼
- 儲存（`Ctrl+S`）、下載修改後的 HTML（維持 CCFolia 原格式）、刪除檔案
- 分享：產生唯讀連結給他人閱覽，對方不需登入，畫面只有紀錄內容與明暗主題切換

檔案存放在瀏覽器的 IndexedDB，不會自動上傳，也不會跨裝置同步。

分享功能會把紀錄上傳到你自己 GitHub 帳號的 Secret Gist（不公開列出，但拿到連結的人都能看）。第一次分享時需要一組只勾選 `gist` 權限的 [GitHub token](https://github.com/settings/tokens/new?scopes=gist&description=CCFolia%20Log%20Viewer)，token 只存在該瀏覽器。修改後按「更新分享內容」同步到連結；「停止分享」會刪除 Gist，舊連結隨即失效。

部署到 GitHub Pages：Settings → Pages → Source 選 `Deploy from a branch`，分支選 `main`、資料夾 `/ (root)`。完成後網址為 `https://<帳號>.github.io/CCFolia-Personal-Plugins/log-viewer/`。

## 安裝

1. 在瀏覽器安裝 Tampermonkey 或其他 userscript 管理器。
2. 開啟要安裝的 `.user.js` 檔案，將全部內容複製到管理器的新增腳本頁面並儲存。
3. 重新載入 CCFolia。需要哪些功能就安裝哪些腳本，各腳本可以分別停用。

腳本會在 CCFolia 網站載入後執行；角色切換、常用對話、明亮輸入區與頁籤提示音的控制項位於房間內，房間資料夾列則位於首頁房間列表上方。

## 資料保存

偏好設定、房間分類與部分快取儲存在瀏覽器的 `localStorage`，不會自動同步到其他瀏覽器或裝置。房間資料夾腳本提供分類資料的匯出與匯入功能；其他腳本的資料可透過瀏覽器資料備份自行保留。

這些腳本會依賴目前 CCFolia 頁面中的表單與元件結構；若網站介面更新，部分功能可能需要調整。
