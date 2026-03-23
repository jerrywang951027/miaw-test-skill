# MIAW Test Skill

Automate end-to-end testing of **Salesforce MIAW (Messaging for In-App and Web)** chat widgets with **Claude Code**. This skill teaches Claude how to write and run Playwright tests against any Experience Cloud site with an Agentforce service agent.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- Node.js 18+
- A Salesforce Experience Cloud site with MIAW deployed

## Quick Start

### 1. Install the skill

**Option A: Install directly from GitHub (recommended)**

```bash
claude install-skill https://github.com/your-org/miaw-test-skill
```

**Option B: Install via npx**

```bash
npx miaw-test-skill
```

**Option C: Clone and install locally**

```bash
git clone https://github.com/your-org/miaw-test-skill.git
cd miaw-test-skill
claude install-skill .
```

### 2. Create a config file

In the directory where you want to run tests, create `miaw-test-config.json`:

```json
{
  "environment": {
    "siteUrl": "https://your-site.my.site.com/s/"
  },
  "auth": {
    "required": false
  }
}
```

That's the minimum config. If your site requires login, set `auth.required` to `true` and add credentials:

```json
{
  "environment": {
    "siteUrl": "https://your-site.my.site.com/s/"
  },
  "auth": {
    "required": true,
    "username": "your-user@example.com",
    "password": "your-password"
  }
}
```

> **Security:** `miaw-test-config.json` is in `.gitignore` by default. Never commit this file to source control.

### 3. Run a test

Open Claude Code in the same directory as your config file, then ask:

```
Test the MIAW chat widget on my site.
```

Claude will automatically:
1. Read your config
2. Install Playwright and Chromium if needed
3. Generate and execute a test script
4. Show you screenshots and the agent's greeting

## What Gets Tested

The skill runs a Playwright browser session that:

1. **Logs in** (if auth is required) via Salesforce Experience Cloud authentication
2. **Opens the chat widget** by clicking the embedded messaging bubble
3. **Waits for the Agentforce agent** to join and send its greeting
4. **Captures screenshots** at each stage (bubble visible, chat open, greeting received)
5. **Validates** that Salesforce merge fields (e.g. `{!$Context.*}`) are properly resolved
6. **Cleans up** by ending the chat session

## Full Configuration Reference

Copy `skills/miaw-e2e-testing/references/config-template.json` for a complete config with all options:

| Section | Key Fields | Description |
|---|---|---|
| `environment` | `siteUrl`, `deploymentName`, `browser` | Target site and browser settings |
| `auth` | `required`, `username`, `password` | Login credentials for gated sites |
| `preChatForm` | `enabled`, `fields[]` | Pre-chat form field values to fill |
| `conversationFlows` | `basicGreeting`, custom flows | Multi-turn conversation test scripts |
| `disconnection` | `enabled`, `disconnectAfterMs` | Network drop/reconnect simulation |
| `selectors` | `chatButton`, `messageInput`, etc. | Override default DOM selectors if needed |

### Supported Test Scenarios

- **Basic greeting** -- Open the widget, verify the agent responds
- **Pre-chat form** -- Fill form fields before starting the conversation
- **Multi-turn conversation** -- Test slot-filling flows and multi-step responses
- **Disconnection/reconnect** -- Simulate network drops, verify recovery
- **Login-gated sites** -- Full Experience Cloud auth flow

## Example Prompts

Once installed, Claude activates this skill when you say things like:

- "Test my MIAW chat widget"
- "Write a Playwright test for my Experience Cloud chat"
- "Validate the Agentforce agent greeting"
- "Test messaging for in-app and web"
- "Automate testing of my embedded chat"

## Project Structure

```
miaw-test-skill/
├── .claude-plugin/
│   ├── marketplace.json          # Plugin registry entry
│   └── plugin.json               # Plugin metadata
├── skills/
│   └── miaw-e2e-testing/
│       ├── SKILL.md              # Skill instructions (what Claude reads)
│       ├── scripts/
│       │   └── miaw-greeting-test.ts   # Reference Playwright test
│       ├── references/
│       │   ├── page-objects.md         # DOM selectors & iframe docs
│       │   └── config-template.json    # Full config template
│       └── evals/
│           └── evals.json              # Eval scenarios for skill testing
└── README.md
```

## Troubleshooting

| Problem | Solution |
|---|---|
| Chat bubble never appears | Verify `siteUrl` is correct and MIAW is deployed on that page |
| Login fails | Check `username`/`password` in config; ensure the user has site access |
| Agent never responds | Increase `agentResponseTimeoutMs` (default: 30s); check that the Agentforce agent is active |
| Merge field warnings | Fix the bot's Initial Message config in Salesforce Setup |
| Wrong elements selected | Add custom CSS selectors in the `selectors` config section |

## Author

**Jerry Wang**

## License

MIT
