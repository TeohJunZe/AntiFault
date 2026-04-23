import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OLLAMA_API_KEY is not configured' }, { status: 500 });
    }

    const ollamaRes = await fetch('https://api.ollama.com/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!ollamaRes.ok) {
      const errorBody = await ollamaRes.text();
      console.error(`[Neo] Ollama cloud error ${ollamaRes.status}:`, errorBody);
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
    return NextResponse.json({ error: `Failed to reach Ollama cloud: ${error.message}` }, { status: 500 });
  }
}
