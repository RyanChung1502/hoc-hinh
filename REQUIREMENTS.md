# Học Hình - Requirements & Decisions

## Overview
**Học Hình** (Từ Vựng Cho Bé) — Ứng dụng PWA học từ vựng tiếng Việt qua hình ảnh cho trẻ em. Hoạt động offline hoàn toàn trên mobile, không cần server.

**Live URL:** https://ryanchung1502.github.io/hoc-hinh/
**Repo:** https://github.com/RyanChung1502/hoc-hinh

---

## Requirements

### Core Features
- [x] **Flashcard toàn màn hình** — Hiển thị hình ảnh minh họa + từ vựng bên dưới, chiếm toàn bộ màn hình
- [x] **Phát âm tiếng Việt** — Chạm vào hình để nghe phát âm (Web Speech API, `vi-VN`)
- [x] **Vuốt chuyển thẻ** — Vuốt trái/phải để chuyển sang thẻ tiếp theo/trước đó, tự phát âm khi chuyển
- [x] **Quản lý thẻ (Settings)** — Thêm, xóa, sắp xếp thứ tự thẻ trong modal Settings
- [x] **Tải ảnh từ điện thoại** — Chọn ảnh từ gallery/camera, tự resize xuống 600px, lưu dạng base64 JPEG
- [x] **Nhập nội dung phát âm** — Nhập text (VD: "Bông hoa"), phone tự đọc bằng TTS
- [x] **Dot indicator** — Hiển thị vị trí thẻ hiện tại, tối đa 10 dots với window trượt
- [x] **Backup/Restore** — Sao lưu toàn bộ thẻ (hình + text) ra JSON, khôi phục từ JSON (ghi đè)
- [x] **App Update** — Nút cập nhật trong Settings, xóa cache SW và reload
- [x] **PWA / Offline** — Cài được trên điện thoại, hoạt động hoàn toàn offline qua Service Worker
- [x] **QR Code** — File `qrcode.png` trong source code, quét để mở app

### UI/UX
- [x] Ngôn ngữ tiếng Việt
- [x] Dark theme (background `#1a1a2e`, accent `#e94560`)
- [x] Mobile-first, portrait orientation
- [x] Header: tên app (trái) + nút Settings (phải)
- [x] Modal bottom-sheet cho Settings (slide up animation)
- [x] Empty state hướng dẫn mở Settings khi chưa có thẻ
- [x] Toast notifications
- [x] Touch feedback (scale animation khi chạm)
- [x] Speaking animation (đổi màu label khi đang phát âm)

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Pure HTML/CSS/JS — no framework** | Zero build step, dễ host trên GitHub Pages, dễ maintain |
| 2 | **IndexedDB for storage** | Offline-first; lưu được ảnh base64 dung lượng lớn; structured data |
| 3 | **Single HTML page + JS** | Không cần routing phức tạp, app chỉ có 1 view chính + 1 modal |
| 4 | **Web Speech API (SpeechSynthesis)** | Không cần thư viện ngoài, không cần server; phone tự đọc tiếng Việt |
| 5 | **Ảnh lưu base64 trong IndexedDB** | Không cần server upload; hoạt động offline hoàn toàn |
| 6 | **Resize ảnh xuống 600px** | Tiết kiệm dung lượng IndexedDB; ảnh vẫn đủ nét trên mobile |
| 7 | **JPEG quality 0.8** | Cân bằng giữa chất lượng và dung lượng |
| 8 | **Modal bottom-sheet cho Settings** | UX mobile quen thuộc (giống iOS/Android action sheet) |
| 9 | **Auto speak khi vuốt** | Trẻ em chỉ cần vuốt, không cần chạm thêm bước nào |
| 10 | **Dot indicator tối đa 10** | Tránh dots tràn màn hình khi có nhiều thẻ |
| 11 | **Keyboard navigation** | Arrow keys + Space cho testing trên desktop |
| 12 | **QR code trong source** | Dễ chia sẻ app cho người khác, in ra giấy |
| 13 | **Backup/Restore qua JSON** | Portable, không cần server; chứa cả ảnh base64 |
| 14 | **Nút cập nhật trong Settings** | PWA cache aggressively → user cần cách force update; tăng version mỗi lần deploy |
| 15 | **Header đặt ở bottom** | Tránh bị che bởi notch/status bar/dynamic island trên điện thoại |
| 16 | **Nav arrows ẩn trên mobile** | Mobile dùng vuốt (tự nhiên hơn); desktop cần nút vì không vuốt được |
| 17 | **Chủ động chọn Vietnamese voice** | Một số browser không tự chọn vi-VN; cần tìm voice qua `getVoices()` + `onvoiceschanged` |

