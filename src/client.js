import { getToken, clearToken, getHost } from './auth.js';
import WebSocket from 'ws';
import { randomBytes } from 'crypto';

function genRequestId(prefix) {
  const rand = randomBytes(4).toString('base64url').slice(0, 8);
  return `${prefix}@@${rand}`;
}

async function request(method, modulePath, params = {}, body = null, retry = true) {
  const token = await getToken();
  const host = getHost();

  const url = new URL(`https://${host}${modulePath}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const headers = {
    'Authorization': `bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url.toString(), options);

  if ((resp.status === 401 || resp.status === 403) && retry) {
    clearToken();
    return request(method, modulePath, params, body, false);
  }

  const data = await resp.json();

  if (data.return_code !== 0 && data.return_code !== undefined) {
    throw new Error(`TE API error: ${data.return_message || 'unknown'} (code: ${data.return_code})`);
  }

  return data.data !== undefined ? data.data : data;
}

export async function httpGet(modulePath, params = {}) {
  return request('GET', modulePath, params);
}

export async function httpPost(modulePath, params = {}, body = {}) {
  return request('POST', modulePath, params, body);
}

async function wsQueryOnce(projectId, requestId, qp, eventModel, options, token) {
  const host = getHost();
  const wsUrl = `wss://${host}/v1/ta-websocket/query/${token}`;
  const timeout = options.timeout || 30000;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      fn(val);
    };

    const ws = new WebSocket(wsUrl);

    const timer = setTimeout(() => {
      settle(reject, new Error(`WebSocket query timed out after ${timeout / 1000}s`));
    }, timeout);

    ws.on('open', () => {
      console.error(`[WS] connected to ${wsUrl.replace(token, '***')}`);
      const message = [
        'data',
        {
          requestId,
          projectId,
          eventModel,
          qp: typeof qp === 'string' ? qp : JSON.stringify(qp),
          searchSource: options.searchSource || 'model_search',
          querySource: options.querySource || 'module',
          contentTranslate: ''
        },
        { channel: 'ta' }
      ];
      const msgStr = JSON.stringify(message);
      console.error(`[WS] sending: ${msgStr.slice(0, 500)}`);
      ws.send(msgStr);
    });

    ws.on('message', (rawData) => {
      const raw = rawData.toString();
      console.error(`[WS] received: ${raw.slice(0, 300)}`);
      try {
        const msg = JSON.parse(raw);
        if (!Array.isArray(msg) || msg[0] !== 'data') {
          console.error(`[WS] ignoring non-data message: type=${msg[0]}`);
          return;
        }

        const payload = msg[1];

        // Handle auth errors even with empty requestId
        if (payload && (payload.status === 'error' || payload.status === 'failed')) {
          console.error(`[WS] query failed: ${payload.errorMsg || payload.hintMsg || 'unknown'}`);
          settle(reject, new Error(`Query error: ${payload.errorMsg || payload.hintMsg || payload.return_message || 'unknown'}`));
          return;
        }

        if (!payload || payload.requestId !== requestId) {
          console.error(`[WS] ignoring mismatched requestId: got=${payload?.requestId}, expected=${requestId}`);
          return;
        }

        console.error(`[WS] payload status=${payload.status}, progress=${payload.progress}`);

        if (payload.progress === 100 && payload.result) {
          if (payload.result.return_code && payload.result.return_code !== 0) {
            settle(reject, new Error(`Query error (code ${payload.result.return_code}): ${payload.result.return_message || 'unknown'}`));
            return;
          }
          settle(resolve, payload.result.data || payload.result);
          return;
        }
      } catch (e) {
        console.error('[WS] message parse error:', e.message, raw.slice(0, 200));
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] error: ${err.message}`);
      settle(reject, new Error(`WebSocket error: ${err.message}`));
    });

    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : 'none';
      console.error(`[WS] closed: code=${code}, reason=${reasonStr}`);
      settle(reject, new Error(`WebSocket closed unexpectedly (code: ${code}, reason: ${reasonStr})`));
    });
  });
}

export async function wsQuery(projectId, requestId, qp, eventModel = 0, options = {}) {
  const token = await getToken();
  try {
    return await wsQueryOnce(projectId, requestId, qp, eventModel, options, token);
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('403') || err.message.includes('未登录') || err.message.includes('closed unexpectedly')) {
      clearToken();
      const newToken = await getToken();
      return wsQueryOnce(projectId, requestId, qp, eventModel, options, newToken);
    }
    throw err;
  }
}

export async function querySql(projectId, sql) {
  const requestId = genRequestId('WS_SQLIDE');
  const qp = { events: { sql }, eventView: { sqlViewParams: [] } };
  return wsQuery(projectId, requestId, qp, 10, {
    searchSource: 'model_search',
    querySource: 'sqlIde'
  });
}

export async function queryReportData(projectId, reportId, qp, eventModel, options = {}) {
  const requestId = genRequestId(`${projectId}_0_${reportId}`);
  return wsQuery(projectId, requestId, qp, eventModel, {
    searchSource: options.searchSource || 'model_search',
    querySource: options.querySource || 'module'
  });
}
