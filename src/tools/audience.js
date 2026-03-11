import { z } from 'zod';
import { httpGet, httpPost } from '../client.js';

export function registerAudienceTools(server) {

  server.tool(
    'te_list_tags',
    'List user tags for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpPost('/v1/ta/user/tag/list', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_tag',
    'Get tag details including its rule definition',
    {
      projectId: z.number().describe('Project ID'),
      tagId: z.number().describe('Tag ID')
    },
    async ({ projectId, tagId }) => {
      const data = await httpGet('/v1/ta/user/tag/query', { projectId, tagId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_clusters',
    'List user clusters/segments for a project (from operations module)',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/cluster/console/listProjectClusters', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_predict_cluster_count',
    'Predict the entity count for a given cluster condition',
    {
      projectId: z.number().describe('Project ID'),
      conditions: z.any().describe('Cluster condition definition')
    },
    async ({ projectId, conditions }) => {
      const data = await httpPost('/v1/hermes/cluster/predictEntityCount', { projectId }, conditions);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_audience_events',
    'List events available for audience targeting in operations module',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpPost('/v1/hermes/common/support/meta/listEvent', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_load_audience_props',
    'Load filterable and measurable properties for audience targeting',
    {
      projectId: z.number().describe('Project ID'),
      events: z.array(z.object({
        eventName: z.string()
      })).optional().describe('Events to load props for')
    },
    async ({ projectId, events }) => {
      const [filtProps, quotaProps, entityProps] = await Promise.all([
        httpPost('/v1/hermes/common/support/meta/loadFiltProps', { projectId }, {
          data: { events: events || [] }
        }).catch(() => null),
        httpPost('/v1/hermes/common/support/meta/loadPropQuotas', { projectId }, {
          data: { events: events || [] }
        }).catch(() => null),
        httpGet('/v1/hermes/common/support/entity/props/list', { projectId }).catch(() => null)
      ]);

      const result = {
        filterProps: filtProps,
        measureProps: quotaProps,
        entityProps: entityProps
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
