export const OPENROUTER_API_KEY = 'gb002apikey';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const OPENROUTER_FALLBACK_MODELS = [
  'google/gemini-flash-1.5-exp:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'deepseek/deepseek-chat:free'
];

export async function generateWithFallback(
  primaryCall: () => Promise<string>,
  prompt: string
): Promise<string> {
  try {
    // Try primary Gemini Live API
    const response = await primaryCall();
    if (response) return response;
  } catch (error) {
    console.warn("Primary AI call failed, attempting OpenRouter fallback...", error);
  }

  // Fallback cascade using OpenRouter models
  for (const model of OPENROUTER_FALLBACK_MODELS) {
    try {
      console.log(`Trying OpenRouter fallback model: ${model}`);
      const res = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href, // standard OpenRouter requirement
          'X-Title': 'Talk AI'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) {
        throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (error) {
      console.warn(`Fallback model ${model} failed`, error);
    }
  }

  throw new Error("All AI models (including fallbacks) failed to generate content.");
}
