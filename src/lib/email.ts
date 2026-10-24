// Transactional email through Brevo's HTTP API (https://developers.brevo.com/reference/sendtransacemail).
//
// Without BREVO_API_KEY (local development) emails are printed to the terminal
// instead, so sign-up codes still work. Reserved test domains (.test, .example,
// .invalid, .localhost) are never sent to Brevo; bounces would hurt the
// sender's reputation.

export type Email = { to: string; toName?: string; subject: string; html: string; text: string };

const RESERVED = /\.(test|example|invalid|localhost)$/i;

function printToTerminal(e: Email, reason: string) {
  console.log(`\n✉  [email not sent: ${reason}]\n   To: ${e.toName ? `${e.toName} <${e.to}>` : e.to}\n   Subject: ${e.subject}\n${e.text.split('\n').map(l => '   ' + l).join('\n')}\n`);
}

export async function sendEmail(e: Email): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME || 'Manikara';

  if (RESERVED.test(e.to.split('@')[1] ?? '')) { printToTerminal(e, 'test address'); return true; }
  if (!apiKey || !fromEmail) {
    if (process.env.NODE_ENV === 'production') {
      console.error('BREVO_API_KEY / MAIL_FROM_EMAIL are not set; cannot send email to', e.to);
      return false;
    }
    printToTerminal(e, 'BREVO_API_KEY not set');
    return true;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: e.to, ...(e.toName ? { name: e.toName } : {}) }],
        subject: e.subject,
        htmlContent: e.html,
        textContent: e.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Brevo rejected email to ${e.to}: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Brevo request failed for ${e.to}:`, err);
    return false;
  }
}

/** Fire-and-forget for notifications that must not slow down or fail the user's action. */
export function sendInBackground(e: Email) {
  void sendEmail(e).catch(err => console.error('email failed', err));
}
