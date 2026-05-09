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
  const userMessage = String(body.message || body.rawMessage || '').slice(0, 8000);
  const appState = body.appState || {};
  if (!userMessage) return sendJson(res, 400, { error: 'Missing message' });

  const systemPrompt = [
    'You are the autonomous Personal OS scheduling agent running inside the user app.',
    'Model: deepseek-v4-flash. You receive the current Personal OS state and must decide which tools/actions to call.',
    'Return JSON only: {"message":"short direct summary","actions":[...]}',
    'For normal non-schedule chat, answer in message and return actions: [].',
    'For schedule changes, use the available tools. Do not say you cannot edit the app if a tool can do it.',
    '',
    'TOOLS / ACTION TYPES:',
    'update_schedule: Allocate unscheduled tasks into future free time using app rules. {}',
    'create_block: Create one custom block. {date,start,end,title,blockType,bg,border,textColor,taskIds,taskTexts}',
    'update_block: Edit one existing block. {id OR date+title, date,start,end,title,type,bg,border,textColor}',
    'move_block: Move one existing block. {id OR date+title, date,start,end}',
    'resize_block: Resize one existing block. {id OR date+title,start,end}',
    'delete_block: Delete one existing block. {id OR date+title}',
    'delete_generated_after: Delete generated task blocks after a cutoff. {date,time,mode}. mode can be start_after or overlapping_after.',
    'shift_generated_from: Move generated task blocks at/after a selected point. {date,time,minutes}. Positive minutes moves later; negative moves earlier.',
    'reflow_generated_from: Re-pack generated task blocks from a selected point into later valid free time. {date,time}',
    'set_task_day: Assign a task to a day in the to-do list. {taskId,day}',
    'mark_task_done: Mark task done or not done. {taskId,done}',
    '',
    'IMPORTANT RULES:',
    'A task with no explicit time or duration must not be scheduled.',
    'Generated task blocks must be at least 45 minutes long.',
    'If a task says a duration and multiple days, allocate that full duration on each named day. Example: 2 hours math test prep monday and sunday means 2 hours Monday and 2 hours Sunday.',
    'Never place generated task blocks inside school/module time. If school modules have gaps, the full span from first school module start to last school module end is unavailable.',
    'Never overlap routines, wind down, work, trip, or existing non-generated custom blocks unless the user explicitly asks to edit that exact block.',
    'Future scheduling today must start at the next 5-minute boundary after now. Example 12:31 -> 12:35, 12:37 -> 12:40.',
    'Earlier to-do tasks are more urgent. Preserve order unless the user asks otherwise.',
    'If a timed task is under 45 minutes, group it with following timed tasks until the block is at least 45 minutes.',
    'If a task is long and does not fit in one free block, split it into multiple parts with titles ending pt. 1, pt. 2, etc.',
    'Use concise block titles under 25 characters. Preserve exact full task text in taskTexts for details.',
    'When shortening, lengthening, or moving a generated task, also move/reflow following generated blocks so they still fit.',
    'When the user says after 16 today I cannot work, use delete_generated_after with today and 16:00, mode overlapping_after unless they specifically mean only blocks starting after 16.',
    '',
    'STATE:',
    JSON.stringify(appState)
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
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1,
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
