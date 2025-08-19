import { Curiosity, Message } from './Curiosity';
import { AIBackend } from './AIBackend';
import { ActionTool, QueryTool } from './tools/CuriosityTool';

// Helper to wait for async operations in tests to complete
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Helper to create a mock AI backend
const createMockAIBackend = (responses: { [message: string]: () => AsyncGenerator<string> }): AIBackend => {
  return {
    streamMessage: jest.fn((messages: Message[]) => {
      const message = messages[messages.length - 1].content;
      if (responses[message]) {
        return responses[message]();
      }
      // Default response for any other message
      return (async function* () {
        const response = `Echo: ${message}`;
        for (const char of response) {
          yield char;
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      })();
    }),
  };
};

describe('Curiosity', () => {
  let chatContainer: HTMLElement;

  beforeEach(() => {
    // Set up a fresh DOM element and mock console for each test
    document.body.innerHTML = '<div id="chat"></div>';
    chatContainer = document.getElementById('chat')!;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render the chat UI without crashing', () => {
    new Curiosity(chatContainer);
    expect(chatContainer.querySelector('.curiosity-chat-container')).not.toBeNull();
    expect(chatContainer.querySelector('.curiosity-input')).not.toBeNull();
    expect(chatContainer.querySelector('.curiosity-send-button')).not.toBeNull();
  });

  it('should display a user message when sent', () => {
    const curiosity = new Curiosity(chatContainer);
    const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
    const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;

    input.value = 'Hello, world!';
    sendButton.click();

    const userMessage = chatContainer.querySelector('.curiosity-message-user');
    expect(userMessage).not.toBeNull();
    expect(userMessage?.textContent).toBe('Hello, world!');
    expect(input.value).toBe('');
  });

  describe('AI Backend Interaction', () => {
    it('should display an error if no AI backend is registered', async () => {
      const curiosity = new Curiosity(chatContainer);
      const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
      const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;

      input.value = 'test';
      sendButton.click();
      await tick();

      const aiMessage = chatContainer.querySelector('.curiosity-message-assistant');
      expect(aiMessage?.textContent).toBe('No AI backend registered.');
      expect(console.error).toHaveBeenCalledWith('Curiosity Error: No AI backend has been registered. Use `registerAIBackend`.');
    });

    it('should stream and display a simple AI text response', async () => {
      const curiosity = new Curiosity(chatContainer);
      const mockBackend = createMockAIBackend({});
      curiosity.registerAIBackend(mockBackend);

      const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
      input.value = 'Hello AI';
      const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;
      sendButton.click();

      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for stream to finish

      const aiMessage = chatContainer.querySelector('.curiosity-message-assistant');
      expect(aiMessage?.textContent).toBe('Echo: Hello AI');
      expect((mockBackend.streamMessage as jest.Mock).mock.calls[0][0]).toEqual(expect.arrayContaining([{ content: 'Hello AI', role: 'user' }]));
    });
  });

  describe('Tool Registration and Usage', () => {
    it('should register a tool', () => {
      const curiosity = new Curiosity(chatContainer);
      const tool = new ActionTool({ name: 'testTool', description: 'A test tool', action: () => {} });
      curiosity.registerTool(tool);
      // @ts-ignore - Accessing private member for test purposes
      expect(curiosity.tools).toContain(tool);
    });

    it('should warn when registering a tool with a duplicate name', () => {
      const curiosity = new Curiosity(chatContainer);
      const tool1 = new ActionTool({ name: 'testTool', description: 'A test tool', action: () => {} });
      const tool2 = new ActionTool({ name: 'testTool', description: 'Another test tool', action: () => {} });
      curiosity.registerTool(tool1);
      curiosity.registerTool(tool2);

      expect(console.warn).toHaveBeenCalledWith('Curiosity Warning: A tool with the name "testTool" is already registered.');
      // @ts-ignore
      expect(curiosity.tools.length).toBe(1);
    });

    it('should execute an ActionTool when called by the AI', async () => {
      const actionFn = jest.fn();
      const tool = new ActionTool({ name: 'doAction', description: 'Performs an action', action: actionFn });
      const mockBackend = createMockAIBackend({
        'use the action tool': async function* () {
          yield `[TOOL_REQUEST]${JSON.stringify({ toolUse: true, toolName: 'doAction', args: { payload: 'test' } })}[END_TOOL_REQUEST]`;
        },
      });

      const curiosity = new Curiosity(chatContainer);
      curiosity.registerAIBackend(mockBackend);
      curiosity.registerTool(tool);

      const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
      input.value = 'use the action tool';
      const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;
      sendButton.click();

      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for stream to finish

      expect(actionFn).toHaveBeenCalledWith({ payload: 'test' });
      const messages = chatContainer.querySelectorAll('.curiosity-message-assistant');
      expect(messages[messages.length - 1].textContent).toBe('Using tool: doAction...');
    });

    it('should execute a QueryTool and send the result back to the AI', async () => {
      const queryFn = jest.fn().mockResolvedValue('some data');
      const tool = new QueryTool({ name: 'doQuery', description: 'Performs a query', query: queryFn });
      const mockBackend = createMockAIBackend({
        'use the query tool': async function* () {
          yield `[TOOL_REQUEST]\n${JSON.stringify({ toolUse: true, toolName: 'doQuery', args: { query: 'info' } })}\n[END_TOOL_REQUEST]`;
        },
        '<tool-response>"some data"</tool-response>': async function* () {
          yield 'AI response after query';
        },
      });

      const curiosity = new Curiosity(chatContainer);
      curiosity.registerAIBackend(mockBackend);
      curiosity.registerTool(tool);

      const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
      input.value = 'use the query tool';
      const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;
      sendButton.click();

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(queryFn).toHaveBeenCalledWith({ query: 'info' });
      expect(mockBackend.streamMessage).toHaveBeenCalledTimes(2);
      expect((mockBackend.streamMessage as jest.Mock).mock.calls[1][0]).toEqual(expect.arrayContaining([{ role: 'tool', content: '<tool-response>"some data"</tool-response>' }]));
      const aiMessages = chatContainer.querySelectorAll('.curiosity-message-assistant');
      expect(aiMessages[aiMessages.length - 2].textContent).toBe('Using tool: doQuery...');
      expect(aiMessages[aiMessages.length - 1].textContent).toBe('AI response after query');
    });

    it('should display an error if a non-existent tool is called', async () => {
      const mockBackend = createMockAIBackend({
        'use bad tool': async function* () {
          yield `[TOOL_REQUEST]\n${JSON.stringify({ toolUse: true, toolName: 'nonExistentTool', args: {} })}\n[END_TOOL_REQUEST]`;
        },
      });

      const curiosity = new Curiosity(chatContainer);
      curiosity.registerAIBackend(mockBackend);

      const input = chatContainer.querySelector<HTMLInputElement>('.curiosity-input')!;
      input.value = 'use bad tool';
      const sendButton = chatContainer.querySelector<HTMLButtonElement>('.curiosity-send-button')!;
      sendButton.click();

      await tick();

      const messages = chatContainer.querySelectorAll('.curiosity-message-assistant');
      expect(messages[messages.length - 1].textContent).toBe('Tool "nonExistentTool" not found.');
    });
  });
});
