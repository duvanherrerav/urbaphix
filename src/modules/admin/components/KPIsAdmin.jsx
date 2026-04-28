import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function KPIsAdmin({ usuarioApp, setKpis, visitasTotal = 0 }) {
  const cargarKPIs = async (conjuntoId, totalVisitasRango) => {
    if (!conjuntoId) return;
    try {
      const [paquetesRes, apartamentosRes] = await Promise.all([

        supabase
          .from('paquetes')
          .select('estado, apartamento_id')
          .eq('conjunto_id', conjuntoId),

        supabase
          .from('apartamentos')
          .select('id, torre_id')

      ]);

      const paquetes = paquetesRes.data || [];
      const apartamentos = apartamentosRes.data || [];

      // 🔥 PAQUETES
      const paquetesPendientes = paquetes.filter(
        p => p.estado === 'pendiente'
      ).length;

      // 🔥 MAPA DE APARTAMENTOS (OPTIMIZADO)
      const mapaApartamentos = {};

      apartamentos.forEach(a => {
        mapaApartamentos[a.id] = a.torre_id;
      });

      // 🔥 TORRE TOP
      const conteoTorres = {};

      paquetes
        .filter(p => p.estado === 'pendiente')
        .forEach(p => {
          const torreId = mapaApartamentos[p.apartamento_id];
          if (!torreId) return;

          conteoTorres[torreId] = (conteoTorres[torreId] || 0) + 1;
        });

      let torreTop = '-';
      let max = 0;

      for (const torreId in conteoTorres) {
        if (conteoTorres[torreId] > max) {
          max = conteoTorres[torreId];
          torreTop = torreId;
        }
      }

      // 🔥 OBTENER NOMBRE TORRE
      if (torreTop !== '-') {
        const { data: torre } = await supabase
          .from('torres')
          .select('nombre')
          .eq('id', torreTop)
          .single();

        torreTop = torre?.nombre || '-';
      }

      // 🔥 ENVIAR KPIs
      setKpis({
        visitasRango: totalVisitasRango,
        paquetesPendientes,
        torreTop
      });

    } catch {
      setKpis((prev) => ({
        ...prev,
        visitasRango: totalVisitasRango
      }));
    }
  };

  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return;
    cargarKPIs(usuarioApp.conjunto_id, visitasTotal);
  }, [usuarioApp?.conjunto_id, visitasTotal]);

  return null;
}
