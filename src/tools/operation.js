import { z } from 'zod';
import { httpGet, httpPost } from '../client.js';

export function registerOperationTools(server) {

  // --- Operation Tasks ---

  server.tool(
    'te_create_task',
    'Create and submit an operation task',
    {
      projectId: z.number().describe('Project ID'),
      taskConfig: z.any().describe('Full task configuration object')
    },
    async ({ projectId, taskConfig }) => {
      const data = await httpPost('/v1/hermes/operationTask/approval/saveAndSubmit', { projectId }, taskConfig);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_tasks',
    'List operation tasks for a project',
    {
      projectId: z.number().describe('Project ID'),
      page: z.number().optional().default(1).describe('Page number'),
      pageSize: z.number().optional().default(20).describe('Page size')
    },
    async ({ projectId, page, pageSize }) => {
      const data = await httpPost('/v1/hermes/operationTask/query/list', { projectId }, {
        data: {
          pagerHeader: { pageNum: page, pageSize }
        },
        projectId
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_task_stats',
    'Get operation task status statistics and performance data',
    {
      projectId: z.number().describe('Project ID'),
      taskId: z.number().optional().describe('Specific task ID for detailed stats')
    },
    async ({ projectId, taskId }) => {
      const [statusStat, taskStat] = await Promise.all([
        httpPost('/v1/hermes/operationTask/query/statusStat', { projectId }, { data: {}, projectId }).catch(() => null),
        taskId
          ? httpPost('/v1/hermes/operationTask/stat/query', { projectId }, { data: { taskId }, projectId }).catch(() => null)
          : null
      ]);
      const result = { statusStat, taskStat };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Flows ---

  server.tool(
    'te_save_flow',
    'Create or update a flow canvas',
    {
      projectId: z.number().describe('Project ID'),
      flowConfig: z.any().describe('Full flow configuration object')
    },
    async ({ projectId, flowConfig }) => {
      const data = await httpPost('/v1/hermes/flow/save', { projectId }, flowConfig);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_flows',
    'List flow canvases for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpPost('/v1/hermes/flow/query/list', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_flow',
    'Get flow canvas definition by UUID',
    {
      projectId: z.number().describe('Project ID'),
      flowUuid: z.string().describe('Flow UUID')
    },
    async ({ projectId, flowUuid }) => {
      const data = await httpGet('/v1/hermes/flow/queryByFlowUuid', { projectId, flowUuid });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  // --- Channels ---

  server.tool(
    'te_list_channels',
    'List push channels for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/hermes/channel/query/list', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_channel',
    'Get channel details and meta info',
    {
      projectId: z.number().describe('Project ID'),
      channelId: z.number().describe('Channel ID')
    },
    async ({ projectId, channelId }) => {
      const [channel, meta] = await Promise.all([
        httpGet('/v1/hermes/channel/queryById', { projectId, channelId }).catch(() => null),
        httpGet('/v1/hermes/channel/queryChannelMetaInfoById', { projectId, channelId }).catch(() => null)
      ]);
      const result = { channel, meta };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Helpers ---

  server.tool(
    'te_get_space_tree',
    'Get navigation space tree (folders, dashboards, reports hierarchy)',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/space/getSpaceTree', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_timezone',
    'Get project timezone offset',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/hermes/common/project/tzOffset', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_mark_times',
    'List date annotations/milestones for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpPost('/v1/ta/projectMilestone/markTime/listMarkTime', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
