import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SoundProvider } from "@/context/SoundContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastContainer } from "@/components/ToastContainer";
import "./globals.css";

// Runs before React hydrates so the correct theme class is already on <html>
// when the page first paints — without this, the page would flash light
// mode for a moment even when the user has dark mode selected.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('sn_theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

const SITE_URL = 'https://servenep.com';
const SITE_TITLE = 'ServeNep | Verified Home Services in Kathmandu, Lalitpur & Bhaktapur';
const SITE_DESCRIPTION =
  "Book verified plumbers, electricians, AC & appliance repair, deep cleaning, and pest control in Kathmandu, Lalitpur, and Bhaktapur. Upfront pricing, background-checked pros, 7-day service warranty.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Pages that set their own title (e.g. "Book a Service | ServeNep")
    // render through this template instead of replacing it outright.
    template: '%s | ServeNep',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'home services Nepal',
    'plumber Kathmandu',
    'electrician Kathmandu',
    'electrician Lalitpur',
    'AC repair Kathmandu',
    'appliance repair Nepal',
    'home cleaning Lalitpur',
    'pest control Bhaktapur',
    'book technician online Nepal',
    'on-demand home services Kathmandu valley',
  ],
  authors: [{ name: 'ServeNep' }],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'ServeNep',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B3C5D',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': 'https://servenep.com/#business',
    name: 'ServeNep',
    url: 'https://servenep.com',
    description: 'Nepal\'s leading on-demand home services marketplace. Book verified plumbers, electricians, cleaners, and technicians in Kathmandu Valley.',
    priceRange: 'Rs. 300 - Rs. 5000',
    areaServed: [
      { '@type': 'City', name: 'Kathmandu' },
      { '@type': 'City', name: 'Lalitpur' },
      { '@type': 'City', name: 'Bhaktapur' },
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kathmandu',
      addressRegion: 'Bagmati',
      addressCountry: 'NP',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 27.7172,
      longitude: 85.3240,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Nepali', 'English'],
    },
    sameAs: [
      'https://servenep.com',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Home Services',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Plumbing & Leak Repairs', areaServed: 'Kathmandu Valley' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Electrical & Wiring', areaServed: 'Kathmandu Valley' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'AC & Appliance Repair', areaServed: 'Kathmandu Valley' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Deep Home Cleaning', areaServed: 'Kathmandu Valley' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pest Control', areaServed: 'Kathmandu Valley' } },
      ],
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <SoundProvider>
            <ToastProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
              <ToastContainer />
            </ToastProvider>
          </SoundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
