import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctionPhase, reserveMet } from '@/lib/bidding-engine';
import { lotLabel, usd } from '@/lib/format';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { signOutEverywhere } from '../auth-actions';
import { setNotifications, setTwoFactor } from './actions';

const EVENT_LABELS: Record<string, string> = {
  SIGN_IN: 'Signed in', SIGN_IN_FAILED: 'Failed sign-in attempt', SIGN_IN_CODE_SENT: 'Sign-in code sent',
  SIGN_IN_RATE_LIMITED: 'Sign-in blocked (too many attempts)', OTP_FAILED: 'Wrong code entered', OTP_LOCKED: 'Code locked after wrong guesses',
  PASSWORD_RESET_REQUESTED: 'Password reset requested', PASSWORD_CHANGED: 'Password changed', SIGN_OUT_ALL: 'Signed out everywhere',
  TWO_FACTOR_ENABLED: 'Two-step sign-in turned on', TWO_FACTOR_DISABLED: 'Two-step sign-in turned off',
  REGISTER: 'Account created', EMAIL_VERIFIED: 'Email verified',
};

/** Short, readable device description from a user-agent string. */
function device(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await requireUser('/account');
  const [proxies, watches, events] = await Promise.all([
    db.autoBid.findMany({
      where: { userId: user.id },
      include: { auction: { include: { gem: { select: { name: true } } } } },
      orderBy: { auction: { endsAt: 'asc' } },
    }),
    db.watch.findMany({
      where: { userId: user.id },
      include: { auction: { include: { gem: { select: { name: true } } } } },
      orderBy: { auction: { endsAt: 'asc' } },
    }),
    db.securityEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const active = proxies.filter(p => auctionPhase(p.auction) !== 'ended');
  const won = proxies.filter(p => auctionPhase(p.auction) === 'ended' && p.auction.leaderId === user.id && reserveMet(p.auction));
  const [first, ...rest] = user.name.split(' ');

  return (
    <section className="page light">
      <div className="page-head">
        <span className="eyebrow">( Your account · {user.email} )</span>
        <h1 className="display">{first}{rest.length > 0 && <> <em>{rest.join(' ')}</em></>}</h1>
      </div>

      <div className="block">
        <h2>Active <em>bids</em></h2>
        {active.length === 0 ? <p className="empty">No bids on open lots. <Link href="/#lots" className="text-link">Browse lots →</Link></p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Current</th><th>Your maximum</th><th>Status</th></tr></thead>
            <tbody>
              {active.map(p => (
                <tr key={p.id}>
                  <td className="serif-cell"><Link href={`/lots/${p.auction.lotNumber}`}>{p.auction.gem.name}</Link> <span className="small muted">{lotLabel(p.auction.lotNumber)}</span></td>
                  <td>{usd(p.auction.currentPrice)}</td>
                  <td>{usd(p.maxAmount)}</td>
                  <td>{p.auction.leaderId === user.id ? <span className="chip ok">Leading</span> : <span className="chip bad">Outbid</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <h2>Won</h2>
        {won.length === 0 ? <p className="empty">Nothing yet.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Hammer price</th><th>Closed</th></tr></thead>
            <tbody>
              {won.map(p => (
                <tr key={p.id}>
                  <td className="serif-cell"><Link href={`/lots/${p.auction.lotNumber}`}>{p.auction.gem.name}</Link> <span className="small muted">{lotLabel(p.auction.lotNumber)}</span></td>
                  <td>{usd(p.auction.currentPrice)}</td>
                  <td>{p.auction.endsAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <h2>Watching</h2>
        {watches.length === 0 ? <p className="empty">Use “Watch lot” on any lot page to follow it here.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Current</th><th>Status</th></tr></thead>
            <tbody>
              {watches.map(w => {
                const phase = auctionPhase(w.auction);
                return (
                  <tr key={w.auctionId}>
                    <td className="serif-cell"><Link href={`/lots/${w.auction.lotNumber}`}>{w.auction.gem.name}</Link> <span className="small muted">{lotLabel(w.auction.lotNumber)}</span></td>
                    <td>{w.auction.bidCount ? usd(w.auction.currentPrice) : '—'}</td>
                    <td><span className={`chip ${phase}`}>{phase === 'live' ? 'Bidding open' : phase === 'upcoming' ? 'Preview' : 'Closed'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="block">
        <h2>Settings <em>&amp; security</em></h2>
        <table className="table">
          <tbody>
            <tr>
              <td className="serif-cell">Bid emails</td>
              <td className="small muted">Receipts when you bid, a warning when you are outbid, and the result when a lot closes. Win notices are always sent.</td>
              <td style={{ textAlign: 'right' }}>
                <form action={setNotifications.bind(null, !user.notifyBids)}>
                  <button className="u watch">{user.notifyBids ? 'On · turn off' : 'Off · turn on'}</button>
                </form>
              </td>
            </tr>
            <tr>
              <td className="serif-cell">Two-step sign-in</td>
              <td className="small muted">After your password, we email a six-digit code to confirm it is you.{user.role === 'ADMIN' && ' Always on for admin accounts.'}</td>
              <td style={{ textAlign: 'right' }}>
                {user.role === 'ADMIN' ? <span className="chip ok">Required</span> : (
                  <form action={setTwoFactor.bind(null, !user.twoFactorEnabled)}>
                    <button className="u watch">{user.twoFactorEnabled ? 'On · turn off' : 'Off · turn on'}</button>
                  </form>
                )}
              </td>
            </tr>
            <tr>
              <td className="serif-cell">Other devices</td>
              <td className="small muted">Lost a phone or used a shared computer? Sign out of every device at once, including this one.</td>
              <td style={{ textAlign: 'right' }}>
                <form action={signOutEverywhere}><button className="u watch danger">Sign out everywhere</button></form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="block">
        <h2>Change <em>password</em></h2>
        <ChangePasswordForm />
      </div>

      <div className="block">
        <h2>Recent <em>activity</em></h2>
        <p className="small muted" style={{ marginBottom: 20 }}>If you see something you don&apos;t recognise, change your password and sign out everywhere.</p>
        <table className="table">
          <thead><tr><th>Event</th><th>Device</th><th>IP</th><th>When</th></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td>{['SIGN_IN_FAILED', 'OTP_FAILED', 'OTP_LOCKED', 'SIGN_IN_RATE_LIMITED'].includes(e.type)
                  ? <span className="chip bad">{EVENT_LABELS[e.type] ?? e.type}</span>
                  : <span className="chip ok">{EVENT_LABELS[e.type] ?? e.type}</span>}</td>
                <td className="small">{device(e.userAgent)}</td>
                <td className="small mono">{e.ip ?? '—'}</td>
                <td className="small muted">{e.createdAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
