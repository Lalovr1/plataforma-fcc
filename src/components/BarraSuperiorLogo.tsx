/**
 * Barra superior fija que muestra el logo y nombre de la plataforma.
 */

export default function BarraSuperiorLogo() {
  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-gray-900 flex items-center px-6 shadow-md z-20">
      <div className="flex items-center space-x-3">
        <img src="/logo.png" alt="Logo FCC Maths" className="w-8 h-8" />
        <span className="text-cyan-400 font-bold text-lg">FCC Maths</span>
      </div>
    </header>
  );
}
