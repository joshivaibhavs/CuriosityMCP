export type ToolType = 'Action' | 'Query';

export interface ToolDefinition {
  name: string;
  description: string;
  exampleUsage: string;
}

export abstract class CuriosityTool {
  readonly name: string;
  readonly description: string;
  readonly exampleUsage: string;
  abstract readonly type: ToolType;

  constructor(definition: ToolDefinition) {
    this.name = definition.name;
    this.description = definition.description;
    this.exampleUsage = definition.exampleUsage;
  }

  abstract execute(args: any): Promise<any>;
}

export class ActionTool extends CuriosityTool {
  readonly type = 'Action';
  private action: (args: any) => void | Promise<void>;

  constructor(definition: ToolDefinition & { action: (args: any) => void | Promise<void> }) {
    super(definition);
    this.action = definition.action;
  }

  async execute(args: any): Promise<void> {
    await this.action(args);
  }
}

export class QueryTool extends CuriosityTool {
  readonly type = 'Query';
  private query: (args: any) => string | Promise<string>;

  constructor(definition: ToolDefinition & { query: (args: any) => string | Promise<string> }) {
    super(definition);
    this.query = definition.query;
  }

  async execute(args: any): Promise<string> {
    return this.query(args);
  }
}
