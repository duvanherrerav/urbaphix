import { supabase } from '../../../services/supabaseClient';

const errorMessage = (error, fallback) => error?.message || fallback;
const TAG_SERVICIO_PUBLICO = '[SERVICIO_PUBLICO]';

export const normalizarCategoriaPaquete = (categoria) => {
  const raw = String(categoria || '').trim().toLowerCase();
  return raw === 'servicio_publico' ? 'servicio_publico' : 'paquete';
};

export const construirDescripcionPersistida = (descripcion, categoria) => {
  const limpia = String(descripcion || '').trim();
  const cat = normalizarCategoriaPaquete(categoria);
  if (!limpia) return '';
  if (cat !== 'servicio_publico') return limpia.replace(TAG_SERVICIO_PUBLICO, '').trim();
  return `${TAG_SERVICIO_PUBLICO} ${limpia.replace(TAG_SERVICIO_PUBLICO, '').trim()}`.trim();
};

export const parsearCategoriaDesdeDescripcion = (descripcionRaw) => {
  const text = String(descripcionRaw || '').trim();
  if (text.toUpperCase().startsWith(TAG_SERVICIO_PUBLICO)) {
    return {
      categoria: 'servicio_publico',
      descripcion: text.replace(new RegExp(`^${TAG_SERVICIO_PUBLICO}\\s*`, 'i'), '').trim()
    };
  }
  return { categoria: 'paquete', descripcion: text };
};

const resolverApartamentoId = async ({ apartamento_id, apartamento_numero, torre_id, conjunto_id }) => {
  if (apartamento_id) return apartamento_id;
  if (!apartamento_numero) return null;

  let aptoQuery = supabase
    .from('apartamentos')
    .select('id, torre_id')
    .eq('numero', String(apartamento_numero).trim());

  if (torre_id) {
    aptoQuery = aptoQuery.eq('torre_id', torre_id);
  } else if (conjunto_id) {
    const { data: torres } = await supabase
      .from('torres')
      .select('id')
      .eq('conjunto_id', conjunto_id);
    const ids = (torres || []).map((t) => t.id);
    if (ids.length) aptoQuery = aptoQuery.in('torre_id', ids);
  }

  const { data: aptos, error } = await aptoQuery.limit(2);
  if (error || !aptos?.length) return null;
  if (aptos.length > 1) {
    throw new Error('Apartamento ambiguo. Indica torre para continuar.');
  }
  return aptos[0].id;
};

const resolverUsuarioResidente = async ({ residente_id, apartamento_id }) => {
  if (residente_id) {
    const { data: residente, error } = await supabase
      .from('residentes')
      .select('id, usuario_id')
      .eq('id', residente_id)
      .single();
    if (!error && residente?.id) return residente;
  }

  if (apartamento_id) {
    const { data: residente, error } = await supabase
      .from('residentes')
      .select('id, usuario_id')
      .eq('apartamento_id', apartamento_id)
      .single();
    if (!error && residente?.id) return residente;
  }
  return null;
};

export const registrarPaquete = async (data, user) => {
  try {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    if ((!data?.residente_id && !data?.apartamento_id && !data?.apartamento_numero) || !data?.descripcion) {
      throw new Error('Datos de paquete incompletos');
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_app')
      .select('conjunto_id')
      .eq('id', user.id)
      .single();

    if (errorUsuario || !usuario?.conjunto_id) {
      throw new Error(errorMessage(errorUsuario, 'No se pudo obtener el conjunto del usuario'));
    }

    const apartamentoId = await resolverApartamentoId({
      apartamento_id: data?.apartamento_id,
      apartamento_numero: data?.apartamento_numero,
      torre_id: data?.torre_id,
      conjunto_id: usuario?.conjunto_id
    });

    const residenteTarget = await resolverUsuarioResidente({
      residente_id: data?.residente_id,
      apartamento_id: apartamentoId
    });
    if (!residenteTarget?.id) {
      throw new Error('No se encontró un residente válido para el apartamento seleccionado');
    }

    const categoria = normalizarCategoriaPaquete(data?.categoria);
    const descripcionPersistida = construirDescripcionPersistida(data?.descripcion, categoria);

    const { data: paquete, error } = await supabase
      .from('paquetes')
      .insert([{
        conjunto_id: usuario.conjunto_id,
        apartamento_id: data?.apartamento_id || null,
        residente_id: residenteTarget.id,
        descripcion: descripcionPersistida,
        recibido_por: user.id,
        estado: 'pendiente'
      }])
      .select()
      .single();

    if (error || !paquete) {
      throw new Error(errorMessage(error, 'No se pudo registrar el paquete'));
    }

    // 🔔 Notificación
    const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
      usuario_id: residenteTarget.usuario_id,
      tipo: categoria === 'servicio_publico' ? 'servicio_publico_recibido' : 'paquete_recibido',
      titulo: categoria === 'servicio_publico' ? 'Tienes un servicio público por reclamar' : 'Tienes un paquete',
      mensaje: categoria === 'servicio_publico'
        ? `Llegó un servicio público (${parsearCategoriaDesdeDescripcion(descripcionPersistida).descripcion || 'sin descripción'}) a portería`
        : `Un paquete ha llegado a portería (${parsearCategoriaDesdeDescripcion(descripcionPersistida).descripcion || 'sin descripción'})`
    }]);

    if (errorNotificacion) {
      console.warn('registrarPaquete: no se pudo crear notificación', errorNotificacion);
    }

    return { ok: true, paquete, error: null };
  } catch (error) {
    console.error('registrarPaquete error:', error);
    return { ok: false, paquete: null, error: errorMessage(error, 'Error al registrar paquete') };
  }
};

