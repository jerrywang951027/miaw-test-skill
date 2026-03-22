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

This skill generates and runs Playwright test suites for Salesforce Experience Cloud MIAW
(Messaging for In-App and Web) deployments that connect to Agentforce service agents.

## Why Playwright for MIAW

MIAW chat widgets are rendered inside shadow DOM and iframes on Experience Cloud sites. Playwright
handles these well because it can pierce shadow DOM boundaries, wait for dynamic elements, and
manage the asynchronous nature of real-time messaging. The tests this skill produces use Playwright's
built-in waiting mechanisms rather than arbitrary timeouts, which makes them resilient to network
latency and agent response times.

## What This Skill Produces

1. A Playwright project scaffold (`playwright.config.ts`, `package.json`, page objects, helpers)
2. Test specs (`.spec.ts` files) covering the user's requested scenarios
3. An HTML test report after execution (via Playwright's built-in reporter)

## Workflow

### Step 1: Generate the Config File

Before writing any tests, generate a `miaw-test-config.json` in the user's working directory.
This is the single source of truth for all environment and test configuration. The user fills
it in once, and all generated code reads from it.

Generate the config from the template at `references/config-template.json`. Walk the user through
each section briefly so they know what to fill in. If the user already has a `miaw-test-config.json`,
read it and skip to Step 2.

The config captures:
- **environment**: Site URL, deployment name, timeouts
- **auth**: Whether login is needed, credentials (or "none" for guest access)
- **preChatForm**: Field definitions (label, type, test value)
- **conversationFlows**: Named multi-turn test scenarios with expected agent responses
- **disconnection**: Whether to test disconnect, how long to wait before reconnect

The generated Playwright project reads this config at runtime, so updating the config
(e.g., changing the site URL or adding a new conversation flow) does not require regenerating tests.

### Step 2: Scaffold the Project

Generate the project in the user's working directory (or a subdirectory they specify). The structure:

```
miaw-tests/
  miaw-test-config.json            # User-facing config (THE source of truth)
  playwright.config.ts
  package.json
  src/
    page-objects/
      experience-site.page.ts    # Site navigation and login
      miaw-widget.page.ts         # Chat widget interactions
      pre-chat-form.page.ts       # Pre-chat form filling
    helpers/
      wait-for-agent.ts           # Wait for agent response with smart polling
      chat-assertions.ts          # Custom assertions for chat messages
    fixtures/
      miaw.fixture.ts             # Playwright test fixture wiring up page objects
  tests/
    chat-basic.spec.ts            # Open widget, send message, get response
    pre-chat-form.spec.ts         # Fill and submit pre-chat form
    multi-turn.spec.ts            # Multi-turn conversation with slot filling
    disconnection.spec.ts         # Chat disconnect and reconnect
  reports/                        # Generated after test run
```

### Step 3: Write the Page Objects

The page objects are the core of reliable MIAW testing. Read the reference file at
`references/page-objects.md` for the complete implementation patterns. Key points:

**MIAWWidgetPage** handles:
- Locating the chat button (usually an `<embedded-messaging>` custom element or shadow DOM container)
- Opening/closing the chat window
- Sending messages via the input field
- Reading agent responses from the message list
- Waiting for typing indicators to appear and disappear
- Scrolling to latest message

**PreChatFormPage** handles:
- Detecting form fields dynamically
- Filling text inputs, dropdowns, checkboxes
- Submitting the form
- Waiting for the transition from form to chat

**ExperienceSitePage** handles:
- Navigating to the site URL
- Login flow (if authenticated)
- Waiting for the page and MIAW widget to fully load

### Step 4: Write the Tests

Each test file follows this pattern:

```typescript
import { test, expect } from '../src/fixtures/miaw.fixture';

test.describe('MIAW - Basic Chat', () => {
  test('should open chat widget and receive agent greeting', async ({ miawWidget, experienceSite }) => {
    await experienceSite.navigate();
    await miawWidget.openChat();

    const greeting = await miawWidget.waitForAgentMessage();
    expect(greeting).toBeTruthy();
  });
});
```

#### Test Scenarios to Cover

**Basic chat flow:**
- Open widget, verify it renders
- Receive agent greeting
- Send a message, verify agent responds
- Close chat

**Pre-chat form:**
- Open widget, verify form appears
- Fill all required fields
- Submit form
- Verify transition to live chat
- Verify agent receives pre-chat data (agent should reference it in greeting or first response)

**Multi-turn conversation with slot filling:**
- Start chat with the agent
- Agent asks for information (slot 1) -> user provides it
- Agent asks for next piece (slot 2) -> user provides it
- Continue until all slots are filled
- Verify agent confirms/summarizes the collected information
- Verify agent takes the expected action (e.g., "I've created case #12345")

The conversation turns are driven by `config.conversationFlows` from the config file. Each named
flow is an array of turns:

```json
{
  "conversationFlows": {
    "orderInquiry": [
      { "userMessage": "I need help with my order", "expectAgentContains": ["order number"] },
      { "userMessage": "ORD-12345", "expectAgentContains": ["issue"] },
      { "userMessage": "The item arrived damaged", "expectAgentContains": ["sorry", "created", "case"] }
    ]
  }
}
```

The test iterates through the flow array, sending each user message and asserting the agent
response contains the expected keywords:

```typescript
import config from '../../miaw-test-config.json';

for (const [flowName, turns] of Object.entries(config.conversationFlows)) {
  test(`multi-turn: ${flowName}`, async ({ miawWidget, experienceSite }) => {
    // ...run through turns
  });
}
```

**Chat disconnection:**
- Start a chat session
- Simulate disconnection (navigate away or kill network via `page.route` to block WebSocket)
- Wait, then restore connection
- Verify reconnection behavior (either session resumes or user gets a "disconnected" message)
- Verify the widget is still usable after reconnection

### Step 5: Configure and Run

The `playwright.config.ts` reads all settings from `miaw-test-config.json` — no `.env` file needed.
The config is loaded once at the top of the config file:

```typescript
import config from './miaw-test-config.json';

export default defineConfig({
  use: {
    baseURL: config.environment.siteUrl,
  },
  timeout: config.environment.testTimeoutMs,
  retries: config.environment.retries,
  reporter: [['html', { outputFolder: 'reports' }]],
  // ...
});
```

Generate a `playwright.config.ts` with:
- Base URL from `config.environment.siteUrl`
- Timeout from `config.environment.testTimeoutMs` (default 60000)
- Retry count from `config.environment.retries` (default 1)
- HTML reporter enabled by default
- Screenshot on failure
- Video recording on first retry
- Auth setup project (only if `config.auth.required` is true)

To run: `npx playwright test`
To view report: `npx playwright show-report`

### Step 6: Present Results

After tests run, point the user to:
1. The terminal output summary (passed/failed/skipped counts)
2. The HTML report at `reports/` — open with `npx playwright show-report`
3. Screenshots and videos for any failures (saved in `test-results/`)

## Important Implementation Notes

### Shadow DOM and MIAW Widget Selectors

MIAW widgets render inside shadow DOM. Use Playwright's built-in shadow-piercing selectors:

```typescript
// The MIAW chat button is typically inside a shadow root
const chatButton = page.locator('embedded-messaging').locator('button[class*="chat"]');

// Or use CSS shadow-piercing if needed
const messageInput = page.locator('embedded-messaging >> textarea');
```

The exact selectors vary by MIAW version and customization. The page object should use
data-testid attributes where available, falling back to semantic selectors (role, aria-label),
and only use CSS class selectors as a last resort since Salesforce can change class names
between releases.

### Waiting for Agent Responses

Never use fixed `waitForTimeout()`. Instead, poll the message list:

```typescript
async waitForAgentMessage(previousCount: number): Promise<string> {
  await this.page.waitForFunction(
    (prev) => {
      const messages = document.querySelectorAll('[class*="agent-message"]');
      return messages.length > prev;
    },
    previousCount,
    { timeout: 30000 }
  );
  // Return the latest agent message text
}
```

### Network Simulation for Disconnection Tests

Use Playwright's route API to simulate network issues:

```typescript
// Block WebSocket connections to simulate disconnect
await page.route('**/*', route => {
  if (route.request().resourceType() === 'websocket') {
    route.abort();
  } else {
    route.continue();
  }
});
```

### Authentication

When `config.auth.required` is true, generate an auth setup project that runs once before
all tests, logs in using credentials from the config, and saves the session:

```typescript
// auth.setup.ts
import { test as setup } from '@playwright/test';
import config from '../miaw-test-config.json';

setup('authenticate', async ({ page }) => {
  await page.goto(config.environment.siteUrl + config.auth.loginUrl);
  await page.fill('#username, input[name="username"]', config.auth.username);
  await page.fill('#password, input[name="password"]', config.auth.password);
  await page.click('#Login, button[type="submit"]');
  await page.waitForURL('**/s/**', { timeout: 30000 });
  await page.context().storageState({ path: config.auth.storageStatePath });
});
```

The storage state is reused across all test specs, so login only happens once per run.

### Custom Selectors

If the user's MIAW deployment uses custom LWC wrappers or non-standard markup, they can
override any selector in `config.selectors`. The page objects check for custom selectors first
and fall back to defaults:

```typescript
const buttonSelector = config.selectors.chatButton || 'embedded-messaging button';
```

This avoids hardcoding selectors in test code and lets the user adapt without editing TypeScript.

## Adapting to the User's Specific Setup

Every MIAW deployment is different. The config file handles most variation, but prompt the user
to review their config when:
- The pre-chat form has complex validation or conditional fields (add field entries to config)
- The agent flow involves handoff to a human agent (add a conversation flow for it)
- The site uses a custom domain or non-standard URL structure (update `siteUrl`)
- The widget uses non-standard selectors (override in `config.selectors`)

When in doubt, generate the tests with clear TODO comments where the user needs to customize,
and explain what they need to fill in.
