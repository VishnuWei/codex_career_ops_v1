import { loadDotEnv } from '../../friend-utils.mjs';

export function loadEmailConfig() {
  loadDotEnv();
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
  return {
    resendApiKey: RESEND_API_KEY || '',
    resendFromEmail: RESEND_FROM_EMAIL || '',
  };
}

export async function sendResendEmail({ to, subject, text, html }) {
  const { resendApiKey, resendFromEmail } = loadEmailConfig();

  if (!resendApiKey || !resendFromEmail) {
    throw new Error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      ...(html ? { html } : { text }),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }

  return response.json();
}
