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

export const metadata: Metadata = {
  title: "ServeNep | On-Demand Home Services Platform in Nepal",
  description: "Book verified plumbers, electricians, cleaners, and technicians in Kathmandu, Lalitpur, and Bhaktapur. 100% transparent pricing and satisfaction guarantee.",
  keywords: "plumber Kathmandu, electrician Kathmandu, home cleaning Lalitpur, appliance repair Nepal, AC repair Bhaktapur, home services Nepal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'ServeNep',
    url: 'https://servenep.com',
    description: 'Nepal\'s leading on-demand home services marketplace. Book verified plumbers, electricians, cleaners, and technicians in Kathmandu Valley.',
    areaServed: ['Kathmandu', 'Lalitpur', 'Bhaktapur'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Kathmandu',
      addressCountry: 'NP',
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
        { '@type': 'Offer', name: 'Plumbing & Leak Repairs' },
        { '@type': 'Offer', name: 'Electrical & Wiring' },
        { '@type': 'Offer', name: 'AC & Appliance Repair' },
        { '@type': 'Offer', name: 'Deep Home Cleaning' },
        { '@type': 'Offer', name: 'Pest Control' },
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
