


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."fn_auth_conjunto_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select ua.conjunto_id
  from public.usuarios_app ua
  where ua.id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."fn_auth_conjunto_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auth_residente_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select r.id
  from public.residentes r
  where r.usuario_id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."fn_auth_residente_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auth_rol"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select ua.rol_id
  from public.usuarios_app ua
  where ua.id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."fn_auth_rol"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_crear_o_reutilizar_visitante_y_registro"("p_conjunto_id" "uuid", "p_residente_id" "uuid", "p_apartamento_id" "uuid", "p_nombre" "text", "p_tipo_documento" "text", "p_documento" "text", "p_tipo_vehiculo" "text", "p_placa" "text", "p_fecha_visita" "date") RETURNS TABLE("visitante_id" "uuid", "registro_id" "uuid", "qr_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_visitante_id uuid;
  v_qr text;
begin
  -- buscar visitante existente por residente + doc + tipo_doc
  select v.id into v_visitante_id
  from public.visitantes v
  where v.residente_id = p_residente_id
    and v.tipo_documento = p_tipo_documento
    and v.documento = p_documento
  limit 1;

  -- crear si no existe
  if v_visitante_id is null then
    insert into public.visitantes(
      conjunto_id, residente_id, nombre, tipo_documento, documento, tipo_vehiculo, placa
    )
    values (
      p_conjunto_id, p_residente_id, p_nombre, upper(p_tipo_documento), p_documento, p_tipo_vehiculo, upper(p_placa)
    )
    returning id into v_visitante_id;
  else
    -- opcional: actualizar datos maestro al reusar
    update public.visitantes
    set nombre = p_nombre,
        tipo_vehiculo = p_tipo_vehiculo,
        placa = upper(p_placa),
        updated_at = now()
    where id = v_visitante_id;
  end if;

  v_qr := gen_random_uuid()::text;

  insert into public.registro_visitas(
    visitante_id, conjunto_id, apartamento_id, fecha_visita, estado, qr_code, created_at
  )
  values (
    v_visitante_id, p_conjunto_id, p_apartamento_id, p_fecha_visita, 'pendiente', v_qr, now()
  )
  returning id into registro_id;

  visitante_id := v_visitante_id;
  qr_code := v_qr;
  return next;
end;
$$;


ALTER FUNCTION "public"."fn_crear_o_reutilizar_visitante_y_registro"("p_conjunto_id" "uuid", "p_residente_id" "uuid", "p_apartamento_id" "uuid", "p_nombre" "text", "p_tipo_documento" "text", "p_documento" "text", "p_tipo_vehiculo" "text", "p_placa" "text", "p_fecha_visita" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_registrar_ingreso_visita"("p_qr_code" "text", "p_vigilante_id" "uuid") RETURNS TABLE("registro_id" "uuid", "estado" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.registro_visitas rv
  set estado = 'ingresado',
      hora_ingreso = now(),
      validado_por = p_vigilante_id,
      updated_at = now()
  where rv.qr_code = p_qr_code
    and rv.estado = 'pendiente'
  returning rv.id, rv.estado
  into registro_id, estado;

  if registro_id is null then
    raise exception 'QR inválido o ya usado';
  end if;

  return next;
end;
$$;


ALTER FUNCTION "public"."fn_registrar_ingreso_visita"("p_qr_code" "text", "p_vigilante_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_registrar_salida_visita"("p_registro_id" "uuid", "p_vigilante_id" "uuid") RETURNS TABLE("registro_id" "uuid", "estado" "text", "hora_salida" timestamp without time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.registro_visitas rv
  set estado = 'salido',
      hora_salida = now(),
      validado_por = p_vigilante_id,
      updated_at = now()
  where rv.id = p_registro_id
    and rv.estado in ('ingresado','pendiente')
  returning rv.id, rv.estado, rv.hora_salida
  into registro_id, estado, hora_salida;

  if registro_id is null then
    raise exception 'No se pudo registrar salida: registro no encontrado o estado inválido';
  end if;

  return next;
end;
$$;


ALTER FUNCTION "public"."fn_registrar_salida_visita"("p_registro_id" "uuid", "p_vigilante_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin

  insert into public.usuarios_app (
    id,
    email,
    rol_id,
    conjunto_id,
    activo,
    created_at
  )
  values (
    new.id,
    new.email,
    'residente',
    null,
    true,
    now()
  );

  return new;

end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accesos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visita_id" "uuid",
    "fecha_ingreso" timestamp without time zone,
    "fecha_salida" timestamp without time zone,
    "vigilante_id" "uuid"
);


ALTER TABLE "public"."accesos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."apartamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "torre_id" "uuid",
    "conjunto_id" "uuid",
    "numero" "text",
    "piso" integer,
    "created_at" timestamp without time zone,
    "tipo_apartamento" "text",
    CONSTRAINT "apartamentos_tipo_apartamento_chk" CHECK (("tipo_apartamento" = ANY (ARRAY['pequeno'::"text", 'mediano'::"text", 'grande'::"text"])))
);


ALTER TABLE "public"."apartamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modulo" "text",
    "referencia_id" "uuid",
    "url" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."archivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comunicados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "titulo" "text",
    "contenido" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."comunicados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "url_pago" "text",
    "instrucciones" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_pagos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conjuntos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "direccion" "text",
    "ciudad" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."conjuntos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidentes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "reportado_por" "uuid",
    "descripcion" "text",
    "nivel" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."incidentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."multas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "residente_id" "uuid",
    "conjunto_id" "uuid",
    "motivo" "text",
    "valor" numeric,
    "estado" "text" DEFAULT 'pendiente'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."multas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "tipo" "text",
    "titulo" "text",
    "mensaje" "text",
    "leido" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "residente_id" "uuid",
    "concepto" "text",
    "valor" numeric,
    "estado" "text",
    "fecha_pago" "date",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "conjunto_id" "uuid",
    "comprobante_url" "text",
    "tipo_pago" "text" DEFAULT 'administracion'::"text",
    CONSTRAINT "pagos_tipo_pago_chk" CHECK (("tipo_pago" = ANY (ARRAY['administracion'::"text", 'multa'::"text", 'incumplimiento_rph'::"text", 'llamado_atencion'::"text", 'cuota_extraordinaria'::"text"])))
);


ALTER TABLE "public"."pagos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paquetes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "residente_id" "uuid",
    "descripcion" "text",
    "recibido_por" "uuid",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "fecha_recibido" timestamp without time zone DEFAULT "now"(),
    "fecha_entrega" timestamp without time zone,
    "created_at" timestamp without time zone,
    "apartamento_id" "uuid"
);


