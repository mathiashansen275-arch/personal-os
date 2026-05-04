const LOCKED_MODEL = 'deepseek-v4-flash';
const DEFAULT_URL = 'https://api.deepseek.com/chat/completions';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
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
    'Allowed JSON shape: {"message":"summary","actions":[{"type":"assign_task_to_block","taskId":"id","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","title":"title","blockType":"focus"}]}',
    'Only schedule undone tasks.',
    'Use task.durationMinutes. If null, ask for a duration in parentheses.',
    'Only use blocks where isDefaultFreeBlock is true.',
    'Never overwrite school blocks or custom blocks.',
    'Prefer generated free blocks after school.',
    'Do not invent dates or times outside appState.week.'
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
    return sendJson(res, 200, JSON.parse(content));
  } catch {
    return sendJson(res, 502, { error: 'Model returned invalid JSON', raw: content });
  }
}
