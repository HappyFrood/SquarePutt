#!/usr/bin/env node
/**
 * SquarePutt Bridge
 *
 * Launch monitor connectors (Square Golf's GSPro integration, MLM2PRO / R10 / Mevo
 * connectors, etc.) speak the GSPro Open Connect v1 protocol: they open a TCP connection
 * to 127.0.0.1:921 and send JSON shot messages. A web page cannot accept TCP connections,
 * so this bridge pretends to be GSPro on port 921 and relays every message to SquarePutt
 * over a local WebSocket (default port 9210).
 *
 * Usage:   npm run bridge            (or: node bridge/squareputt-bridge.mjs)
 * Options: --gspro-port 921 --ws-port 9210 --handed RH|LH --verbose
 *
 * Important: close GSPro itself first — only one program can listen on port 921.
 * No dependencies; requires Node 18+.
 */

import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const GSPRO_PORT = Number(arg('gspro-port', 921));
const WS_PORT = Number(arg('ws-port', 9210));
const HANDED = arg('handed', 'RH');
const VERBOSE = args.includes('--verbose');

const log = (...m) => console.log(new Date().toLocaleTimeString(), ...m);

/* ----------------------------- WebSocket server ----------------------------- */

const browsers = new Set();

function wsFrame(text) {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function broadcast(obj) {
  const frame = wsFrame(JSON.stringify(obj));
  for (const s of browsers) {
    try {
      s.write(frame);
    } catch {
      browsers.delete(s);
    }
  }
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('SquarePutt bridge is running. Open SquarePutt in your browser.\n');
});

httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  browsers.add(socket);
  log(`SquarePutt page connected (${browsers.size} open)`);
  socket.write(wsFrame(JSON.stringify(statusMessage())));

  socket.on('data', (buf) => {
    // Only control frames matter here: close (0x8) and ping (0x9).
    const opcode = buf[0] & 0x0f;
    if (opcode === 0x8) socket.end(Buffer.from([0x88, 0x00]));
    if (opcode === 0x9) socket.write(Buffer.from([0x8a, 0x00]));
  });
  const drop = () => {
    browsers.delete(socket);
  };
  socket.on('close', drop);
  socket.on('error', drop);
});

httpServer.listen(WS_PORT, '127.0.0.1', () => log(`WebSocket for SquarePutt on ws://127.0.0.1:${WS_PORT}`));

/* ------------------------- GSPro Open Connect server ------------------------ */

let monitorSockets = new Set();
let lastDevice = null;

function statusMessage() {
  return { type: 'status', launchMonitorConnected: monitorSockets.size > 0, device: lastDevice };
}

/** Splits a TCP stream into complete top-level JSON objects (connectors don't delimit). */
function makeJsonSplitter(onObject) {
  let buf = '';
  return (chunk) => {
    buf += chunk.toString('utf8');
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = -1;
    let consumed = 0;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          onObject(buf.slice(start, i + 1));
          consumed = i + 1;
          start = -1;
        }
      }
    }
    buf = buf.slice(consumed);
    if (buf.length > 1e6) buf = ''; // runaway guard
  };
}

const gsproServer = net.createServer((sock) => {
  monitorSockets.add(sock);
  log(`Launch monitor connector connected from ${sock.remoteAddress}`);
  // Tell the launch monitor a putter is selected so it switches to putting mode.
  const playerInfo = { Code: 201, Message: 'GSPro Player Information', Player: { Handed: HANDED, Club: 'PT' } };
  sock.write(JSON.stringify(playerInfo));
  broadcast(statusMessage());

  const split = makeJsonSplitter((text) => {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.DeviceID) lastDevice = msg.DeviceID;
    const opts = msg.ShotDataOptions || {};
    const isShot = opts.ContainsBallData !== false && msg.BallData && !opts.IsHeartBeat;
    if (isShot) {
      const b = msg.BallData;
      log(`Shot #${msg.ShotNumber ?? '?'}: ${Number(b.Speed).toFixed(1)} mph, HLA ${Number(b.HLA ?? 0).toFixed(1)}°`);
    } else if (VERBOSE) {
      log('Status/heartbeat', JSON.stringify(opts));
    }
    broadcast({ type: 'shot', packet: msg });
    sock.write(JSON.stringify({ Code: 200, Message: isShot ? 'Shot received successfully' : 'OK' }));
  });

  sock.on('data', split);
  const drop = () => {
    if (monitorSockets.delete(sock)) {
      log('Launch monitor connector disconnected');
      broadcast(statusMessage());
    }
  };
  sock.on('close', drop);
  sock.on('error', drop);
});

gsproServer.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${GSPRO_PORT} is in use. Close GSPro (or anything else on that port) and try again.\n`);
  } else if (e.code === 'EACCES') {
    console.error(`\nNo permission to listen on port ${GSPRO_PORT}. Try a port above 1024 with --gspro-port.\n`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

gsproServer.listen(GSPRO_PORT, '127.0.0.1', () =>
  log(`Listening for GSPro Open Connect connectors on 127.0.0.1:${GSPRO_PORT}`)
);
