const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

function buildSystemPrompt() {
  return `
You are a medical triage assistant for rural Bangladesh and the hill tracts.
You must answer in very simple Bangla.
You must classify urgency into exactly one of these:
1) জরুরি (Emergency)
2) দ্রুত ডাক্তার দেখানো দরকার (Urgent)
3) সাধারণ (Routine)
4) ঘরে চিকিৎসা (Self-care)

Rules:
- Never prescribe antibiotics, steroids, or controlled drugs.
- Provide only safe advice (hydration, rest, ORS advice, paracetamol general guidance).
- Always include warning signs to go to hospital immediately.
- End with: "এটি চিকিৎসকের বিকল্প নয়।"

✅ VERY IMPORTANT OUTPUT FORMAT:
You MUST output two sections exactly like this:

FULL_ADVICE:
জরুরিতা: <one of the 4 classes above>
সম্ভাব্য কারণ: <1-2 possibilities>
আপনি এখন কী করবেন: <3-6 short steps>
জরুরি সতর্কতা: <danger signs>
ঔষধ (যদি নিরাপদ হয়): <safe suggestions>
নোট: এটি চিকিৎসকের বিকল্প নয়।

SMS_SUMMARY:
A single Bangla SMS under 280 characters.
Must include:
- urgency word
- 2-3 steps
- 1 danger sign
- safe medicine suggestion if appropriate
End with: "এটি চিকিৎসকের বিকল্প নয়।"
  `.trim();
}

function splitAdvice(text) {
  const fullMatch = text.match(/FULL_ADVICE:\s*([\s\S]*?)SMS_SUMMARY:/i);
  const smsMatch = text.match(/SMS_SUMMARY:\s*([\s\S]*)/i);

  const fullAdvice = fullMatch ? fullMatch[1].trim() : (text || "").trim();
  let smsSummary = smsMatch ? smsMatch[1].trim() : "";

  if (!smsSummary) smsSummary = fullAdvice.slice(0, 260);

  // Keep SMS small so Twilio doesn't split too much
  if (smsSummary.length > 280) {
    smsSummary = smsSummary.slice(0, 275) + "...";
  }

  return { fullAdvice, smsSummary };
}

/**
 * Returns:
 * { fullAdvice, smsSummary }
 */
async function getAiDoctorOpinion({ symptomsBn }) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("Missing PERPLEXITY_API_KEY in .env");

  const url = "https://api.perplexity.ai/chat/completions";

  const body = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: `রোগীর উপসর্গ (Bangla): ${symptomsBn}\n\nউপরের FULL_ADVICE এবং SMS_SUMMARY ফরম্যাট মেনে উত্তর দিন।`
      }
    ],
    temperature: 0.2,
    max_tokens: 700
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Perplexity API error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() || "";

  return splitAdvice(raw);
}

module.exports = { getAiDoctorOpinion };
