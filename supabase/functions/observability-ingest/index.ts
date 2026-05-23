import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_MODULES = new Set([
  "auth",
  "dashboard",
  "visitas",
  "porteria",
  "qr",
  "pagos",
  "reservas",
  "incidentes",
  "paqueteria",
  "seguridad",
  "supabase",
  "app",
]);
const ALLOWED_SEVERITIES = new Set(["info", "warn", "error"]);
const SENSITIVE_KEY_PATTERN = /(token|session|password|secret|authorization|auth|cookie|jwt|email|telefono|phone|placa|document|comprobante|signed|url|payload|headers|fullname|full_name|name)/i;

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const truncate = (value: unknown, max: number) => String(value ?? "").slice(0, max);

const sanitizeScalar = (key: string, value: unknown) => {
  if (typeof value === "string" && SENSITIVE_KEY_PATTERN.test(key)) return "[redacted]";
  if (typeof value === "string") return truncate(value, 140);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  return `[${typeof value}]`;
};

const sanitizeMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const entries = Object.entries(metadata as Record<string, unknown>).slice(0, 25);
  return Object.fromEntries(entries.map(([key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) return [key, "[redacted]"];
    if (Array.isArray(value)) return [key, `[array:${value.length}]`];
    if (value && typeof value === "object") return [key, "[object]"];
    return [key, sanitizeScalar(key, value)];
  }));
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonResponse(500, { ok: false, error: "missing_server_env" });
  if (!authHeader.startsWith("Bearer ")) return jsonResponse(401, { ok: false, error: "missing_bearer" });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const module = truncate(payload.module, 64).toLowerCase();
  const action = truncate(payload.action, 64).toLowerCase();
  const severity = truncate(payload.severity, 16).toLowerCase();
  const message = truncate(payload.message, 280);
  const eventType = payload.event_type == null ? null : truncate(payload.event_type, 64);
  const environment = payload.environment == null ? null : truncate(payload.environment, 32);
  const source = "frontend";

  if (!ALLOWED_MODULES.has(module)) return jsonResponse(400, { ok: false, error: "invalid_module" });
  if (!ALLOWED_SEVERITIES.has(severity)) return jsonResponse(400, { ok: false, error: "invalid_severity" });
  if (action.length < 2) return jsonResponse(400, { ok: false, error: "invalid_action" });
  if (message.length < 1) return jsonResponse(400, { ok: false, error: "invalid_message" });

  const metadata = sanitizeMetadata(payload.metadata ?? {});
  if (!metadata) return jsonResponse(400, { ok: false, error: "invalid_metadata" });
  const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata)).length;
  if (metadataBytes > 4096) return jsonResponse(400, { ok: false, error: "metadata_too_large" });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse(401, { ok: false, error: "invalid_user" });

  const actorRole = payload.actor_role == null ? null : truncate(payload.actor_role, 32).toLowerCase();
  const errorType = payload.error_type == null ? null : truncate(payload.error_type, 64);
  const errorCode = payload.error_code == null ? null : truncate(payload.error_code, 64);
  const httpStatus = Number.isInteger(payload.http_status) ? payload.http_status as number : null;
  const conjuntoId = typeof payload.conjunto_id === "string" ? truncate(payload.conjunto_id, 36) : null;

  const { error: insertError } = await adminClient.from("operational_events").insert({
    conjunto_id: conjuntoId,
    actor_user_id: userData.user.id,
    actor_role: actorRole,
    module,
    action,
    severity,
    event_type: eventType,
    message,
    error_type: errorType,
    error_code: errorCode,
    http_status: httpStatus,
    metadata,
    environment,
    source,
  });

  if (insertError) return jsonResponse(500, { ok: false, error: "insert_failed" });
  return jsonResponse(200, { ok: true });
});
