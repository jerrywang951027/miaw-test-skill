import { chromium } from '@playwright/test';
import * as path from 'path';
const config = require(path.resolve(process.cwd(), 'miaw-test-config.json'));

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const page = await browser.newPage({ viewport: null }); // null viewport = use full window size

  // Login
  if (config.auth.required) {
    const loginUrl = config.environment.siteUrl.replace(/\/s\/$/, '/s/login/');
    console.log(`Logging in at ${loginUrl}...`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[placeholder*="Username" i], input[type="text"]').first().fill(config.auth.username);
    await page.locator('input[type="password"]').first().fill(config.auth.password);
    await page.locator('button:has-text("Log")').first().click();
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 }).catch(() => {});
    // Don't use networkidle — Salesforce pages have continuous background requests
    // that prevent it from resolving. The bubble waitFor below is the real gate.
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    console.log('Logged in.');
  }

  // Navigate to site (only if not already on the exact site home)
  const currentUrl = page.url();
  const onSiteHome = currentUrl.replace(/\/$/, '') === config.environment.siteUrl.replace(/\/$/, '');
  if (!onSiteHome) {
    console.log(`Navigating to ${config.environment.siteUrl}...`);
    await page.goto(config.environment.siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  } else {
    console.log(`Already on site: ${currentUrl}`);
  }
  // Click chat bubble (waitFor handles the timing — no fixed delay needed)
  console.log('Looking for chat bubble...');
  const bubble = page.locator('[class*="embeddedMessaging"] button').first();
  await bubble.waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'miaw-01-bubble.png', fullPage: true });
  console.log('Clicking chat bubble...');
  await bubble.click();

  // Wait for greeting in iframe
  // The "joined" notification appears first, then the actual greeting message follows.
  // We need to wait until there's content AFTER the "joined" line.
  console.log('Waiting for agent greeting...');
  const chatFrame = page.frameLocator('#embeddedMessagingFrame');
  let bodyText = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1500);
    bodyText = await chatFrame.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    // Check that we have the "joined" notification AND at least one message after it
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
    const joinedIdx = lines.findIndex(l => l.includes('joined'));
    if (joinedIdx >= 0) {
      // Look for actual message content after "joined" (not just UI elements)
      const afterJoined = lines.slice(joinedIdx + 1).filter(
        l => !l.includes('Attach file') && !l.includes('Type your message') &&
             !l.includes('New participant') && !l.match(/^DS$/)
      );
      if (afterJoined.some(l => l.length > 10 && !l.match(/•\s*\d+:\d+/))) {
        break;
      }
    }
    if (i % 5 === 4) console.log(`  Still waiting... (${(i + 1) * 1.5}s)`);
  }

  await page.screenshot({ path: 'miaw-02-chat-open.png', fullPage: true });

  // Extract the greeting
  console.log('\n========================================');
  console.log('FULL CHAT PANEL TEXT:');
  console.log('========================================');
  console.log(bodyText);
  console.log('========================================\n');

  // Parse out just the agent message (lines after "joined" and before the agent name repeat)
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
  const joinedIdx = lines.findIndex(l => l.includes('joined'));
  if (joinedIdx >= 0 && joinedIdx + 1 < lines.length) {
    // The greeting is typically the text between "joined" line and the next agent name/timestamp
    const greetingLines: string[] = [];
    for (let i = joinedIdx + 1; i < lines.length; i++) {
      // Stop at lines that look like timestamps or "Type your message" or agent name labels
      if (lines[i].includes('Type your message') || lines[i].includes('Attach file')) break;
      if (lines[i].includes('New participant')) break;
      // Stop at agent name + timestamp pattern (e.g., "dummy service agent • 10:16 PM")
      if (lines[i].match(/•\s*\d+:\d+/)) break;
      // Skip avatar initials (1-3 uppercase letters alone on a line)
      if (lines[i].match(/^[A-Z]{1,3}$/)) continue;
      greetingLines.push(lines[i]);
    }
    const greeting = greetingLines.join(' ');

    console.log('AGENT GREETING:');
    console.log(`"${greeting}"`);
    console.log('');

    // Check for unresolved merge fields
    const unresolved = greeting.match(/\{!\$[^}]+\}/g);
    if (unresolved) {
      console.log('WARNING: Unresolved merge field variables found:');
      unresolved.forEach(v => console.log(`  - ${v}`));
      console.log('These should be resolved by Salesforce. Check the agent greeting template in Setup.');
    } else {
      console.log('No unresolved merge fields. Greeting looks clean.');
    }
  }

  await page.screenshot({ path: 'miaw-03-greeting.png', fullPage: true });

  // End the chat session to avoid stale sessions on Salesforce side
  console.log('Ending chat session...');
  try {
    // Click the menu button (three dots) in the chat header
    const menuBtn = chatFrame.locator('button:has-text("Open the chat menu"), button[aria-label*="menu" i]').first();
    await menuBtn.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    // Click "End chat"
    const endChatBtn = chatFrame.locator('button:has-text("End chat"), [class*="endChat"]').first();
    await endChatBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    // Confirm if there's a confirmation dialog
    const confirmBtn = chatFrame.locator('button:has-text("End chat")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    console.log('Chat ended.');
    await page.waitForTimeout(1000);
    // Close the chat window — X button is inside the iframe header
    // Try multiple selectors for the close/X button
    const closeSelectors = [
      'button:has-text("Close chat window")',
      'button[aria-label*="Close chat" i]',
      'button[aria-label*="close" i]',
      'button[title*="Close" i]',
    ];
    let closed = false;
    for (const sel of closeSelectors) {
      // Try iframe first
      const btn = chatFrame.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        console.log(`Chat window closed (iframe: ${sel}).`);
        closed = true;
        break;
      }
      // Try main page
      const mainBtn = page.locator(sel).first();
      if (await mainBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await mainBtn.click();
        console.log(`Chat window closed (main: ${sel}).`);
        closed = true;
        break;
      }
    }
    if (!closed) {
      // Last resort: find any X-looking button near the chat header
      const xBtn = chatFrame.locator('button').filter({ hasText: /^[×✕Xx]$/ }).first();
      if (await xBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await xBtn.click();
        console.log('Chat window closed (X button).');
      } else {
        console.log('Could not find close button.');
      }
    }
  } catch (e: any) {
    console.log(`Could not end chat cleanly: ${e.message.substring(0, 80)}`);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'miaw-04-ended.png', fullPage: true });
  console.log('\nScreenshots saved: miaw-01-bubble.png, miaw-02-chat-open.png, miaw-03-greeting.png, miaw-04-ended.png');

  await browser.close();
})();
