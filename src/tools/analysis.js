import { z } from 'zod';
import { httpGet, httpPost, querySql, queryReportData } from '../client.js';

export function registerAnalysisTools(server) {

  server.tool(
    'te_list_reports',
    'List all reports for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpPost('/v1/ta/event/listAll', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_report',
    'Get report definition details (events, eventView, graphConf)',
    {
      projectId: z.number().describe('Project ID'),
      reportId: z.number().describe('Report ID')
    },
    async ({ projectId, reportId }) => {
      const data = await httpGet('/v1/ta/event/reportsearch', {
        projectId, reportId, searchSource: 'model_search'
      });
      if (data && typeof data.events === 'string') {
        try { data.events = JSON.parse(data.events); } catch {}
      }
      if (data && typeof data.eventView === 'string') {
        try { data.eventView = JSON.parse(data.eventView); } catch {}
      }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_save_report',
    'Create or update a report',
    {
      projectId: z.number().describe('Project ID'),
      reportName: z.string().describe('Report name'),
      reportModel: z.number().describe('Report model type: 0=Event Analysis, 1=Retention, 2=Funnel, 10=Distribution'),
      events: z.any().describe('Events configuration (array of event objects)'),
      eventView: z.any().describe('Event view configuration (display/query settings)')
    },
    async ({ projectId, reportName, reportModel, events, eventView }) => {
      const eventsObj = typeof events === 'string' ? JSON.parse(events) : events;
      const eventViewObj = typeof eventView === 'string' ? JSON.parse(eventView) : eventView;
      const qp = JSON.stringify({ events: eventsObj, eventView: eventViewObj });
      const data = await httpPost('/v1/ta/event/reportsave', {
        projectId, reportName, reportModel, qp
      }, null);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_dashboards',
    'List all dashboards for a project',
    { projectId: z.number().describe('Project ID') },
    async ({ projectId }) => {
      const data = await httpGet('/v1/ta/dashboard/all-dashboards', { projectId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_get_dashboard',
    'Get dashboard details including its reports',
    {
      projectId: z.number().describe('Project ID'),
      dashboardId: z.number().describe('Dashboard ID')
    },
    async ({ projectId, dashboardId }) => {
      const data = await httpPost('/v1/ta/dashboard/search-dashboard', {
        projectId, dashboardId, dashbordId: dashboardId
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_create_dashboard',
    'Create a new dashboard',
    {
      projectId: z.number().describe('Project ID'),
      dashboardName: z.string().describe('Dashboard name')
    },
    async ({ projectId, dashboardName }) => {
      const data = await httpPost('/v1/ta/dashboard/create-dashboard', { projectId }, {
        dashbordName: dashboardName
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_update_dashboard',
    'Update a dashboard (add reports, change layout)',
    {
      projectId: z.number().describe('Project ID'),
      dashboardId: z.number().describe('Dashboard ID'),
      reports: z.array(z.object({
        reportId: z.number(),
        reportWidth: z.number().optional().default(12),
        indexOrder: z.number()
      })).describe('Reports to include with layout config')
    },
    async ({ projectId, dashboardId, reports }) => {
      const data = await httpPost('/v1/ta/dashboard/update-dashboard', { projectId }, {
        dashbordId: dashboardId,
        eventReportList: reports
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_list_dashboard_reports',
    'List reports within a dashboard with their definitions',
    {
      projectId: z.number().describe('Project ID'),
      dashboardId: z.number().describe('Dashboard ID')
    },
    async ({ projectId, dashboardId }) => {
      const dashboard = await httpPost('/v1/ta/dashboard/search-dashboard', {
        projectId, dashboardId, dashbordId: dashboardId
      });
      return { content: [{ type: 'text', text: JSON.stringify(dashboard?.eventReportList || [], null, 2) }] };
    }
  );

  server.tool(
    'te_query_report_data',
    'Query report data via WebSocket (supports event analysis, retention, funnel, etc.)',
    {
      projectId: z.number().describe('Project ID'),
      reportId: z.number().describe('Report ID'),
      dashboardId: z.number().optional().describe('Dashboard ID (if querying from a dashboard)'),
      startTime: z.string().optional().describe('Start time, format: YYYY-MM-DD HH:mm:ss'),
      endTime: z.string().optional().describe('End time, format: YYYY-MM-DD HH:mm:ss')
    },
    async ({ projectId, reportId, dashboardId, startTime, endTime }) => {
      const report = await httpGet('/v1/ta/event/reportsearch', {
        projectId, reportId, searchSource: 'model_search'
      });

      let events = report.events;
      let eventView = report.eventView;
      if (typeof events === 'string') events = JSON.parse(events);
      if (typeof eventView === 'string') eventView = JSON.parse(eventView);

      if (startTime) eventView.startTime = startTime;
      if (endTime) eventView.endTime = endTime;

      const qp = { events, eventView };
      const data = await queryReportData(projectId, reportId, qp, report.reportModel, {
        dashboardId,
        searchSource: 'model_search',
        querySource: 'module'
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'te_query_sql',
    'Execute a SQL query via WebSocket and return results',
    {
      projectId: z.number().describe('Project ID'),
      sql: z.string().describe('SQL query string. Tables: ta.v_event_{projectId}, ta.v_user_{projectId}')
    },
    async ({ projectId, sql }) => {
      const data = await querySql(projectId, sql);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
