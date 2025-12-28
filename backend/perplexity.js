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
- Provide only safe guidance (hydration, rest, ORS advice, paracetamol general guidance).
- Always include warning signs to go to hospital immediately.
- End with: “এটি চিকিৎসকের বিকল্প নয়।”

Output format must be:

জরুরিতা: <one>
সম্ভাব্য কারণ: <1-2 possibilities>
আপনি এখন কী করবেন: <steps>
জরুরি সতর্কতা: <warning signs>
ঔষধ (যদি নিরাপদ হয়): <safe suggestions>
নোট: এটি চিকিৎসকের বিকল্প নয়।
  `.trim();
}

async function getAiDoctorOpinion({ symptomsBn }) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PERPLEXITY_API_KEY in .env");
  }

  const url = "https://api.perplexity.ai/chat/completions";

  const body = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: `রোগীর উপসর্গ (Bangla): ${symptomsBn}\n\nদয়া করে শুধু উপরের ফরম্যাটে উত্তর দিন।`
      }
    ],
    temperature: 0.2,
    max_tokens: 500
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Perplexity API error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "দুঃখিত, উত্তর তৈরি করা যায়নি।";
  return text;
}

module.exports = { getAiDoctorOpinion };
