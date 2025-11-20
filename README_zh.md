# Secure Authenticator（繁體）

Secure Authenticator 是一款可以安裝為 PWA 的零知識 TOTP 保險庫。它把 Google Authenticator 的方便與離線安全性結合起來，讓你完全掌控所有驗證碼。

## 亮點功能
- **離線 PWA 體驗** – 可加到桌機或手機主畫面，沒有網路照樣運作。Service Worker 會快取介面與資料。
- **零知識安全模型** – 主密碼只存在你的裝置。資料透過 PBKDF2（10 萬次）+ AES-GCM 加密後才寫入瀏覽器儲存。
- **生物辨識解鎖** – 可選擇 WebAuthn（Face ID / Touch ID / Windows Hello）一鍵解鎖，主密碼仍是最終後盾。
- **高效率整理** – 拖曳群組、長按啟動編輯模式、拖至刪除/編輯區塊、即時搜尋，大量帳戶也能快速管理。
- **匯入匯出** – 支援 Google Authenticator 匯出 (`otpauth-migration://`)，可合併或覆寫現有資料，也能產生加密或純文字備份。
- **多語與主題** – 內建 9 種語言、亮/暗/系統主題，自動偵測也可手動切換。

## 安全保證
1. 所有資料在進入 localStorage/IndexedDB 前都先在本地加密。
2. PBKDF2 派生的密鑰搭配 AES-GCM，可有效抵抗暴力破解（請選擇強密碼）。
3. WebAuthn 密鑰由系統安全模組保管，我們不接觸任何生物資訊。
4. 沒有同步伺服器、沒有雲端備份，一切都在你的裝置上完成。

## 技術堆疊
- React 19 + Vite
- Tailwind + `@dnd-kit`
- WebCrypto / WebAuthn
- `vite-plugin-pwa` 產生 Service Worker 與 manifest

## 快速開始
```bash
npm install
npm run dev       # 啟動開發模式
npm run build     # 建置正式版
npm run preview   # 以本機服務預覽正式版
```
啟動後可透過瀏覽器的「安裝應用程式 / 加到主畫面」把它當成原生 App 使用。

## 授權
採 **Creative Commons Attribution-NonCommercial 4.0 International** 授權，僅允許非商業用途並需保留署名。若要商用請聯絡維護者。
