require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const { getAiDoctorOpinion } = require("./perplexity");
const { readJson, writeJson } = require("./db");

// ✅ Optional Twilio (keep if you want, otherwise you can remove)
let twilio = null;
try {
  twilio = require("twilio");
} catch (e) {
  // twilio not installed - that's okay if using sms-local
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // ✅ needed for form-urlencoded (Twilio & some gateways)

const DOCTOR_FILE = path.join(__dirname, "data", "doctor_requests.json");
const ORDER_FILE = path.join(__dirname, "data", "medicine_orders.json");

// Generate UUID
function id() {
  return crypto.randomUUID();
}

/**
 * ✅ Extract urgency from FULL advice and normalize into:
 * emergency | urgent | routine | self-care | unknown
 */
function extractUrgencyNormalized(fullAdviceText) {
  const lines = (fullAdviceText || "").split("\n").map((x) => x.trim());
  const line = lines.find((l) => l.startsWith("জরুরিতা"));
  if (!line) return "unknown";

  const value = line
    .replace("জরুরিতা:", "")
    .replace("জরুরিতা -", "")
    .trim()
    .toLowerCase();

  // Bangla + English detection
  if (value.includes("emergency") || value.includes("জরুরি")) return "emergency";
  if (value.includes("urgent") || value.includes("দ্রুত")) return "urgent";
  if (value.includes("routine") || value.includes("সাধারণ")) return "routine";
  if (value.includes("self-care") || value.includes("ঘরে")) return "self-care";

  // Extra fallback detection
  if (value.includes("হাসপাতাল") || value.includes("অবিলম্বে")) return "emergency";

  return "unknown";
}

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "ShasthoBondhu backend running" });
});

/**
 * ✅ Web: AI doctor opinion
 */
app.post("/api/ai-opinion", async (req, res) => {
  try {
    const { symptomsBn, phone } = req.body;

    if (!symptomsBn || symptomsBn.trim().length < 5) {
      return res.status(400).json({ ok: false, error: "Please provide symptoms in Bangla." });
    }

    // Perplexity returns { fullAdvice, smsSummary }
    const { fullAdvice } = await getAiDoctorOpinion({ symptomsBn });
    const urgency = extractUrgencyNormalized(fullAdvice);

    const request = {
      id: id(),
      source: "web",
      phone: phone || null,
      symptoms: symptomsBn,
      ai_reply: fullAdvice,
      urgency,
      created_at: new Date().toISOString()
    };

    const requests = readJson(DOCTOR_FILE, []);
    requests.unshift(request);
    writeJson(DOCTOR_FILE, requests);

    res.json({ ok: true, aiReply: fullAdvice, requestId: request.id, urgency });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "AI service failed.", details: err.message });
  }
});

/**
 * ✅ Web: Place medicine order
 */
