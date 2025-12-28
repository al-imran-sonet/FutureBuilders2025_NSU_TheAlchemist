require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const { getAiDoctorOpinion } = require("./perplexity");
const { readJson, writeJson } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const DOCTOR_FILE = path.join(__dirname, "data", "doctor_requests.json");
const ORDER_FILE = path.join(__dirname, "data", "medicine_orders.json");

// Simple helper
function id() {
  return crypto.randomUUID();
}

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "ShasthoBondhu backend running" });
});

// ✅ Web: AI doctor opinion
app.post("/api/ai-opinion", async (req, res) => {
  try {
    const { symptomsBn, phone } = req.body;

    if (!symptomsBn || symptomsBn.trim().length < 5) {
      return res.status(400).json({ error: "Please provide symptoms in Bangla." });
    }

    const aiReply = await getAiDoctorOpinion({ symptomsBn });

    const request = {
      id: id(),
      source: "web",
      phone: phone || null,
      symptoms: symptomsBn,
      ai_reply: aiReply,
      created_at: new Date().toISOString()
    };

    const requests = readJson(DOCTOR_FILE, []);
    requests.unshift(request);
    writeJson(DOCTOR_FILE, requests);

    res.json({ ok: true, aiReply, requestId: request.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI service failed.", details: err.message });
  }
});

// ✅ Web: Place medicine order
app.post("/api/order", (req, res) => {
  try {
    const { name, phone, address, items } = req.body;

    if (!phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const order = {
      id: id(),
      source: "web",
      name: name || null,
      phone,
      address,
      items, // [{name, qty}]
      status: "pending",
      assigned_to: null,
      created_at: new Date().toISOString()
    };

    const orders = readJson(ORDER_FILE, []);
    orders.unshift(order);
    writeJson(ORDER_FILE, orders);

    res.json({ ok: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order failed." });
  }
});

// ✅ Admin: list doctor requests
app.get("/api/admin/doctor-requests", (req, res) => {
  const requests = readJson(DOCTOR_FILE, []);
  res.json({ ok: true, requests });
});

// ✅ Admin: list medicine orders
app.get("/api/admin/orders", (req, res) => {
  const orders = readJson(ORDER_FILE, []);
  res.json({ ok: true, orders });
});

// ✅ Admin: update order status/assignment
app.post("/api/admin/orders/update", (req, res) => {
  const { id, status, assigned_to } = req.body;

  if (!id) return res.status(400).json({ error: "Missing order id." });

  const orders = readJson(ORDER_FILE, []);
  const idx = orders.findIndex(o => o.id === id);

  if (idx === -1) return res.status(404).json({ error: "Order not found." });

  if (status) orders[idx].status = status;
  if (assigned_to !== undefined) orders[idx].assigned_to = assigned_to;

  writeJson(ORDER_FILE, orders);
  res.json({ ok: true, updated: orders[idx] });
});

/**
 * ✅ SMS endpoint placeholder (connect Twilio later)
 * If you integrate Twilio, their webhook will POST here with:
 * - From: phone number
 * - Body: message text
 * You will parse HELP / MED and respond.
 */
app.post("/api/sms", async (req, res) => {
  res.json({
    ok: true,
    message: "SMS webhook ready. Integrate Twilio to use this."
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:${PORT}`));
