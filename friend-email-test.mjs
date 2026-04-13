#!/usr/bin/env node

import { extractEmail } from './friend-utils.mjs';
import { loadEmailConfig, sendResendEmail } from './lib/friend/email.mjs';

const { resendApiKey, resendFromEmail } = loadEmailConfig();
const to = extractEmail();

if (!resendApiKey || !resendFromEmail) {
  console.error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL.');
  process.exit(1);
}

if (!to) {
  console.error('Could not determine recipient email from profile or cv.md.');
  process.exit(1);
}

const json = await sendResendEmail({
  to,
  subject: 'Career Ops test email',
  html: '<p>Career Ops email delivery is configured correctly.</p>',
});
console.log(`Test email sent to ${to}`);
console.log(JSON.stringify(json, null, 2));