ALTER TABLE "public"."paquetes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parqueaderos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "numero" "text",
    "tipo" "text",
    "ocupado" boolean DEFAULT false
);


ALTER TABLE "public"."parqueaderos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pqr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "residente_id" "uuid",
    "asunto" "text",
    "descripcion" "text",
    "estado" "text" DEFAULT 'abierto'::"text",
    "respuesta" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."pqr" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recursos_comunes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "descripcion" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "capacidad" integer,
    "requiere_aprobacion" boolean DEFAULT true NOT NULL,
    "requiere_deposito" boolean DEFAULT false NOT NULL,
    "deposito_valor" numeric(12,2),
    "tiempo_buffer_min" integer DEFAULT 0 NOT NULL,
    "reglas" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recursos_comunes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registro_visitas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visitante_id" "uuid" NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "apartamento_id" "uuid",
    "fecha_visita" "date" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "qr_code" "text" NOT NULL,
    "hora_ingreso" timestamp without time zone,
    "hora_salida" timestamp without time zone,
    "validado_por" "uuid",
    "notas" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "registro_visitas_estado_chk" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'ingresado'::"text", 'salido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."registro_visitas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zona_id" "uuid",
    "residente_id" "uuid",
    "fecha" "date",
    "hora_inicio" time without time zone,
    "hora_fin" time without time zone,
    "estado" "text" DEFAULT 'pendiente'::"text"
);


ALTER TABLE "public"."reservas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas_bloqueos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "recurso_id" "uuid" NOT NULL,
    "fecha_inicio" timestamp without time zone NOT NULL,
    "fecha_fin" timestamp without time zone NOT NULL,
    "motivo" "text" NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservas_bloqueos_fecha_ck" CHECK (("fecha_fin" > "fecha_inicio"))
);


ALTER TABLE "public"."reservas_bloqueos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas_documentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reserva_id" "uuid" NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "nombre_archivo" "text" NOT NULL,
    "ruta_storage" "text" NOT NULL,
    "tipo_documento" "text",
    "subido_por" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reservas_documentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas_eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reserva_id" "uuid" NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "accion" "text" NOT NULL,
    "detalle" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reservas_eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas_zonas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "recurso_id" "uuid" NOT NULL,
    "residente_id" "uuid" NOT NULL,
    "apartamento_id" "uuid",
    "fecha_inicio" timestamp without time zone NOT NULL,
    "fecha_fin" timestamp without time zone NOT NULL,
    "tipo_reserva" "text" DEFAULT 'recreativa'::"text" NOT NULL,
    "subtipo" "text",
    "estado" "text" DEFAULT 'solicitada'::"text" NOT NULL,
    "motivo" "text",
    "observaciones" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "aprobada_por" "uuid",
    "rechazada_por" "uuid",
    "checkin_por" "uuid",
    "checkout_por" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservas_zonas_estado_ck" CHECK (("estado" = ANY (ARRAY['solicitada'::"text", 'aprobada'::"text", 'rechazada'::"text", 'cancelada'::"text", 'en_curso'::"text", 'finalizada'::"text", 'no_show'::"text"]))),
    CONSTRAINT "reservas_zonas_fecha_ck" CHECK (("fecha_fin" > "fecha_inicio")),
    CONSTRAINT "reservas_zonas_tipo_ck" CHECK (("tipo_reserva" = ANY (ARRAY['recreativa'::"text", 'logistica'::"text", 'prestamo'::"text"])))
);


