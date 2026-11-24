function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function getAdminHeaders() {
  return {
    'x-admin-email': sessionStorage.getItem('sh_admin_email') || '',
    'x-admin-pin': sessionStorage.getItem('sh_admin_pin') || ''
  };
}

async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pin = document.getElementById('adminPin').value.trim();
  sessionStorage.setItem('sh_admin_email', email);
  sessionStorage.setItem('sh_admin_pin', pin);

  const ok = await loadDashboard();
  if (!ok) {
    sessionStorage.clear();
    showToast('Invalid Admin Email or PIN.');
  }
}

function adminLogout() {
  sessionStorage.clear();
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginGate').style.display = 'block';
  document.getElementById('adminLogoutBtn').style.display = 'none';
}

async function loadDashboard() {
  const res = await fetch('/api/admin/stats', { headers: getAdminHeaders() });
  if (!res.ok) return false;

  const data = await res.json();
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  document.getElementById('adminLogoutBtn').style.display = 'inline-flex';

  document.getElementById('stRevenue').textContent = '₹' + data.totalRevenueInr;
  document.getElementById('stStudents').textContent = data.totalStudents;
  document.getElementById('stDownloads').textContent = data.totalDownloads;
  document.getElementById('stResources').textContent = data.totalResources;

  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = (data.resources || []).map((r) => `
    <tr>
      <td><strong>${r.title}</strong></td>
      <td>${r.category}</td>
      <td>${r.resource_type.toUpperCase()}</td>
      <td>${r.is_free ? 'FREE (₹0)' : '₹' + r.price_inr}</td>
      <td>${r.downloads_count || 0}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="editPrice('${r.id}', ${r.price_inr})">Edit ₹</button>
        <button class="btn btn-danger btn-sm" onclick="deleteResource('${r.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  return true;
}

document.getElementById('isFreeSelect').addEventListener('change', (e) => {
  const priceInput = document.getElementById('priceInput');
  priceInput.disabled = e.target.value === 'true';
  if (e.target.value === 'true') priceInput.value = 0;
});

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: formData
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Upload failed');

  showToast('Resource published successfully!');
  e.target.reset();
  loadDashboard();
});

async function editPrice(id, currentPrice) {
  const input = prompt('Naya Price (₹ INR) enter karein (Free karne ke liye 0 dalein):', currentPrice);
  if (input === null) return;
  const price = Math.max(0, Number(input) || 0);

  const res = await fetch('/api/admin/resource/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
    body: JSON.stringify({ price_inr: price, is_free: price === 0 })
  });
  if (res.ok) {
    showToast('Price updated!');
    loadDashboard();
  }
}

async function deleteResource(id) {
  if (!confirm('Is resource ko delete karna chahte hain?')) return;
  const res = await fetch('/api/admin/resource/' + id, {
    method: 'DELETE',
    headers: getAdminHeaders()
  });
  if (res.ok) {
    showToast('Resource deleted.');
    loadDashboard();
  }
}

if (sessionStorage.getItem('sh_admin_pin')) loadDashboard();