---

## Data Model

### Card (IndexedDB store: "cards")
```
id          string    Auto-generated (card_<timestamp>_<random>)
text        string    Nội dung phát âm (bắt buộc), VD: "Bông hoa"
image       string    Base64 data URL (JPEG, max 600px)
order       number    Thứ tự hiển thị (0, 1, 2, ...)
createdAt   string    ISO date
```

---

## Tech Stack & Architecture

### File Structure
```
project-root/
├── index.html          # Single HTML page — toàn bộ markup
├── style.css           # Dark theme, mobile-first, CSS variables
├── app.js              # Logic: IndexedDB, swipe, TTS, CRUD
├── sw.js               # Service Worker — cache-first strategy
├── manifest.json       # PWA manifest — standalone display
├── icon-192.png        # PWA icon 192x192
├── icon-512.png        # PWA icon 512x512
├── qrcode.png          # QR code link tới deployed app
└── REQUIREMENTS.md     # File này
```

### Key Patterns (dùng lại cho app khác)

#### 1. IndexedDB CRUD Template
```js
const DB_NAME = 'app-db';
const DB_VER = 1;
const STORE = 'items';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

function dbGetAll() { /* transaction readonly → getAll() */ }
function dbPut(item) { /* transaction readwrite → put() */ }
function dbDelete(id) { /* transaction readwrite → delete() */ }
```

#### 2. Service Worker (Cache-First)
```js
const CACHE_NAME = 'app-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json'];

// install → cache assets
// activate → cleanup old caches
// fetch → cache first, fallback to network
```

#### 3. PWA Manifest
```json
{
  "name": "App Name",
  "short_name": "App",
  "start_url": ".",
  "display": "standalone",        // ← mở như app, không có browser chrome
  "orientation": "portrait",
  "background_color": "#1a1a2e",
  "theme_color": "#e94560",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### 4. HTML Head (PWA-ready)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#e94560">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
```

#### 5. Touch Swipe Detection
```js
let startX, diffX, swiping = false;
// touchstart → ghi startX
// touchmove  → tính diffX, nếu |dx| > |dy| → swiping = true → translate card
// touchend   → nếu |diffX| > threshold → slide, không thì snap back
```

#### 6. Web Speech API (Text-to-Speech)
```js
function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';    // Tiếng Việt
  u.rate = 0.85;        // Chậm hơn cho trẻ em
  u.pitch = 1.1;        // Cao hơn chút
  speechSynthesis.speak(u);
}
```

#### 7. Image Resize trước khi lưu
```js
// FileReader → Image → Canvas resize → toDataURL('image/jpeg', 0.8)
// Max 600px, giữ tỉ lệ
```

#### 8. CSS Variables cho Dark Theme
```css
:root {
  --bg: #1a1a2e;
  --card-bg: #16213e;
  --accent: #e94560;
  --text: #ffffff;
  --text-dim: #a0a0b0;
  --radius: 16px;
}
```

#### 9. Backup/Restore (JSON file)
```js
// Sao lưu — xuất toàn bộ data ra file JSON để download
function backupData() {
  const data = JSON.stringify(items, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'app-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Khôi phục — đọc file JSON, validate, ghi đè IndexedDB
async function restoreData(e) {
  const file = e.target.files[0];
  const text = await file.text();
  const imported = JSON.parse(text);
  // Validate → confirm → clear DB → import all → reload UI
}
```

#### 10. App Update (xóa cache Service Worker)
```js
// Trong app.js — version tracking
const APP_VERSION = 'v2';

// Nút cập nhật: xóa cache cũ → update SW → reload
function checkUpdate() {
  navigator.serviceWorker.getRegistration().then(reg => {
    reg.update().then(() => {
      caches.keys().then(keys => {
        Promise.all(keys.map(k => caches.delete(k))).then(() => {
          location.reload(true);
        });
      });
    });
  });
}
```
**Quan trọng:** Mỗi lần update code phải tăng 2 chỗ:
1. `CACHE_NAME` trong `sw.js` (VD: `'app-v2'` → `'app-v3'`)
2. `APP_VERSION` trong `app.js` (VD: `'v2'` → `'v3'`)

