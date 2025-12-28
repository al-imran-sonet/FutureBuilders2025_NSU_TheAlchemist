const API_BASE = "http://localhost:5000";

const symptomsEl = document.getElementById("symptoms");
const phoneEl = document.getElementById("phone");
const extraEl = document.getElementById("extra");

const btnAi = document.getElementById("btnAi");
const aiResultWrap = document.getElementById("aiResultWrap");
const aiResult = document.getElementById("aiResult");

btnAi.addEventListener("click", async () => {
  const symptoms = symptomsEl.value.trim();
  const phone = phoneEl.value.trim();
  const extra = extraEl.value.trim();

  if (symptoms.length < 5) {
    alert("দয়া করে উপসর্গ লিখুন।");
    return;
  }

  btnAi.disabled = true;
  btnAi.textContent = "লোড হচ্ছে...";

  try {
    const finalText = extra ? `${symptoms}\nঅতিরিক্ত তথ্য: ${extra}` : symptoms;

    const resp = await fetch(`${API_BASE}/api/ai-opinion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptomsBn: finalText, phone })
    });

    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "AI failed");

    aiResultWrap.style.display = "block";
    aiResult.textContent = data.aiReply;
  } catch (err) {
    alert("AI পরামর্শ আনা যাচ্ছে না। " + err.message);
  } finally {
    btnAi.disabled = false;
    btnAi.textContent = "পরামর্শ নিন";
  }
});

// Medicine ordering
const medName = document.getElementById("medName");
const medQty = document.getElementById("medQty");
const btnAdd = document.getElementById("btnAdd");
const cartEl = document.getElementById("cart");
const btnOrder = document.getElementById("btnOrder");
const orderMsg = document.getElementById("orderMsg");

const nameEl = document.getElementById("name");
const orderPhoneEl = document.getElementById("orderPhone");
const addressEl = document.getElementById("address");

let cart = [];

function renderCart() {
  if (cart.length === 0) {
    cartEl.textContent = "(এখনো কিছু যোগ করা হয়নি)";
    return;
  }
  cartEl.textContent = cart.map((i, idx) => `${idx + 1}. ${i.name} × ${i.qty}`).join("\n");
}

btnAdd.addEventListener("click", () => {
  const item = {
    name: medName.value,
    qty: Number(medQty.value || 1)
  };
  if (item.qty <= 0) return;

  cart.push(item);
  renderCart();
});

btnOrder.addEventListener("click", async () => {
  const name = nameEl.value.trim();
  const phone = orderPhoneEl.value.trim();
  const address = addressEl.value.trim();

  if (!phone || phone.length < 10) return alert("ফোন নম্বর দিন।");
  if (!address || address.length < 6) return alert("ঠিকানা দিন।");
  if (cart.length === 0) return alert("কমপক্ষে ১টি আইটেম যোগ করুন।");

  btnOrder.disabled = true;
  btnOrder.textContent = "অর্ডার হচ্ছে...";

  try {
    const resp = await fetch(`${API_BASE}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, items: cart })
    });

    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Order failed");

    orderMsg.textContent = `✅ অর্ডার সফল! Order ID: ${data.orderId}`;
    cart = [];
    renderCart();

    nameEl.value = "";
    addressEl.value = "";
  } catch (err) {
    alert("অর্ডার করা যায়নি: " + err.message);
  } finally {
    btnOrder.disabled = false;
    btnOrder.textContent = "অর্ডার করুন";
  }
});
