import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Plus Jakarta Sans содержит только латиницу — кириллица красиво уходит
// в системный шрифт из CSS-стека (см. tailwind fontFamily / globals.css).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GSM Developer SRL — услуги 1С: внедрение, доработка, поддержка",
  description:
    "Внедрение, доработка, поддержка и интеграции 1С. Заявки на доработку в личном кабинете — с вложениями и понятным статусом.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
