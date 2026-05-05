const LOCKED_MODEL = 'deepseek-v4-flash';
const DEFAULT_URL = 'https://api.deepseek.com/chat/completions';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function numEnv(name) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const secret = process.env.DEEPSEEK_API_KEY;
  const endpoint = process.env.DEEPSEEK_API_URL || DEFAULT_URL;
  const configuredModel = process.env.DEEPSEEK_MODEL || LOCKED_MODEL;

  if (!secret) return sendJson(res, 500, { error: 'Missing server secret' });
  if (configuredModel !== LOCKED_MODEL) return sendJson(res, 500, { error: 'Wrong model configured', required: LOCKED_MODEL, configured: configuredModel });

  const body = req.body || {};
  const userMessage = String(body.message || '').slice(0, 4000);
  const appState = body.appState || {};
  if (!userMessage) return sendJson(res, 400, { error: 'Missing message' });

  const systemPrompt = [
    'You are the Personal OS assistant. Behave like a normal helpful AI with full read access to the supplied Personal OS state.',
    'You cannot edit app code. You can only return safe schedule actions and messages.',
    'Return JSON only.',
    'Allowed JSON shape: {"message":"summary","actions":[{"type":"assign_group_to_block","taskIds":["id"],"taskTexts":["full task text"],"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","title":"max 25 chars","blockType":"business|personal|homework|work|errand|neutral"}]}',
    'When scheduling, use the current appState tasks and week. Respect task order: earlier tasks are higher priority and should be scheduled earlier when possible.',
    'Infer days and exact time ranges from task text, for example Thursday 12.45-15.30 cut grandmas grass means create a block on Thursday 12:45-15:30 with a short title like Grandma grass.',
    'If a task has a duration in parentheses, use that duration. If multiple short tasks are under the minimum, group them.',
    'Generated blocks must be at least 30 minutes. If grouped, make a useful title with & under 25 chars; otherwise use Grouped tasks.',
    'Always preserve full task text in taskTexts so the UI can show details.',
    'Never overlap or overwrite school, work, wind down/evening routine, trip, or existing custom blocks unless the user explicitly asks to edit that exact block.',
    'Ignore break blocks. The user will take breaks manually.',
    'If there is not enough room today, continue into the next day with free time.',
    'Use concise block titles, max 25 characters.',
    'For general chat, answer normally in message and return actions: [].'
  ].join('\n');

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + secret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: LOCKED_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ message: userMessage, appState }) }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return sendJson(res, upstream.status, { error: 'Model request failed', details: data });

  const content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '{}';
  try {
    const parsed = JSON.parse(content);
    const usage = data.usage || {};
    const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
    const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
    const inputEurPer1M = numEnv('DEEPSEEK_INPUT_EUR_PER_1M');
    const outputEurPer1M = numEnv('DEEPSEEK_OUTPUT_EUR_PER_1M');
    const costEUR = (inputTokens / 1000000 * inputEurPer1M) + (outputTokens / 1000000 * outputEurPer1M);
    parsed.usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
    parsed.costEUR = costEUR;
    parsed.costPricingConfigured = inputEurPer1M > 0 || outputEurPer1M > 0;
    if (!Array.isArray(parsed.actions)) parsed.actions = [];
    return sendJson(res, 200, parsed);
  } catch {
    return sendJson(res, 502, { error: 'Model returned invalid JSON', raw: content });
  }
}
