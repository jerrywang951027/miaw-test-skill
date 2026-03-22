# MIAW Page Object Reference

## MIAWWidgetPage

This page object encapsulates all interactions with the MIAW chat widget.

### Locator Strategy

MIAW renders inside shadow DOM via the `<embedded-messaging>` custom element. The internal
structure varies by Salesforce release, but the general hierarchy is:

```
<embedded-messaging>
  #shadow-root
    <div class="embeddedMessagingFrame">
      <button class="embeddedMessagingConversationButton"> <!-- chat launcher -->
      <iframe> <!-- chat window when open -->
        <div class="conversationPanel">
          <div class="messageList">
            <div class="chatMessage agentMessage">...</div>
            <div class="chatMessage endUserMessage">...</div>
          </div>
          <textarea class="messageInput">
          <button class="sendButton">
        </div>
      </iframe>
    </div>
</embedded-messaging>
```

### Recommended Selectors (Priority Order)

1. `data-testid` attributes (if the org has custom LWC wrappers)
2. ARIA roles and labels: `role="button"`, `aria-label="Chat with an Agent"`
3. Semantic element + context: `embedded-messaging button`, `embedded-messaging textarea`
4. CSS classes as last resort (prefix match to survive minor changes): `[class*="ConversationButton"]`

### Core Methods

```typescript
class MIAWWidgetPage {
  private page: Page;
  private widgetRoot: Locator;
  private chatFrame: FrameLocator | null = null;

  constructor(page: Page) {
    this.page = page;
    this.widgetRoot = page.locator('embedded-messaging');
  }

  async waitForWidgetReady(): Promise<void> {
    // Wait for the embedded-messaging element to appear and its shadow root to populate
    await this.widgetRoot.waitFor({ state: 'attached' });
    await this.page.waitForFunction(() => {
      const el = document.querySelector('embedded-messaging');
      return el?.shadowRoot?.querySelector('button') !== null;
    }, { timeout: 30000 });
  }

  async openChat(): Promise<void> {
    await this.waitForWidgetReady();
    // Click the chat launcher button inside shadow DOM
    const launchButton = this.widgetRoot.locator('button').first();
    await launchButton.click();
    // Wait for chat window (iframe) to appear
    await this.page.waitForSelector('embedded-messaging iframe', { timeout: 15000 });
    this.chatFrame = this.page.frameLocator('embedded-messaging iframe');
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.chatFrame) throw new Error('Chat not open. Call openChat() first.');
    const input = this.chatFrame.locator('textarea, [contenteditable="true"]').first();
    await input.fill(text);
    // Press Enter or click send button
    const sendBtn = this.chatFrame.locator('button[class*="send"], button[aria-label*="Send"]').first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
    } else {
      await input.press('Enter');
    }
  }

  async waitForAgentMessage(options?: { timeout?: number; afterCount?: number }): Promise<string> {
    if (!this.chatFrame) throw new Error('Chat not open.');
    const timeout = options?.timeout ?? 30000;
    const afterCount = options?.afterCount ?? 0;

    // Wait for a new agent message to appear beyond the current count
    const agentMessages = this.chatFrame.locator('[class*="agent"], [class*="Agent"]');
    await agentMessages.nth(afterCount).waitFor({ timeout });
    return await agentMessages.nth(afterCount).innerText();
  }

  async getMessageCount(): Promise<number> {
    if (!this.chatFrame) return 0;
    return await this.chatFrame.locator('[class*="chatMessage"], [class*="ChatMessage"]').count();
  }

  async getAllMessages(): Promise<Array<{ sender: 'agent' | 'user'; text: string }>> {
    if (!this.chatFrame) return [];
    const messages = this.chatFrame.locator('[class*="chatMessage"], [class*="ChatMessage"]');
    const count = await messages.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const el = messages.nth(i);
      const className = await el.getAttribute('class') || '';
      const sender = className.toLowerCase().includes('agent') ? 'agent' as const : 'user' as const;
      const text = await el.innerText();
      result.push({ sender, text });
    }
    return result;
  }

  async closeChat(): Promise<void> {
    const closeBtn = this.widgetRoot.locator('button[aria-label*="Close"], button[aria-label*="close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  }

  async isWidgetVisible(): Promise<boolean> {
    return await this.widgetRoot.isVisible();
  }

  async isTypingIndicatorVisible(): Promise<boolean> {
    if (!this.chatFrame) return false;
    const indicator = this.chatFrame.locator('[class*="typing"], [class*="Typing"]');
    return await indicator.isVisible().catch(() => false);
  }

  async waitForTypingToStop(timeout = 30000): Promise<void> {
    if (!this.chatFrame) return;
    const indicator = this.chatFrame.locator('[class*="typing"], [class*="Typing"]');
    await indicator.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }
}
```

