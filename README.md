# Secure Authenticator

## English

### Overview
Secure Authenticator is a browser-based TOTP manager built with React 19 and Vite. It keeps encrypted credentials in `localStorage`, offers drag-and-drop account organization, and supports multi-language UI strings sourced from `i18n/locales`. The design centers around privacy: everything runs completely offline and data never leaves the browser.

### Key Features
- **Vault encryption:** `services/webCryptoService.ts` derives AES-GCM keys from the master password (PBKDF2 w/100k iterations) and persists ciphertext via `storageService`. Legacy data can still be decrypted through the CryptoJS fallback.
- **TOTP generation:** `hooks/useTotpTicker.ts` drives the per-second countdown shared across all rows, while `hooks/useTOTP.ts` (plus `libs/otpauth.ts`) renders RFC 6238 codes with dynamic digits/periods.
- **Account organization:** `components/sortable/*` and DnD Kit enable reordering and group assignment inside `components/MainScreen.tsx`; metadata lives on each `Account` (`types.ts`).
- **Import/export:** `libs/migration.ts` decodes Google Authenticator `otpauth-migration://` payloads. `components/modals/SettingsModal.tsx` handles encrypted JSON exports, plaintext previews, and merge vs overwrite imports.
- **QR tooling:** `components/modals/ScanQRModal.tsx` and `libs/qrcode.ts` let users scan or render codes without external services.
- **Localization & theming:** `contexts/I18nContext.tsx`, `hooks/useI18n.ts`, and Tailwind-based themes (`contexts/ThemeContext.tsx`) provide instant language/theme switching. All locales now include the `alerts.import_summary` string used for import toasts.

### Project Structure (excerpt)
```
components/        UI (screens, modals, drag-and-drop, toasts)
contexts/          Theme and I18n providers
hooks/             TOTP ticker, timer, localized helpers
services/          Encryption, storage, clipboard helpers
libs/              OTP migration, QR code, protobuf runtime
i18n/locales/      JSON translation files (en, zh-CN, zh-TW, de, es, fr, ja, ko, pt)
```

### Getting Started
1. **Requirements:** Node.js 18+ (ESM) and npm 10+.
2. **Install:** `npm install`
3. **Development:** `npm run dev` → visit the Vite URL shown in the console.
4. **Production build:** `npm run build`
5. **Preview build:** `npm run preview`

No extra environment variables are required. The app auto-detects the browser language but can be switched manually via the settings modal (see `components/LanguageSwitcher.tsx`).

### Localization Workflow
- English strings (`i18n/locales/en.json`) act as the source of truth.
- Every locale must define the same JSON keys; any missing entry should fall back to English text until a translation is provided.
- When adding a new string, update English first, then duplicate into other locale files (even if temporarily in English) to avoid Vite JSON parse errors.

### Data Safety Checklist
- Always test import/export flows after modifying `storageService` or `webCryptoService`.
- Use browsers with WebCrypto support; legacy CryptoJS decryption remains only for backwards compatibility.
- Resetting the vault (`reset_app_button`) permanently deletes encrypted payloads—warn users accordingly.

### Contributing
1. Fork or branch from `main`.
2. Run `npm run dev` and ensure hot reload is stable.
3. Add or update tests if you introduce helper utilities (currently lightweight manual testing).
4. Submit a PR describing UI/locale adjustments.

### License
Secure Authenticator is distributed under the **Creative Commons Attribution-NonCommercial 4.0 International** license (see `LICENSE`). Commercial use requires a separate agreement with the maintainers; non-commercial forks must keep attribution to the original project.

---

See `README_zh.md` for the Traditional Chinese overview.
