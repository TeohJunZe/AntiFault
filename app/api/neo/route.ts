import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, currentContext } = await req.json();

    // In a real application, this would call OpenAI/Anthropic SDK to get a streaming response.
    // Since we don't have API keys, we will simulate a streaming response with simulated delays.
    
    // Create a simple response based on mock data
    let responseText = "I have processed your query. ";
    if (prompt.toLowerCase().includes('urgent') || prompt.toLowerCase().includes('alert')) {
        responseText = "There are several critical alerts. Please focus your attention on the anomaly detected in the Hydraulic Press. Immediate action is recommended.";
    } else if (prompt.toLowerCase().includes('report')) {
        responseText = "Generating a comprehensive maintenance report. Most systems are nominal, but some predictive indicators flag potential future risks on Conveyor Belt #1.";
    } else if (currentContext && currentContext.toLowerCase().includes('critical')) {
        responseText = `Based on the context, ${currentContext.split(' ')[0]} requires attention. How would you like to proceed?`;
    } else {
        responseText = "I've updated the HUD with the latest telemetry. " + (prompt.length > 20 ? "Analysis indicates stable operations for the targeted sub-systems." : "What else can I help you with today?");
    }

    // Return a mocked stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const words = responseText.split(' ');
        for (const word of words) {
          // Send word with a space
          controller.enqueue(encoder.encode(word + ' '));
          // Simulate network delay for streaming effect
          await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        controller.close();
      }
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('Neo API Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
