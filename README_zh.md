# Secure Authenticator（繁體中文）

### 專案介紹
Secure Authenticator 是以 React 19 與 Vite 打造的瀏覽器版 TOTP 驗證器。所有資料都只存在於瀏覽器的 `localStorage`，並透過主密碼進行 AES-GCM 加密。介面支援拖曳排序、群組管理、多語系與主題切換，完全離線即可運作。

### 核心功能
- **保險庫加密：** `services/webCryptoService.ts` 以 PBKDF2 (100k 次) 推導密鑰並使用 AES-GCM 儲存資料；舊版資料仍可透過 CryptoJS 解密。
- **動態驗證碼：** `hooks/useTotpTicker.ts` 與 `hooks/useTOTP.ts` 產生 RFC 6238 代碼，支援自訂位數與週期。
- **帳戶整理：** `components/sortable/*` + DnD Kit 提供拖曳排序；帳戶結構定義在 `types.ts`，可設定 group/order。
- **匯入匯出：** `libs/migration.ts` 解析 Google Authenticator 匯出 URI；`components/modals/SettingsModal.tsx` 可匯入、匯出、選擇合併或覆寫。
- **QR 工具：** 內建掃描 (`components/modals/ScanQRModal.tsx`) 與生成器 (`libs/qrcode.ts`)，無須上傳雲端。
- **在地化/主題：** `contexts/I18nContext.tsx`、`hooks/useI18n.ts`、`contexts/ThemeContext.tsx` 提供即時語系與主題切換；所有語系皆已補齊 `alerts.import_summary` 提示字串。

### 專案結構 (節錄)
```
components/        主要頁面、模態視窗、拖曳、通知
contexts/          主題與語系提供者
hooks/             TOTP 計時與輔助 Hooks
services/          加密、儲存、剪貼簿等服務
libs/              OTP 匯入、QR Code、protobuf runtime
i18n/locales/      多語 JSON (含英文、繁體、簡體、德/西/法/日/韓/葡)
```

### 快速開始
1. **需求：** Node.js 18+、npm 10+
2. **安裝：** `npm install`
3. **開發模式：** `npm run dev`（依照終端機顯示的 Vite 位址開啟）
4. **正式建置：** `npm run build`
5. **建置預覽：** `npm run preview`

程式會自動讀取瀏覽器語言，也可透過設定選單中的 `LanguageSwitcher` 手動切換。

### 在地化流程
- 以英文檔 (`i18n/locales/en.json`) 為基準。
- 新增字串時請同步更新所有語系，即使暫時使用英文，亦能避免 JSON 解析錯誤。
- 若要新增語系，請註冊於 `i18n/config.ts` 的 `SUPPORTED_LOCALES`，並建立完整的 JSON 檔。

### 資料安全建議
- 每次修改 `storageService` 或 `webCryptoService` 後，務必測試匯入／匯出與重設流程。
- 建議使用支援 WebCrypto 的瀏覽器；CryptoJS 僅保留相容用途。
- 重設應用程式會永久刪除所有資料，請在 UI 中顯示警示文字。

### 貢獻方式
1. 以 `main` 建立分支。
2. 執行 `npm run dev` 進行開發與手動驗證。
3. 若新增工具函式，請補齊相對應的測試或使用說明。
4. 送出 PR 並描述 UI 與語系的調整內容。

### 授權
本專案採用 **Creative Commons Attribution-NonCommercial 4.0 International** 授權。僅允許非商業用途，並需保留原始專案的署名；若須商業使用，請另行聯繫維護者。
