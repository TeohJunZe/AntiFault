import { NextResponse } from 'next/server';

const NEO_SYSTEM_PROMPT = `You are Neo, an AI assistant for factory equipment monitoring.

Rules:
- Answer the question DIRECTLY. Do not start with introductions like "Of course!", "As your friendly assistant", "Great question!", "Sure!", "Absolutely!".
- Go straight to the answer. Be concise and useful.
- Speak naturally like a colleague. Keep it casual but professional.
- Never use asterisk actions like *looks around* or *checks data*. Just state facts.
- Never say "I am an AI" or "As an AI".
- Keep responses to 1-3 sentences unless a detailed report is requested.
- If a machine is critical, say it directly with urgency.

Always respond as Neo.`;

function cleanLLMOutput(text: string): string {
  // Strip echoed prefixes that local models sometimes emit
  return text
    .replace(/^(User|Neo|Assistant|Human):\s*/gi, '')
    .replace(/\n(User|Neo|Assistant|Human):\s*/gi, '\n')
    .trim();
}

export async function POST(req: Request) {
  try {
    const { prompt, currentContext } = await req.json();

    const fullPrompt = currentContext
      ? `Context about current factory state: ${currentContext}\n\nUser question: ${prompt}`
      : prompt;

    // Call Ollama local API
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama2',
        prompt: fullPrompt,
        system: NEO_SYSTEM_PROMPT,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 256,
        },
      }),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      // Fallback to a simple mock response if Ollama isn't available
      const encoder = new TextEncoder();
      const fallbackText = "Ollama is not reachable right now. Make sure it's running with llama2 loaded.";
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(fallbackText));
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain' } });
    }

    // Stream Ollama's NDJSON response as plain text tokens
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Ollama streams newline-delimited JSON
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  const cleaned = cleanLLMOutput(json.response);
                  if (cleaned) {
                    controller.enqueue(encoder.encode(cleaned));
                  }
                }
                if (json.done) {
                  break;
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Neo API Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
