import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';

const TOKEN_DIR = path.join(process.env.HOME || '', '.te-mcp');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000; // 20 hours
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
      if (!data.token) return null;
      // TTL check: discard tokens older than TOKEN_TTL_MS
      if (data.updatedAt) {
        const age = Date.now() - new Date(data.updatedAt).getTime();
        if (age > TOKEN_TTL_MS) {
          console.error(`[TE MCP] Cached token expired (${Math.round(age / 3600000)}h old), re-authenticating...`);
          clearToken();
          return null;
        }
      }
      // Host consistency check
      const expectedHost = getHost();
      if (data.host && data.host !== expectedHost) {
        console.error(`[TE MCP] Cached token host (${data.host}) != TE_HOST (${expectedHost}), re-authenticating...`);
        clearToken();
        return null;
      }
      return data;
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
 * @returns {{ token: string|null, error: 'not_mac'|'no_js_permission'|'no_tab'|'no_token'|null }}
 */
function extractTokenViaOsascript() {
  if (process.platform !== 'darwin') return { token: null, error: 'not_mac' };

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

    if (result === 'NO_TAB_FOUND') return { token: null, error: 'no_tab' };
    if (!result || result === 'missing value') return { token: null, error: 'no_token' };
    return { token: result.replace(/^["']|["']$/g, ''), error: null };
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('not allowed') || msg.includes('assistive access') || msg.includes('(-1743)')) {
      return { token: null, error: 'no_js_permission' };
    }
    return { token: null, error: 'no_tab' };
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
    // Force open in the main Chrome app (not remote-debugging instances)
    execFileSync('open', ['-a', 'Google Chrome', `https://${host}`], { timeout: 5000 });
  } catch {
    console.error(`[TE MCP] Could not open browser. Please open https://${host} in Chrome manually.`);
  }

  const deadline = Date.now() + OSASCRIPT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, OSASCRIPT_POLL_INTERVAL_MS));
    const { token, error } = extractTokenViaOsascript();
    if (token) {
      console.error(`[TE MCP] Token captured automatically from Chrome.`);
      return token;
    }
    if (error === 'no_js_permission') {
      // Stop polling — permission issue won't resolve itself
      return null;
    }
  }

  console.error(`[TE MCP] osascript polling timed out after ${OSASCRIPT_POLL_TIMEOUT_MS / 1000}s.`);
  return null;
}

export async function getToken() {
  // 1. Check cache (with TTL + host validation)
  const cached = loadToken();
  if (cached && cached.token) return cached.token;

  // 2. Try osascript extraction from existing Chrome tab
  const { token: osascriptToken, error } = extractTokenViaOsascript();

  if (error === 'no_js_permission') {
    throw new Error(
      `[TE MCP] Chrome 未开启 JavaScript from Apple Events 权限。\n` +
      `请在 Chrome 菜单栏执行：View → Developer → Allow JavaScript from Apple Events\n` +
      `开启后重新连接 MCP 即可。`
    );
  }

  if (error === 'not_mac') {
    throw new Error(
      `[TE MCP] 当前平台不支持自动提取 token。仅支持 macOS + Chrome。`
    );
  }

  if (osascriptToken) {
    console.error(`[TE MCP] Token captured automatically from Chrome.`);
    saveToken(osascriptToken);
    return osascriptToken;
  }

  // 3. No TE tab open — open browser + poll osascript
  const polledToken = await requestTokenViaOsascript();
  if (polledToken) {
    saveToken(polledToken);
    return polledToken;
  }

  // All attempts failed
  const host = getHost();
  throw new Error(
    `[TE MCP] 无法获取 token。请确认：\n` +
    `1. Chrome 已打开并登录 https://${host}\n` +
    `2. Chrome 菜单 View → Developer → Allow JavaScript from Apple Events 已开启\n` +
    `3. TE 页面 localStorage 中存在 ACCESS_TOKEN`
  );
}