app.post("/api/order", (req, res) => {
  try {
    const { name, phone, address, items } = req.body;

    if (!phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }

    const order = {
      id: id(),
      source: "web",
      name: name || null,
      phone,
      address,
      items,
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
    res.status(500).json({ ok: false, error: "Order failed." });
  }
});

/**
 * ✅ Admin: list doctor requests
 */
app.get("/api/admin/doctor-requests", (req, res) => {
  const requests = readJson(DOCTOR_FILE, []);
  res.json({ ok: true, requests });
});

/**
 * ✅ Admin: list medicine orders
 */
app.get("/api/admin/orders", (req, res) => {
  const orders = readJson(ORDER_FILE, []);
  res.json({ ok: true, orders });
});

/**
 * ✅ Admin: update order status/assignment
 */
app.post("/api/admin/orders/update", (req, res) => {
  try {
    const { id, status, assigned_to } = req.body;

    if (!id) return res.status(400).json({ ok: false, error: "Missing order id." });

    const orders = readJson(ORDER_FILE, []);
    const idx = orders.findIndex((o) => o.id === id);

    if (idx === -1) return res.status(404).json({ ok: false, error: "Order not found." });

    if (status) orders[idx].status = status;
    if (assigned_to !== undefined) orders[idx].assigned_to = assigned_to;

    writeJson(ORDER_FILE, orders);
    res.json({ ok: true, updated: orders[idx] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Update failed." });
  }
});

/**
 * ✅ Android Local SMS Gateway Endpoint
 * The Android SMS Forwarder app will send:
 * { "from": "+8801xxxxxxxxx", "body": "HELP জ্বর..." }
 *
 * We return:
 * { ok: true, reply: "<short sms reply>" }
 */
app.post("/api/sms-local", async (req, res) => {
  try {
    const from = (req.body.from || "").trim();
    const body = (req.body.body || "").trim();

    console.log("📩 [sms-local] Incoming:", { from, body });

    if (!from || !body) {
      return res.status(400).json({ ok: false, error: "Missing from/body" });
    }

    // ✅ HELP command (AI Doctor Opinion)
    if (body.toUpperCase().startsWith("HELP")) {
      const symptoms = body.substring(4).trim();

      if (!symptoms || symptoms.length < 5) {
        return res.json({
          ok: true,
          reply: "⚠️ লিখুন: HELP <আপনার সমস্যা>\nউদাহরণ: HELP জ্বর ৩ দিন মাথাব্যথা"
        });
      }

      const { fullAdvice, smsSummary } = await getAiDoctorOpinion({ symptomsBn: symptoms });
      const urgency = extractUrgencyNormalized(fullAdvice);

      const request = {
        id: id(),
        source: "sms-local",
        phone: from,
        symptoms,
        ai_reply: fullAdvice, // store full for admin
        urgency,
        created_at: new Date().toISOString()
      };

      const requests = readJson(DOCTOR_FILE, []);
      requests.unshift(request);
      writeJson(DOCTOR_FILE, requests);

      // Send only summary to phone (for SMS reply)
      return res.json({ ok: true, reply: smsSummary });
    }

    // ✅ MED command (Medicine Order)
    if (body.toUpperCase().startsWith("MED")) {
      const orderText = body.substring(3).trim();

      if (!orderText) {
        return res.json({
          ok: true,
          reply: "⚠️ লিখুন: MED ORS 3, Paracetamol 10"
        });
      }

      // Parse: "ORS 3, Paracetamol 10"
      const items = orderText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((part) => {
          const pieces = part.split(" ").filter(Boolean);
          const qty = Number(pieces[pieces.length - 1]) || 1;
          const name = pieces.slice(0, -1).join(" ") || pieces.join(" ");
          return { name, qty };
        });

      const order = {
        id: id(),
        source: "sms-local",
        name: null,
        phone: from,
        address: "SMS user (call for address)",
        items,
        status: "pending",
        assigned_to: null,
        created_at: new Date().toISOString()
      };

      const orders = readJson(ORDER_FILE, []);
      orders.unshift(order);
      writeJson(ORDER_FILE, orders);

      return res.json({
        ok: true,
        reply: `✅ অর্ডার গ্রহণ করা হয়েছে!\nOrder ID: ${order.id}\nআমরা ফোন করে ঠিকানা নিশ্চিত করবো।`
      });
    }

    // ✅ Unknown command
    return res.json({
      ok: true,
      reply:
        "❓ কমান্ড বুঝতে পারিনি।\n\nডাক্তার:\nHELP <সমস্যা>\n\nঅর্ডার:\nMED ORS 3, Paracetamol 10"
    });
  } catch (err) {
    console.error("❌ sms-local error:", err);
    return res.status(200).json({ ok: true, reply: "⚠️ সার্ভার সমস্যা। পরে চেষ্টা করুন।" });
  }
});

/**
 * ✅ Optional Twilio Webhook Endpoint
 * Keep if you want, otherwise ignore.
 */
app.post("/api/sms", async (req, res) => {
  try {
    if (!twilio) return res.status(200).send("Twilio not installed (OK)");

    const from = req.body.From;
    const body = (req.body.Body || "").trim();
    if (!from || !body) return res.status(400).send("Invalid SMS");

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    async function replySMS(text) {
      await client.messages.create({
        body: (text || "").trim(),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: from
      });
    }

    if (body.toUpperCase().startsWith("HELP")) {
      const symptoms = body.substring(4).trim();

      const { fullAdvice, smsSummary } = await getAiDoctorOpinion({ symptomsBn: symptoms });
      const urgency = extractUrgencyNormalized(fullAdvice);

      const request = {
        id: id(),
        source: "sms",
        phone: from,
        symptoms,
        ai_reply: fullAdvice,
        urgency,
        created_at: new Date().toISOString()
      };

      const requests = readJson(DOCTOR_FILE, []);
      requests.unshift(request);
      writeJson(DOCTOR_FILE, requests);

      await replySMS(smsSummary);
      return res.status(200).send("OK");
    }

    await replySMS("❓ কমান্ড বুঝতে পারিনি। HELP <সমস্যা> লিখুন।");
    return res.status(200).send("OK");
  } catch (err) {
    console.error("SMS Error:", err.message);
    return res.status(200).send("OK");
  }
});

// ✅ Listen on all interfaces so phone can access
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Local access: http://localhost:${PORT}`);
  console.log(`✅ Phone access: http://<YOUR_LAPTOP_IP>:${PORT}`);
});