ALTER TABLE "public"."reservas_zonas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."residentes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "es_propietario" boolean,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "conjunto_id" "uuid",
    "apartamento_id" "uuid"
);


ALTER TABLE "public"."residentes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "text" NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_documento" (
    "id" bigint NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."tipos_documento" OWNER TO "postgres";


ALTER TABLE "public"."tipos_documento" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tipos_documento_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."torres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "nombre" "text",
    "pisos" integer,
    "created_at" timestamp without time zone
);


ALTER TABLE "public"."torres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trasteos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "residente_id" "uuid",
    "conjunto_id" "uuid",
    "fecha" "date",
    "estado" "text" DEFAULT 'pendiente'::"text"
);


ALTER TABLE "public"."trasteos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_app" (
    "id" "uuid" NOT NULL,
    "conjunto_id" "uuid",
    "rol_id" "text",
    "nombre" "text",
    "telefono" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "email" "text",
    "fcm_token" "text"
);


ALTER TABLE "public"."usuarios_app" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehiculos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "residente_id" "uuid",
    "placa" "text",
    "tipo" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehiculos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visitantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid" NOT NULL,
    "residente_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "documento" "text" NOT NULL,
    "tipo_vehiculo" "text",
    "placa" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "visitantes_placa_formato_chk" CHECK ((("placa" IS NULL) OR ("placa" ~ '^[A-Z]{3}[0-9]{3}$'::"text") OR ("placa" ~ '^[A-Z]{3}[0-9]{2}[A-Z]?$'::"text"))),
    CONSTRAINT "visitantes_tipo_vehiculo_chk" CHECK ((("tipo_vehiculo" = ANY (ARRAY['carro'::"text", 'moto'::"text"])) OR ("tipo_vehiculo" IS NULL)))
);


ALTER TABLE "public"."visitantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zonas_comunes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conjunto_id" "uuid",
    "nombre" "text"
);


ALTER TABLE "public"."zonas_comunes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accesos"
    ADD CONSTRAINT "accesos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."apartamentos"
    ADD CONSTRAINT "apartamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comunicados"
    ADD CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_pagos"
    ADD CONSTRAINT "config_pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conjuntos"
    ADD CONSTRAINT "conjuntos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidentes"
    ADD CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."multas"
    ADD CONSTRAINT "multas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paquetes"
    ADD CONSTRAINT "paquetes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parqueaderos"
    ADD CONSTRAINT "parqueaderos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqr"
    ADD CONSTRAINT "pqr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recursos_comunes"
    ADD CONSTRAINT "recursos_comunes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."reservas_bloqueos"
    ADD CONSTRAINT "reservas_bloqueos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas_documentos"
    ADD CONSTRAINT "reservas_documentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas_eventos"
    ADD CONSTRAINT "reservas_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_no_solape" EXCLUDE USING "gist" ("recurso_id" WITH =, "tsrange"("fecha_inicio", "fecha_fin", '[)'::"text") WITH &&) WHERE (("estado" = ANY (ARRAY['solicitada'::"text", 'aprobada'::"text", 'en_curso'::"text"])));



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."residentes"
    ADD CONSTRAINT "residentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_documento"
    ADD CONSTRAINT "tipos_documento_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."tipos_documento"
    ADD CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."torres"
    ADD CONSTRAINT "torres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trasteos"
    ADD CONSTRAINT "trasteos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitantes"
    ADD CONSTRAINT "visitantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zonas_comunes"
    ADD CONSTRAINT "zonas_comunes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_notificaciones_usuario" ON "public"."notificaciones" USING "btree" ("usuario_id");



CREATE INDEX "idx_paquetes_residente" ON "public"."paquetes" USING "btree" ("residente_id");



CREATE INDEX "idx_recursos_comunes_conjunto" ON "public"."recursos_comunes" USING "btree" ("conjunto_id");



CREATE INDEX "idx_recursos_comunes_tipo" ON "public"."recursos_comunes" USING "btree" ("tipo");



CREATE INDEX "idx_registro_visitas_estado" ON "public"."registro_visitas" USING "btree" ("estado");



CREATE INDEX "idx_registro_visitas_fecha" ON "public"."registro_visitas" USING "btree" ("fecha_visita");



