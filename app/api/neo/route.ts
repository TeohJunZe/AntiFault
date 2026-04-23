import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawKey = process.env.OLLAMA_API_KEY;
    const apiKey = rawKey === 'your_api_key_goes_here' ? undefined : rawKey;
    const defaultUrl = apiKey ? 'https://api.ollama.com' : 'http://localhost:11434';
    const baseUrl = process.env.OLLAMA_URL || defaultUrl;

    // On cloud, override model to one available on Ollama cloud
    const payload = { ...body };
    if (apiKey && payload.model === 'llama2') {
      payload.model = 'llama3.2';
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.log(`[Neo] Calling ${baseUrl}/api/generate with model: ${payload.model}`);

    const ollamaRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!ollamaRes.ok) {
      const errorBody = await ollamaRes.text();
      console.error(`[Neo] Ollama error ${ollamaRes.status}:`, errorBody);
      return NextResponse.json(
        { error: `Ollama returned ${ollamaRes.status}: ${errorBody}` },
        { status: ollamaRes.status }
      );
    }

    return new Response(ollamaRes.body, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  } catch (error: any) {
    console.error('Neo API Proxy Error:', error);
    return NextResponse.json({ error: `Failed to proxy request: ${error.message}` }, { status: 500 });
  }
}
