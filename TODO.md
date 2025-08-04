# TODO: @Curiosity/mcp-frontend-server

This document outlines the plan for creating the `@Curiosity/mcp-frontend-server` NPM package.

## Phase 1: Project Setup & Core Structure

- [ ] Initialize a new NPM project (`package.json`).
- [ ] Install TypeScript and other development dependencies (e.g., `typescript`, `rollup`, `esbuild`).
- [ ] Configure TypeScript with a `tsconfig.json` file.
- [ ] Set up a bundler (e.g., `esbuild`) to create distributable package files (ESM, UMD).
- [ ] Create the basic directory structure (`src`, `dist`, `examples`).
- [ ] Set up a simple HTML file in `examples` to test the package during development.

## Phase 2: The `Curiosity` Class and UI

- [ ] Create the main `Curiosity` class in `src/Curiosity.ts`.
- [ ] Implement the constructor to accept an `HTMLElement`.
- [ ] Add a method to render the basic chat UI (input field, send button, message container) into the provided DOM element.
- [ ] Style the UI. The CSS should be self-contained and injected by the package to avoid conflicts.
- [ ] Handle user input and display user messages in the UI.

## Phase 3: AI Backend Integration

- [ ] Define a TypeScript interface for the AI backend, e.g., `AIBackend`, with the required `streamMessage(message: string): AsyncGenerator<string>` method.
- [ ] Implement the `registerAIBackend` instance method on the `Curiosity` class.
- [ ] When a user sends a message, call the `streamMessage` method of the registered backend.
- [ ] As the AI's response is streamed back, update the UI with the incoming text chunks.

## Phase 4: Tooling System

- [ ] Define a base `CuriosityTool` class or interface in `src/tools/CuriosityTool.ts`.
- [ ] Create two classes, `ActionTool` and `QueryTool`, that extend the base `CuriosityTool`.
    - `ActionTool`: The `execute` method will perform an action and not return a value to the AI.
    - `QueryTool`: The `execute` method will perform an action and return a string or object to be sent back to the AI.
- [ ] Implement the `registerTool` instance method on the `Curiosity` class to store tool instances.
- [ ] The `streamMessage` implementation will need to be updated to handle tool-use requests from the AI. This will involve:
    - A predefined format for tool calls in the AI's messages (e.g., JSON).
    - Parsing these messages to identify tool calls.
    - Executing the corresponding tool.
    - For `QueryTool`, sending the result back to the AI to continue the conversation.

## Phase 5: Packaging and Documentation

- [ ] Write a `README.md` with installation and usage instructions.
- [ ] Add TSDoc comments to the public classes and methods.
- [ ] Build the final distributable files.
- [ ] (Optional) Publish the package to NPM.