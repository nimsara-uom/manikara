import { publicKeyPem } from '@/lib/gemkey';

export function GET() {
  return new Response(publicKeyPem(), {
    headers: { 'Content-Type': 'application/x-pem-file', 'Cache-Control': 'public, max-age=3600' },
  });
}