CREATE INDEX "idx_registro_visitas_visitante" ON "public"."registro_visitas" USING "btree" ("visitante_id");



CREATE INDEX "idx_reservas_bloqueos_recurso" ON "public"."reservas_bloqueos" USING "btree" ("recurso_id");



CREATE INDEX "idx_reservas_documentos_reserva" ON "public"."reservas_documentos" USING "btree" ("reserva_id");



CREATE INDEX "idx_reservas_eventos_conjunto" ON "public"."reservas_eventos" USING "btree" ("conjunto_id");



CREATE INDEX "idx_reservas_eventos_reserva" ON "public"."reservas_eventos" USING "btree" ("reserva_id");



CREATE INDEX "idx_reservas_zonas_conjunto" ON "public"."reservas_zonas" USING "btree" ("conjunto_id");



CREATE INDEX "idx_reservas_zonas_estado" ON "public"."reservas_zonas" USING "btree" ("estado");



CREATE INDEX "idx_reservas_zonas_rango" ON "public"."reservas_zonas" USING "btree" ("fecha_inicio", "fecha_fin");



CREATE INDEX "idx_reservas_zonas_recurso" ON "public"."reservas_zonas" USING "btree" ("recurso_id");



CREATE INDEX "idx_reservas_zonas_residente" ON "public"."reservas_zonas" USING "btree" ("residente_id");



CREATE UNIQUE INDEX "ux_visitantes_residente_doc" ON "public"."visitantes" USING "btree" ("residente_id", "tipo_documento", "documento");



CREATE OR REPLACE TRIGGER "trg_recursos_comunes_updated_at" BEFORE UPDATE ON "public"."recursos_comunes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reservas_zonas_updated_at" BEFORE UPDATE ON "public"."reservas_zonas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."accesos"
    ADD CONSTRAINT "accesos_vigilante_id_fkey" FOREIGN KEY ("vigilante_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."apartamentos"
    ADD CONSTRAINT "apartamentos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."comunicados"
    ADD CONSTRAINT "comunicados_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."config_pagos"
    ADD CONSTRAINT "config_pagos_conjunto_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."apartamentos"
    ADD CONSTRAINT "fk_apartamento_torre" FOREIGN KEY ("torre_id") REFERENCES "public"."torres"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "fk_pagos_conjunto" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."residentes"
    ADD CONSTRAINT "fk_residente_apartamento" FOREIGN KEY ("apartamento_id") REFERENCES "public"."apartamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."residentes"
    ADD CONSTRAINT "fk_residente_conjunto" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."incidentes"
    ADD CONSTRAINT "incidentes_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."incidentes"
    ADD CONSTRAINT "incidentes_reportado_por_fkey" FOREIGN KEY ("reportado_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."multas"
    ADD CONSTRAINT "multas_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."multas"
    ADD CONSTRAINT "multas_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."paquetes"
    ADD CONSTRAINT "paquetes_apartamento_id_fkey" FOREIGN KEY ("apartamento_id") REFERENCES "public"."apartamentos"("id");



ALTER TABLE ONLY "public"."paquetes"
    ADD CONSTRAINT "paquetes_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."paquetes"
    ADD CONSTRAINT "paquetes_recibido_por_fkey" FOREIGN KEY ("recibido_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."paquetes"
    ADD CONSTRAINT "paquetes_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."parqueaderos"
    ADD CONSTRAINT "parqueaderos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."pqr"
    ADD CONSTRAINT "pqr_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."recursos_comunes"
    ADD CONSTRAINT "recursos_comunes_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_apartamento_id_fkey" FOREIGN KEY ("apartamento_id") REFERENCES "public"."apartamentos"("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."registro_visitas"
    ADD CONSTRAINT "registro_visitas_visitante_id_fkey" FOREIGN KEY ("visitante_id") REFERENCES "public"."visitantes"("id");



ALTER TABLE ONLY "public"."reservas_bloqueos"
    ADD CONSTRAINT "reservas_bloqueos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."reservas_bloqueos"
    ADD CONSTRAINT "reservas_bloqueos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_bloqueos"
    ADD CONSTRAINT "reservas_bloqueos_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos_comunes"("id");



ALTER TABLE ONLY "public"."reservas_documentos"
    ADD CONSTRAINT "reservas_documentos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."reservas_documentos"
    ADD CONSTRAINT "reservas_documentos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas_zonas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservas_documentos"
    ADD CONSTRAINT "reservas_documentos_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_eventos"
    ADD CONSTRAINT "reservas_eventos_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_eventos"
    ADD CONSTRAINT "reservas_eventos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."reservas_eventos"
    ADD CONSTRAINT "reservas_eventos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas_zonas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."reservas"
    ADD CONSTRAINT "reservas_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "public"."zonas_comunes"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_apartamento_id_fkey" FOREIGN KEY ("apartamento_id") REFERENCES "public"."apartamentos"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_aprobada_por_fkey" FOREIGN KEY ("aprobada_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_checkin_por_fkey" FOREIGN KEY ("checkin_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_checkout_por_fkey" FOREIGN KEY ("checkout_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_rechazada_por_fkey" FOREIGN KEY ("rechazada_por") REFERENCES "public"."usuarios_app"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "public"."recursos_comunes"("id");



ALTER TABLE ONLY "public"."reservas_zonas"
    ADD CONSTRAINT "reservas_zonas_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."residentes"
    ADD CONSTRAINT "residentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_app"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."torres"
    ADD CONSTRAINT "torres_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."trasteos"
    ADD CONSTRAINT "trasteos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."trasteos"
    ADD CONSTRAINT "trasteos_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_app"
    ADD CONSTRAINT "usuarios_app_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."visitantes"
    ADD CONSTRAINT "visitantes_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE ONLY "public"."visitantes"
    ADD CONSTRAINT "visitantes_residente_id_fkey" FOREIGN KEY ("residente_id") REFERENCES "public"."residentes"("id");



ALTER TABLE ONLY "public"."visitantes"
    ADD CONSTRAINT "visitantes_tipo_doc_fk" FOREIGN KEY ("tipo_documento") REFERENCES "public"."tipos_documento"("codigo");



ALTER TABLE ONLY "public"."zonas_comunes"
    ADD CONSTRAINT "zonas_comunes_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "public"."conjuntos"("id");



ALTER TABLE "public"."accesos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin ve residentes" ON "public"."residentes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_app"
  WHERE (("usuarios_app"."id" = "auth"."uid"()) AND ("usuarios_app"."rol_id" = 'admin'::"text")))));



ALTER TABLE "public"."archivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos por conjunto" ON "public"."archivos" FOR SELECT USING (true);



CREATE POLICY "bloqueos_admin_write" ON "public"."reservas_bloqueos" TO "authenticated" USING ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND ("public"."fn_auth_rol"() = 'admin'::"text"))) WITH CHECK ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND ("public"."fn_auth_rol"() = 'admin'::"text")));



