import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ConvexUserBootstrap } from "@/components/ConvexUserBootstrap";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_COLORS, themeBootScript } from "@/lib/theme";
import "./globals.css";

/**
 * The design's three faces, loaded once and exposed as the CSS variables the
 * token sheet maps to `font-sans`, `font-serif` and `font-mono`.
 *
 * Fraunces is the display serif; Inter is the interface face; IBM Plex Mono
 * carries eyebrows, counters and small labels. The design document uses the
 * same three, so the exported component classes line up without a rewrite.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "LendLoop",
  description: "Lend and borrow tools within a trusted circle.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The boot script below edits the class on this element before hydration.
      suppressHydrationWarning
      className={`${inter.variable} ${plexMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/*
          Browser chrome follows the resolved theme, not just the OS media
          query: the boot script below sets this to the dark ground when the
          stored choice wins. See src/lib/theme.ts for the full behaviour.
        */}
        <meta name="theme-color" content={THEME_COLORS.light} />
        {/*
          Sets `.dark` from localStorage / the OS before the body paints. The
          palette itself lives in globals.css; this only chooses which block
          applies.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <ClerkProvider>
            <ConvexClientProvider>
              <ConvexUserBootstrap />
              {children}
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
