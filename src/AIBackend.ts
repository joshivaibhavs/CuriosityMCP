import { CuriosityTool } from './tools/CuriosityTool';

export interface AIBackend {
  /**
   * Streams a response from the AI for a given message.
   * @param message The user's message to send to the AI.
   * @param tools A list of available tools the AI can use.
   * @returns An async generator that yields the AI's response in chunks. This can be text or a JSON string for a tool call.
   */
  streamMessage(message: string, tools: CuriosityTool[]): AsyncGenerator<string>;
}
