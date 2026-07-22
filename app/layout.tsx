import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppCheckProvider } from "@/components/AppCheckProvider";
import NavBar from "@/app/NavBar";
import { Toaster } from "@/components/ui/sonner";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AppCheckProvider>
          <AuthProvider>
            <NavBar />
            {children}
            <Toaster />
          </AuthProvider>
        </AppCheckProvider>
      </body>
    </html>
  );
}