#### 11. Vietnamese Voice Selection (Web Speech API)
```js
// Voices load bất đồng bộ trên một số browser
let viVoice = null;

function findVietnameseVoice() {
  const voices = speechSynthesis.getVoices();
  viVoice = voices.find(v => v.lang === 'vi-VN')
    || voices.find(v => v.lang.startsWith('vi'))
    || voices.find(v => v.name.toLowerCase().includes('vietnam'))
    || null;
}

speechSynthesis.onvoiceschanged = findVietnameseVoice;
findVietnameseVoice(); // gọi ngay lần đầu

// Khi speak, gán voice rõ ràng
const u = new SpeechSynthesisUtterance(text);
u.lang = 'vi-VN';
if (viVoice) u.voice = viVoice;
```
**Lưu ý thiết bị:** Nếu không có giọng Việt:
- Android: Settings → System → Language → Text-to-Speech → cài Google TTS → tải gói "Tiếng Việt"
- iPhone: Settings → Accessibility → Spoken Content → Voices → Vietnamese

#### 12. Nav Arrows cho Desktop
```js
// Ẩn trên mobile (dùng vuốt), hiện trên desktop
// CSS: @media (pointer: coarse) { .nav-arrows { display: none; } }
// Nút ◀ ▶ ở 2 bên màn hình, disabled khi ở đầu/cuối
```

#### 13. Header nên đặt ở dưới (mobile)
```
Trên điện thoại, vùng trên cùng bị che bởi notch / status bar / dynamic island.
→ Đặt header (chứa nút Settings) ở bottom thay vì top.
→ CSS: position: fixed; bottom: 0;
→ Background gradient ngược: linear-gradient(to top, ...)
```

---

## Build & Deploy

### Prerequisites
- Không cần Node.js, npm, hay build tool nào
- Chỉ cần text editor + browser

### Local Development
1. Mở `index.html` trực tiếp trong browser (hoặc dùng Live Server)
2. Service Worker cần HTTPS hoặc localhost để hoạt động

### Deploy lên GitHub Pages
1. Tạo GitHub repo (public)
2. Push code lên branch `main`
3. Repo Settings → Pages → Source: `Deploy from a branch` → `main` → `/ (root)` → Save
4. Chờ 1-2 phút → app live tại `https://<username>.github.io/<repo>/`

### CLI nhanh (dùng GitHub CLI)
```bash
# Init + push
git init
git remote add origin https://github.com/<user>/<repo>.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main

# Set public (nếu cần)
gh repo edit <user>/<repo> --visibility public --accept-visibility-change-consequences

# Enable Pages (nếu chưa bật)
gh api repos/<user>/<repo>/pages -X POST -f source.branch=main -f source.path=/

# Check status
gh api repos/<user>/<repo>/pages --jq '.html_url, .status'
```

### Tạo QR Code (dùng Node.js)
```bash
npm install qrcode --no-save
node -e "require('qrcode').toFile('qrcode.png','https://<user>.github.io/<repo>/',{width:512,margin:2},e=>console.log(e||'done'))"
rm -rf node_modules package-lock.json
```

### Tạo PWA Icons (dùng Node.js + canvas)
```bash
npm install canvas --no-save
node generate-icons.js   # script vẽ icon bằng Canvas API
rm -rf node_modules package-lock.json
```

### Cài app trên điện thoại
**Android (Chrome):**
1. Mở Chrome → vào URL app
2. Menu ⋮ → "Thêm vào màn hình chính" / "Install app"

**iPhone (Safari):**
1. Mở Safari → vào URL app
2. Share → "Thêm vào MH chính"

---

## Template: Tạo App Mới Tương Tự

### Checklist
1. [ ] Tạo thư mục project mới
2. [ ] Copy `sw.js` template → đổi `CACHE_NAME` và `ASSETS`
3. [ ] Copy `manifest.json` template → đổi name, colors, icons
4. [ ] Tạo `index.html` với PWA head tags
5. [ ] Tạo `style.css` với CSS variables (dark theme)
6. [ ] Tạo `app.js` với IndexedDB CRUD + business logic
7. [ ] Tạo icons (192x192 + 512x512)
8. [ ] Test offline: DevTools → Application → Service Workers
9. [ ] Push lên GitHub → bật Pages
10. [ ] Tạo QR code
11. [ ] Test cài app trên điện thoại

### Nguyên tắc
- **Zero dependencies** — không framework, không thư viện ngoài
- **Offline-first** — mọi thứ lưu local (IndexedDB), không cần server
- **Mobile-first** — thiết kế cho điện thoại trước, touch-friendly
- **Dark theme** — dễ nhìn, hiện đại
- **Vietnamese UI** — target user là người Việt

---

## Future Considerations
- [ ] Phân loại thẻ theo chủ đề (Số, Động vật, Hoa quả, ...)
- [ ] Chế độ quiz — hiển thị ảnh, cho bé chọn đáp án đúng
- [ ] Âm thanh custom — ghi âm giọng bố mẹ thay vì dùng TTS
- [ ] Nhiều ngôn ngữ — Anh-Việt song ngữ
- [ ] Cloud sync — đồng bộ thẻ giữa các thiết bị
