"use strict";
(() => {
  // src/tools/CuriosityTool.ts
  var CuriosityTool = class {
    constructor(definition) {
      this.name = definition.name;
      this.description = definition.description;
    }
  };
  var ActionTool = class extends CuriosityTool {
    constructor(definition) {
      super(definition);
      this.type = "Action";
      this.action = definition.action;
    }
    async execute(args) {
      await this.action(args);
    }
  };
  var QueryTool = class extends CuriosityTool {
    constructor(definition) {
      super(definition);
      this.type = "Query";
      this.query = definition.query;
    }
    async execute(args) {
      return this.query(args);
    }
  };

  // src/Curiosity.ts
  var Curiosity = class {
    constructor(element) {
      this.aiBackend = null;
      this.tools = [];
      this.element = element;
      this.render();
      this.injectStyles();
      this.setupEventListeners();
    }
    registerAIBackend(backend) {
      this.aiBackend = backend;
    }
    registerTool(tool) {
      if (this.tools.some((t) => t.name === tool.name)) {
        console.warn(`Curiosity Warning: A tool with the name "${tool.name}" is already registered.`);
        return;
      }
      this.tools.push(tool);
    }
    render() {
      this.element.innerHTML = `
            <div class="curiosity-chat-container">
                <div class="curiosity-messages"></div>
                <div class="curiosity-input-area">
                    <input type="text" class="curiosity-input" placeholder="Type your message...">
                    <button class="curiosity-send-button">Send</button>
                </div>
            </div>
        `;
      this.messagesContainer = this.element.querySelector(".curiosity-messages");
      this.input = this.element.querySelector(".curiosity-input");
      this.sendButton = this.element.querySelector(".curiosity-send-button");
    }
    setupEventListeners() {
      this.sendButton.addEventListener("click", () => this.handleSendMessage());
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.handleSendMessage();
        }
      });
    }
    async handleSendMessage(messageText = this.input.value.trim()) {
      if (!messageText) return;
      if (this.input.value) {
        this.displayMessage(messageText, "user");
        this.input.value = "";
      }
      if (!this.aiBackend) {
        this.displayMessage("No AI backend registered.", "ai");
        console.error("Curiosity Error: No AI backend has been registered. Use `registerAIBackend`.");
        return;
      }
      let fullResponse = "";
      const aiMessageElement = this.createStreamedMessageElement();
      try {
        for await (const chunk of this.aiBackend.streamMessage(messageText, this.tools)) {
          fullResponse += chunk;
          aiMessageElement.textContent = fullResponse;
          this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
        console.log("Full response:", fullResponse);
        const toolCall = this.tryParseToolCall(fullResponse);
        if (toolCall) {
          aiMessageElement.remove();
          await this.handleToolCall(toolCall);
        }
      } catch (error) {
        aiMessageElement.textContent = "An error occurred while fetching the response.";
        console.error("Curiosity Error: Streaming failed.", error);
      }
    }
    tryParseToolCall(text) {
      try {
        const json = JSON.parse(text);
        console.log("Parsed JSON:", json);
        if (json && typeof json.tool === "string" && json.args !== void 0) {
          return json;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    async handleToolCall(toolCall) {
      const tool = this.tools.find((t) => t.name === toolCall.tool);
      if (!tool) {
        this.displayMessage(`Tool "${toolCall.tool}" not found.`, "ai");
        return;
      }
      try {
        this.displayMessage(`Using tool: ${tool.name}...`, "ai");
        const result = await tool.execute(toolCall.args);
        if (tool instanceof QueryTool) {
          const toolResponseMessage = `Tool ${tool.name} returned: ${JSON.stringify(result)}`;
          await this.handleSendMessage(toolResponseMessage);
        }
      } catch (error) {
        this.displayMessage(`Error executing tool "${tool.name}".`, "ai");
        console.error(`Curiosity Error: Tool execution failed for ${tool.name}.`, error);
      }
    }
    displayMessage(text, sender) {
      const messageElement = document.createElement("div");
      messageElement.classList.add("curiosity-message", `curiosity-message-${sender}`);
      messageElement.textContent = text;
      this.messagesContainer.appendChild(messageElement);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    createStreamedMessageElement() {
      const messageElement = document.createElement("div");
      messageElement.classList.add("curiosity-message", "curiosity-message-ai");
      this.messagesContainer.appendChild(messageElement);
      return messageElement;
    }
    injectStyles() {
      const style = document.createElement("style");
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
                background-color: #007bff;
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 0;
            }
            .curiosity-message-ai {
                background-color: #f1f1f1;
                color: #333;
                align-self: flex-start;
                border-bottom-left-radius: 0;
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
                background-color: #007bff;
                color: white;
                border-radius: 15px;
                cursor: pointer;
                font-weight: bold;
            }
            .curiosity-send-button:hover {
                background-color: #0056b3;
            }
        `;
      document.head.appendChild(style);
    }
  };

  // examples/main.ts
  var chatContainer = document.getElementById("curiosity-container");
  if (chatContainer) {
    const curiosity = new Curiosity(chatContainer);
    const realAIBackend = {
      async *streamMessage(message, tools) {
        const systemPrompt = `You are a helpful assistant integrated into a web page. You can use tools to interact with the page. To use a tool, respond with a JSON object with the following format: {"tool": "tool_name", "args": {"arg_name": "value"}}. Available tools:
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`;
        const response = await fetch("http://localhost:1234/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.2-1b-instruct",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: -1,
            stream: true
          })
        });
        if (!response.body) {
          throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.substring(6);
              if (data === "[DONE]") {
                return;
              }
              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  yield content;
                }
              } catch (e) {
                console.error("Error parsing stream data:", e);
              }
            }
          }
        }
      }
    };
    curiosity.registerAIBackend(realAIBackend);
    const changeColorTool = new ActionTool({
      name: "changeBackgroundColor",
      description: "Changes the background color of the page body.",
      action: ({ color }) => {
        console.log("Changing background color to:", color);
        document.body.style.backgroundColor = color;
      }
    });
    curiosity.registerTool(changeColorTool);
    console.log("Curiosity UI initialized and ready.");
  } else {
    console.error("Could not find the #curiosity-container element.");
  }
})();