CREATE POLICY "bloqueos_select_conjunto" ON "public"."reservas_bloqueos" FOR SELECT TO "authenticated" USING (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



ALTER TABLE "public"."comunicados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comunicados por conjunto" ON "public"."comunicados" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



ALTER TABLE "public"."config_pagos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crear comunicados admin" ON "public"."comunicados" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "crear incidentes vigilancia" ON "public"."incidentes" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'vigilancia'::"text"));



CREATE POLICY "crear multas admin" ON "public"."multas" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "crear pagos admin" ON "public"."pagos" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."usuarios_app"
  WHERE (("usuarios_app"."id" = "auth"."uid"()) AND ("usuarios_app"."rol_id" = 'admin'::"text")))));



CREATE POLICY "crear pagos admin conjunto" ON "public"."pagos" FOR INSERT WITH CHECK (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE (("usuarios_app"."id" = "auth"."uid"()) AND ("usuarios_app"."rol_id" = 'admin'::"text")))));



CREATE POLICY "crear pqr residente" ON "public"."pqr" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'residente'::"text"));



CREATE POLICY "crear reservas residente" ON "public"."reservas" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'residente'::"text"));



CREATE POLICY "docs_insert_conjunto" ON "public"."reservas_documentos" FOR INSERT TO "authenticated" WITH CHECK (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



CREATE POLICY "docs_select_conjunto" ON "public"."reservas_documentos" FOR SELECT TO "authenticated" USING (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



CREATE POLICY "eventos_insert_conjunto" ON "public"."reservas_eventos" FOR INSERT TO "authenticated" WITH CHECK (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



CREATE POLICY "eventos_select_conjunto" ON "public"."reservas_eventos" FOR SELECT TO "authenticated" USING (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



ALTER TABLE "public"."incidentes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "incidentes por conjunto" ON "public"."incidentes" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



CREATE POLICY "insert accesos vigilancia" ON "public"."accesos" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'vigilancia'::"text"));



CREATE POLICY "insert notificaciones permitido" ON "public"."notificaciones" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "insert paquetes vigilancia" ON "public"."paquetes" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'vigilancia'::"text"));



CREATE POLICY "insert residentes admin" ON "public"."residentes" FOR INSERT WITH CHECK ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "lectura config pagos" ON "public"."config_pagos" FOR SELECT USING (true);



CREATE POLICY "lectura usuarios" ON "public"."usuarios_app" FOR SELECT USING (true);



