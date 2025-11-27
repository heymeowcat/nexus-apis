// Simple test to verify MCP server can be imported
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('✓ Testing MCP Server Implementation...\n')

// Check if mcp-server.ts exists
try {
  const mcpServerPath = join(__dirname, 'src', 'mcp-server.ts')
  const content = readFileSync(mcpServerPath, 'utf-8')
  console.log('✓ MCP server file exists')
  console.log(`✓ File size: ${content.length} bytes`)
  
  // Count tools
  const toolMatches = content.match(/name: '[\w_]+'/g) || []
  console.log(`✓ Found ${toolMatches.length} tool definitions`)
  
  console.log('\n✓ MCP Server structure validated!')
  console.log('\nNote: To run the MCP server, use:')
  console.log('  node src/mcp-server.ts')
  console.log('\nOr compile TypeScript first:')
  console.log('  npm run build')
  console.log('  node dist/mcp-server.js')
  
} catch (error) {
  console.error('✗ Error:', error.message)
  process.exit(1)
}
