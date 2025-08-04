export abstract class ReasoningSeparator<T> {
  abstract processChatResponse(response: T): { isReasoning: boolean; text: string };
}
