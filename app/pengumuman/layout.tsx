export default function PengumumanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="stylesheet" href="/css/bootstrap.min.css" />
      <link rel="stylesheet" href="/css/snbt.css" />
      <div style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </>
  );
}
