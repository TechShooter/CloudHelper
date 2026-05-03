// Pagina statica HTML pura - nessun Edge Function, nessun bundle React
// Fa redirect a /login o /chat immediatamente via JavaScript inline

export default function Home() {
  return (
    <html>
      <head>
        <title>CloudHelper</title>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var hasSession = document.cookie.includes('sb-');
              window.location.replace(hasSession ? '/chat' : '/login');
            })();
          `
        }} />
      </head>
      <body style={{ margin: 0, background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#9CA3AF', fontFamily: 'system-ui, sans-serif' }}>Caricamento...</div>
      </body>
    </html>
  );
}
