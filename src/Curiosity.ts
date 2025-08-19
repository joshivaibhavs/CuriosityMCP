import { AIBackend } from './AIBackend';
import { CuriosityOptions } from './CuriosityOptions';
import { CuriosityTool, ActionTool, QueryTool } from './tools/CuriosityTool';

export type Sender = 'user' | 'assistant' | 'tool';

export interface Message {
  role: Sender | 'system';
  content: string;
}
export class Curiosity {
  private element: HTMLElement;
  private messagesContainer!: HTMLDivElement;
  private input!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private aiBackend: AIBackend | null = null;
  private tools: CuriosityTool[] = [];
  private messages: Message[] = [];
  private readonly styles: { [key: string]: string } = {};
  #toolUsagePromptSection =
    '\n<tool-usage>If you have access to any tools, you can use them by including a tool call in your message as given in the <usage> section of each tool. Respond with the JSON object which adheres to the usage guidelines, including the toolUse and toolName properties. Wrap the <usage> section in a [TOOL_REQUEST] tag as shown in the example. Example:\n[TOOL_REQUEST]{"toolUse": true, "toolName": "exampleTool"}[END_TOOL_REQUEST]</tool-usage>';
  #toolsPrompt = '';
  #systemPrompt: string = `<system-prompt>You are a helpful assistant.</system-prompt>${this.toolUsagePromptSection}`;

  constructor(element: HTMLElement, options: CuriosityOptions = {}) {
    this.element = element;
    this.render();

    if (options.systemPrompt) {
      this.#systemPrompt = `<system-prompt>${options.systemPrompt}</system-prompt>${this.toolUsagePromptSection}`;
    }

    if (options.styles) {
      Object.assign(this.styles, options.styles);
    }
    this.injectStyles();
    this.setupEventListeners();
  }

  private get toolUsagePromptSection(): string {
    if (this.tools.length === 0) {
      return '';
    }
    return this.#toolUsagePromptSection;
  }

  private constructSystemPrompt(): string {
    let prompt = this.#systemPrompt;
    if (this.tools.length > 0) {
      prompt += this.toolUsagePromptSection;
      prompt += this.#toolsPrompt;
    }
    prompt += `<today>${new Date().toISOString()}</today>`;
    return prompt;
  }

