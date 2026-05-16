import { ESTADOS_PAQUETE, FILTROS_PAQUETE } from '../services/estadosPaquete';

const chipBase = 'app-btn text-xs rounded-full px-3 py-1.5';

export default function PaquetesFiltros({ filtroEstado, setFiltroEstado, resumen, busqueda, setBusqueda, onResetPagina }) {
  const seleccionarFiltro = (estado) => {
    setFiltroEstado(estado);
    onResetPagina();
  };

  return (
    <section className="app-surface-primary border border-brand-primary/10 rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${chipBase} ${filtroEstado === FILTROS_PAQUETE.TODOS ? 'app-btn-primary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro(FILTROS_PAQUETE.TODOS)}>
          Todos <span className="opacity-80">({resumen.total})</span>
        </button>
        <button type="button" className={`${chipBase} ${filtroEstado === ESTADOS_PAQUETE.PENDIENTE ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro(ESTADOS_PAQUETE.PENDIENTE)}>
          Pendientes <span className="opacity-80">({resumen.pendientes})</span>
        </button>
        <button type="button" className={`${chipBase} ${filtroEstado === ESTADOS_PAQUETE.ENTREGADO ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => seleccionarFiltro(ESTADOS_PAQUETE.ENTREGADO)}>
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
