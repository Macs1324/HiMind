# HiMind MCP Server

A Model Context Protocol (MCP) server that provides access to the HiMind knowledge engine. This allows AI agents in code editors to search your organization's knowledge base and find relevant experts.

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd hi-mind-mcp
npm install
```

### 2. Run the MCP Server
```bash
npm run dev
```

You should see:
```
🧠 Starting HiMind MCP Server...
📋 Organization ID: default-org-id
🌐 API Base URL: http://localhost:3000/api
🔧 Available tool: ask_question
🚀 Server ready for MCP clients!
✅ MCP Server ready (Demo mode)
```

## 🔧 Configuration

### Environment Variables
```bash
# Set your HiMind API URL (default: http://localhost:3000/api)
export HIMIND_API_BASE="https://your-himind-instance.com/api"

# Set your organization ID (default: default-org-id)
export HIMIND_ORG_ID="your-actual-org-id"
```

## 📋 Available Tools

### `ask_question`
Searches the knowledge base for relevant information and experts.

**Input Schema:**
```json
{
  "query": "string" // The question or topic to search for
}
```

**Example Usage:**
```
User: "How do I optimize React performance?"
AI: [Uses ask_question tool] "Let me search your knowledge base..."
```

## 🔌 MCP Client Setup

### VS Code / Cursor
1. Install "Model Context Protocol" extension
2. Add to your settings:
```json
{
  "mcp.servers": {
    "himind": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/hi-mind-mcp"
    }
  }
}
```

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "himind": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/hi-mind-mcp"
    }
  }
}
```

## 🏗️ Project Structure

```
hi-mind-mcp/
├── src/
│   └── server.ts          # Main MCP server implementation
├── package.json           # Dependencies and scripts
├── README.md             # This file
└── .gitignore            # Git ignore file
```

## 🚧 Current Status

### ✅ What's Working
- MCP server starts and runs
- Tool definitions are properly structured
- Logging and debugging output
- Placeholder responses for testing

### 🔧 What's Next
- Implement full MCP protocol (stdin/stdout)
- Connect to actual HiMind API endpoints
- Add more tools (topics, experts, etc.)
- Error handling and validation

## 🧪 Testing

### Manual Testing
```bash
# Start the server
npm run dev

# In another terminal, you can test the API structure
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

### MCP Client Testing
1. Start the MCP server: `npm run dev`
2. Configure your MCP client (VS Code, Claude, etc.)
3. Try asking the AI to use the `ask_question` tool

## 🔮 Development Roadmap

### Phase 1: Basic MCP Protocol ✅
- [x] Server structure and tool definitions
- [x] Basic request handling
- [x] Logging and debugging

### Phase 2: Full MCP Integration
- [ ] Implement stdin/stdout MCP protocol
- [ ] Handle MCP handshake and capabilities
- [ ] Proper JSON-RPC message parsing

### Phase 3: HiMind Integration
- [ ] Connect to actual API endpoints
- [ ] Add authentication and error handling
- [ ] Implement all available tools

### Phase 4: Production Ready
- [ ] Build and packaging
- [ ] Configuration management
- [ ] Monitoring and logging

## 🆘 Troubleshooting

### Server won't start
- Check Node.js version: `node --version` (requires 18+)
- Verify dependencies: `npm install`
- Check environment variables

### MCP client can't connect
- Ensure server is running: `npm run dev`
- Verify configuration paths in MCP client
- Check MCP extension is installed

### No tools available
- Verify server started successfully
- Check MCP client configuration
- Look for error messages in server output

## 📚 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [VS Code MCP Extension](https://marketplace.visualstudio.com/items?itemName=modelcontextprotocol.vscode-mcp)

## 🤝 Contributing

This is an MVP project. Feel free to:
- Report issues
- Suggest improvements
- Submit pull requests

## 📄 License

MIT License - see LICENSE file for details.
