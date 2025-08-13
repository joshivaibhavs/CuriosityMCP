import { Curiosity, AIBackend, ActionTool, Message } from '../src/index';

const colorPicker = document.querySelector('#color-picker') as HTMLInputElement;

function colorNameToHex(element: HTMLElement): string | null {
  const computedColor = window.getComputedStyle(element).backgroundColor;
  if (!computedColor) {
    return null;
  }
  const rgbMatch = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!rgbMatch) {
    return null;
  }
  const r = parseInt(rgbMatch[1]);
  const g = parseInt(rgbMatch[2]);
  const b = parseInt(rgbMatch[3]);
  const toHex = (c: number) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Extend the Window interface to include changeColor
declare global {
  interface Window {
    changeColor: (color: string) => void;
  }
}

function changeColor(color: string): void {
  document.body.style.backgroundColor = color;
  colorPicker.value = colorNameToHex(document.body) || '#FFFFFF';
}

(function () {
  if (!colorPicker) {
    console.error('Color picker input not found. Please ensure it exists in the HTML.');
    return;
  }
  colorPicker.addEventListener('change', (event) => {
    changeColor((event.target as HTMLInputElement).value);
  });
})();

// Get the container element from the HTML
const chatContainer = document.getElementById('curiosity-container');

if (chatContainer) {
  // 1. Initialize the Curiosity UI
  const curiosity = new Curiosity(chatContainer, { systemPrompt: 'You are a helpful assistant integrated into a web page. You can use tools to interact with the page. ' });

  // 2. Create and register the real AI backend
  const realAIBackend: AIBackend = {
    async *streamMessage(messages: Message[]): AsyncGenerator<string> {
      const systemPrompt = curiosity.systemPrompt;

      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        // Use the LM Studio (https://lmstudio.ai) server endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma-3-12b-it',
          messages,
          temperature: 0.7,
          max_tokens: -1,
          stream: true,
        }),
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
    },
  };
  curiosity.registerAIBackend(realAIBackend);

  // 3. Create and register a tool
  const changeColorTool = new ActionTool({
    name: 'changeBackgroundColor',
    description: 'Changes the background color of the page body.',
    arguments: {
      color: 'The color to change the background to. Can be a color name or hex value.',
    },
    action: (args: { [color: string]: string }) => {
      let color;
      for (const argName in args) {
        if (argName.toLowerCase().includes('color') || argName.toLowerCase().includes('value')) {
          color = args[argName];
          break;
        }
      }
      if (!color) return;
      changeColor(color);
    },
  });
  curiosity.registerTool(changeColorTool);

  console.log('Curiosity UI initialized and ready.');
} else {
  console.error('Could not find the #curiosity-container element.');
}
