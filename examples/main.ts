import { Curiosity, AIBackend, ActionTool } from '../src/index';

// Get the container element from the HTML
const chatContainer = document.getElementById('curiosity-container');

if (chatContainer) {
    // 1. Initialize the Curiosity UI
    const curiosity = new Curiosity(chatContainer);

    // 2. Create and register the real AI backend
    const realAIBackend: AIBackend = {
        async *streamMessage(message: string, tools: any[]) {
            const systemPrompt = `You are a helpful assistant integrated into a web page. You can use tools to interact with the page. To use a tool, respond with a JSON object with the following format: {"tool": "tool_name", "args": {"arg_name": "value"}}. Available tools:\n${tools.map(t => `- ${t.name}: ${t.description} \nExample usage: ${t.exampleUsage}`).join('\n')}`;

            const response = await fetch('http://localhost:1234/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.2-1b-instruct',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message }
                    ],
                    temperature: 0.7,
                    max_tokens: -1,
                    stream: true
                })
            });

            if (!response.body) {
                throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            console.error('Error parsing stream data:', e);
                        }
                    }
                }
            }
        }
    };
    curiosity.registerAIBackend(realAIBackend);

    // 3. Create and register a tool
    const changeColorTool = new ActionTool({
        name: 'changeBackgroundColor',
        description: 'Changes the background color of the page body.',
        exampleUsage: 'changeBackgroundColor {"color": "lightblue"}',
        action: ({ color }: { color: string }) => {
            console.log('Changing background color to:', color);
            document.body.style.backgroundColor = color;
        }
    });
    curiosity.registerTool(changeColorTool);

    console.log('Curiosity UI initialized and ready.');

} else {
    console.error('Could not find the #curiosity-container element.');
}
