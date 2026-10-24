import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { Effects } from '@/components/Effects';
import { signOut } from './auth-actions';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Manikara — Fine Gemstone Auctions', template: '%s · Manikara' },
  description: 'Rare coloured gemstones, independently certified, signed with a unique Gem Key and sold at open auction.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Lets CSS hide reveal-on-scroll content only when JS is running to reveal it */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Effects />
        <nav className="nav">
          <Link href="/" className="wordmark">MANIKARA</Link>
          <div className="links">
            <Link className="u" href="/#lots">Auctions</Link>
            <Link className="u" href="/verify">Gem Key</Link>
            <Link className="u" href="/#house">The House</Link>
            <Link className="u" href="/#faq">Enquiries</Link>
          </div>
          <div className="nav-r">
            {user ? (
              <>
                {user.role === 'ADMIN' && <Link className="u" href="/admin">Admin</Link>}
                <Link className="u" href="/account">{user.name.split(' ')[0]}</Link>
                <form action={signOut}><button className="u">Sign out</button></form>
              </>
            ) : (
              <>
                <Link className="u" href="/login">Sign in</Link>
                <Link className="u" href="/#lots">Bid now</Link>
              </>
            )}
          </div>
        </nav>
        <main>{children}</main>
        <footer className="site-footer">
          <div><span className="wordmark">MANIKARA</span>Fine gemstone auctions.<br />Ratnapura · Colombo · London</div>
          <div>
            <h6>Auctions</h6>
            <ul><li><Link href="/#lots">Current lots</Link></li><li><Link href="/account">My bids</Link></li></ul>
          </div>
          <div>
            <h6>House</h6>
            <ul><li><Link href="/#house">About</Link></li><li><Link href="/verify">Verify a Gem Key</Link></li><li><Link href="/#faq">Enquiries</Link></li></ul>
          </div>
          <div>
            <h6>Contact</h6>
            concierge@manikara.lk<br />+94 11 000 0000
          </div>
          <div className="legal"><span>© {new Date().getFullYear()} Manikara</span><span>Ed25519-signed Gem Keys</span></div>
        </footer>
      </body>
    </html>
  );
}
