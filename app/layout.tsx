import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { SesionProvider } from "@/lib/auth";
import { AppCheckProvider } from "@/components/AppCheckProvider";
import NavBar from "@/app/NavBar";
import BottomNavBar from "@/components/layout/BottomNavBar";
import { Toaster } from "@/components/ui/sonner";
import { WebVitals } from "@/app/_components/WebVitals";
import { ConfirmDialogProvider } from "@/components/ConfirmDialogProvider";
import { FilePreviewProvider } from "@/components/FilePreviewProvider";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el pinch-zoom viola WCAG 1.4.4 (axe: "meta-viewport") —
  // es la causa de que e2e/login-accessibility.spec.ts venga fallando en CI.
  viewportFit: "cover",
  themeColor: "#061936",
};

export const metadata: Metadata = {
  title: "SMV Hub",
  description: "Plataforma interna de SMV Maquinados — compras, diseño y operación del taller",
  applicationName: "SMV Hub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SMV Hub",
  },
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
                <FilePreviewProvider>
                  <NavBar />
                  {children}
                  <BottomNavBar />
                  <Toaster />
                </FilePreviewProvider>
              </ConfirmDialogProvider>
            </AuthProvider>
          </SesionProvider>
        </AppCheckProvider>
      </body>
    </html>
  );
}
