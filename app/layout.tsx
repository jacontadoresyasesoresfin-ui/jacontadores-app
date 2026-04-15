import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "J&A Contadores - Asesores | Portal de Gestión",
  description: "Portal de gestión financiera y contable para clientes de J&A Contadores - Asesores. Firma líder en Tunja, Boyacá y toda Colombia.",
  keywords: "contadores, asesores, contabilidad, revisoría fiscal, Tunja, Boyacá, Colombia, DIAN",
  authors: [{ name: "J&A Contadores - Asesores" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "J&A Contadores - Asesores | Portal de Gestión",
    description: "Gestión financiera y contable profesional para empresas colombianas.",
    siteName: "J&A Contadores - Asesores",
    locale: "es_CO",
    type: "website",
  },
};

/**
 * Desarrollado para J&A Contadores - Asesores
 * Firma de Contadores Públicos - Tunja, Boyacá, Colombia
 * Liderado por María Alexandra Pérez Lagos
 */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Fuentes Google — Montserrat + Inter (idéntico a jacontadores.com) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
