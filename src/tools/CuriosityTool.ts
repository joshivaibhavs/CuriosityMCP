export type ToolType = 'Action' | 'Query';

export type ToolArgumentDescription = string;

export interface ToolDefinition {
  name: string;
  description: string;
  arguments?: { [key: string]: ToolArgumentDescription };
}

export abstract class CuriosityTool {
  readonly name: string;
  readonly description: string;
  readonly arguments?: { [key: string]: ToolArgumentDescription };
  abstract readonly type: ToolType;

  constructor(definition: ToolDefinition) {
    this.name = definition.name;
    this.description = definition.description;
    if (definition.arguments) {
      this.arguments = definition.arguments;
    }
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
