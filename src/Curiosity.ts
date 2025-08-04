import { AIBackend } from './AIBackend';
import { CuriosityOptions } from './CuriosityOptions';
import { CuriosityTool, ActionTool, QueryTool } from './tools/CuriosityTool';

export class Curiosity {
  private element: HTMLElement;
  private messagesContainer!: HTMLDivElement;
  private input!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private aiBackend: AIBackend | null = null;
  private tools: CuriosityTool[] = [];
  #toolUsagePromptSection =
    '\n<tool-usage>If you have access to any tools, you can use them by including a tool call in your message as given in the <usage> section of each tool. Respond with only the JSON object which adheres to the usage guidelines, including the toolUse and toolName properties. Do not include any formatting.</tool-usage>';
  #systemPrompt: string = `<system-prompt>You are a helpful assistant.</system-prompt>${this.#toolUsagePromptSection}`;

  constructor(element: HTMLElement, options: CuriosityOptions = {}) {
    this.element = element;
    this.render();
    this.injectStyles();

    if (options.systemPrompt) {
      this.#systemPrompt = `<system-prompt>${options.systemPrompt}</system-prompt>${this.#toolUsagePromptSection}`;
    }
    this.setupEventListeners();
  }

  public get systemPrompt(): string {
    return this.#systemPrompt;
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
    let toolDefinition = `
<tool>
<name>${tool.name}</name>
<description>${tool.description}</description>
<usage>\n`;
    if (tool.arguments) {
      toolDefinition += JSON.stringify({ toolUse: true, toolName: tool.name, args: tool.arguments });
    } else {
      toolDefinition += JSON.stringify({ toolUse: true, toolName: tool.name });
    }
    toolDefinition += `\n</usage>`;
    this.#systemPrompt += toolDefinition;
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
      for await (const { text: chunk, isReasoning } of this.aiBackend.streamMessage(messageText)) {
        if (isReasoning) {
          aiMessageElement.textContent = 'Thinking...';
          continue; // Skip displaying reasoning chunks
        }
        if (!chunk) continue; // Skip empty chunks
        if (fullResponse.startsWith('Thinking...')) {
          fullResponse = ''; // Reset if we were previously thinking
        }
        fullResponse += chunk;
        aiMessageElement.textContent = fullResponse; // Update UI as chunks arrive
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

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

  private tryParseToolCall(text: string): { toolName: string; args: any } | null {
    if (text.includes('```')) {
      // If the response is wrapped in code blocks, remove them
      text = text.replace(/```json|```/g, '').trim();
    }
    try {
      const json = JSON.parse(text);
      if (json && typeof json === 'object' && 'toolUse' in json && 'toolName' in json) {
        return json;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  private async handleToolCall(toolCall: { toolName: string; args: any }): Promise<void> {
    const tool = this.tools.find((t) => t.name === toolCall.toolName);
    if (!tool) {
      this.displayMessage(`Tool "${toolCall.toolName}" not found.`, 'ai');
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
