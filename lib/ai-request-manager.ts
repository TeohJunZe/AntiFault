/**
 * AI Request Manager — Local Ollama
 * 
 * All Neo AI calls go through this manager.
 * Priority: llama2 → gemma3 (fallback)
 * Uses Ollama /api/generate endpoint with structured prompt + conversation memory.
 */

import PQueue from "p-queue";

// ─── Request Queue ───
const queue = new PQueue({ concurrency: 1 });

// ─── Response Cache ───
interface CacheEntry {
    response: string;
    timestamp: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, CacheEntry>();

function getCacheKey(query: string, dataHash: string): string {
    return `${query.toLowerCase().trim()}::${dataHash}`;
}

function hashMachineData(data: any[]): string {
    if (!data || !Array.isArray(data)) return "no-data";
    return data.map(m => `${m.name}:${Math.round(m.healthScore / 5) * 5}:${m.status}`).join("|");
}

function getCachedResponse(key: string): string | null {
    const entry = responseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        responseCache.delete(key);
        return null;
    }
    return entry.response;
}

function setCachedResponse(key: string, response: string): void {
    if (responseCache.size > 100) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
    }
    responseCache.set(key, { response, timestamp: Date.now() });
}

// ─── Neo Personality Prompt ───
const NEO_PERSONALITY = `You are Neo, an AI assistant for factory equipment monitoring in a dashboard called AntiFault.

Rules:
- Answer the question DIRECTLY. Do not start with introductions like "Of course!", "As your friendly assistant", "Great question!", "Sure!", "Absolutely!".
- Go straight to the answer. Be concise and useful.
- Speak naturally like a colleague. Keep it casual but professional.
- Never use asterisk actions like *looks around* or *checks data*. Just state facts.
- Never say "I am an AI" or "As an AI".
- Keep responses to 1-3 sentences unless a detailed report is requested.
- If a machine is critical, say it directly with urgency.

Always respond as Neo.`;

// ─── Build Prompt with Memory ───
function buildPrompt(
    query: string,
    machineData: any[],
    conversationHistory: { role: string; content: string }[]
): string {
    // Compress to key fields only — prevents llama2 context window overflow (causes 500 errors)
    const compressedData = machineData.map(m => ({
        name: m.name,
        status: m.status,
        health: m.healthScore ?? m.health,
        temp: m.temperature ?? m.sensors?.temperature,
        vibration: m.vibration ?? m.sensors?.vibration,
        alerts: m.alerts?.length ?? 0,
    }));
    const machineDataStr = JSON.stringify(compressedData);

    // Build conversation memory (last 10 messages)
    const recentHistory = conversationHistory.slice(-6);
    const memoryLines = recentHistory.map(msg =>
        msg.role === "user" ? `User: ${msg.content}` : `Neo: ${msg.content}`
    );

    const conversationBlock = memoryLines.length > 0
        ? memoryLines.join("\n") + "\n"
        : "";

    return `${NEO_PERSONALITY}

Current machine sensor data:
${machineDataStr}

Conversation:
${conversationBlock}User: ${query}

Neo:`;
}

// ─── Response Cleanup ───
function cleanResponse(raw: string, query: string): string {
    let cleaned = raw.trim();

    // Remove any repeated "Neo:" prefixes
    cleaned = cleaned.replace(/^(Neo:\s*)+/gi, "").trim();

    // Remove duplicated system prompt fragments
    if (cleaned.includes("You are Neo")) {
        const neoIdx = cleaned.lastIndexOf("Neo:");
        if (neoIdx !== -1) {
            cleaned = cleaned.substring(neoIdx + 4).trim();
        }
    }

    // Remove echoed user message
    if (cleaned.toLowerCase().startsWith(`user: ${query.toLowerCase()}`)) {
        cleaned = cleaned.substring(`user: ${query}`.length).trim();
        cleaned = cleaned.replace(/^(Neo:\s*)+/gi, "").trim();
    }

    // Limit response length (prevent rambling)
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    if (sentences.length > 5) {
        cleaned = sentences.slice(0, 5).join(" ");
    }

    return cleaned || "I couldn't process that. Could you try again?";
}

// ─── Call Ollama Stream ───
async function callOllamaStream(model: string, prompt: string, onToken: (token: string) => void): Promise<void> {
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for stream

    try {
        const response = await fetch("/api/neo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                prompt,
                stream: true,
                options: {
                    temperature: 0.7,
                    num_predict: 300,
                },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Ollama returned ${response.status}`);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Reset timeout on each chunk (browser compatible)
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => controller.abort(), 60000);
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        onToken(json.response);
                    }
                } catch (e) {
                    // Ignore parse errors on partial lines
                }
            }
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

// ─── Public Interface ───
export interface NeoRequest {
    query: string;
    machineData: any[];
    conversationHistory?: { role: string; content: string }[];
}

export async function streamNeoRequest(
    request: NeoRequest,
    onToken: (token: string) => void
): Promise<void> {
    const { query, machineData, conversationHistory } = request;

    // Check cache
    const dataHash = hashMachineData(machineData);
    const cacheKey = getCacheKey(query, dataHash);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
        console.log("[AI Manager] Cache hit (stream):", query.substring(0, 50));
        // Simulate streaming the cached response word by word
        const words = cached.split(/(?<=\s+)/);
        for (const word of words) {
            onToken(word);
        }
        return;
    }

    const prompt = buildPrompt(query, machineData, conversationHistory || []);
    let fullResponse = "";

    const handleToken = (token: string) => {
        fullResponse += token;
        onToken(token);
    };

    // Priority 1: llama2 (works locally if downloaded)
    try {
        console.log("[AI Manager] Streaming llama2...");
        await callOllamaStream("llama2", prompt, handleToken);
        console.log("[AI Manager] ✅ llama2 stream finished");
    } catch (err: any) {
        console.warn("[AI Manager] llama2 stream failed:", err.message);
        
        // Priority 2: gemma3:4b (works on Ollama Cloud)
        try {
            console.log("[AI Manager] Streaming gemma3:4b (fallback)...");
            fullResponse = ""; // reset accumulated text
            await callOllamaStream("gemma3:4b", prompt, handleToken);
            console.log("[AI Manager] ✅ gemma3:4b stream finished");
        } catch (err2: any) {
            console.warn("[AI Manager] gemma3:4b stream failed:", err2.message);
            // Last resort: show exact error
            const fallbackMsg = `[Connection Error] Could not reach the AI models. Details: ${err2.message}. Please verify your API key and model availability.`;
            
            // Output fallback word by word to simulate streaming
            const words = fallbackMsg.split(" ");
            for (let i = 0; i < words.length; i++) {
                handleToken(words[i] + " ");
                await new Promise(r => setTimeout(r, 50));
            }
        }
    }

    if (fullResponse.trim()) {
        const cleaned = cleanResponse(fullResponse, query);
        setCachedResponse(cacheKey, cleaned);
    }
}
