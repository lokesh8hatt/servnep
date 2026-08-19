import type { Metadata } from 'next';

// Private, behind-login pages with no content value to searchers — keeping
// these out of the index avoids diluting the site's overall quality signal.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
