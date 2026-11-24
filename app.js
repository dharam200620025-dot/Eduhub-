let state = {
  category: 'All',
  type: 'all',
  pricing: 'all',
  q: '',
  resources: [],
  pendingOrder: null
};

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'videoModal') document.getElementById('videoFrame').src = '';
}
function openAuthModal() { openModal('authModal'); }

function getToken() { return localStorage.getItem('studyhub_token') || ''; }
function getUser() {
  try { return JSON.parse(localStorage.getItem('studyhub_user') || 'null'); } catch { return null; }
}

function renderAuthBar() {
  const area = document.getElementById('authArea');
  const user = getUser();
  if (user) {
    area.innerHTML = `
      <a href="/library" class="btn btn-gold btn-sm">📚 My Library</a>
      <button class="btn btn-outline btn-sm" onclick="logout()">Logout</button>
    `;
  } else {
    area.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openAuthModal()">Login</button>
      <button class="btn btn-primary btn-sm" onclick="openAuthModal()">Sign Up</button>
    `;
  }
}

function logout() {
  localStorage.removeItem('studyhub_token');
  localStorage.removeItem('studyhub_user');
  renderAuthBar();
  showToast('Logged out successfully.');
}

async function sendOtp() {
  const email = document.getElementById('authEmail').value.trim();
  if (!email) return showToast('Please enter your email.');

  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'OTP error');

  document.getElementById('otpStep').style.display = 'block';
  document.getElementById('otpHint').textContent = data.demoOtp ? `(Demo OTP: ${data.demoOtp})` : '';
  showToast(data.message);
}

async function verifyOtp() {
  const email = document.getElementById('authEmail').value.trim();
  const otp = document.getElementById('authOtp').value.trim();
  const full_name = document.getElementById('authName').value.trim();

  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, full_name })
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Invalid OTP');

  localStorage.setItem('studyhub_token', data.access_token);
  localStorage.setItem('studyhub_user', JSON.stringify(data.user));
  renderAuthBar();
  closeModal('authModal');
  showToast(`Welcome, ${data.user.full_name}!`);
}

async function loadResources() {
  const params = new URLSearchParams({
    category: state.category,
    type: state.type,
    pricing: state.pricing,
    q: state.q
  });
  const res = await fetch('/api/resources?' + params.toString());
  const data = await res.json();
  state.resources = data.resources || [];
  renderCatalog();
}

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  if (!state.resources.length) {
    grid.innerHTML = `<div class="panel" style="grid-column:1/-1;text-align:center;">Koi study material match nahi hua. Filter change karke dekhein.</div>`;
    return;
  }

  grid.innerHTML = state.resources.map((r) => `
    <article class="item-card">
      <div>
        <div class="badges">
          <span class="badge b-cat">${r.category}</span>
          <span class="badge ${r.is_free ? 'b-free' : 'b-paid'}">${r.is_free ? 'FREE ₹0' : '₹' + r.price_inr}</span>
          ${r.resource_type === 'video' ? '<span class="badge b-video">🎥 Video</span>' : '<span class="badge b-cat">📄 PDF</span>'}
        </div>
        <h4 style="margin-top:10px;">${r.title}</h4>
        <p style="margin-top:6px;">${r.description || ''}</p>
      </div>
      <div>
        <div class="item-meta">
          <span>Subject: <b>${r.subject || 'General'}</b></span>
          <span>⬇ ${r.downloads_count || 0}</span>
        </div>
        <div class="item-actions" style="margin-top:12px;">
          ${r.resource_type === 'pdf' && !r.is_free
            ? `<button class="btn btn-outline btn-sm" onclick="openPreview('${r.id}')">👁 2-Page Sample</button>`
            : ''}
          ${r.is_free
            ? `<button class="btn btn-primary btn-sm" onclick="accessResource('${r.id}')">${r.resource_type === 'video' ? '▶ Watch Free' : '⬇ Download Free'}</button>`
            : `<button class="btn btn-gold btn-sm" onclick="buyResource('${r.id}')">🔓 Unlock ₹${r.price_inr}</button>`}
        </div>
      </div>
    </article>
  `).join('');
}

function openPreview(id) {
  const item = state.resources.find((r) => r.id === id);
  if (!item) return;
  document.getElementById('previewTitle').textContent = item.title;
  document.getElementById('previewDesc').textContent = item.description;
  const btn = document.getElementById('previewUnlockBtn');
  btn.textContent = `Unlock Full PDF — ₹${item.price_inr}`;
  btn.onclick = () => { closeModal('previewModal'); buyResource(id); };
  openModal('previewModal');
}

function openDemoVideo() {
  document.getElementById('videoTitle').textContent = 'StudyHub Platform Demo Lecture';
  document.getElementById('videoFrame').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  openModal('videoModal');
}

async function accessResource(id) {
  if (!getToken()) {
    showToast('Download karne ke liye pehle Login karein.');
    return openAuthModal();
  }

  const res = await fetch('/api/resources/download/' + id, {
    headers: { Authorization: 'Bearer ' + getToken() }
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Access denied');

  if (data.type === 'video') {
    document.getElementById('videoTitle').textContent = data.title;
    document.getElementById('videoFrame').src = data.videoUrl;
    openModal('videoModal');
  } else if (data.downloadUrl) {
    window.open(data.downloadUrl, '_blank');
    showToast('Secure PDF download started! Saved in My Library.');
  }
}

async function buyResource(id) {
  if (!getToken()) {
    showToast('Purchase karne ke liye pehle Login karein.');
    return openAuthModal();
  }

  const res = await fetch('/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: JSON.stringify({ resourceId: id })
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Order error');

  if (data.demoMode) {
    state.pendingOrder = { orderId: data.order.id, resourceId: id };
    document.getElementById('chkTitle').textContent = data.resourceTitle;
    document.getElementById('chkPrice').textContent = data.priceInr;
    return openModal('checkoutModal');
  }

  // Live Razorpay Popup
  const user = getUser();
  const rzp = new window.Razorpay({
    key: data.key_id,
    amount: data.order.amount,
    currency: 'INR',
    name: 'StudyHub',
    description: data.resourceTitle,
    order_id: data.order.id,
    prefill: { email: user ? user.email : '' },
    theme: { color: '#0A49D8' },
    handler: async (response) => {
      await verifyPaymentOnServer(response, id);
    }
  });
  rzp.open();
}

async function confirmDemoPayment() {
  if (!state.pendingOrder) return;
  closeModal('checkoutModal');
  await verifyPaymentOnServer(
    {
      razorpay_order_id: state.pendingOrder.orderId,
      razorpay_payment_id: 'pay_upi_' + Date.now(),
      razorpay_signature: 'demo_sig'
    },
    state.pendingOrder.resourceId
  );
}

async function verifyPaymentOnServer(payload, resourceId) {
  const res = await fetch('/api/payment/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Verification failed');

  showToast('Payment Verified! PDF unlocked in My Library.');
  accessResource(resourceId);
}

function setCategory(cat) {
  state.category = cat;
  document.querySelectorAll('#categoryChips .chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  loadResources();
}

function jumpToCategory(cat) {
  setCategory(cat);
  document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
}

// Event Listeners
document.getElementById('categoryChips').addEventListener('click', (e) => {
  if (e.target.classList.contains('chip')) setCategory(e.target.dataset.cat);
});
document.getElementById('typeFilter').addEventListener('change', (e) => { state.type = e.target.value; loadResources(); });
document.getElementById('priceFilter').addEventListener('change', (e) => { state.pricing = e.target.value; loadResources(); });
document.getElementById('globalSearch').addEventListener('input', (e) => { state.q = e.target.value.trim(); loadResources(); });

renderAuthBar();
loadResources();
    
