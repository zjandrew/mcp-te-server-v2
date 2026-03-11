import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerMetaTools } from './tools/meta.js';
import { registerAnalysisTools } from './tools/analysis.js';
import { registerAudienceTools } from './tools/audience.js';
import { registerOperationTools } from './tools/operation.js';

const server = new McpServer({
  name: 'mcp-te-server-v2',
  version: '1.0.0'
});

registerMetaTools(server);
registerAnalysisTools(server);
registerAudienceTools(server);
registerOperationTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[TE MCP] Server running on stdio');
}

main().catch((error) => {
  console.error('[TE MCP] Fatal error:', error);
  process.exit(1);
});
