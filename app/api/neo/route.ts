import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Call Ollama local API or cloud API from the server
    // This avoids CORS issues and keeps the API key hidden from the browser
    const rawKey = process.env.OLLAMA_API_KEY;
    const apiKey = rawKey === 'your_api_key_goes_here' ? undefined : rawKey;
    const defaultUrl = apiKey ? 'https://ollama.com' : 'http://localhost:11434';
    const baseUrl = process.env.OLLAMA_URL || defaultUrl;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const ollamaRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!ollamaRes.ok) {
      return NextResponse.json({ error: `Ollama returned ${ollamaRes.status}` }, { status: ollamaRes.status });
    }

    // Proxy the raw NDJSON stream back to the client
    return new Response(ollamaRes.body, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  } catch (error) {
    console.error('Neo API Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to proxy request to Ollama' }, { status: 500 });
  }
}
