export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-gray-400 mb-8">Pagina non trovata</p>
        <a
          href="/"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Torna alla home
        </a>
      </div>
    </div>
  );
}
