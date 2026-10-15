// Date helpers that use the computer's own time zone, so dates match the clock on screen.

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-15" */
export function localDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-15 14:03:22" */
export function localDateTime(date: Date = new Date()): string {
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Makes a keyword safe to use in a file name: "boho earrings" -> "boho-earrings". */
export function fileSafe(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '-') || 'keyword'
  );
}
