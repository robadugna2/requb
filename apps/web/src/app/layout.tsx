import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/layout/LanguageContext';
import { ThemeProvider } from '@/components/layout/ThemeContext';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

// Applies the saved theme before first paint to avoid a flash of the wrong theme
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('equb_theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: 'Equb Platform - Admin Dashboard',
  description: 'Digital Equb Management Platform - Admin Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${outfit.variable} font-sans h-full`}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

