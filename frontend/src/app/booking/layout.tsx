import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Plumber, Electrician or Home Service Online',
  description:
    'Book verified plumbers, electricians, AC & appliance repair, cleaning, or pest control in Kathmandu, Lalitpur, or Bhaktapur. See upfront pricing and confirm in minutes.',
  alternates: { canonical: '/booking' },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
