# Secure Authenticator

Secure Authenticator is a zero-knowledge TOTP vault you can install as a Progressive Web App. It is built for people who want the convenience of Google Authenticator with the privacy of an offline-first experience.

## Feature Highlights
- **Offline-first PWA** – Install it on desktop or mobile and keep using it without a network connection. Service workers cache the UI and your encrypted vault locally.
- **Zero-knowledge vault** – Your master password never leaves the device. Codes and metadata are sealed with PBKDF2 (100k iterations) + AES-GCM and stored in local browser storage only.
- **Biometric unlock** – Opt into system biometrics/WebAuthn so you can unlock with Face ID/Touch ID/Windows Hello while the master password remains the ultimate fallback.
- **Organize effortlessly** – Drag-and-drop groups, long-press edit mode, bulk delete targets, and instant search help you tame large OTP collections.
- **One-click import/export** – Merge or overwrite Google Authenticator exports and produce encrypted or plaintext backups anytime.
- **Personalized experience** – Nine languages, dark/light/system themes, and compact UI tweaks keep the app comfortable everywhere.

## Security Model
1. All vault data is encrypted client-side before it ever touches persistent storage.
2. PBKDF2-derived keys plus AES-GCM protect against brute-force attempts as long as the master password is strong.
3. Optional WebAuthn unlock stores private keys in the platform secure enclave; we never transmit or store biometric data.
4. Because everything runs in the browser, the attack surface is limited to the device you already trust—no syncing servers, no cloud copies.

## Technology Stack
- React 19 + Vite for fast, modern UI development
- Tailwind-powered design system for responsive layouts
- `@dnd-kit` for smooth drag-and-drop interactions
- WebCrypto + WebAuthn for encryption and biometric unlock
- `vite-plugin-pwa` for service worker generation and manifest management

## Getting Started
```bash
npm install
npm run dev       # start local development with hot reload
npm run build     # create a production bundle
npm run preview   # serve the production bundle locally
```
Once running, use the browser’s “Install App” (or “Add to Home Screen”) option to pin Secure Authenticator like a native client.

## License
Distributed under **Creative Commons Attribution-NonCommercial 4.0 International**. Keep attribution and contact the maintainers for commercial licensing.

Need the Traditional Chinese overview? See `README_zh.md`.
