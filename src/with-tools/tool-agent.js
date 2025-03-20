// src/with-tools/tool-agent.ts
import { MistralClient } from './mistral-client';
export class ToolAgent {
    constructor(config, toolManager) {
        this.messages = [];
        this.systemPrompt = "You are a helpful assistant that can use tools.";
        this.client = new MistralClient(config);
        this.toolManager = toolManager;
        this.resetConversation();
    }
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        if (this.messages.length > 0 && this.messages[0].role === 'system') {
            this.messages[0].content = prompt;
        }
        else {
            this.resetConversation();
        }
    }
    resetConversation() {
        this.messages = [{ role: 'system', content: this.systemPrompt }];
    }
    async processToolCalls(toolCalls) {
        const toolMessages = [];
        for (const toolCall of toolCalls) {
            const { id, function: { name, arguments: argsString } } = toolCall;
            console.log(`Processing tool call: ${name}`);
            try {
                const args = JSON.parse(argsString);
                const result = await this.toolManager.executeTool(name, args);
                toolMessages.push({
                    role: 'tool',
                    tool_call_id: id,
                    name: name,
                    content: JSON.stringify(result),
                });
                console.log(`Tool ${name} executed successfully.`);
            }
            catch (error) {
                console.error(`Error executing tool ${name}:`, error);
                toolMessages.push({
                    role: 'tool',
                    tool_call_id: id,
                    name: name,
                    content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
                });
            }
        }
        return toolMessages;
    }
    async invoke(prompt) {
        this.messages.push({ role: 'user', content: prompt });
        try {
            const tools = this.toolManager.getMistralTools();
            let response = await this.client.chat(this.messages, { tools, toolChoice: 'auto' });
            // Loop to handle multiple tool calls in a row
            while (response.toolCalls && response.toolCalls.length > 0) {
                console.log(`Received ${response.toolCalls.length} tool calls`);
                // Add assistant message WITH tool_calls (important!)
                this.messages.push({
                    role: 'assistant',
                    content: response.content, // might be empty string, and that is OK.
                    tool_calls: response.toolCalls, // Include tool_calls
                });
                const toolMessages = await this.processToolCalls(response.toolCalls);
                this.messages.push(...toolMessages);
                // Get the next response from the model
                response = await this.client.chat(this.messages);
            }
            // Add final assistant message
            this.messages.push({ role: 'assistant', content: response.content });
            return response.content;
        }
        catch (error) {
            console.error('Error invoking agent:', error);
            throw error;
        }
    }
    getConversationHistory() {
        return [...this.messages];
    }
}
//# sourceMappingURL=tool-agent.js.map