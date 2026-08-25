import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Common Record — Portable Model-Free Wiki",
  description: "Import any source as a provenance-bearing witness and project it as a public wiki without an LLM.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
