import type { Metadata } from 'next';

// Purely functional gateway-redirect landing pages — no content for search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
