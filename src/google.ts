// Opens a visible Chrome window, types into the Google search box like a person,
// and reads the suggestions Google shows underneath.

import { chromium, type BrowserContext, type Page } from 'playwright';
import { randomBetween } from './settings.js';

/** What is on screen before a search: the normal Google page, a cookie screen, or a "check" page. */
export type PageCheck = 'ready' | 'consent' | 'blocked';

/** What the runner needs from a browser. A fake version of this is used in tests. */
export interface SearchSession {
  /** Makes sure the Google home page is open and reports what is showing. */
  prepare(): Promise<PageCheck>;
  /** Types the text, reads the suggestions, clears the box. Never presses Enter. */
  collect(text: string): Promise<string[]>;
  /** True once the Chrome window has been closed (by the user or by us). */
  readonly closed: boolean;
  /** Calls the function when the Chrome window is closed. */
  onClosed(callback: () => void): void;
  close(): Promise<void>;
}

export interface GoogleOptions {
  domain: string;
  language: string;
  /** Folder for the separate Chrome profile that remembers cookies between runs. */
  profileFolder: string;
}

/** Search box on Google's home page (it is a textarea today, an input in older layouts). */
const SEARCH_BOX = 'textarea[name="q"], input[name="q"]';
/** Each suggestion row in the drop-down list. */
const SUGGESTION_ROWS = '[role="listbox"] [role="option"]';
/** Rows in the list that are not keywords. */
const NOT_A_KEYWORD = /report inappropriate predictions|unangemessene vorhersagen|neprimerne napovedi|signaler des prédictions/i;
/** Buttons on Google's cookie screen, in the languages offered on the form. */
const CONSENT_BUTTONS =
  /^(reject all|accept all|alle ablehnen|alle akzeptieren|zavrni vse|sprejmi vse|tout refuser|tout accepter|سب مسترد کریں|سب قبول کریں)$/i;

const SUGGESTION_WAIT_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opens Chrome with its own profile folder. Uses the installed Google Chrome if there is one,
 * otherwise the Chromium that Playwright downloaded. Always a visible window, never headless.
 */
async function launchBrowser(profileFolder: string): Promise<BrowserContext> {
  const options = { headless: false, viewport: null } as const;
  try {
    return await chromium.launchPersistentContext(profileFolder, { ...options, channel: 'chrome' });
  } catch {
    return await chromium.launchPersistentContext(profileFolder, options);
  }
}

export class GoogleSession implements SearchSession {
  private isClosed = false;
  private closeListeners: (() => void)[] = [];

  private constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly homeUrl: string,
  ) {
    context.on('close', () => this.markClosed());
    page.on('close', () => this.markClosed());
  }

  static async open(options: GoogleOptions): Promise<GoogleSession> {
    const context = await launchBrowser(options.profileFolder);
    const page = context.pages()[0] ?? (await context.newPage());
    const homeUrl = `https://www.${options.domain}/?hl=${encodeURIComponent(options.language)}`;
    return new GoogleSession(context, page, homeUrl);
  }

  get closed(): boolean {
    return this.isClosed;
  }

  async prepare(): Promise<PageCheck> {
    if (await this.isBlocked()) return 'blocked';
    if (await this.searchBoxVisible()) return 'ready';

    // Not on the Google home page (first start, or after a cookie screen): go there.
    if (!(await this.consentVisible())) {
      await this.page.goto(this.homeUrl, { waitUntil: 'domcontentloaded' });
    }
    if (await this.isBlocked()) return 'blocked';
    if (await this.consentVisible()) {
      await this.tryClickConsent();
      if (await this.consentVisible()) return 'consent';
    }
    return (await this.searchBoxVisible(5000)) ? 'ready' : 'consent';
  }

  async collect(text: string): Promise<string[]> {
    const box = this.page.locator(SEARCH_BOX).first();
    await this.clearBox();

    // Type one character at a time with a small random pause, like a person.
    for (const character of text) {
      await this.page.keyboard.type(character);
      await sleep(randomBetween(50, 150));
    }

    const suggestions = await this.readSuggestions();
    await this.clearBox();
    // Moving focus away closes the drop-down so it starts fresh next time.
    await box.blur().catch(() => undefined);
    return suggestions;
  }

  onClosed(callback: () => void): void {
    this.closeListeners.push(callback);
  }

  async close(): Promise<void> {
    if (!this.isClosed) await this.context.close().catch(() => undefined);
    this.markClosed();
  }

  private markClosed(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    for (const listener of this.closeListeners) listener();
  }

  /** Click the box, select everything and delete it. */
  private async clearBox(): Promise<void> {
    await this.page.locator(SEARCH_BOX).first().click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
  }

  /**
   * Waits up to 3 seconds for the list, then reads it again until it stops changing,
   * because Google updates the list a moment after the last key.
   */
  private async readSuggestions(): Promise<string[]> {
    const listAppeared = await this.page
      .locator(SUGGESTION_ROWS)
      .first()
      .waitFor({ state: 'visible', timeout: SUGGESTION_WAIT_MS })
      .then(() => true)
      .catch(() => false);
    if (!listAppeared) return [];

    let previous: string[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      await sleep(300);
      const current = await this.readVisibleRows();
      if (attempt > 0 && current.join('|') === previous.join('|')) return current;
      previous = current;
    }
    return previous;
  }

  /** The keyword text of every visible suggestion row (first line only, skipping non-keyword rows). */
  private async readVisibleRows(): Promise<string[]> {
    const texts = await this.page.locator(SUGGESTION_ROWS).evaluateAll((rows) =>
      rows
        .filter((row) => (row as HTMLElement).offsetParent !== null)
        .map((row) => (row as HTMLElement).innerText.split('\n')[0] ?? ''),
    );
    return texts.map((t) => t.trim()).filter((t) => t && !NOT_A_KEYWORD.test(t));
  }

  private async searchBoxVisible(timeout = 0): Promise<boolean> {
    const box = this.page.locator(SEARCH_BOX).first();
    if (timeout === 0) return box.isVisible().catch(() => false);
    return box
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /** Google's "unusual traffic" / CAPTCHA page. We only detect it; the user solves it by hand. */
  private async isBlocked(): Promise<boolean> {
    if (this.page.url().includes('/sorry/')) return true;
    const captcha = this.page.locator('iframe[src*="recaptcha"], #captcha-form');
    const unusualTraffic = this.page.getByText(/unusual traffic/i);
    return (await captcha.count().catch(() => 0)) > 0 || (await unusualTraffic.count().catch(() => 0)) > 0;
  }

  private async consentVisible(): Promise<boolean> {
    if (this.page.url().includes('consent.google.')) return true;
    return this.page
      .getByRole('button', { name: CONSENT_BUTTONS })
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** Tries to click "Reject all" (or "Accept all") on Google's cookie screen. */
  private async tryClickConsent(): Promise<void> {
    const button = this.page.getByRole('button', { name: CONSENT_BUTTONS }).first();
    await button.click({ timeout: 3000 }).catch(() => undefined);
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await sleep(1000);
  }
}
