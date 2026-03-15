import { z } from 'zod';
import { httpGet, httpPost } from '../client.js';

export function registerMetaTools(server) {

  server.tool(
    'te_list_events',
    'Get event catalog for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/event/catalog/listEvent', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_load_event_props',
    'Load filterable properties for events (includes event props and user props)',
    {
      projectId: z.number().describe('Project ID'),
      events: z.array(z.object({
        eventName: z.string().describe('Event name'),
        eventType: z.string().optional().describe('Event type: event or event_v')
      })).optional().describe('Events to load props for. If empty, loads all.')
    },
    async ({ projectId, events }) => {
      const body = {
        data: {
          commonHeader: { projectId },
          events: events || []
        }
      };
      const data = await httpPost('/v1/ta/event/model/meta/loadFiltProps', { projectId }, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_load_measure_props',
    'Load measurable/aggregatable properties for events',
    {
      projectId: z.number().describe('Project ID'),
      events: z.array(z.object({
        eventName: z.string().describe('Event name'),
        eventType: z.string().optional().describe('Event type: event or event_v')
      })).describe('Events to load measure props for')
    },
    async ({ projectId, events }) => {
      const body = {
        data: {
          commonHeader: { projectId },
          events
        }
      };
      const data = await httpPost('/v1/ta/event/model/meta/loadPropQuotas', { projectId }, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_entities',
    'List analysis entities (user, account, device, etc.) for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/entity/listEntities', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_metrics',
    'List predefined metrics for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/metric/listProjectMetrics', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_tables',
    'List SQL-queryable tables for a project (event views, user views, tag tables, etc.)',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/taIde/auth/listProjectTable', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_table_columns',
    'Get column definitions for a specific SQL table',
    {
      projectId: z.number().describe('Project ID'),
      table: z.string().describe('Table name, e.g. v_event_1300'),
      schema: z.string().optional().default('ta').describe('Schema name, default: ta'),
      catalog: z.string().optional().default('hive').describe('Catalog name, default: hive')
    },
    async ({ projectId, table, schema, catalog }) => {
      const data = await httpGet('/v1/ta/taIde/auth/tableColumns', { projectId, table, schema, catalog });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
