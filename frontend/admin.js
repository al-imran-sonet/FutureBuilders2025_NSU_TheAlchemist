const API_BASE = "http://localhost:5000";

// Tabs
const tabDoctor = document.getElementById("tabDoctor");
const tabOrders = document.getElementById("tabOrders");
const panelDoctor = document.getElementById("panelDoctor");
const panelOrders = document.getElementById("panelOrders");

// Controls
const backendStatus = document.getElementById("backendStatus");
const btnReload = document.getElementById("btnReload");

const btnReloadDoctor = document.getElementById("btnReloadDoctor");
const doctorSearch = document.getElementById("doctorSearch");
const doctorUrgencyFilter = document.getElementById("doctorUrgencyFilter");
const doctorBody = document.getElementById("doctorBody");
const doctorCount = document.getElementById("doctorCount");

const btnReloadOrders = document.getElementById("btnReloadOrders");
const orderSearch = document.getElementById("orderSearch");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const orderBody = document.getElementById("orderBody");
const orderCount = document.getElementById("orderCount");

// Data cache
let doctorRequests = [];
let orders = [];

// ---------- Helpers ----------
function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB"); // DD/MM/YYYY, HH:MM:SS
  } catch {
    return iso || "-";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * ✅ Now supports BOTH:
 * - normalized keys (emergency, urgent, routine, self-care)
 * - old raw text (জরুরি, urgent, etc.)
 */
function urgencyKey(urgencyText = "") {
  const u = (urgencyText || "").toLowerCase().trim();

  // ✅ normalized keys
  if (u === "emergency") return "emergency";
  if (u === "urgent") return "urgent";
  if (u === "routine") return "routine";
  if (u === "self-care") return "self-care";

  // ✅ fallback detection for old data
  if (u.includes("emergency") || u.includes("জরুরি")) return "emergency";
  if (u.includes("urgent") || u.includes("দ্রুত")) return "urgent";
  if (u.includes("routine") || u.includes("সাধারণ")) return "routine";
  if (u.includes("self-care") || u.includes("ঘরে")) return "self-care";

  return "unknown";
}

function urgencyPill(urgencyText) {
  const key = urgencyKey(urgencyText);
  if (key === "emergency") return `<span class="pill red">🔴 জরুরি (Emergency)</span>`;
  if (key === "urgent") return `<span class="pill orange">🟠 দ্রুত ডাক্তার (Urgent)</span>`;
  if (key === "routine") return `<span class="pill green">🟢 সাধারণ (Routine)</span>`;
  if (key === "self-care") return `<span class="pill gray">✅ ঘরে চিকিৎসা</span>`;
  return `<span class="pill gray">⚪ Unknown</span>`;
}

function includesSearch(haystack, query) {
  return (haystack || "").toLowerCase().includes((query || "").toLowerCase());
}

async function apiGet(path) {
  const resp = await fetch(`${API_BASE}${path}`);
  return resp.json();
}

async function apiPost(path, payload) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return resp.json();
}

// ---------- Tabs ----------
tabDoctor.addEventListener("click", () => {
  tabDoctor.classList.add("active");
  tabOrders.classList.remove("active");
  panelDoctor.style.display = "block";
  panelOrders.style.display = "none";
});

tabOrders.addEventListener("click", () => {
  tabOrders.classList.add("active");
  tabDoctor.classList.remove("active");
  panelOrders.style.display = "block";
  panelDoctor.style.display = "none";
});

// ---------- Backend status ----------
async function checkBackend() {
  try {
    const data = await apiGet("/api/health");
    backendStatus.textContent = data?.ok ? "online ✅" : "offline ❌";
  } catch {
    backendStatus.textContent = "offline ❌";
  }
}

// ---------- Doctor Requests ----------
function renderDoctorTable() {
  const q = doctorSearch.value.trim();
  const f = doctorUrgencyFilter.value;

  let filtered = doctorRequests.slice();

  if (q) {
    filtered = filtered.filter(r =>
      includesSearch(r.id, q) ||
      includesSearch(r.phone, q) ||
      includesSearch(r.symptoms, q) ||
      includesSearch(r.ai_reply, q)
    );
  }

  if (f !== "all") {
    filtered = filtered.filter(r => urgencyKey(r.urgency || "") === f);
  }

  doctorCount.textContent = `Showing ${filtered.length} requests`;

  if (filtered.length === 0) {
    doctorBody.innerHTML = `<tr><td colspan="6">No requests found.</td></tr>`;
    return;
  }

  doctorBody.innerHTML = filtered.slice(0, 50).map(r => {
    return `
      <tr>
        <td>${escapeHtml(formatDateTime(r.created_at))}</td>
        <td>${escapeHtml(r.phone || "-")}</td>
        <td>
          ${urgencyPill(r.urgency || "")}
          <div class="muted">stored: ${escapeHtml(r.urgency || "")}</div>
        </td>
        <td class="wrap">${escapeHtml(r.symptoms || "")}</td>
        <td class="wrap">${escapeHtml(r.ai_reply || "")}</td>
        <td class="mono">${escapeHtml(r.id)}</td>
      </tr>
    `;
  }).join("");
}

