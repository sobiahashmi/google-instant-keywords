import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, parsePort } from '../src/config.js';

describe('parsePort', () => {
  it('uses 3000 when PORT is not set or empty', () => {
    expect(DEFAULT_PORT).toBe(3000);
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('  ')).toBe(3000);
  });

  it('reads a valid port', () => {
    expect(parsePort('3001')).toBe(3001);
    expect(parsePort(' 8080 ')).toBe(8080);
  });

  it('refuses anything that is not a port number, with a clear message', () => {
    for (const bad of ['abc', '0', '70000', '30.5', '-1']) {
      expect(() => parsePort(bad)).toThrow(/PORT in \.env must be a number from 1 to 65535/);
    }
  });
});
