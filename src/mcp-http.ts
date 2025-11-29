import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { server } from './mcp-server.js'

export function createMCPRouter() {
  const router = express.Router()

  // Store active transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

  // Main endpoint for Streamable HTTP
  router.all('/', async (req, res) => {

    req.header['accept'] = 'application/json', 'text/event-stream';

    const sessionId = req.headers['mcp-session-id'] as string | undefined

    let transport: StreamableHTTPServerTransport

    if (sessionId && transports[sessionId]) {
      // Use existing transport for this session
      transport = transports[sessionId]
    } else {
      // Create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId]
        }
      }

      // Store the transport
      if (transport.sessionId) {
        transports[transport.sessionId] = transport
      }

      // Connect the server to the transport
      await server.connect(transport)
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body)
  })

  return router
}

