import { ReasoningSeparator } from './ReasoningSeparator';

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: 'deepseek-r1-distill-llama-8b';
  system_fingerprint: 'deepseek-r1-distill-llama-8b';
  choices: {
    index: number;
    delta: { role: 'assistant' | 'user' | 'system'; content: string };
    logprobs: null;
    finish_reason: null;
  }[];
}

export class DeepSeekReasoningSeparator extends ReasoningSeparator<DeepSeekResponse> {
  #isReasoning = false;
  #completeResponse = '';
  processChatResponse(response: DeepSeekResponse): { isReasoning: boolean; text: string } {
    if (response.choices.length === 0) {
      return { isReasoning: this.#isReasoning, text: '' };
    }
    this.#completeResponse += response.choices[0].delta.content;
    if (this.#completeResponse.includes('<think>')) {
      this.#isReasoning = true;
    }
    if (this.#completeResponse.includes('</think>')) {
      this.#isReasoning = false;
      response.choices[0].delta.content = '';
      this.#completeResponse = '';
    }
    return { isReasoning: this.#isReasoning, text: this.#isReasoning ? 'thinking...' : response.choices[0].delta.content };
  }
}
