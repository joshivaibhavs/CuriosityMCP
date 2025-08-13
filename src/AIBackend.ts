import { Message } from './Curiosity';

export interface AIBackend {
  /**
   * Streams a response from the AI for a given message.
   * @param messages An array of message history, including the system prompt, user messages, AI responses, and tool calls.
   * @returns An async generator that yields the AI's response in chunks. This can be text or a JSON string for a tool call.
   */
  streamMessage(messages: Message[]): AsyncGenerator<string>;
}
