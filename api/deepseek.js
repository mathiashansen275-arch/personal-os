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
    'You are the Personal OS scheduling assistant.',
    'You can read provided task and schedule data, but you cannot edit website code.',
    'Return JSON only.',
    'Allowed JSON shape: {"message":"summary","actions":[{"type":"assign_task_to_block","taskId":"id","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","title":"title","blockType":"business|personal|homework|work|errand|neutral"}]}',
    'Only schedule tasks when the user explicitly asks to allocate, move, schedule, plan, or place tasks into blocks.',
    'If the user is just chatting or asking a question, answer with a message and no actions.',
    'Only schedule undone tasks.',
    'Sort schedulable tasks by duration ascending so shorter tasks are placed first when possible.',
    'Use task.durationMinutes. If null, ask for a duration in parentheses.',
    'Only use blocks where title is exactly Available block and isDefaultFreeBlock is true.',
    'If a block has any other title, do not use it unless the user explicitly names that exact block and asks you to change it.',
    'Never overwrite school blocks, wind down/evening routine blocks, work blocks, or custom user-created blocks.',
    'Break blocks may be moved around freely only when needed to fit tasks, but task actions must still be placed into Available block time.',
    'Do not create or return task blocks shorter than 45 minutes. If a task is shorter than 45 minutes, group it with other short tasks or use a 45 minute block.',
    'Prefer generated free blocks after school.',
    'Do not invent dates or times outside appState.week.',
    'Choose blockType business for agency, work, client, SOP, strategy, product research, Vinted, business, sales, marketing, studying business, or money-making tasks.',
    'Choose blockType personal for chores, personal life, health, friends, family, errands that are not business, and general personal tasks.',
    'Keep action titles clean and based on the task name without the duration parentheses.'
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
    return sendJson(res, 200, parsed);
  } catch {
    return sendJson(res, 502, { error: 'Model returned invalid JSON', raw: content });
  }
}
