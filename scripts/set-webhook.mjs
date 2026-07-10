// /**
//  * Registers the Telegram webhook URL with Telegram's API.
//  * Runs as part of the Vercel build (vercel-build script in package.json)
//  * so the webhook is always registered before any Lambda invocation.
//  *
//  * Exits 0 on failure so a network hiccup doesn't break the whole deployment.
//  */

// const token = process.env.BOT_TOKEN;
// const domain = process.env.WEBHOOK_DOMAIN;
// const path = process.env.WEBHOOK_PATH ?? '/webhook';

// if (!token || !domain) {
//   console.warn('[set-webhook] BOT_TOKEN or WEBHOOK_DOMAIN not set — skipping registration');
//   process.exit(0);
// }

// const webhookUrl = `${domain}${path}`;
// console.log(`[set-webhook] Registering webhook: ${webhookUrl}`);

// try {
//   const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
//   });
//   const json = await res.json();
//   if (json.ok) {
//     console.log('[set-webhook] Webhook registered successfully');
//   } else {
//     console.error(`[set-webhook] Telegram rejected webhook: ${json.description}`);
//   }
// } catch (err) {
//   console.error('[set-webhook] Network error (non-fatal):', err.message);
// }

/**
 * Registers the Telegram webhook URL with Telegram's API.
 * Runs during the Vercel build.
 */

console.log('[set-webhook] ===== Script started =====');

const token = process.env.BOT_TOKEN;
const domain = process.env.WEBHOOK_DOMAIN;
const path = process.env.WEBHOOK_PATH ?? '/webhook';

console.log('[set-webhook] BOT_TOKEN:', token ? 'SET' : 'NOT SET');
console.log('[set-webhook] WEBHOOK_DOMAIN:', domain ?? 'NOT SET');
console.log('[set-webhook] WEBHOOK_PATH:', path);

if (!token || !domain) {
  console.error(
    '[set-webhook] BOT_TOKEN or WEBHOOK_DOMAIN missing. Skipping webhook registration.',
  );
  console.log('[set-webhook] ===== Script finished =====');
  process.exit(0);
}

const webhookUrl = `${domain}${path}`;

console.log(`[set-webhook] Registering webhook: ${webhookUrl}`);

try {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      drop_pending_updates: true,
    }),
  });

  console.log('[set-webhook] HTTP status:', res.status);

  const json = await res.json();

  console.log('[set-webhook] Telegram response:', json);

  if (json.ok) {
    console.log('[set-webhook] ✅ Webhook registered successfully');
  } else {
    console.error(
      `[set-webhook] ❌ Telegram rejected webhook: ${json.description}`,
    );
  }
} catch (err) {
  console.error('[set-webhook] ❌ Network error:', err);
}

console.log('[set-webhook] ===== Script finished =====');
