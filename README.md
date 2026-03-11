# @zhoujinandrew/mcp-te-server-v2

MCP (Model Context Protocol) server for **ThinkingEngine (TE)** analytics platform. Enables AI assistants like Claude to query events, run SQL, manage dashboards, user segments, and operations directly through TE's API.

## Quick Setup

Add to your MCP client configuration (e.g. Claude Code `~/.claude.json`, Cursor, etc.):

```json
{
  "mcpServers": {
    "mcp-te-v2": {
      "command": "npx",
      "args": ["-y", "@zhoujinandrew/mcp-te-server-v2@latest"],
      "env": {
        "TE_HOST": "ta.thinkingdata.cn"
      }
    }
  }
}
```

## Prerequisites

- **Node.js >= 18** (for native `fetch` support)
- A TE platform account with access to the target project

### macOS Auto-Auth (Optional, Recommended)

For zero-interaction token capture from Chrome:

1. Open Chrome → **View** → **Developer** → **Allow JavaScript from Apple Events** (one-time toggle)
2. macOS will prompt for Automation permission on first run — click **Allow**

## Authentication Flow

The server uses a 4-step auth cascade. No manual configuration needed in most cases:

| Step | What happens | User action |
|------|-------------|-------------|
| 1. **Cache** | Reads `~/.te-mcp/token.json` | None |
| 2. **osascript** (macOS) | Extracts `ACCESS_TOKEN` from an open TE Chrome tab | None |
| 3. **Open & Poll** (macOS) | Opens TE login page, polls Chrome until token appears | Login to TE |
| 4. **Manual Fallback** | Opens a local page with a text input for pasting token | Paste token from DevTools |

Token is cached at `~/.te-mcp/token.json` and reused until it expires (401/403 triggers re-auth automatically).

### Manual Token Reset

```bash
rm ~/.te-mcp/token.json
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TE_HOST` | Yes | `ta.thinkingdata.cn` | TE platform hostname |

## Available Tools

### Metadata

| Tool | Description |
|------|-------------|
| `te_list_events` | Get event catalog for a project |
| `te_load_event_props` | Load filterable properties for events |
| `te_load_measure_props` | Load measurable/aggregatable properties |
| `te_list_entities` | List analysis entities (user, account, device, etc.) |
| `te_list_metrics` | List predefined metrics |
| `te_list_tables` | List SQL-queryable tables |
| `te_get_table_columns` | Get column definitions for a SQL table |

### Analysis

| Tool | Description |
|------|-------------|
| `te_list_reports` | List all reports |
| `te_get_report` | Get report definition details |
| `te_save_report` | Create or update a report |
| `te_list_dashboards` | List all dashboards |
| `te_get_dashboard` | Get dashboard details |
| `te_create_dashboard` | Create a new dashboard |
| `te_update_dashboard` | Update dashboard layout |
| `te_list_dashboard_reports` | List reports in a dashboard |
| `te_query_report_data` | Query report data via WebSocket |
| `te_query_sql` | Execute SQL queries |

### Audience & Segments

| Tool | Description |
|------|-------------|
| `te_list_tags` | List user tags |
| `te_get_tag` | Get tag details and rules |
| `te_list_clusters` | List user clusters/segments |
| `te_predict_cluster_count` | Predict entity count for cluster conditions |
| `te_list_audience_events` | List events for audience targeting |
| `te_load_audience_props` | Load audience targeting properties |

### Operations

| Tool | Description |
|------|-------------|
| `te_create_task` | Create and submit an operation task |
| `te_list_tasks` | List operation tasks |
| `te_get_task_stats` | Get task statistics |
| `te_save_flow` | Create or update a flow canvas |
| `te_list_flows` | List flow canvases |
| `te_get_flow` | Get flow definition |
| `te_list_channels` | List push channels |
| `te_get_channel` | Get channel details |

### Helpers

| Tool | Description |
|------|-------------|
| `te_get_space_tree` | Get navigation space tree |
| `te_get_timezone` | Get project timezone offset |
| `te_list_mark_times` | List date annotations/milestones |

## Development

```bash
git clone https://github.com/zjandrew/mcp-te-server-v2.git
cd mcp-te-server-v2
npm install
TE_HOST=ta.thinkingdata.cn node src/index.js
```

## License

MIT
