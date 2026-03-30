import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function KPIsAdmin({ usuarioApp, setKpis }) {

  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      cargarKPIs();
    }
  }, [usuarioApp]);

  const cargarKPIs = async () => {

    try {

      const hoy = new Date().toISOString().split('T')[0];

      const hace7dias = new Date();
      hace7dias.setDate(hace7dias.getDate() - 7);
      const fechaInicio = hace7dias.toISOString().split('T')[0];

      // 🔥 CONSULTAS EN PARALELO (PRO)
      const [visitasRes, paquetesRes, apartamentosRes] = await Promise.all([

        supabase
          .from('visitas')
          .select('fecha_visita')
          .eq('conjunto_id', usuarioApp.conjunto_id),

        supabase
          .from('paquetes')
          .select('estado, apartamento_id')
          .eq('conjunto_id', usuarioApp.conjunto_id),

        supabase
          .from('apartamentos')
          .select('id, torre_id')

      ]);

      const visitas = visitasRes.data || [];
      const paquetes = paquetesRes.data || [];
      const apartamentos = apartamentosRes.data || [];

      // 🔥 VISITAS
      const visitasHoy = visitas.filter(v => v.fecha_visita === hoy).length;

      const visitasSemana = visitas.filter(
        v => v.fecha_visita >= fechaInicio
      ).length;

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
        visitasHoy,
        visitasSemana,
        paquetesPendientes,
        torreTop
      });

    } catch (err) {
      console.log('Error KPIs:', err);
    }
  };

  return null;
}