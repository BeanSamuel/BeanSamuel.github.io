import { Peer } from 'peerjs';

// Thin wrapper over PeerJS. Signalling (SDP/ICE exchange) uses the free public
// PeerJS broker (0.peerjs.com); once the DataChannel opens, the two players
// talk directly, peer-to-peer, with no server in the path. You host nothing —
// GitHub Pages stays a static site. See docs/fps-modes-design.md §5.1.

const PREFIX = 'cyfps-'; // namespaces our ids on the shared public broker
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// Wrap a PeerJS DataConnection into a minimal { send, on, close, isOpen }.
function wrapConn(conn, peer) {
  const listeners = { data: [], close: [] };
  conn.on('data', (d) => listeners.data.forEach((f) => f(d)));
  conn.on('close', () => listeners.close.forEach((f) => f()));
  conn.on('error', () => listeners.close.forEach((f) => f()));
  return {
    // Guard on `open` so a closed channel doesn't spew PeerJS "connection is
    // not open" errors every tick while the sim's send loop winds down.
    send: (obj) => { if (conn.open) { try { conn.send(obj); } catch { /* channel closed */ } } },
    onData: (f) => listeners.data.push(f),
    onClose: (f) => listeners.close.push(f),
    isOpen: () => conn.open,
    close: () => { try { conn.close(); } catch { /* noop */ } try { peer.destroy(); } catch { /* noop */ } },
  };
}

/**
 * Host a room. Returns { code, cancel, ready } where ready resolves with the
 * wrapped connection once a guest joins. onStatus reports lifecycle strings.
 */
export function hostRoom({ onStatus } = {}) {
  const code = randomCode();
  const peer = new Peer(PREFIX + code, { debug: 1 });
  let settled = false;

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; onStatus?.('error'); reject(new Error('timed out waiting for opponent')); }
    }, 5 * 60 * 1000);

    peer.on('open', () => onStatus?.('waiting'));
    peer.on('error', (err) => {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      // 'unavailable-id' means the code is taken — extremely unlikely, retry-worthy.
      onStatus?.('error');
      reject(err);
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        onStatus?.('connected');
        resolve(wrapConn(conn, peer));
      });
    });
  });

  return { code, ready, cancel: () => { settled = true; try { peer.destroy(); } catch { /* noop */ } } };
}

/**
 * Join a room by code. Resolves with the wrapped connection once open.
 */
export function joinRoom(code, { onStatus } = {}) {
  const peer = new Peer({ debug: 1 });
  let settled = false;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; onStatus?.('error'); reject(new Error('could not reach room')); }
    }, 30 * 1000);

    peer.on('open', () => {
      onStatus?.('connecting');
      const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      conn.on('open', () => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        onStatus?.('connected');
        resolve(wrapConn(conn, peer));
      });
      conn.on('error', (err) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); onStatus?.('error'); reject(err);
      });
    });
    peer.on('error', (err) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); onStatus?.('error'); reject(err);
    });
  });
}
