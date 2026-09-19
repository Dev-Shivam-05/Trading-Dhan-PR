/**
 * P17 - check the phone notification channels without waiting for 09:20.
 *
 *   npm run notify:test              send one test message to every configured channel
 *   npm run notify:test -- --chat-id print the chat id(s) that have messaged your Telegram bot
 *
 * Telegram setup, once: open @BotFather in Telegram, send /newbot, put the token it gives you in
 * .env as TELEGRAM_BOT_TOKEN, send any message to your new bot, then run `--chat-id` and put the
 * number it prints in .env as TELEGRAM_CHAT_ID.
 */

import { notify, channelsConfigured } from '../src/server/notify.ts';

async function main() {
  if (process.argv.includes('--chat-id')) {
    const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
    if (!/^\d+:[\w-]+$/.test(token)) { console.log('Put TELEGRAM_BOT_TOKEN=<token from @BotFather> in .env first.'); process.exitCode = 1; return; }
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const j = await res.json() as { ok: boolean; result?: { message?: { chat: { id: number; first_name?: string; username?: string } } }[]; description?: string };
    if (!j.ok) { console.log(`Telegram said: ${j.description}`); process.exitCode = 1; return; }
    const chats = new Map<number, string>();
    for (const u of j.result ?? []) if (u.message) chats.set(u.message.chat.id, u.message.chat.username ?? u.message.chat.first_name ?? '');
    if (!chats.size) { console.log('No messages yet. Send any message to your bot in Telegram, then run this again.'); process.exitCode = 1; return; }
    for (const [id, name] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (${name})`);
    return;
  }
  const ch = channelsConfigured();
  if (!ch.length) { console.log('No channel configured. Set NTFY_TOPIC and/or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env.'); process.exitCode = 1; return; }
  const at = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const out = await notify('Dhan terminal - test', `If you can read this, the 09:20 scan can reach you.\nSent ${at} IST`);
  for (const o of out) console.log(`${o.channel}: ${o.ok ? 'sent' : 'FAILED ' + o.detail}`);
  process.exitCode = out.every(o => o.ok) ? 0 : 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
