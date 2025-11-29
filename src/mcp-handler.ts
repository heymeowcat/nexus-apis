import { createMcpHandler } from 'mcp-handler'
import { registerTools } from './mcp-server.js'

// Create MCP handler using mcp-handler library
// This handles Streamable HTTP transport and session management automatically
export const mcpHandler = createMcpHandler((server) => {
  // Register all tools on the provided server instance
  registerTools(server as any)
})

