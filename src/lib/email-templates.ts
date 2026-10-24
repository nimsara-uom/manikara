// Branded transactional emails. Inline styles only: most mail clients ignore <style> blocks.
import type { Email } from './email';
import { appUrl } from './qr';

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const lot = (n: number) => 'Lot ' + String(n).padStart(3, '0');

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Wraps body HTML in the ivory-and-ink letterhead. */
function layout(opts: { eyebrow: string; title: string; body: string; cta?: { label: string; href: string }; footnote?: string }): string {
  const { eyebrow, title, body, cta, footnote } = opts;
  return `<!doctype html><html><body style="margin:0;background:#f2ede4;padding:40px 16px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f0e0d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f7f3eb;border:1px solid #b8976a">
<tr><td style="padding:44px 44px 12px;font-family:Georgia,serif;font-size:18px;letter-spacing:8px;color:#0f0e0d">MANIKARA</td></tr>
<tr><td style="padding:24px 44px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7a736a">( ${esc(eyebrow)} )</td></tr>
<tr><td style="padding:14px 44px 0;font-family:Georgia,serif;font-size:34px;line-height:1.1;font-weight:normal;color:#0f0e0d">${title}</td></tr>
<tr><td style="padding:22px 44px 0;font-size:15px;line-height:1.7;color:#3a3631">${body}</td></tr>
${cta ? `<tr><td style="padding:30px 44px 0"><a href="${esc(cta.href)}" style="display:inline-block;border-top:1px solid #0f0e0d;border-bottom:1px solid #0f0e0d;padding:14px 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#0f0e0d;text-decoration:none">${esc(cta.label)} &rarr;</a></td></tr>` : ''}
<tr><td style="padding:40px 44px 40px;font-size:12px;line-height:1.7;color:#7a736a">${footnote ?? ''}</td></tr>
</table>
<p style="font-size:11px;color:#7a736a;letter-spacing:1px;margin-top:18px">Manikara · Fine gemstone auctions · Ratnapura · Colombo · London</p>
</td></tr></table></body></html>`;
}

const PREFS = 'You receive bid emails because notifications are on in your account. You can turn them off on your account page.';

export function otpEmail(to: string, name: string, code: string, purpose: 'VERIFY_EMAIL' | 'SIGN_IN' | 'RESET_PASSWORD', ttlMin: number): Email {
  const copy = {
    VERIFY_EMAIL: { subject: 'Your Manikara verification code', eyebrow: 'Verify your email', lead: 'Welcome to Manikara. Enter this code to confirm your email address and finish creating your account.' },
    SIGN_IN: { subject: 'Your Manikara sign-in code', eyebrow: 'Sign-in code', lead: 'Someone (hopefully you) entered your password. Enter this code to finish signing in.' },
    RESET_PASSWORD: { subject: 'Reset your Manikara password', eyebrow: 'Password reset', lead: 'Enter this code to choose a new password.' },
  }[purpose];
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    to, toName: name, subject: copy.subject,
    html: layout({
      eyebrow: copy.eyebrow,
      title: `Hello ${esc(name.split(' ')[0])},`,
      body: `${copy.lead}<div style="margin:28px 0 6px;font-family:Georgia,serif;font-size:44px;letter-spacing:10px;color:#0f0e0d">${spaced}</div><div style="font-size:12px;color:#7a736a">Expires in ${ttlMin} minutes.</div>`,
      footnote: 'Never share this code. Manikara staff will never ask for it. If you did not request it, you can ignore this email; ' +
        (purpose === 'SIGN_IN' ? 'but someone knows your password, so please reset it.' : 'nothing will change.'),
    }),
    text: `${copy.lead}\n\nYour code: ${spaced}\nIt expires in ${ttlMin} minutes.\n\nNever share this code. If you did not request it, ignore this email.`,
  };
}

export function bidPlacedEmail(to: string, name: string, a: { lotNumber: number; gemName: string; price: number; max: number; leading: boolean }): Email {
  const href = `${appUrl()}/lots/${a.lotNumber}`;
  const body = a.leading
    ? `Your maximum of <b>${usd(a.max)}</b> on <b>${esc(a.gemName)}</b> is in. You are the highest bidder at <b>${usd(a.price)}</b>, and we will bid for you up to your maximum.`
    : `Your bid of <b>${usd(a.max)}</b> on <b>${esc(a.gemName)}</b> was recorded, but another collector's maximum is higher. The price is now <b>${usd(a.price)}</b>.`;
  return {
    to, toName: name,
    subject: a.leading ? `You lead on ${lot(a.lotNumber)}: ${a.gemName}` : `Outbid straight away on ${lot(a.lotNumber)}`,
    html: layout({ eyebrow: `${lot(a.lotNumber)} · Bid received`, title: a.leading ? 'You are in the <em style="color:#b8976a">lead.</em>' : 'Not quite <em style="color:#b8976a">enough.</em>', body, cta: { label: 'View the lot', href }, footnote: PREFS }),
    text: `${body.replace(/<[^>]+>/g, '')}\n\n${href}`,
  };
}

