import Peer, { type DataConnection } from 'peerjs';
import type { Channel } from './protocol.ts';
import { peerIdFor } from './protocol.ts';

/**
 * WebRTC data channel between two devices. The PeerJS signalling server only introduces the
 * devices (it sees the pairing code, never the hands); the data itself flows peer-to-peer,
 * encrypted by WebRTC (DTLS).
 */
export interface SignalServer {
  host: string;
  port: number;
  path: string;
  secure: boolean;
}

const DEFAULT_SERVER: SignalServer = { host: '0.peerjs.com', port: 443, path: '/', secure: true };
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };

export function signalServer(): SignalServer {
  try {
    const raw = localStorage.getItem('leakfinder.signal');
    if (raw) return { ...DEFAULT_SERVER, ...(JSON.parse(raw) as Partial<SignalServer>) };
  } catch {
    /* ignore */
  }
  const host = import.meta.env.VITE_SIGNAL_HOST as string | undefined;
  return host ? { ...DEFAULT_SERVER, host } : DEFAULT_SERVER;
}

export interface Link {
  channel: Channel;
  close: () => void;
}

function toChannel(conn: DataConnection): Channel {
  return {
    send: (d) => conn.send(d),
    onMessage: (cb) => conn.on('data', (d) => cb(typeof d === 'string' ? d : String(d))),
  };
}

function friendly(err: { type?: string; message?: string }): Error {
  switch (err.type) {
    case 'peer-unavailable':
      return new Error('No device is showing that code. Check the code and make sure the other device is still on the pairing screen.');
    case 'unavailable-id':
      return new Error('That code is already in use — try again for a new one.');
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return new Error("Couldn't reach the pairing service. Check your internet connection and try again.");
    case 'browser-incompatible':
      return new Error("This browser doesn't support direct device connections (WebRTC).");
    default:
      return new Error(err.message || 'Connection failed.');
  }
}

/** Show a code and wait for the other device to connect. */
export function hostLink(code: string, onReady: () => void): { link: Promise<Link>; cancel: () => void } {
  const peer = new Peer(peerIdFor(code), { ...signalServer(), config: ICE, debug: 0 });
  let cancelled = false;
  const link = new Promise<Link>((resolve, reject) => {
    peer.on('open', () => onReady());
    peer.on('error', (e) => reject(friendly(e)));
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (cancelled) return conn.close();
        resolve({ channel: toChannel(conn), close: () => peer.destroy() });
      });
      conn.on('error', (e) => reject(friendly(e as { type?: string; message?: string })));
    });
  });
  return {
    link,
    cancel: () => {
      cancelled = true;
      peer.destroy();
    },
  };
}

/** Connect to a device that is showing `code`. */
export function joinLink(code: string): { link: Promise<Link>; cancel: () => void } {
  const peer = new Peer({ ...signalServer(), config: ICE, debug: 0 });
  const link = new Promise<Link>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting. Are both devices online?')), 25_000);
    peer.on('error', (e) => {
      clearTimeout(timer);
      reject(friendly(e));
    });
    peer.on('open', () => {
      const conn = peer.connect(peerIdFor(code), { serialization: 'raw', reliable: true });
      conn.on('open', () => {
        clearTimeout(timer);
        resolve({ channel: toChannel(conn), close: () => peer.destroy() });
      });
      conn.on('error', (e) => {
        clearTimeout(timer);
        reject(friendly(e as { type?: string; message?: string }));
      });
    });
  });
  return { link, cancel: () => peer.destroy() };
}
