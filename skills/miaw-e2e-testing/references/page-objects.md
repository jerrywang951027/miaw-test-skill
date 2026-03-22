# MIAW DOM Structure Reference

Discovered through testing against a live Salesforce Experience Cloud MIAW deployment.

## Architecture

MIAW renders in two layers:
1. **Main page DOM** — contains the chat bubble button inside `<experience_messaging-embedded-messaging>` or `<embedded-messaging>`
2. **Chat iframe** (`#embeddedMessagingFrame`) — contains the full chat panel (messages, input, agent info)

## Iframes

Three iframes are injected by MIAW:

| ID | Purpose |
|---|---|
| `embeddedMessagingSiteContextFrame` | Site context/config |
| `embeddedMessagingFrame` | **The chat panel** — all messages and input live here |
| `embeddedMessagingFilePreviewFrame` | File/image preview overlay |

The iframe src follows this pattern:
```
{siteUrl}/ESW{deploymentId}/?lwc.mode=prod
```

## Selectors

### Chat Bubble (main page)
```typescript
// The chat bubble button
page.locator('[class*="embeddedMessaging"] button').first()
// aria-label example: "Hello, have a question? Let's chat."
```

### Chat Panel (inside iframe)
```typescript
const chatFrame = page.frameLocator('#embeddedMessagingFrame');

// Full body text (includes agent name, timestamps, messages)
const bodyText = await chatFrame.locator('body').innerText();

// Message input
const input = chatFrame.locator('textarea, input[placeholder*="Type your message"]');

// Send button (attachment button is also present)
const sendBtn = chatFrame.locator('button[aria-label*="Send"]');
```

### Login Page
```typescript
// Username field
page.locator('input[placeholder*="Username" i], input[type="text"]').first()

// Password field
page.locator('input[type="password"]').first()

// Login button (SLDS-styled)
page.locator('button:has-text("Log")').first()
// class: "slds-button slds-button--brand loginButton uiButton--none uiButton"
```

## Login Flow

Salesforce Experience Cloud login redirects through `frontdoor.jsp`:
1. Navigate to `{siteUrl}/s/login/`
2. Fill credentials and click login
3. Page redirects: login -> frontdoor.jsp -> CommunitiesLanding -> /s/ (home)
4. Wait with: `page.waitForURL(url => !url.includes('/login'))`
5. Then: `page.waitForLoadState('networkidle')`

## Chat Loading Sequence

After clicking the bubble:
1. `embeddedMessagingFrame` iframe loads (~2-3s)
2. Agent joins the conversation (~3-5s) — shown as "{agent name} joined"
3. Agent sends greeting message (~5-15s total from click)

Poll the iframe body text to detect when the greeting has arrived rather than using fixed timeouts.