async function loadDoctorRequests() {
  doctorBody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

  try {
    const data = await apiGet("/api/admin/doctor-requests");
    if (!data.ok) throw new Error("Failed to load doctor requests");
    doctorRequests = data.requests || [];
    renderDoctorTable();
  } catch (err) {
    doctorBody.innerHTML = `<tr><td colspan="6">Failed: ${escapeHtml(err.message)}</td></tr>`;
  }
}

doctorSearch.addEventListener("input", renderDoctorTable);
doctorUrgencyFilter.addEventListener("change", renderDoctorTable);
btnReloadDoctor.addEventListener("click", loadDoctorRequests);

// ---------- Orders ----------
function renderOrdersTable() {
  const q = orderSearch.value.trim();
  const statusF = orderStatusFilter.value;

  let filtered = orders.slice();

  if (q) {
    filtered = filtered.filter(o =>
      includesSearch(o.id, q) ||
      includesSearch(o.phone, q) ||
      includesSearch(o.address, q) ||
      includesSearch(o.name, q)
    );
  }

  if (statusF !== "all") {
    filtered = filtered.filter(o => (o.status || "").toLowerCase() === statusF);
  }

  orderCount.textContent = `Showing ${filtered.length} orders`;

  if (filtered.length === 0) {
    orderBody.innerHTML = `<tr><td colspan="8">No orders found.</td></tr>`;
    return;
  }

  orderBody.innerHTML = filtered.slice(0, 50).map(o => {
    const itemsText = (o.items || []).map(i => `${i.name}×${i.qty}`).join(", ");
    const assigned = o.assigned_to || "";

    return `
      <tr>
        <td>${escapeHtml(formatDateTime(o.created_at))}</td>
        <td>
          <div><b>${escapeHtml(o.name || "-")}</b></div>
          <div class="muted">${escapeHtml(o.phone || "-")}</div>
          <div class="muted">Source: ${escapeHtml(o.source || "-")}</div>
        </td>
        <td class="wrap">${escapeHtml(o.address || "")}</td>
        <td class="wrap">${escapeHtml(itemsText)}</td>
        <td>
          <select data-order-id="${escapeHtml(o.id)}" class="statusSelect">
            <option value="pending" ${o.status === "pending" ? "selected" : ""}>pending</option>
            <option value="confirmed" ${o.status === "confirmed" ? "selected" : ""}>confirmed</option>
            <option value="out-for-delivery" ${o.status === "out-for-delivery" ? "selected" : ""}>out-for-delivery</option>
            <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>delivered</option>
          </select>
        </td>
        <td>
          <input data-order-id="${escapeHtml(o.id)}" class="assignInput" value="${escapeHtml(assigned)}" placeholder="Delivery person" />
        </td>
        <td>
          <button class="btnSmall updateBtn" data-order-id="${escapeHtml(o.id)}">Update</button>
          <div class="muted" id="msg-${escapeHtml(o.id)}"></div>
        </td>
        <td class="mono">${escapeHtml(o.id)}</td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".updateBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const orderId = btn.getAttribute("data-order-id");
      const status = document.querySelector(`.statusSelect[data-order-id="${orderId}"]`)?.value;
      const assigned_to = document.querySelector(`.assignInput[data-order-id="${orderId}"]`)?.value || "";

      const msgEl = document.getElementById(`msg-${orderId}`);
      msgEl.textContent = "Updating...";

      try {
        const data = await apiPost("/api/admin/orders/update", {
          id: orderId,
          status,
          assigned_to
        });

        if (!data.ok) throw new Error(data.error || "Update failed");
        msgEl.textContent = "✅ Updated";

        const idx = orders.findIndex(x => x.id === orderId);
        if (idx !== -1) orders[idx] = data.updated;
      } catch (err) {
        msgEl.textContent = "❌ " + err.message;
      }
    });
  });
}

async function loadOrders() {
  orderBody.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;

  try {
    const data = await apiGet("/api/admin/orders");
    if (!data.ok) throw new Error("Failed to load orders");
    orders = data.orders || [];
    renderOrdersTable();
  } catch (err) {
    orderBody.innerHTML = `<tr><td colspan="8">Failed: ${escapeHtml(err.message)}</td></tr>`;
  }
}

orderSearch.addEventListener("input", renderOrdersTable);
orderStatusFilter.addEventListener("change", renderOrdersTable);
btnReloadOrders.addEventListener("click", loadOrders);

// ---------- Reload All ----------
btnReload.addEventListener("click", async () => {
  await checkBackend();
  await loadDoctorRequests();
  await loadOrders();
});

// ---------- Initial load ----------
(async function init() {
  await checkBackend();
  await loadDoctorRequests();
  await loadOrders();
})();
