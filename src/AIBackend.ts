export interface AIBackend {
  /**
   * Streams a response from the AI for a given message.
   * @param message The user's message to send to the AI.
   * @returns An async generator that yields the AI's response in chunks. This can be text or a JSON string for a tool call.
   */
  streamMessage(message: string): AsyncGenerator<{ text: string; isReasoning?: boolean }>;
}
