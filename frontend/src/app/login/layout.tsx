import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login or Sign Up',
  description: 'Log in or create a free ServeNep account to book verified home service professionals in Kathmandu, Lalitpur, and Bhaktapur.',
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