export const listarPaquetesConDetalle = async ({ conjunto_id, estado = 'todos', busqueda = '' }) => {
  try {
    if (!conjunto_id) throw new Error('Conjunto no especificado');

    let query = supabase
      .from('paquetes')
      .select('id, conjunto_id, apartamento_id, residente_id, descripcion, estado, fecha_recibido, fecha_entrega, recibido_por')
      .eq('conjunto_id', conjunto_id)
      .order('fecha_recibido', { ascending: false });

    const estadoNormalizado = String(estado || 'todos').toLowerCase();
    if (estadoNormalizado !== 'todos') {
      query = query.eq('estado', estadoNormalizado);
    }

    const { data: paquetes, error } = await query;
    if (error) throw new Error(errorMessage(error, 'No se pudo consultar paquetería'));

    const idsResidentes = [...new Set((paquetes || []).map((p) => p.residente_id).filter(Boolean))];
    const apartamentosIds = [...new Set((paquetes || []).map((p) => p.apartamento_id).filter(Boolean))];

    const [residentesResp, apartamentosResp, torresResp] = await Promise.all([
      idsResidentes.length
        ? supabase.from('residentes').select('id, apartamento_id').in('id', idsResidentes)
        : Promise.resolve({ data: [], error: null }),
      apartamentosIds.length
        ? supabase.from('apartamentos').select('id, numero, torre_id').in('id', apartamentosIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('torres').select('id, nombre').eq('conjunto_id', conjunto_id)
    ]);

    if (residentesResp.error) throw new Error(errorMessage(residentesResp.error, 'No se pudo cargar residentes'));
    if (apartamentosResp.error) throw new Error(errorMessage(apartamentosResp.error, 'No se pudo cargar apartamentos'));
    if (torresResp.error) throw new Error(errorMessage(torresResp.error, 'No se pudo cargar torres'));

    const residenteById = Object.fromEntries((residentesResp.data || []).map((r) => [r.id, r]));
    const aptoById = Object.fromEntries((apartamentosResp.data || []).map((a) => [a.id, a]));
    const torreById = Object.fromEntries((torresResp.data || []).map((t) => [t.id, t]));

    const enriched = (paquetes || []).map((p) => {
      const residente = residenteById[p.residente_id] || {};
      const apartamentoId = p.apartamento_id || residente.apartamento_id;
      const apto = aptoById[apartamentoId] || {};
      const torre = torreById[apto.torre_id] || {};
      const parsed = parsearCategoriaDesdeDescripcion(p.descripcion);
      return {
        ...p,
        categoria: parsed.categoria,
        descripcion_visible: parsed.descripcion,
        apartamento_numero: apto.numero || null,
        torre_nombre: torre.nombre || null
      };
    });

    const term = String(busqueda || '').trim().toLowerCase();
    const data = term
      ? enriched.filter((p) =>
        String(p.descripcion_visible || '').toLowerCase().includes(term)
        || String(p.apartamento_numero || '').toLowerCase().includes(term)
        || String(p.torre_nombre || '').toLowerCase().includes(term)
      )
      : enriched;

    return { ok: true, data, error: null };
  } catch (error) {
    return { ok: false, data: [], error: errorMessage(error, 'No se pudo listar paquetería') };
  }
};

export const entregarPaquete = async (paquete_id) => {
  try {
    if (!paquete_id) {
      throw new Error('Paquete inválido');
    }

    const { data: paquete, error: errorPaquete } = await supabase
      .from('paquetes')
      .select('*')
      .eq('id', paquete_id)
      .single();

    if (errorPaquete || !paquete) {
      throw new Error(errorMessage(errorPaquete, 'No se encontró el paquete'));
    }

    const { error: errorUpdate } = await supabase
      .from('paquetes')
      .update({
        estado: 'entregado',
        fecha_entrega: new Date().toISOString()
      })
      .eq('id', paquete_id);

    if (errorUpdate) {
      throw new Error(errorMessage(errorUpdate, 'No se pudo actualizar el estado del paquete'));
    }

    // 🔔 Notificación
    const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
      usuario_id: paquete.residente_id,
      tipo: 'paquete_entregado',
      titulo: 'Paquete entregado',
      mensaje: 'Tu paquete fue entregado correctamente'
    }]);

    if (errorNotificacion) {
      console.warn('entregarPaquete: no se pudo crear notificación', errorNotificacion);
    }

    return { ok: true, paquete, error: null };
  } catch (error) {
    console.error('entregarPaquete error:', error);
    return { ok: false, paquete: null, error: errorMessage(error, 'Error al entregar paquete') };
  }
};