---
name: miaw-e2e-testing
description: >
  End-to-end testing of Salesforce Experience Cloud MIAW (Messaging for In-App and Web) chat widgets
  with Agentforce service agents using Playwright. Use this skill whenever the user wants to test
  MIAW chat functionality, write Playwright tests for Experience Cloud messaging, validate Agentforce
  service agent conversations, test pre-chat forms, multi-turn chat flows, slot filling, or chat
  disconnection scenarios. Also trigger when the user mentions "test chat widget", "MIAW testing",
  "Experience Cloud chat test", "messaging for in-app and web", or wants to automate testing of
  any Salesforce embedded chat or messaging deployment, even if they don't explicitly say "MIAW"
  or "Playwright".
---

# MIAW End-to-End Testing with Playwright

This skill runs a Playwright test against a Salesforce Experience Cloud site with MIAW
(Messaging for In-App and Web) deployed. It logs in, opens the chat widget, captures the
Agentforce service agent's greeting message, takes a screenshot, and presents the results.

## Prerequisites

The user must have a `miaw-test-config.json` in their working directory. If it doesn't exist,
generate one from `references/config-template.json` and ask the user to fill in their details.

The config must have at minimum:
- `environment.siteUrl` — the Experience Cloud site URL (e.g., `https://myco.my.site.com/portal/s/`)
- `auth.username` and `auth.password` — if login is required (`auth.required: true`)

## How It Works

When triggered, run the following steps. Do NOT generate a project scaffold or multiple test
files. Instead, write and execute a single self-contained Playwright script.

### Step 1: Check for config and dependencies

1. Read `miaw-test-config.json` from the working directory. If missing, generate from template and ask the user to fill it in.
2. Check that `@playwright/test` is installed. If not, run `npm install @playwright/test` and `npx playwright install chromium`.

### Step 2: Write and run the test script

Write a single file `miaw-greeting-test.ts` in the working directory and execute it with `npx tsx`.
The script does:

1. **Login** (if `config.auth.required` is true):
   - Navigate to `{siteUrl}` with the path changed to end in `/s/login/`
   - Fill username and password using selectors: `input[placeholder*="Username" i], input[type="text"]` and `input[type="password"]`
   - Click the login button: `button:has-text("Log")`
   - Wait for URL to change away from `/login`
   - Wait for `networkidle`

2. **Navigate to site home**:
   - Go to `config.environment.siteUrl`
   - Wait for `networkidle` + 3 seconds for dynamic components

3. **Find and click the MIAW chat bubble**:
   - The chat bubble is a button inside the embedded messaging container
   - Selector: `[class*="embeddedMessaging"] button`
   - The button has `aria-label` like "Hello, have a question? Let's chat."
   - Take screenshot: `miaw-01-bubble.png`

4. **Wait for chat panel and agent greeting**:
   - The chat panel opens in an **iframe** with id `embeddedMessagingFrame`
   - Use `page.frameLocator('#embeddedMessagingFrame')` to access chat content
   - Wait up to 30 seconds for the greeting to appear
   - The greeting is inside the iframe body text — use `frame.locator('body').innerText()` to extract
   - Take screenshot: `miaw-02-chat-open.png`

5. **Extract and validate the greeting**:
   - Parse the iframe body text to find the agent's greeting message
   - Check for unresolved merge field variables like `{!$Context.*}` — these indicate a Salesforce config issue
   - Take final screenshot: `miaw-03-greeting.png`

6. **Present results**:
   - Print the full greeting text to console
   - Show the screenshot using the Read tool so the user sees it inline
   - If unresolved merge fields are found, warn the user

### Key Technical Details

These were discovered through actual testing against a live MIAW deployment:

**DOM Structure**: The MIAW chat content lives inside an iframe, NOT in shadow DOM:
- Main page has `<experience_messaging-embedded-messaging>` or `<embedded-messaging>` custom elements
- The chat bubble button is in the main DOM: `[class*="embeddedMessaging"] button`
- The chat panel (messages, input) renders inside iframe `#embeddedMessagingFrame`
- The iframe src pattern: `{domain}/ESW{deploymentName}/` with `?lwc.mode=prod`

**Login flow**: Salesforce Experience Cloud login goes through `frontdoor.jsp` redirects.
Use `waitForURL(url => !url.includes('/login'))` rather than waiting for a specific URL.

**Chat loading**: After clicking the bubble, the iframe loads and the agent joins.
The greeting may take 5-15 seconds to appear. Poll the iframe body text rather than
using fixed timeouts.

**Extracting messages from the iframe**:
```typescript
const chatFrame = page.frameLocator('#embeddedMessagingFrame');
const bodyText = await chatFrame.locator('body').innerText({ timeout: 30000 });
// bodyText contains all chat content including agent name, timestamps, and messages
```

### Example Test Script

```typescript
import { chromium } from '@playwright/test';
const config = require('./miaw-test-config.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Login
  if (config.auth.required) {
    const loginUrl = config.environment.siteUrl.replace(/\/s\/$/, '/s/login/');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[placeholder*="Username" i], input[type="text"]').first().fill(config.auth.username);
    await page.locator('input[type="password"]').first().fill(config.auth.password);
    await page.locator('button:has-text("Log")').first().click();
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }

  // Navigate to site
  await page.goto(config.environment.siteUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click chat bubble
  const bubble = page.locator('[class*="embeddedMessaging"] button').first();
  await bubble.waitFor({ timeout: 15000 });
  await page.screenshot({ path: 'miaw-01-bubble.png', fullPage: true });
  await bubble.click();

  // Wait for greeting in iframe
  const chatFrame = page.frameLocator('#embeddedMessagingFrame');
  let greeting = '';
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const bodyText = await chatFrame.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    if (bodyText.includes('joined')) {
      greeting = bodyText;
      break;
    }
  }

  await page.screenshot({ path: 'miaw-02-chat-open.png', fullPage: true });

  // Extract just the greeting message
  const lines = greeting.split('\n').filter(l => l.trim());
  console.log('\n=== AGENT GREETING ===');
  console.log(greeting);
  console.log('=== END ===\n');

  // Check for unresolved variables
  const unresolved = greeting.match(/\{!\$[^}]+\}/g);
  if (unresolved) {
    console.log('WARNING: Unresolved merge fields:');
    unresolved.forEach(v => console.log(`  ${v}`));
  }

  await page.screenshot({ path: 'miaw-03-greeting.png', fullPage: true });
  await browser.close();
})();
```

### Step 3: Show the screenshot

After the script completes, use the Read tool to show `miaw-03-greeting.png` (or `miaw-02-chat-open.png`)
to the user so they can see the result inline in the conversation. Also print the extracted greeting text.
