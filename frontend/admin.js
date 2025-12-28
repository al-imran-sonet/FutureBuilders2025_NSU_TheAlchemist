const API_BASE = "http://localhost:5000";

const doctorList = document.getElementById("doctorList");
const orderList = document.getElementById("orderList");

document.getElementById("btnLoadDoctor").addEventListener("click", loadDoctor);
document.getElementById("btnLoadOrders").addEventListener("click", loadOrders);

async function loadDoctor() {
  doctorList.textContent = "Loading...";
  const resp = await fetch(`${API_BASE}/api/admin/doctor-requests`);
  const data = await resp.json();
  if (!data.ok) return (doctorList.textContent = "Failed");
  doctorList.textContent = data.requests
    .slice(0, 20)
    .map(r => `ID: ${r.id}\nSource: ${r.source}\nPhone: ${r.phone || "-"}\nSymptoms: ${r.symptoms}\n---\nAI:\n${r.ai_reply}\n\n====================\n`)
    .join("\n");
}

async function loadOrders() {
  orderList.textContent = "Loading...";
  const resp = await fetch(`${API_BASE}/api/admin/orders`);
  const data = await resp.json();
  if (!data.ok) return (orderList.textContent = "Failed");

  orderList.textContent = data.orders
    .slice(0, 30)
    .map(o => {
      const items = o.items.map(i => `${i.name}×${i.qty}`).join(", ");
      return `ID: ${o.id}\nStatus: ${o.status}\nAssigned: ${o.assigned_to || "-"}\nPhone: ${o.phone}\nAddress: ${o.address}\nItems: ${items}\nCreated: ${o.created_at}\n---------------------------`;
    })
    .join("\n\n");
}

loadDoctor();
loadOrders();
