import { z } from 'zod';
import { httpGet, httpPost } from '../client.js';

const hostParam = z.string().optional().describe('TE system host (e.g. ta.thinkingdata.cn). Defaults to TE_HOST env var.');

export function registerAudienceTools(server) {

  server.tool(
    'te_list_tags',
    'List user tags for a project',
    { projectId: z.number().describe('Project ID'), host: hostParam },
    async ({ projectId, host }) => {
      const data = await httpPost('/v1/ta/user/tag/list', { projectId }, undefined, host);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_tag',
    'Get tag details including its rule definition',
    {
      projectId: z.number().describe('Project ID'),
      tagId: z.number().describe('Tag ID'),
      host: hostParam
    },
    async ({ projectId, tagId, host }) => {
      const data = await httpGet('/v1/ta/user/tag/query', { projectId, tagId }, host);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_clusters',
    'List user clusters/segments for a project (from operations module)',
    { projectId: z.number().describe('Project ID'), host: hostParam },
    async ({ projectId, host }) => {
      const data = await httpGet('/v1/ta/cluster/console/listProjectClusters', { projectId }, host);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_predict_cluster_count',
    'Predict the entity count for a given cluster condition',
    {
      projectId: z.number().describe('Project ID'),
      conditions: z.any().describe('Cluster condition definition'),
      host: hostParam
    },
    async ({ projectId, conditions, host }) => {
      const data = await httpPost('/v1/hermes/cluster/predictEntityCount', { projectId }, conditions, host);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_audience_events',
    'List events available for audience targeting in operations module',
    { projectId: z.number().describe('Project ID'), host: hostParam },
    async ({ projectId, host }) => {
      const data = await httpPost('/v1/hermes/common/support/meta/listEvent', { projectId }, undefined, host);
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
      })).optional().describe('Events to load props for'),
      host: hostParam
    },
    async ({ projectId, events, host }) => {
      const [filtProps, quotaProps, entityProps] = await Promise.all([
        httpPost('/v1/hermes/common/support/meta/loadFiltProps', { projectId }, {
          data: { events: events || [] }
        }, host).catch(() => null),
        httpPost('/v1/hermes/common/support/meta/loadPropQuotas', { projectId }, {
          data: { events: events || [] }
        }, host).catch(() => null),
        httpGet('/v1/hermes/common/support/entity/props/list', { projectId }, host).catch(() => null)
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
