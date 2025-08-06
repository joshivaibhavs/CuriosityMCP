# Curiosity MCP Frontend Server

A simple, embeddable chat UI component that connects to a streaming AI backend and supports frontend tools.

**Public Beta Notice**

This is a public beta release of the Curiosity MCP Frontend Server library. It is intended for testing and feedback purposes. While it should work in most cases, it may not be fully stable and could break in some instances. Please use with caution and report any issues you encounter.

## Automate your users' journeys with a chat agent!

### Demo

![Curiosity MCP Frontend Demo](./assets/Curiosity-MCP-demo.gif)

## Installation

```bash
npm insatll @curiositymcp/mcp-frontend-server
```

## Quick Start

1.  **Create an HTML file** with a container element for the chat UI.

    ```html
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Curiosity Example</title>
        <style>
          /* Give the container a defined size */
          #chat-container {
            width: 400px;
            height: 600px;
            border: 1px solid #ccc;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div id="chat-container"></div>
        <script src="./node_modules/@curiositymcp/mcp-frontend-server/dist/index.umd.js"></script>
        <script src="./main.js"></script>
      </body>
    </html>
    ```

2.  **Create a JavaScript file** (`main.js`) to initialize the UI, register a backend, and add tools.

    ```javascript
    // Get the container element
    const chatContainer = document.getElementById('chat-container');

    // 1. Initialize the Curiosity UI
    const curiosity = new CuriosityMCP.Curiosity(chatContainer);

    // 2. Create and register a mock AI backend
    const mockAIBackend = {
      async *streamMessage(message) {
        // Check if the user is asking to use a tool
        if (message.toLowerCase().includes('change background')) {
          // AI decides to use a tool
          yield JSON.stringify({ toolUse: true, toolName: 'changeBackgroundColor', args: { color: 'lightblue' } });
          return;
        }

        // Otherwise, stream a simple response
        const response = `You said: "${message}". I am a mock AI.`;
        for (const char of response) {
          yield char;
          await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate streaming delay
        }
      },
    };
    curiosity.registerAIBackend(mockAIBackend);

    // 3. Create and register a tool
    const changeColorTool = new CuriosityMCP.ActionTool({
      name: 'changeBackgroundColor',
      description: 'Changes the background color of the page body.',
      action: ({ color }) => {
        document.body.style.backgroundColor = color;
      },
    });
    curiosity.registerTool(changeColorTool);

    console.log('Curiosity UI initialized.');
    ```

3.  **Open the HTML file** in your browser. You should see the chat interface. Try typing "change background" to see the tool in action!
