import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FlowingBackground from "@/components/FlowingBackground";

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Harvey J. Houlahan | AI/ML Engineer",
  description: "Australian engineer building ML systems, supply-chain transparency tools, and applied AI for products across fashion, energy, and healthcare. Based in NYC.",
  keywords: ["AI Engineer", "Machine Learning", "NLP", "iOS Development", "Full Stack"],
  authors: [{ name: "Harvey J. Houlahan" }],
  openGraph: {
    title: "Harvey J. Houlahan | AI/ML Engineer",
    description: "AI/ML Engineer • Applied NLP • Data Systems • iOS • Sustainable Tech",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <div className="min-h-screen flex flex-col relative bg-black">
          <FlowingBackground variant="subtle" />
          <Navbar />
          <main className="flex-grow relative z-10">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
