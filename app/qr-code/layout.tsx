import type { Metadata } from "next";

// Utility page for printed materials — kept reachable but out of the index.
export const metadata: Metadata = {
  title: "QR code — Harvey Houlahan",
  robots: { index: false, follow: false },
};

export default function QRCodeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