ALTER TABLE "public"."multas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "multas por conjunto" ON "public"."multas" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificaciones usuario" ON "public"."notificaciones" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagos multi conjunto" ON "public"."pagos" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



ALTER TABLE "public"."paquetes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "paquetes por conjunto" ON "public"."paquetes" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



CREATE POLICY "paquetes residente" ON "public"."paquetes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."residentes" "r"
  WHERE (("r"."id" = "paquetes"."residente_id") AND ("r"."usuario_id" = "auth"."uid"())))));



ALTER TABLE "public"."parqueaderos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pqr" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pqr por residente" ON "public"."pqr" FOR SELECT USING (("residente_id" IN ( SELECT "residentes"."id"
   FROM "public"."residentes"
  WHERE ("residentes"."usuario_id" = "auth"."uid"()))));



CREATE POLICY "recursos_admin_write" ON "public"."recursos_comunes" TO "authenticated" USING ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND ("public"."fn_auth_rol"() = 'admin'::"text"))) WITH CHECK ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND ("public"."fn_auth_rol"() = 'admin'::"text")));



ALTER TABLE "public"."recursos_comunes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recursos_select_conjunto" ON "public"."recursos_comunes" FOR SELECT TO "authenticated" USING (("conjunto_id" = "public"."fn_auth_conjunto_id"()));



ALTER TABLE "public"."registro_visitas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registro_visitas_insert_propios" ON "public"."registro_visitas" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."visitantes" "v"
     JOIN "public"."residentes" "r" ON (("r"."id" = "v"."residente_id")))
  WHERE (("v"."id" = "registro_visitas"."visitante_id") AND ("r"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "registro_visitas_select_propios" ON "public"."registro_visitas" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."visitantes" "v"
     JOIN "public"."residentes" "r" ON (("r"."id" = "v"."residente_id")))
  WHERE (("v"."id" = "registro_visitas"."visitante_id") AND ("r"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "registro_visitas_select_same_conjunto" ON "public"."registro_visitas" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."usuarios_app" "ua"
  WHERE (("ua"."id" = "auth"."uid"()) AND ("ua"."conjunto_id" = "registro_visitas"."conjunto_id")))) OR (EXISTS ( SELECT 1
   FROM (("public"."visitantes" "v"
     JOIN "public"."residentes" "r" ON (("r"."id" = "v"."residente_id")))
     JOIN "public"."usuarios_app" "ua" ON (("ua"."id" = "auth"."uid"())))
  WHERE (("v"."id" = "registro_visitas"."visitante_id") AND ("ua"."conjunto_id" = "r"."conjunto_id"))))));



CREATE POLICY "registro_visitas_update_vigilancia_admin" ON "public"."registro_visitas" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_app" "ua"
  WHERE (("ua"."id" = "auth"."uid"()) AND ("ua"."rol_id" = ANY (ARRAY['vigilancia'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."usuarios_app" "ua"
  WHERE (("ua"."id" = "auth"."uid"()) AND ("ua"."rol_id" = ANY (ARRAY['vigilancia'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."reservas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservas por conjunto" ON "public"."reservas" FOR SELECT USING (("zona_id" IN ( SELECT "zonas_comunes"."id"
   FROM "public"."zonas_comunes"
  WHERE ("zonas_comunes"."conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
           FROM "public"."usuarios_app"
          WHERE ("usuarios_app"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."reservas_bloqueos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservas_documentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservas_eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservas_insert_residente_admin" ON "public"."reservas_zonas" FOR INSERT TO "authenticated" WITH CHECK ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND (("public"."fn_auth_rol"() = 'admin'::"text") OR (("public"."fn_auth_rol"() = 'residente'::"text") AND ("residente_id" = "public"."fn_auth_residente_id"())))));



CREATE POLICY "reservas_select_admin_vigilancia_residente" ON "public"."reservas_zonas" FOR SELECT TO "authenticated" USING ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND (("public"."fn_auth_rol"() = ANY (ARRAY['admin'::"text", 'vigilancia'::"text"])) OR ("residente_id" = "public"."fn_auth_residente_id"()))));



CREATE POLICY "reservas_update_admin_vigilancia_residente" ON "public"."reservas_zonas" FOR UPDATE TO "authenticated" USING ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND (("public"."fn_auth_rol"() = ANY (ARRAY['admin'::"text", 'vigilancia'::"text"])) OR (("public"."fn_auth_rol"() = 'residente'::"text") AND ("residente_id" = "public"."fn_auth_residente_id"()))))) WITH CHECK ((("conjunto_id" = "public"."fn_auth_conjunto_id"()) AND (("public"."fn_auth_rol"() = ANY (ARRAY['admin'::"text", 'vigilancia'::"text"])) OR (("public"."fn_auth_rol"() = 'residente'::"text") AND ("residente_id" = "public"."fn_auth_residente_id"())))));



ALTER TABLE "public"."reservas_zonas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."residentes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "residentes multi conjunto" ON "public"."residentes" FOR SELECT USING (("conjunto_id" = ( SELECT "usuarios_app"."conjunto_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"()))));



CREATE POLICY "residentes_select_same_conjunto" ON "public"."residentes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_app" "ua"
  WHERE (("ua"."id" = "auth"."uid"()) AND ("ua"."conjunto_id" = "residentes"."conjunto_id")))));



ALTER TABLE "public"."tipos_documento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tipos_documento_select_authenticated" ON "public"."tipos_documento" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."trasteos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update comprobante pagos" ON "public"."pagos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "update pagos admin" ON "public"."pagos" FOR UPDATE USING ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "update paquetes vigilancia" ON "public"."paquetes" FOR UPDATE USING ((( SELECT "usuarios_app"."rol_id"
   FROM "public"."usuarios_app"
  WHERE ("usuarios_app"."id" = "auth"."uid"())) = 'vigilancia'::"text"));