export function outbidEmail(to: string, name: string, a: { lotNumber: number; gemName: string; price: number; minimumBid: number; endsAt: Date }): Email {
  const href = `${appUrl()}/lots/${a.lotNumber}`;
  const body = `Another collector has outbid your maximum on <b>${esc(a.gemName)}</b>. The price is now <b>${usd(a.price)}</b>; the next bid starts at <b>${usd(a.minimumBid)}</b>.<br>Bidding closes ${a.endsAt.toUTCString()}.`;
  return {
    to, toName: name, subject: `You've been outbid on ${lot(a.lotNumber)}: ${a.gemName}`,
    html: layout({ eyebrow: `${lot(a.lotNumber)} · Outbid`, title: 'You have been <em style="color:#b8976a">outbid.</em>', body, cta: { label: 'Bid again', href }, footnote: PREFS }),
    text: `${body.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')}\n\nBid again: ${href}`,
  };
}

export function wonEmail(to: string, name: string, a: { lotNumber: number; gemName: string; price: number }): Email {
  const href = `${appUrl()}/lots/${a.lotNumber}`;
  const body = `Congratulations. Bidding has closed and <b>${esc(a.gemName)}</b> is yours at <b>${usd(a.price)}</b>. Our concierge will contact you shortly about payment and insured delivery. The stone's Gem Key travels with it.`;
  return {
    to, toName: name, subject: `You won ${lot(a.lotNumber)}: ${a.gemName}`,
    html: layout({ eyebrow: `${lot(a.lotNumber)} · Won`, title: 'The stone is <em style="color:#b8976a">yours.</em>', body, cta: { label: 'View your lot', href } }),
    text: `${body.replace(/<[^>]+>/g, '')}\n\n${href}`,
  };
}

export function lotClosedEmail(to: string, name: string, a: { lotNumber: number; gemName: string; price: number; sold: boolean }): Email {
  const href = `${appUrl()}/#lots`;
  const body = a.sold
    ? `Bidding on <b>${esc(a.gemName)}</b> has closed. It sold to another collector for <b>${usd(a.price)}</b>. Thank you for bidding.`
    : `Bidding on <b>${esc(a.gemName)}</b> has closed below its reserve, so the stone was not sold.`;
  return {
    to, toName: name, subject: `${lot(a.lotNumber)} has closed`,
    html: layout({ eyebrow: `${lot(a.lotNumber)} · Closed`, title: 'Bidding has <em style="color:#b8976a">closed.</em>', body, cta: { label: 'See current lots', href }, footnote: PREFS }),
    text: `${body.replace(/<[^>]+>/g, '')}\n\n${href}`,
  };
}

export function adminResultEmail(to: string, name: string, a: { lotNumber: number; gemName: string; price: number; sold: boolean; bidCount: number; winnerEmail: string | null }): Email {
  const body = a.sold
    ? `<b>${esc(a.gemName)}</b> sold for <b>${usd(a.price)}</b> after ${a.bidCount} bids. Winner: ${esc(a.winnerEmail ?? 'unknown')}.`
    : `<b>${esc(a.gemName)}</b> closed unsold (${a.bidCount} bids, reserve not met).`;
  return {
    to, toName: name, subject: `[Admin] ${lot(a.lotNumber)} ${a.sold ? `sold for ${usd(a.price)}` : 'closed unsold'}`,
    html: layout({ eyebrow: `${lot(a.lotNumber)} · Result`, title: a.sold ? 'Lot <em style="color:#b8976a">sold.</em>' : 'Lot <em style="color:#b8976a">unsold.</em>', body, cta: { label: 'Open admin', href: `${appUrl()}/admin` } }),
    text: body.replace(/<[^>]+>/g, ''),
  };
}

export function passwordChangedEmail(to: string, name: string): Email {
  const body = 'Your Manikara password was just changed, and every other device was signed out. If this was not you, reset your password immediately and contact us.';
  return {
    to, toName: name, subject: 'Your Manikara password was changed',
    html: layout({ eyebrow: 'Security', title: 'Password <em style="color:#b8976a">changed.</em>', body, cta: { label: 'Reset password', href: `${appUrl()}/forgot` } }),
    text: `${body}\n\n${appUrl()}/forgot`,
  };
}
