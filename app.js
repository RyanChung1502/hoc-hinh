/* ── IndexedDB ── */
const DB_NAME = 'hoc-hinh-db';
const DB_VER = 1;
const STORE = 'cards';
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

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(card) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(card);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ── State ── */
let cards = [];
let currentIndex = 0;

/* ── DOM ── */
const $ = s => document.querySelector(s);
const viewer = $('.viewer');
const cardContainer = $('.card-container');
const dotsContainer = $('.dots');
const modalOverlay = $('.modal-overlay');
const toast = $('.toast');

/* ── Init ── */
async function init() {
  await openDB();
  cards = await dbGetAll();
  cards.sort((a, b) => a.order - b.order);
  currentIndex = 0;
  renderViewer();
  renderDots();
  updateArrows();
  setupSwipe();
}

/* ── Render viewer ── */
function renderViewer() {
  cardContainer.innerHTML = '';

  if (cards.length === 0) {
    cardContainer.innerHTML = `
      <div class="card center">
        <div class="empty-state">
          <div class="icon">📚</div>
          <h2>Chưa có thẻ nào</h2>
          <p>Thêm hình ảnh và từ vựng<br>trong phần Cài đặt</p>
          <button class="btn-primary" onclick="openSettings()">⚙️ Mở Cài đặt</button>
        </div>
      </div>`;
    return;
  }

  const card = cards[currentIndex];
  const el = document.createElement('div');
  el.className = 'card center';
  el.innerHTML = `
    <img src="${card.image}" alt="${card.text}">
    <div class="label">${card.text}</div>
    <div class="hint">Chạm để nghe · Vuốt để chuyển</div>`;
  el.addEventListener('click', () => speak(card.text, el));
  cardContainer.appendChild(el);
}

function renderDots() {
  dotsContainer.innerHTML = '';
  if (cards.length <= 1) return;
  // Show max 10 dots, with window around current
  const maxDots = 10;
  let start = 0, end = cards.length;
  if (cards.length > maxDots) {
    start = Math.max(0, currentIndex - Math.floor(maxDots / 2));
    end = start + maxDots;
    if (end > cards.length) { end = cards.length; start = end - maxDots; }
  }
  for (let i = start; i < end; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === currentIndex ? ' active' : '');
    dotsContainer.appendChild(d);
  }
}

/* ── Swipe ── */
function setupSwipe() {
  let startX = 0, startY = 0, diffX = 0, swiping = false;

  cardContainer.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    diffX = 0;
    swiping = false;
  }, { passive: true });

  cardContainer.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      swiping = true;
    }
    if (swiping) {
      diffX = dx;
      const card = cardContainer.querySelector('.card');
      if (card) {
        card.style.transition = 'none';
        card.style.transform = `translateX(${diffX}px)`;
        card.style.opacity = Math.max(0.3, 1 - Math.abs(diffX) / 400);
      }
    }
  }, { passive: true });

  cardContainer.addEventListener('touchend', () => {
    if (!swiping) return;
    const threshold = 80;
    if (diffX < -threshold && currentIndex < cards.length - 1) {
      animateSlide('left');
    } else if (diffX > threshold && currentIndex > 0) {
      animateSlide('right');
    } else {
      // Snap back
      const card = cardContainer.querySelector('.card');
      if (card) {
        card.style.transition = '';
        card.style.transform = '';
        card.style.opacity = '';
      }
    }
  }, { passive: true });
}

function animateSlide(direction) {
  const card = cardContainer.querySelector('.card');
  if (!card) return;

  card.style.transition = '';
  card.className = 'card slide-' + direction;

  setTimeout(() => {
    currentIndex += direction === 'left' ? 1 : -1;
    renderViewer();
    renderDots();
    updateArrows();
    // Auto speak on new card
    const newCard = cardContainer.querySelector('.card');
    if (newCard && cards[currentIndex]) {
      speak(cards[currentIndex].text, newCard);
    }
  }, 300);
}

/* ── Speech ── */
let viVoice = null;

function findVietnameseVoice() {
  const voices = speechSynthesis.getVoices();
  // Ưu tiên: vi-VN exact → vi → bất kỳ voice nào có "vietnam" trong tên
  viVoice = voices.find(v => v.lang === 'vi-VN')
    || voices.find(v => v.lang.startsWith('vi'))
    || voices.find(v => v.name.toLowerCase().includes('vietnam'))
    || null;
}

// Voices load async trên một số browser
if (window.speechSynthesis) {
  findVietnameseVoice();
  speechSynthesis.onvoiceschanged = findVietnameseVoice;
}

function speak(text, el) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  if (viVoice) u.voice = viVoice;
  u.rate = 0.85;
  u.pitch = 1.1;

  if (el) el.classList.add('speaking');
  u.onend = () => { if (el) el.classList.remove('speaking'); };
  u.onerror = () => { if (el) el.classList.remove('speaking'); };

  window.speechSynthesis.speak(u);
}

/* ── Settings modal ── */
function openSettings() {
  renderCardList();
  clearAddForm();
  modalOverlay.classList.add('open');
}

function closeSettings() {
  modalOverlay.classList.remove('open');
  renderViewer();
  renderDots();
  updateArrows();
}

