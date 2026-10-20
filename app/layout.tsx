import type { ReactNode } from "react";

export const metadata = { title: "nanocode on durable-harness", description: "nanocode agents made durable on a Vercel Workflow World" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#0a0a0a", color: "#ededed" }}>{children}</body>
    </html>
  );
}
