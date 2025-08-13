export const metadata = {
  title: "BCG Webapp",
  description: "Matriz BCG restauración",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
