// Checks whether another program is already using a port on this computer.

import net from 'node:net';

/** Tries to connect to the port at one address. True if something answers. */
function answers(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * True if any program already answers on this port, through either form of "localhost"
 * (127.0.0.1 or ::1). Windows sometimes lets two programs share a port without an error,
 * so this check is needed as well as the usual "address in use" error.
 */
export async function isPortInUse(port: number, timeoutMs = 500): Promise<boolean> {
  const results = await Promise.all([answers('127.0.0.1', port, timeoutMs), answers('::1', port, timeoutMs)]);
  return results.includes(true);
}
