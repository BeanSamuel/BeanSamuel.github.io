import { useState, useRef, useCallback, useEffect } from 'react';
import Duel from './Duel';
import { hostRoom, joinRoom } from '../net/peer';
import { makeOnlineDriver } from '../net/lockstep';
import { MSG, PROTOCOL_VERSION } from '../net/protocol';

// Lobby + handshake for online 1v1. Establishes the P2P connection, agrees a
// shared seed and player indices (host = 0, guest = 1), then hands a ready
// {conn, seed, localIndex} to Duel, which builds the lockstep driver.

const Online = () => {
  const [view, setView] = useState('menu'); // menu | hosting | joining | error | play
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const session = useRef(null); // { conn, seed, localIndex }
  const cleanupRef = useRef(null);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    session.current = null;
    setView('menu'); setCode(''); setStatusMsg(''); setError('');
  }, []);

  // --- Host ---
  const onHost = useCallback(async () => {
    setError(''); setView('hosting'); setStatusMsg('creating room…');
    const room = hostRoom({ onStatus: (s) => setStatusMsg(s === 'waiting' ? 'share the code · waiting for opponent…' : s) });
    setCode(room.code);
    let helloTimer = null;
    cleanupRef.current = () => { clearInterval(helloTimer); room.cancel(); session.current?.conn.close(); };
    try {
      const conn = await room.ready;
      const seed = (Math.random() * 0x7fffffff) >>> 0;
      session.current = { conn, seed, localIndex: 0 };
      // Resend HELLO until the guest starts talking back (tolerates the open race).
      let acked = false;
      conn.onData(() => { acked = true; });
      const sendHello = () => conn.send({ t: MSG.HELLO, version: PROTOCOL_VERSION, seed, hostIndex: 0 });
      sendHello();
      helloTimer = setInterval(() => { if (acked) { clearInterval(helloTimer); } else sendHello(); }, 250);
      setView('play');
    } catch (err) {
      setError(String(err.message || err)); setView('error');
    }
  }, []);

  // --- Join ---
  const onJoin = useCallback(async () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length < 4) { setError('enter the 4-character room code'); return; }
    setError(''); setView('joining'); setStatusMsg('connecting…');
    try {
      const conn = await joinRoom(c, { onStatus: (s) => setStatusMsg(s + '…') });
      cleanupRef.current = () => conn.close();
      // Wait for the host's HELLO to learn the seed and check versions.
      const seed = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('no handshake from host')), 15000);
        conn.onData((msg) => {
          if (msg && msg.t === MSG.HELLO) {
            clearTimeout(to);
            if (msg.version !== PROTOCOL_VERSION) { reject(new Error('version mismatch — both open the same build')); return; }
            resolve(msg.seed >>> 0);
          }
        });
      });
      session.current = { conn, seed, localIndex: 1 };
      setView('play');
    } catch (err) {
      setError(String(err.message || err)); setView('error');
    }
  }, [joinCode]);

  const makeDriver = useCallback((sampleLocal) => {
    const { conn, seed, localIndex } = session.current;
    return makeOnlineDriver({ conn, localIndex, seed, sampleLocal, onStatus: () => {} });
  }, []);

  if (view === 'play') {
    return (
      <Duel
        makeDriver={makeDriver}
        statusText="ONLINE"
        hint="P2P · inputs only cross the wire · outcomes are computed on both sides (anti-cheat)"
        onExit={reset}
      />
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
      <p style={{ color: 'var(--text-dim)', marginBottom: '1.6rem', fontSize: '0.85rem' }}>
        1v1 · First to 5 · peer-to-peer, no server. One hosts, the other joins with the code.
      </p>

      {view === 'menu' && (
        <>
          <button onClick={onHost} className="cyber-btn" style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginBottom: '1.2rem' }}>
            [ CREATE ROOM ]
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="CODE"
              maxLength={4}
              style={{ flex: 1, padding: '0.75rem', background: 'var(--panel-bg)', border: '1px solid var(--border-strong)', borderRadius: '4px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.1rem' }}
              onKeyDown={(e) => e.key === 'Enter' && onJoin()}
            />
            <button onClick={onJoin} className="cyber-btn" style={{ padding: '0.75rem 1.4rem' }}>JOIN</button>
          </div>
        </>
      )}

      {view === 'hosting' && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>ROOM CODE</div>
          <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '0.4em', color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(87,201,214,0.5)', marginBottom: '1rem' }}>
            {code || '····'}
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{statusMsg}</p>
          <button onClick={reset} className="cyber-btn" style={{ marginTop: '1.4rem', padding: '0.5rem 1.4rem' }}>[ CANCEL ]</button>
        </div>
      )}

      {view === 'joining' && (
        <div>
          <p style={{ color: 'var(--accent-primary)', fontSize: '1rem' }}>{statusMsg}</p>
          <button onClick={reset} className="cyber-btn" style={{ marginTop: '1.4rem', padding: '0.5rem 1.4rem' }}>[ CANCEL ]</button>
        </div>
      )}

      {view === 'error' && (
        <div>
          <p style={{ color: 'var(--accent-secondary)', marginBottom: '0.6rem' }}>connection failed</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1.2rem' }}>{error}</p>
          <button onClick={reset} className="cyber-btn" style={{ padding: '0.5rem 1.4rem' }}>[ BACK ]</button>
        </div>
      )}

      <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '2rem', lineHeight: 1.6 }}>
        Anti-cheat: only inputs are sent; both clients simulate identically and compare state hashes, so
        fake hits / god-mode / teleport / speed-hacks are rejected. Aimbot &amp; wallhack can&apos;t be
        stopped without a server — that&apos;s a hard limit of having no backend.
      </p>
    </div>
  );
};

export default Online;
