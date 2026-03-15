import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFileSync } from 'node:child_process';

const TOKEN_DIR = path.join(process.env.HOME || '', '.te-mcp');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');
const CALLBACK_PORT = 9877;
const LOGIN_TIMEOUT_MS = 60000;
const OSASCRIPT_POLL_INTERVAL_MS = 2000;
const OSASCRIPT_POLL_TIMEOUT_MS = 60000;

function ensureDir() {
  if (!fs.existsSync(TOKEN_DIR)) fs.mkdirSync(TOKEN_DIR, { recursive: true });
}

export function getHost() {
  return process.env.TE_HOST || 'ta.thinkingdata.cn';
}

export function loadToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (data.token) return data;
    }
  } catch {}
  return null;
}

export function saveToken(token, host) {
  ensureDir();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({
    host: host || getHost(),
    token,
    updatedAt: new Date().toISOString()
  }, null, 2));
}

export function clearToken() {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
}

/**
 * Extract ACCESS_TOKEN from Chrome via macOS osascript.
 * Requires: Chrome > View > Developer > Allow JavaScript from Apple Events
 * Returns token string or null if extraction failed.
 */
function extractTokenViaOsascript() {
  if (process.platform !== 'darwin') return null;

  const host = getHost();
  const lines = [
    'tell application "Google Chrome"',
    '  repeat with w in windows',
    '    repeat with t in tabs of w',
    `      if URL of t contains "${host}" then`,
    '        return execute t javascript "localStorage.getItem(\'ACCESS_TOKEN\')"',
    '      end if',
    '    end repeat',
    '  end repeat',
    '  return "NO_TAB_FOUND"',
    'end tell',
  ];

  try {
    const args = lines.flatMap(line => ['-e', line]);
    const result = execFileSync('osascript', args, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!result || result === 'missing value' || result === 'NO_TAB_FOUND') {
      return null;
    }
    // Strip surrounding quotes if present (localStorage returns JSON string)
    return result.replace(/^["']|["']$/g, '');
  } catch {
    return null;
  }
}

/**
 * Open TE in the user's browser, then poll osascript until token appears.
 * Returns token string or null if polling times out.
 */
async function requestTokenViaOsascript() {
  const host = getHost();

  console.error(`[TE MCP] No TE tab found in Chrome. Opening https://${host} ...`);
  console.error(`[TE MCP] Please login, then your token will be captured automatically.`);

  try {
    const openModule = await import('open');
    await openModule.default(`https://${host}`);
  } catch {
    console.error(`[TE MCP] Could not open browser. Please open https://${host} manually.`);
  }

  const deadline = Date.now() + OSASCRIPT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, OSASCRIPT_POLL_INTERVAL_MS));
    const token = extractTokenViaOsascript();
    if (token) {
      console.error(`[TE MCP] Token captured automatically from Chrome.`);
      return token;
    }
  }

  console.error(`[TE MCP] osascript polling timed out after ${OSASCRIPT_POLL_TIMEOUT_MS / 1000}s.`);
  return null;
}

export async function getToken() {
  // 1. Check cache
  const cached = loadToken();
  if (cached && cached.token) return cached.token;

  // 2. Try osascript extraction from existing Chrome tab
  const osascriptToken = extractTokenViaOsascript();
  if (osascriptToken) {
    console.error(`[TE MCP] Token captured automatically from Chrome.`);
    saveToken(osascriptToken);
    return osascriptToken;
  }

  // 3. Open TE in browser + poll osascript
  if (process.platform === 'darwin') {
    const polledToken = await requestTokenViaOsascript();
    if (polledToken) {
      saveToken(polledToken);
      return polledToken;
    }
  }

  // 4. Fallback: browser-based manual flow
  return await requestTokenFromBrowser();
}

async function requestTokenFromBrowser() {
  const host = getHost();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error(`Token acquisition timed out after ${LOGIN_TIMEOUT_MS / 1000}s. Please login to TE and try again.`));
    }, LOGIN_TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/auth') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getAuthPage(host));
        return;
      }

      if (req.method === 'POST' && req.url === '/callback') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.token) {
              saveToken(data.token, data.host || host);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              clearTimeout(timeout);
              server.close();
              resolve(data.token);
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No token provided' }));
            }
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(CALLBACK_PORT, async () => {
      console.error(`[TE MCP] Fallback: manual token entry at http://localhost:${CALLBACK_PORT}/auth`);
      console.error(`[TE MCP] If auto-capture didn't work, paste your token there.`);
      try {
        const openModule = await import('open');
        await openModule.default(`http://localhost:${CALLBACK_PORT}/auth`);
      } catch {
        console.error(`[TE MCP] Could not open browser. Visit http://localhost:${CALLBACK_PORT}/auth`);
      }
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start auth callback server: ${err.message}`));
    });
  });
}

function getAuthPage(host) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>TE MCP Authentication</title>
<style>
body{font-family:system-ui;max-width:600px;margin:50px auto;padding:20px;text-align:center}
.status{padding:20px;border-radius:8px;margin:20px 0}
.pending{background:#fff3cd;color:#856404}.success{background:#d4edda;color:#155724}
.error{background:#f8d7da;color:#721c24}
input[type="text"]{width:100%;padding:10px;font-size:14px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;margin:10px 0;font-family:monospace}
button{padding:12px 24px;font-size:16px;cursor:pointer;border:none;border-radius:6px;background:#1a73e8;color:white;margin:5px}
button:hover{background:#1557b0}
.steps{text-align:left;margin:20px auto;max-width:450px;line-height:1.8}
.steps code{background:#f0f0f0;padding:2px 6px;border-radius:3px}
</style></head>
<body>
<h2>TE MCP — Manual Token Entry</h2>
<div id="status" class="status pending">
  <p>Auto-capture via osascript didn't work.<br>Please paste your token below.</p>
</div>
<div class="steps">
  <strong>How to get your token:</strong>
  <ol>
    <li>Open <a href="https://${host}" target="_blank">${host}</a> and login</li>
    <li>Press <code>F12</code> to open DevTools</li>
    <li>Go to <strong>Application</strong> → <strong>Local Storage</strong> → <code>https://${host}</code></li>
    <li>Find <code>ACCESS_TOKEN</code> and copy its value</li>
    <li>Paste it below and click Submit</li>
  </ol>
</div>
<input type="text" id="tokenInput" placeholder="Paste your ACCESS_TOKEN here..." />
<br>
<button onclick="submitToken()">Submit Token</button>
<script>
async function submitToken() {
  const status = document.getElementById('status');
  const token = document.getElementById('tokenInput').value.trim();
  if (!token) {
    status.className = 'status error';
    status.innerHTML = '<p>Please paste a token first.</p>';
    return;
  }
  try {
    const resp = await fetch('http://localhost:${CALLBACK_PORT}/callback', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token, host: '${host}'})
    });
    const data = await resp.json();
    if (data.success) {
      status.className = 'status success';
      status.innerHTML = '<p>Token saved! You can close this page.</p>';
    } else {
      status.className = 'status error';
      status.innerHTML = '<p>Failed: ' + (data.error || 'Unknown error') + '</p>';
    }
  } catch(e) {
    status.className = 'status error';
    status.innerHTML = '<p>Error: ' + e.message + '</p>';
  }
}
document.getElementById('tokenInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitToken();
});
</script></body></html>`;
}
