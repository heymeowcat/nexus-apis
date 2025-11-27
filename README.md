# Nexus APIs

Nexus APIs project providing REST APIs and an MCP (Model Context Protocol) server for Microsoft Copilot agents.

## Features

- **REST APIs**: Requisition approval, Purchase orders, Team management, Accounts receivable
- **MCP Server**: 17 tools for automated employee onboarding/offboarding workflows
- **Microsoft Copilot Integration**: Native MCP support for Copilot Studio agents

## MCP Server

The MCP server provides comprehensive onboarding and offboarding automation:

- **7 Onboarding Tools**: From initiation to completion with approvals, system provisioning, and compliance
- **6 Offboarding Tools**: Complete offboarding workflow with deprovisioning and final payroll
- **4 Query Tools**: Status checks, pending approvals, and employee details

### Quick Start

```bash
# Install dependencies
npm install

# View MCP server information
curl http://localhost:3000/mcp

# Run MCP server (for Copilot Studio)
node src/mcp-server.ts
```

### Microsoft Copilot Studio Configuration

**Server Name**: `Nexus Onboarding/Offboarding MCP`  
**Server Description**: `Handles automated employee onboarding and offboarding workflows with HRMS integration, compliance checks, and system provisioning`  
**Server Command**: `node src/mcp-server.ts`

See [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) for detailed integration guide.

## Deployment

### One-Click Deploy

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/nexus-apis)

### Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Development

```bash
# Run locally
npm run dev

# Build
npm run build

# Start production server
npm start
```

## Documentation

- [MCP Integration Guide](./MCP_INTEGRATION.md) - Complete MCP server documentation
- [API Documentation](./docs/api.md) - REST API reference (coming soon)

## License

ISC
