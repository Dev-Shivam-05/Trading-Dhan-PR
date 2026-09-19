/**
 * P17 - push a short message to the user's phone. Two channels, each used only when configured:
 *
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID   a bot the user made with @BotFather
 *   NTFY_TOPIC                              https://ntfy.sh/<topic>, no account needed; the topic
 *                                           name is the only secret, so it is long and random
 *
 * A failed send never fails the caller: the scan's result is already on disk and in scan-logs, a
 * notification is a convenience on top. Every outcome is returned so the caller can print it.
 */

export type NotifyOutcome = { channel: 'telegram' | 'ntfy'; ok: boolean; detail: string };

export function channelsConfigured(): string[] {
  const out: string[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim()) out.push('telegram');
  if (process.env.NTFY_TOPIC?.trim()) out.push('ntfy');
  return out;
}

async function telegram(title: string, body: string): Promise<NotifyOutcome> {
  const token = process.env.TELEGRAM_BOT_TOKEN!.trim();
  const chat = process.env.TELEGRAM_CHAT_ID!.trim();
  // Validated because the token is interpolated into a URL path.
  if (!/^\d+:[\w-]+$/.test(token)) return { channel: 'telegram', ok: false, detail: 'TELEGRAM_BOT_TOKEN is not <digits>:<key>' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Plain text, no parse_mode: a symbol like M&M or an underscore would break Markdown parsing.
      body: JSON.stringify({ chat_id: chat, text: `${title}\n\n${body}`, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await res.json().catch(() => ({})) as { ok?: boolean; description?: string };
    return { channel: 'telegram', ok: res.ok && j.ok === true, detail: j.ok ? 'sent' : `HTTP ${res.status} ${j.description ?? ''}`.trim() };
  } catch (err) {
    return { channel: 'telegram', ok: false, detail: (err as Error).message };
  }
}

async function ntfy(title: string, body: string, priority: 'default' | 'high'): Promise<NotifyOutcome> {
  const topic = process.env.NTFY_TOPIC!.trim();
  if (!/^[\w-]{12,64}$/.test(topic)) return { channel: 'ntfy', ok: false, detail: 'NTFY_TOPIC must be 12-64 letters, digits, - or _' };
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      // Header values must be Latin-1; the title is kept to ASCII for that reason.
      headers: { Title: title.replace(/[^\x20-\x7e]/g, '-'), Priority: priority, Tags: 'chart_with_upwards_trend' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { channel: 'ntfy', ok: res.ok, detail: res.ok ? 'sent' : `HTTP ${res.status}` };
  } catch (err) {
    return { channel: 'ntfy', ok: false, detail: (err as Error).message };
  }
}

export async function notify(title: string, body: string, opts: { urgent?: boolean } = {}): Promise<NotifyOutcome[]> {
  const jobs: Promise<NotifyOutcome>[] = [];
  const ch = channelsConfigured();
  if (ch.includes('telegram')) jobs.push(telegram(title, body));
  if (ch.includes('ntfy')) jobs.push(ntfy(title, body, opts.urgent ? 'high' : 'default'));
  return Promise.all(jobs);
}