function renderCardList() {
  const list = $('#card-list');
  if (cards.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">Chưa có thẻ nào</p>';
    return;
  }
  list.innerHTML = cards.map((c, i) => `
    <div class="card-item" data-id="${c.id}">
      <img src="${c.image}" alt="${c.text}">
      <div class="info">
        <div class="name">${c.text}</div>
        <div class="order">Thẻ ${i + 1} / ${cards.length}</div>
      </div>
      <div class="actions">
        ${i > 0 ? `<button class="btn-sm" onclick="moveCard('${c.id}',-1)" title="Lên">▲</button>` : '<div style="width:36px"></div>'}
        ${i < cards.length - 1 ? `<button class="btn-sm" onclick="moveCard('${c.id}',1)" title="Xuống">▼</button>` : '<div style="width:36px"></div>'}
        <button class="btn-sm delete" onclick="deleteCard('${c.id}')" title="Xóa">✕</button>
      </div>
    </div>`).join('');
}

/* ── Add card ── */
let pendingImage = null;

function clearAddForm() {
  $('#input-text').value = '';
  pendingImage = null;
  const area = $('.img-upload-area');
  area.innerHTML = `
    <div class="placeholder"><span>📷</span>Chạm để chọn ảnh</div>
    <input type="file" accept="image/*" onchange="handleImageSelect(event)">`;
  updateAddBtn();
}

function triggerImagePick() {
  $('.img-upload-area input[type="file"]').click();
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    // Resize to save space
    const img = new Image();
    img.onload = () => {
      const maxSize = 600;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = h * maxSize / w; w = maxSize; }
        else { w = w * maxSize / h; h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      pendingImage = canvas.toDataURL('image/jpeg', 0.8);

      const area = $('.img-upload-area');
      area.innerHTML = `<img src="${pendingImage}"><input type="file" accept="image/*" onchange="handleImageSelect(event)">`;
      updateAddBtn();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function updateAddBtn() {
  const text = $('#input-text').value.trim();
  $('#btn-save-card').disabled = !text || !pendingImage;
}

async function addCard() {
  const text = $('#input-text').value.trim();
  if (!text || !pendingImage) return;

  const card = {
    id: 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    text: text,
    image: pendingImage,
    order: cards.length,
    createdAt: new Date().toISOString()
  };

  await dbPut(card);
  cards.push(card);
  clearAddForm();
  renderCardList();
  showToast('Đã thêm "' + text + '"');
}

/* ── Delete card ── */
async function deleteCard(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  if (!confirm(`Xóa thẻ "${card.text}"?`)) return;

  await dbDelete(id);
  cards = cards.filter(c => c.id !== id);
  // Fix order
  cards.forEach((c, i) => { c.order = i; dbPut(c); });
  if (currentIndex >= cards.length) currentIndex = Math.max(0, cards.length - 1);
  renderCardList();
  showToast('Đã xóa "' + card.text + '"');
}

/* ── Move card ── */
async function moveCard(id, dir) {
  const idx = cards.findIndex(c => c.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cards.length) return;

  [cards[idx], cards[newIdx]] = [cards[newIdx], cards[idx]];
  cards.forEach((c, i) => { c.order = i; dbPut(c); });
  renderCardList();
}

/* ── Toast ── */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ── Backup ── */
function backupData() {
  if (cards.length === 0) {
    showToast('Chưa có thẻ để sao lưu');
    return;
  }
  const data = JSON.stringify(cards, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hoc-hinh-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã sao lưu ' + cards.length + ' thẻ');
}

function triggerRestore() {
  $('#restore-input').click();
}

async function restoreData(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!Array.isArray(imported) || imported.length === 0) {
      showToast('File không hợp lệ');
      return;
    }

    // Validate structure
    const valid = imported.every(c => c.text && c.image);
    if (!valid) {
      showToast('File không đúng định dạng');
      return;
    }

    if (!confirm('Khôi phục ' + imported.length + ' thẻ?\nDữ liệu hiện tại sẽ bị ghi đè.')) {
      e.target.value = '';
      return;
    }

    // Clear existing
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });

    // Import all
    for (let i = 0; i < imported.length; i++) {
      const card = imported[i];
      card.order = i;
      if (!card.id) card.id = 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await dbPut(card);
    }

    cards = imported;
    cards.sort((a, b) => a.order - b.order);
    currentIndex = 0;
    renderCardList();
    showToast('Đã khôi phục ' + imported.length + ' thẻ');
  } catch (err) {
    showToast('Lỗi đọc file');
  }

  e.target.value = '';
}

/* ── Nav arrows ── */
function goPrev() {
  if (currentIndex > 0) animateSlide('right');
}

function goNext() {
  if (currentIndex < cards.length - 1) animateSlide('left');
}

function updateArrows() {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  if (prev) prev.disabled = currentIndex <= 0 || cards.length === 0;
  if (next) next.disabled = currentIndex >= cards.length - 1 || cards.length === 0;
}

/* ── Keyboard nav (for testing on desktop) ── */
document.addEventListener('keydown', e => {
  if (modalOverlay.classList.contains('open')) return;
  if (e.key === 'ArrowLeft') goPrev();
  if (e.key === 'ArrowRight') goNext();
  if (e.key === ' ') {
    e.preventDefault();
    const card = cardContainer.querySelector('.card');
    if (card && cards[currentIndex]) speak(cards[currentIndex].text, card);
  }
});

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

/* ── Start ── */
init();
