#!/usr/bin/env node
/**
 * Minimal CDP driver for GUI-testing the unpacked extension inside an
 * isolated "Chrome for Testing" instance (default port 9223).
 *
 * Requirements: Node >= 22 (uses global fetch + WebSocket). No dependencies.
 * The instance must be launched with --remote-debugging-port=9223, see
 * docs/E2E-TESTING.md ("环境 A") for the exact launch command.
 *
 * Usage:
 *   node cdp-driver.js list                        list page targets
 *   node cdp-driver.js new <url>                   open a new tab (may stay on about:blank; use nav next)
 *   node cdp-driver.js nav <url> [urlmatch]        navigate matched tab via Page.navigate
 *   node cdp-driver.js eval <expr> [urlmatch]      Runtime.evaluate (awaitPromise) on matched page
 *   node cdp-driver.js click <x> <y> [urlmatch]    trusted mouse click at viewport coords
 *   node cdp-driver.js clickel <sel> [urlmatch]    trusted click at the center of querySelector(sel)
 *   node cdp-driver.js text <str> [urlmatch]       Input.insertText into the focused element
 *   node cdp-driver.js key <char> [urlmatch]       trusted key press
 *   node cdp-driver.js shot <absfile> [urlmatch]   jpeg screenshot saved to file
 *   node cdp-driver.js reload [urlmatch]           Page.reload
 *   node cdp-driver.js close <urlmatch>            close all tabs whose URL contains the match
 *
 * [urlmatch] picks the first page target whose URL contains the string;
 * omitted = most recently created page target.
 *
 * Notes:
 *  - JavaScript dialogs (confirm/alert) are auto-accepted.
 *  - A global watchdog exits with code 2 after PORT_TIMEOUT ms so shell
 *    pipelines never hang on a wedged target.
 *  - /json/new ignores its url parameter on recent Chrome; open about:blank
 *    with `new`, then `nav` to the real URL.
 */

const PORT = process.env.CDP_PORT || 9223;
const TIMEOUT = process.env.CDP_TIMEOUT || 45000;
const fs = require('fs');

function httpJson(path, method = 'GET') {
  return fetch(`http://127.0.0.1:${PORT}${path}`, { method }).then(r => r.json());
}

async function pickTarget(match) {
  const list = await httpJson('/json/list');
  const pages = list.filter(t => t.type === 'page');
  if (!match) return pages[pages.length - 1];
  return pages.find(t => t.url.includes(match));
}

async function withPage(match, fn) {
  const t = await pickTarget(match);
  if (!t) throw new Error('no target matching: ' + match);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method === 'Page.javascriptDialogOpening') {
      ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  try {
    return await fn(send, t);
  } finally {
    ws.close();
  }
}

const [cmd, ...args] = process.argv.slice(2);
setTimeout(() => { console.error('DRIVER TIMEOUT'); process.exit(2); }, TIMEOUT).unref();

(async () => {
  switch (cmd) {
    case 'list': {
      const list = await httpJson('/json/list');
      console.log(JSON.stringify(list.filter(t => t.type === 'page').map(t => ({ url: t.url, title: t.title })), null, 1));
      break;
    }
    case 'new': {
      const t = await httpJson('/json/new?' + new URLSearchParams({ url: args[0] }), 'PUT');
      console.log(JSON.stringify({ id: t.id, url: t.url }));
      break;
    }
    case 'eval': {
      const [expr, match] = args;
      const out = await withPage(match, async (send) => {
        const r = await send('Runtime.evaluate', {
          expression: expr, awaitPromise: true, returnByValue: true
        });
        if (r.exceptionDetails) return { __exception: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
        return r.result.value;
      });
      console.log(JSON.stringify(out));
      break;
    }
    case 'click': {
      const [x, y, match] = args.map((v, i) => i < 2 ? +v : v);
      await withPage(match, async (send) => {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', {
            type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1
          });
        }
      });
      console.log(JSON.stringify({ clicked: true, x, y }));
      break;
    }
    case 'clickel': {
      const [sel, match] = args;
      const out = await withPage(match, async (send) => {
        const r = await send('Runtime.evaluate', {
          expression: `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }; })()`,
          returnByValue: true
        });
        const pos = r.result.value;
        if (!pos) throw new Error('element not found: ' + sel);
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', {
            type, x: pos.x, y: pos.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1
          });
        }
        return pos;
      });
      console.log(JSON.stringify({ clicked: sel, at: out }));
      break;
    }
    case 'text': {
      const [str, match] = args;
      await withPage(match, async (send) => {
        await send('Input.insertText', { text: str });
      });
      console.log(JSON.stringify({ typed: str }));
      break;
    }
    case 'key': {
      const [ch, match] = args;
      await withPage(match, async (send) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      });
      console.log(JSON.stringify({ keyed: ch }));
      break;
    }
    case 'shot': {
      const [file, match] = args;
      const out = await withPage(match, async (send) => {
        const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
        return r.data;
      });
      fs.writeFileSync(file, Buffer.from(out, 'base64'));
      console.log(JSON.stringify({ saved: file }));
      break;
    }
    case 'reload': {
      const [match] = args;
      await withPage(match, async (send) => { await send('Page.reload', { ignoreCache: false }); });
      console.log(JSON.stringify({ reloaded: true }));
      break;
    }
    case 'nav': {
      const [url, match] = args;
      await withPage(match, async (send) => { await send('Page.navigate', { url }); });
      console.log(JSON.stringify({ navigated: url }));
      break;
    }
    case 'close': {
      const [match] = args;
      const list = await httpJson('/json/list');
      for (const t of list.filter(t => t.type === 'page' && t.url.includes(match))) {
        await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
      }
      console.log(JSON.stringify({ closed: match }));
      break;
    }
    default:
      console.error('unknown cmd', cmd);
      process.exit(1);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
