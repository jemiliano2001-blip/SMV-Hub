import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SesionProvider } from "@/lib/auth";
import { AppCheckProvider } from "@/components/AppCheckProvider";
import NavBar from "@/app/NavBar";
import { Toaster } from "@/components/ui/sonner";
import { WebVitals } from "@/app/_components/WebVitals";
import { ConfirmDialogProvider } from "@/components/ConfirmDialogProvider";

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SMV Hub",
  description: "Plataforma interna de SMV Maquinados — compras, diseño y operación del taller",
  applicationName: "SMV Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <WebVitals />
        <AppCheckProvider>
          <SesionProvider>
            <AuthProvider>
              <ConfirmDialogProvider>
                <NavBar />
                {children}
                <Toaster />
              </ConfirmDialogProvider>
            </AuthProvider>
          </SesionProvider>
        </AppCheckProvider>
      </body>
    </html>
  );
}