CREATE POLICY "usuario puede verse" ON "public"."usuarios_app" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "usuarios actualizar su info" ON "public"."usuarios_app" FOR UPDATE USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."usuarios_app" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehiculos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ver mis notificaciones" ON "public"."notificaciones" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."visitantes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visitantes_insert_propios" ON "public"."visitantes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."residentes" "r"
  WHERE (("r"."id" = "visitantes"."residente_id") AND ("r"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "visitantes_select_propios" ON "public"."visitantes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."residentes" "r"
  WHERE (("r"."id" = "visitantes"."residente_id") AND ("r"."usuario_id" = "auth"."uid"())))));



CREATE POLICY "visitantes_select_same_conjunto" ON "public"."visitantes" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."usuarios_app" "ua"
  WHERE (("ua"."id" = "auth"."uid"()) AND ("ua"."conjunto_id" = "visitantes"."conjunto_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."residentes" "r"
     JOIN "public"."usuarios_app" "ua" ON (("ua"."id" = "auth"."uid"())))
  WHERE (("r"."id" = "visitantes"."residente_id") AND ("ua"."conjunto_id" = "r"."conjunto_id"))))));



CREATE POLICY "visitantes_update_propios" ON "public"."visitantes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."residentes" "r"
  WHERE (("r"."id" = "visitantes"."residente_id") AND ("r"."usuario_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."residentes" "r"
  WHERE (("r"."id" = "visitantes"."residente_id") AND ("r"."usuario_id" = "auth"."uid"())))));



