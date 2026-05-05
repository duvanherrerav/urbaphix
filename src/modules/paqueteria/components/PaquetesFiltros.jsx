const chipBase = 'app-btn text-xs rounded-full px-3 py-1.5';

export default function PaquetesFiltros({ filtroEstado, setFiltroEstado, resumen, busqueda, setBusqueda, onResetPagina }) {
  const seleccionarFiltro = (estado) => {
    setFiltroEstado(estado);
    onResetPagina();
  };

  return (
    <section className="app-surface-primary border border-brand-primary/10 rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${chipBase} ${filtroEstado === 'todos' ? 'app-btn-primary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro('todos')}>
          Todos <span className="opacity-80">({resumen.total})</span>
        </button>
        <button type="button" className={`${chipBase} ${filtroEstado === 'pendiente' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro('pendiente')}>
          Pendientes <span className="opacity-80">({resumen.pendientes})</span>
        </button>
        <button type="button" className={`${chipBase} ${filtroEstado === 'entregado' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro('entregado')}>
          Entregados <span className="opacity-80">({resumen.entregados})</span>
        </button>
      </div>

      <input
        className="app-input"
        placeholder="Buscar por paquete o servicio"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          onResetPagina();
        }}
      />
    </section>
  );
}
