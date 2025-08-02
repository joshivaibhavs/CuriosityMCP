import { AIBackend } from './AIBackend';
import { CuriosityTool, ActionTool, QueryTool } from './tools/CuriosityTool';

export class Curiosity {
  private element: HTMLElement;
  private messagesContainer!: HTMLDivElement;
  private input!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private aiBackend: AIBackend | null = null;
  private tools: CuriosityTool[] = [];

  constructor(element: HTMLElement) {
    this.element = element;
    this.render();
    this.injectStyles();
    this.setupEventListeners();
  }

  public registerAIBackend(backend: AIBackend): void {
    this.aiBackend = backend;
  }

  public registerTool(tool: CuriosityTool): void {
    if (this.tools.some((t) => t.name === tool.name)) {
      console.warn(`Curiosity Warning: A tool with the name "${tool.name}" is already registered.`);
      return;
    }
    this.tools.push(tool);
  }

  private render(): void {
    this.element.innerHTML = `
            <div class="curiosity-chat-container">
                <div class="curiosity-messages"></div>
                <div class="curiosity-input-area">
                    <input type="text" class="curiosity-input" placeholder="Type your message...">
                    <button class="curiosity-send-button">Send</button>
                </div>
            </div>
        `;
    this.messagesContainer = this.element.querySelector('.curiosity-messages')!;
    this.input = this.element.querySelector('.curiosity-input')!;
    this.sendButton = this.element.querySelector('.curiosity-send-button')!;
  }

  private setupEventListeners(): void {
    this.sendButton.addEventListener('click', () => this.handleSendMessage());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.handleSendMessage();
      }
    });
  }

  private async handleSendMessage(messageText: string = this.input.value.trim()): Promise<void> {
    if (!messageText) return;

    if (this.input.value) {
      this.displayMessage(messageText, 'user');
      this.input.value = '';
    }

    if (!this.aiBackend) {
      this.displayMessage('No AI backend registered.', 'ai');
      console.error('Curiosity Error: No AI backend has been registered. Use `registerAIBackend`.');
      return;
    }

    let fullResponse = '';
    const aiMessageElement = this.createStreamedMessageElement();

    try {
      for await (const chunk of this.aiBackend.streamMessage(messageText, this.tools)) {
        fullResponse += chunk;
        aiMessageElement.textContent = fullResponse; // Update UI as chunks arrive
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      console.log('Full response:', fullResponse);

      // Check if the complete response is a tool call
      const toolCall = this.tryParseToolCall(fullResponse);
      if (toolCall) {
        aiMessageElement.remove(); // Remove the JSON from chat
        await this.handleToolCall(toolCall);
      }
    } catch (error) {
      aiMessageElement.textContent = 'An error occurred while fetching the response.';
      console.error('Curiosity Error: Streaming failed.', error);
    }
  }

  private tryParseToolCall(text: string): { tool: string; args: any } | null {
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', json);
      if (json && typeof json.tool === 'string' && json.args !== undefined) {
        return json;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  private async handleToolCall(toolCall: { tool: string; args: any }): Promise<void> {
    const tool = this.tools.find((t) => t.name === toolCall.tool);
    if (!tool) {
      this.displayMessage(`Tool "${toolCall.tool}" not found.`, 'ai');
      return;
    }

    try {
      this.displayMessage(`Using tool: ${tool.name}...`, 'ai');
      const result = await tool.execute(toolCall.args);

      if (tool instanceof QueryTool) {
        // For QueryTool, send the result back to the AI for the next response.
        const toolResponseMessage = `Tool ${tool.name} returned: ${JSON.stringify(result)}`;
        await this.handleSendMessage(toolResponseMessage);
      }
      // For ActionTool, the action is complete, and the conversation stops here.
    } catch (error) {
      this.displayMessage(`Error executing tool "${tool.name}".`, 'ai');
      console.error(`Curiosity Error: Tool execution failed for ${tool.name}.`, error);
    }
  }

  private displayMessage(text: string, sender: 'user' | 'ai'): void {
    const messageElement = document.createElement('div');
    messageElement.classList.add('curiosity-message', `curiosity-message-${sender}`);
    messageElement.textContent = text;
    this.messagesContainer.appendChild(messageElement);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private createStreamedMessageElement(): HTMLDivElement {
    const messageElement = document.createElement('div');
    messageElement.classList.add('curiosity-message', 'curiosity-message-ai');
    this.messagesContainer.appendChild(messageElement);
    return messageElement;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
            .curiosity-chat-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                box-sizing: border-box;
                font-family: sans-serif;
            }
            .curiosity-messages {
                flex-grow: 1;
                padding: 1rem;
                overflow-y: auto;
                border-bottom: 1px solid #eee;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .curiosity-message {
                padding: 0.5rem 1rem;
                border-radius: 15px;
                max-width: 80%;
                word-wrap: break-word;
            }
            .curiosity-message-user {
                background-color: #007bff;
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 0;
            }
            .curiosity-message-ai {
                background-color: #f1f1f1;
                color: #333;
                align-self: flex-start;
                border-bottom-left-radius: 0;
            }
            .curiosity-input-area {
                display: flex;
                padding: 1rem;
                background-color: #f9f9f9;
            }
            .curiosity-input {
                flex-grow: 1;
                border: 1px solid #ccc;
                border-radius: 15px;
                padding: 0.5rem 1rem;
                font-size: 1rem;
                margin-right: 0.5rem;
            }
            .curiosity-send-button {
                padding: 0.5rem 1rem;
                border: none;
                background-color: #007bff;
                color: white;
                border-radius: 15px;
                cursor: pointer;
                font-weight: bold;
            }
            .curiosity-send-button:hover {
                background-color: #0056b3;
            }
        `;
    document.head.appendChild(style);
  }
}