ALTER TABLE "public"."zonas_comunes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."apartamentos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."config_pagos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."incidentes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notificaciones";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pagos";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."paquetes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."registro_visitas";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tipos_documento";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."torres";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."visitantes";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auth_conjunto_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auth_conjunto_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auth_conjunto_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auth_residente_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auth_residente_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auth_residente_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auth_rol"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auth_rol"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auth_rol"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_o_reutilizar_visitante_y_registro"("p_conjunto_id" "uuid", "p_residente_id" "uuid", "p_apartamento_id" "uuid", "p_nombre" "text", "p_tipo_documento" "text", "p_documento" "text", "p_tipo_vehiculo" "text", "p_placa" "text", "p_fecha_visita" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_o_reutilizar_visitante_y_registro"("p_conjunto_id" "uuid", "p_residente_id" "uuid", "p_apartamento_id" "uuid", "p_nombre" "text", "p_tipo_documento" "text", "p_documento" "text", "p_tipo_vehiculo" "text", "p_placa" "text", "p_fecha_visita" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_o_reutilizar_visitante_y_registro"("p_conjunto_id" "uuid", "p_residente_id" "uuid", "p_apartamento_id" "uuid", "p_nombre" "text", "p_tipo_documento" "text", "p_documento" "text", "p_tipo_vehiculo" "text", "p_placa" "text", "p_fecha_visita" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_registrar_ingreso_visita"("p_qr_code" "text", "p_vigilante_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_registrar_ingreso_visita"("p_qr_code" "text", "p_vigilante_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_ingreso_visita"("p_qr_code" "text", "p_vigilante_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_registrar_salida_visita"("p_registro_id" "uuid", "p_vigilante_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_visita"("p_registro_id" "uuid", "p_vigilante_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_registrar_salida_visita"("p_registro_id" "uuid", "p_vigilante_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";


















GRANT ALL ON TABLE "public"."accesos" TO "anon";
GRANT ALL ON TABLE "public"."accesos" TO "authenticated";
GRANT ALL ON TABLE "public"."accesos" TO "service_role";



GRANT ALL ON TABLE "public"."apartamentos" TO "anon";
GRANT ALL ON TABLE "public"."apartamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."apartamentos" TO "service_role";



GRANT ALL ON TABLE "public"."archivos" TO "anon";
GRANT ALL ON TABLE "public"."archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos" TO "service_role";



GRANT ALL ON TABLE "public"."comunicados" TO "anon";
GRANT ALL ON TABLE "public"."comunicados" TO "authenticated";
GRANT ALL ON TABLE "public"."comunicados" TO "service_role";



GRANT ALL ON TABLE "public"."config_pagos" TO "anon";
GRANT ALL ON TABLE "public"."config_pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."config_pagos" TO "service_role";



GRANT ALL ON TABLE "public"."conjuntos" TO "anon";
GRANT ALL ON TABLE "public"."conjuntos" TO "authenticated";
GRANT ALL ON TABLE "public"."conjuntos" TO "service_role";



GRANT ALL ON TABLE "public"."incidentes" TO "anon";
GRANT ALL ON TABLE "public"."incidentes" TO "authenticated";
GRANT ALL ON TABLE "public"."incidentes" TO "service_role";



GRANT ALL ON TABLE "public"."multas" TO "anon";
GRANT ALL ON TABLE "public"."multas" TO "authenticated";
GRANT ALL ON TABLE "public"."multas" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."pagos" TO "anon";
GRANT ALL ON TABLE "public"."pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos" TO "service_role";



GRANT ALL ON TABLE "public"."paquetes" TO "anon";
GRANT ALL ON TABLE "public"."paquetes" TO "authenticated";
GRANT ALL ON TABLE "public"."paquetes" TO "service_role";



GRANT ALL ON TABLE "public"."parqueaderos" TO "anon";
GRANT ALL ON TABLE "public"."parqueaderos" TO "authenticated";
GRANT ALL ON TABLE "public"."parqueaderos" TO "service_role";



GRANT ALL ON TABLE "public"."pqr" TO "anon";
GRANT ALL ON TABLE "public"."pqr" TO "authenticated";
GRANT ALL ON TABLE "public"."pqr" TO "service_role";



GRANT ALL ON TABLE "public"."recursos_comunes" TO "anon";
GRANT ALL ON TABLE "public"."recursos_comunes" TO "authenticated";
GRANT ALL ON TABLE "public"."recursos_comunes" TO "service_role";



GRANT ALL ON TABLE "public"."registro_visitas" TO "anon";
GRANT ALL ON TABLE "public"."registro_visitas" TO "authenticated";
GRANT ALL ON TABLE "public"."registro_visitas" TO "service_role";



GRANT ALL ON TABLE "public"."reservas" TO "anon";
GRANT ALL ON TABLE "public"."reservas" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas" TO "service_role";



GRANT ALL ON TABLE "public"."reservas_bloqueos" TO "anon";
GRANT ALL ON TABLE "public"."reservas_bloqueos" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas_bloqueos" TO "service_role";



GRANT ALL ON TABLE "public"."reservas_documentos" TO "anon";
GRANT ALL ON TABLE "public"."reservas_documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas_documentos" TO "service_role";



GRANT ALL ON TABLE "public"."reservas_eventos" TO "anon";
GRANT ALL ON TABLE "public"."reservas_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."reservas_zonas" TO "anon";
GRANT ALL ON TABLE "public"."reservas_zonas" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas_zonas" TO "service_role";



GRANT ALL ON TABLE "public"."residentes" TO "anon";
GRANT ALL ON TABLE "public"."residentes" TO "authenticated";
GRANT ALL ON TABLE "public"."residentes" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_documento" TO "anon";
GRANT ALL ON TABLE "public"."tipos_documento" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_documento" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tipos_documento_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tipos_documento_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tipos_documento_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."torres" TO "anon";
GRANT ALL ON TABLE "public"."torres" TO "authenticated";
GRANT ALL ON TABLE "public"."torres" TO "service_role";



GRANT ALL ON TABLE "public"."trasteos" TO "anon";
GRANT ALL ON TABLE "public"."trasteos" TO "authenticated";
GRANT ALL ON TABLE "public"."trasteos" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_app" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_app" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_app" TO "service_role";



GRANT ALL ON TABLE "public"."vehiculos" TO "anon";
GRANT ALL ON TABLE "public"."vehiculos" TO "authenticated";
GRANT ALL ON TABLE "public"."vehiculos" TO "service_role";



GRANT ALL ON TABLE "public"."visitantes" TO "anon";
GRANT ALL ON TABLE "public"."visitantes" TO "authenticated";
GRANT ALL ON TABLE "public"."visitantes" TO "service_role";



GRANT ALL ON TABLE "public"."zonas_comunes" TO "anon";
GRANT ALL ON TABLE "public"."zonas_comunes" TO "authenticated";
GRANT ALL ON TABLE "public"."zonas_comunes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