  public get systemPrompt(): string {
    return this.constructSystemPrompt();
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
<usage>\n[TOOL_REQUEST]`;
    if (tool.arguments) {
      toolDefinition += JSON.stringify({ toolUse: true, toolName: tool.name, args: tool.arguments });
    } else {
      toolDefinition += JSON.stringify({ toolUse: true, toolName: tool.name });
    }
    toolDefinition += `[END_TOOL_REQUEST]\n</usage>`;
    this.#toolsPrompt += toolDefinition;
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

  private async handleSendMessage(content: string = this.input.value.trim(), role: Sender = 'user'): Promise<void> {
    if (!content) return;

    if (this.input.value) {
      this.displayMessage(content, role);
      this.input.value = '';
    }

    if (!this.aiBackend) {
      this.displayMessage('No AI backend registered.', 'assistant');
      console.error('Curiosity Error: No AI backend has been registered. Use `registerAIBackend`.');
      return;
    }

    let fullResponse = '';
    const aiMessageElement = this.createStreamedMessageElement();

    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
    this.messages.push({ role, content });

    try {
      for await (const chunk of this.aiBackend.streamMessage(this.messages)) {
        fullResponse += chunk;
        aiMessageElement.textContent = fullResponse; // Update UI as chunks arrive
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }

      // Check if the complete response is a tool call
      const toolCall = this.tryParseToolCall(fullResponse);
      if (toolCall && 'toolCallFailed' in toolCall) {
        aiMessageElement.textContent = 'A tool call was requested by the AI, but it could not be parsed correctly, as the AI responded with a malformed request. Please try again.';
        aiMessageElement.classList.add('curiosity-message-tool-error');
        console.error('Curiosity Error: Tool call parsing failed.', fullResponse);
        return;
      } else if (toolCall) {
        aiMessageElement.remove(); // Remove the JSON from chat
        await this.handleToolCall(toolCall as { toolName: string; args: any });
      } else {
        this.messages.push({ role: 'assistant', content: fullResponse });
      }
    } catch (error) {
      aiMessageElement.textContent = 'An error occurred while fetching the response.';
      console.error('Curiosity Error: Streaming failed.', error);
    }
  }

  private tryParseToolCall(text: string): { toolName: string; args: any } | { toolCallFailed: true } | null {
    if (!text || !text.includes('[TOOL_REQUEST]') || !text.includes('[END_TOOL_REQUEST]')) return null;
    const toolCallRegex = /\[TOOL_REQUEST\](.*?)\[END_TOOL_REQUEST\]/s;
    const match = text.match(toolCallRegex);
    if (!match || match.length < 2) return null;
    try {
      // const cleanedText = text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1').trim();
      const cleanedText = match[1].trim();
      if (!cleanedText) return null;
      // Parse the JSON object
      const json = JSON.parse(cleanedText);
      if (json && typeof json === 'object' && 'toolUse' in json && 'toolName' in json) {
        return json;
      } else {
        throw new Error('Invalid tool call format');
      }
      return null;
    } catch (e) {
      return { toolCallFailed: true };
    }
  }

  private async handleToolCall(toolCall: { toolName: string; args: any }): Promise<void> {
    const tool = this.tools.find((t) => t.name === toolCall.toolName);
    if (!tool) {
      this.displayMessage(`Tool "${toolCall.toolName}" not found.`, 'assistant');
      return;
    }

    try {
      this.displayMessage(`Using tool: ${tool.name}...`, 'assistant');
      const result = await tool.execute(toolCall.args);

      if (tool instanceof QueryTool) {
        // For QueryTool, send the result back to the AI for the next response.
        await this.handleSendMessage(`<tool-response>${JSON.stringify(result)}</tool-response>`, 'tool');
      }
      // For ActionTool, the action is complete, and the conversation stops here.
    } catch (error) {
      this.displayMessage(`Error executing tool "${tool.name}".`, 'assistant');
      console.error(`Curiosity Error: Tool execution failed for ${tool.name}.`, error);
    }
  }

  private displayMessage(text: string, sender: Sender): void {
    const messageElement = document.createElement('div');
    messageElement.classList.add('curiosity-message', `curiosity-message-${sender}`);
    messageElement.textContent = text;
    this.messagesContainer.appendChild(messageElement);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private createStreamedMessageElement(): HTMLDivElement {
    const messageElement = document.createElement('div');
    messageElement.classList.add('curiosity-message', `curiosity-message-assistant`);
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
                background-color: ${this.styles?.backgroundColor || '#007bff'};
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 0;
            }
            .curiosity-message-assistant {
                background-color: #f1f1f1;
                color: #333;
                align-self: flex-start;
                border-bottom-left-radius: 0;
            }
            .curiosity-message-tool {
                background-color: #e0f7fa;
                color: #006064;
                align-self: flex-start;
                border-bottom-left-radius: 0;
            }
            .curiosity-message-tool-error {
              background-color: #ffebee;
              color: #b71c1c;
              align-self: flex-start;
              border-bottom-left-radius: 0;
            }
            .curiosity-message-tool-error::before {
              content: 'Tool Error: ';
              font-weight: bold;
              color: #b71c1c;
            }
            .curiosity-message-tool::before {
              content: 'Tool Response: ';
              font-weight: bold;
              color: #006064;
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
                background-color: ${this.styles?.backgroundColor || '#007bff'};
                color: white;
                border-radius: 15px;
                cursor: pointer;
                font-weight: bold;
            }
            .curiosity-send-button:hover {
                background-color: ${this.styles?.backgroundColorHover || '#0056b3'};
            }
        `;
    document.head.appendChild(style);
  }
}
