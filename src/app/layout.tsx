import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ConvexUserBootstrap } from "@/components/ConvexUserBootstrap";
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
      className={`${inter.variable} ${plexMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <ClerkProvider>
          <ConvexClientProvider>
            <ConvexUserBootstrap />
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