## PreChatFormPage

```typescript
class PreChatFormPage {
  private chatFrame: FrameLocator;

  constructor(chatFrame: FrameLocator) {
    this.chatFrame = chatFrame;
  }

  async isFormVisible(): Promise<boolean> {
    const form = this.chatFrame.locator('form, [class*="preChatForm"], [class*="PreChat"]');
    return await form.isVisible().catch(() => false);
  }

  async fillField(label: string, value: string): Promise<void> {
    // Try label-based lookup first
    const field = this.chatFrame.locator(`label:has-text("${label}") + input, label:has-text("${label}") + textarea`).first();
    if (await field.isVisible()) {
      await field.fill(value);
      return;
    }
    // Fallback: placeholder-based
    const byPlaceholder = this.chatFrame.locator(`input[placeholder*="${label}" i], textarea[placeholder*="${label}" i]`).first();
    await byPlaceholder.fill(value);
  }

  async selectDropdown(label: string, value: string): Promise<void> {
    const select = this.chatFrame.locator(`label:has-text("${label}") + select`).first();
    await select.selectOption({ label: value });
  }

  async submit(): Promise<void> {
    const submitBtn = this.chatFrame.locator('button[type="submit"], button:has-text("Start Chat"), button:has-text("Submit")').first();
    await submitBtn.click();
  }

  async fillAndSubmit(fields: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(fields)) {
      await this.fillField(label, value);
    }
    await this.submit();
  }
}
```

## ExperienceSitePage

```typescript
class ExperienceSitePage {
  private page: Page;
  private baseUrl: string;

  constructor(page: Page, baseUrl: string) {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  async navigate(path = '/'): Promise<void> {
    await this.page.goto(this.baseUrl + path, { waitUntil: 'networkidle' });
  }

  async login(username: string, password: string): Promise<void> {
    await this.navigate('/login');
    await this.page.fill('#username, input[name="username"]', username);
    await this.page.fill('#password, input[name="password"]', password);
    await this.page.click('#Login, button[type="submit"]');
    await this.page.waitForURL('**/s/**', { timeout: 30000 });
  }

  async waitForMIAWReady(): Promise<void> {
    await this.page.waitForSelector('embedded-messaging', { timeout: 30000 });
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for common indicators of authenticated state
    const avatar = this.page.locator('[class*="avatar"], [class*="userProfile"]');
    return await avatar.isVisible().catch(() => false);
  }
}
```

## Custom Test Fixture

Wire everything together in a Playwright fixture:

```typescript
// src/fixtures/miaw.fixture.ts
import { test as base } from '@playwright/test';
import { MIAWWidgetPage } from '../page-objects/miaw-widget.page';
import { PreChatFormPage } from '../page-objects/pre-chat-form.page';
import { ExperienceSitePage } from '../page-objects/experience-site.page';

type MIAWFixtures = {
  experienceSite: ExperienceSitePage;
  miawWidget: MIAWWidgetPage;
  preChatForm: PreChatFormPage;
};

export const test = base.extend<MIAWFixtures>({
  experienceSite: async ({ page }, use) => {
    const site = new ExperienceSitePage(page, process.env.EXPERIENCE_SITE_URL || 'http://localhost');
    await use(site);
  },
  miawWidget: async ({ page }, use) => {
    const widget = new MIAWWidgetPage(page);
    await use(widget);
  },
  preChatForm: async ({ page }, use) => {
    // PreChatForm requires the chat iframe, which is available after opening chat
    // The test should open chat first, then access this fixture
    const frame = page.frameLocator('embedded-messaging iframe');
    const form = new PreChatFormPage(frame);
    await use(form);
  },
});

export { expect } from '@playwright/test';
```
