import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { GemForm } from '@/components/admin/GemForm';

export const metadata = { title: 'Add a stone' };

export default async function NewGemPage() {
  await requireAdmin();
  return (
    <section className="page light">
      <Link href="/admin" className="back">← All stones</Link>
      <div className="page-head">
        <span className="eyebrow">( Curator · New stone )</span>
        <h1 className="display">Add a <em>stone.</em></h1>
        <p>Saving issues the stone&apos;s Gem Key straight away, signed over every fact and photograph below.</p>
      </div>
      <GemForm />
    </section>
  );
}
