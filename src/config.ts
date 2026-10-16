// Reads the tool's settings from the .env file in the project folder.

/** The port used when .env does not set one. */
export const DEFAULT_PORT = 3000;

/**
 * Turns the PORT text from .env into a port number.
 * Empty means the default (3000). Anything that is not a whole number
 * from 1 to 65535 stops the tool with a clear message, instead of guessing.
 */
export function parsePort(value: string | undefined): number {
  const text = (value ?? '').trim();
  if (text === '') return DEFAULT_PORT;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT in .env must be a number from 1 to 65535, but it is "${text}".`);
  }
  return port;
}

/**
 * Loads .env (if there is one) and returns the port to use.
 * A PORT already set before starting (for example by start.bat) wins over .env.
 */
export function loadPort(envFile = '.env'): number {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // No .env file: that is fine, the default port is used.
  }
  return parsePort(process.env.PORT);
}
