export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Missing DEEPSEEK_API_KEY' });
  }

  const body = request.body ?? {};
  const message = typeof body.message === 'string' ? body.message : '';
  const context = body.context ?? {};
  if (!message.trim()) {
    return response.status(400).json({ message: 'Message is required' });
  }

  try {
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [
              'You are the Personal OS v2 assistant.',
              'Never claim schedule changes unless a validated tool has changed state.',
              'Current browser tool execution is limited. If you cannot perform a mutation, explain that no changes were made.',
              'Protected events cannot be moved, deleted, or overlapped.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({ message, context }),
          },
        ],
      }),
    });

    const data = await deepseekResponse.json();
    if (!deepseekResponse.ok) {
      return response.status(deepseekResponse.status).json({ message: data?.error?.message || 'DeepSeek request failed' });
    }

    const reply = data?.choices?.[0]?.message?.content || 'No changes made.';
    return response.status(200).json({ reply });
  } catch (error) {
    return response.status(500).json({ message: error instanceof Error ? error.message : 'DeepSeek request failed' });
  }
}
