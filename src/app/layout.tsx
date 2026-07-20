import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Business Tracker",
  description: "Shopify + Meta ads business tracking dashboard (PKR)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 lg:ml-64">
            <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
