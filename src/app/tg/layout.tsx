import Script from "next/script";

export const metadata = {
  title: "GSM Developer — заявки",
};

export default function TgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* SDK Telegram Mini Apps — должен загрузиться до логики приложения */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
