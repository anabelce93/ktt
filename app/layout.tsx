import "./globals.css";
export const metadata = { title: "Widget Corea del Sur", description: "Reserva tu viaje a Corea" };
export default function RootLayout({ children }:{children: React.ReactNode}) {
  return (<html lang="es"><body>{children}</body></html>);
}
