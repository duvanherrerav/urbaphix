#!/usr/bin/env node

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const OPTIONAL_TOKENS = [
  ['TOKEN_RESIDENTE', 'residente'],
  ['TOKEN_VIGILANCIA', 'vigilancia'],
  ['TOKEN_ADMIN', 'admin_conjunto'],
  ['TOKEN_CROSS', 'cross_tenant'],
  ['TOKEN_SUPERADMIN', 'superadmin']
];

const SELECT_COLUMNS = 'id,user_id,role_name,status,granted_by,granted_reason,revoked_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value.replace(/\/$/, '');
}

function stableRow(row) {
  return {
    id: row.id ? '<uuid>' : row.id,
    user_id: row.user_id ? '<uuid>' : row.user_id,
    role_name: row.role_name,
    status: row.status,
    granted_by: row.granted_by ? '<uuid>' : row.granted_by,
    granted_reason: row.granted_reason ? '<redacted>' : row.granted_reason,
    revoked_at: row.revoked_at ? '<timestamp>' : row.revoked_at
  };
}

function parseBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { non_json_body: text ? '<redacted>' : '' };
  }
}

async function authRequest({ path, token }) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  const text = await response.text();
  return { status: response.status, parsed: parseBody(text) };
}

async function request({ method, token, query = '', body }) {
  const url = `${SUPABASE_URL}/rest/v1/platform_memberships${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, parsed: parseBody(text) };
}

async function resolveTokenUserId(token, expectedUserId) {
  const result = await authRequest({ path: '/auth/v1/user', token });
  if (result.status === 401) return { ok: false, reason: 'JWT inválido o expirado al consultar /auth/v1/user' };
  if (result.status !== 200 || !result.parsed?.id) {
    return { ok: false, reason: `No se pudo confirmar auth.uid() real; /auth/v1/user respondió ${result.status}` };
  }
  if (expectedUserId && expectedUserId !== result.parsed.id) {
    return { ok: false, reason: 'RESIDENTE_USER_ID no coincide con el user_id del token residente' };
  }
  return { ok: true, userId: result.parsed.id };
}

function classifyRead(result, role) {
  if (result.status === 401) return 'SETUP_FAIL';
  if (result.status === 403) return 'PASS';
  if (result.status !== 200 || !Array.isArray(result.parsed)) return 'REVIEW';
  if (role === 'superadmin') return result.parsed.length > 0 ? 'PASS' : 'PASS_EMPTY_OR_NO_DATA';
  return result.parsed.length === 0 ? 'PASS' : 'REVIEW_SELF_READ_REQUIRED';
}

function classifyWrite(result) {
  if (result.status === 401) return 'SETUP_FAIL';
  if (result.status === 403) return 'PASS';
  if (result.status >= 400 && result.status < 500) return 'PASS_REJECTED';
  if (Array.isArray(result.parsed) && result.parsed.length === 0) return 'PASS_NO_ROWS_AFFECTED_ON_CONTROLLED_TARGET';
  return 'FAIL_P0_REVIEW';
}

function printCase(id, title, role, endpoint, result, classification) {
  const rows = Array.isArray(result.parsed) ? result.parsed.map(stableRow) : result.parsed;
  console.log(`\n### ${id} — ${title}`);
  console.log(`- Ambiente: DEV`);
  console.log(`- Rol usado: ${role}`);
  console.log(`- Endpoint: \`${endpoint}\``);
  console.log(`- Status code: \`${result.status}\``);
  console.log(`- Respuesta saneada: \`${JSON.stringify(rows)}\``);
  console.log(`- Cantidad de filas: \`${Array.isArray(result.parsed) ? result.parsed.length : 'n/a'}\``);
  console.log(`- Resultado: \`${classification}\``);
}

function printSetupCase(id, title, role, classification, reason) {
  console.log(`\n### ${id} — ${title}`);
  console.log(`- Ambiente: DEV`);
  console.log(`- Rol usado: ${role}`);
  console.log(`- Resultado: \`${classification}\``);
  console.log(`- Motivo: ${reason}`);
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  const tokens = Object.fromEntries(
    OPTIONAL_TOKENS.filter(([name]) => Boolean(process.env[name])).map(([name, role]) => [role, process.env[name]])
  );

  for (const [name, role] of OPTIONAL_TOKENS) {
    if (!process.env[name] && role !== 'superadmin') {
      printSetupCase('SETUP', `${role} — token requerido`, role, 'SETUP_FAIL', `falta \`${name}\`; no se ejecutó prueba autenticada.`);
    }
  }

  const readQuery = `?select=${encodeURIComponent(SELECT_COLUMNS)}`;
  const normalRoles = [
    ['P1', 'residente normal lista platform_memberships', 'residente'],
    ['P2', 'vigilancia normal lista platform_memberships', 'vigilancia'],
    ['P3', 'admin_conjunto normal lista platform_memberships', 'admin_conjunto'],
    ['P4', 'usuario cross-tenant normal lista platform_memberships', 'cross_tenant']
  ];

  for (const [id, title, role] of normalRoles) {
    if (!tokens[role]) continue;
    const result = await request({ method: 'GET', token: tokens[role], query: readQuery });
    printCase(id, title, role, `GET /rest/v1/platform_memberships${readQuery}`, result, classifyRead(result, role));
  }

  if (tokens.residente) {
    const expectedResidenteUserId = process.env.RESIDENTE_USER_ID;
    const resolvedUser = await resolveTokenUserId(tokens.residente, expectedResidenteUserId);
    if (!resolvedUser.ok) {
      printSetupCase('P5', 'residente intenta INSERT platform role', 'residente', 'SETUP_FAIL', resolvedUser.reason);
    } else {
      const insertResult = await request({
        method: 'POST',
        token: tokens.residente,
        body: { user_id: resolvedUser.userId, role_name: 'platform_ops', status: 'active' }
      });
      printCase('P5', 'residente intenta INSERT platform role con auth.uid() real', 'residente', 'POST /rest/v1/platform_memberships', insertResult, classifyWrite(insertResult));
    }

    const controlledTargetId = process.env.PLATFORM_MEMBERSHIP_TARGET_ID;
    if (!controlledTargetId) {
      printSetupCase('P6', 'residente intenta UPDATE platform role controlado', 'residente', 'NO_APLICABLE / PENDIENTE_POR_SETUP', 'falta `PLATFORM_MEMBERSHIP_TARGET_ID`; no se usa UUID inexistente para evitar falso PASS.');
      printSetupCase('P7', 'residente intenta DELETE platform membership controlado', 'residente', 'NO_APLICABLE / PENDIENTE_POR_SETUP', 'falta `PLATFORM_MEMBERSHIP_TARGET_ID`; no se usa UUID inexistente para evitar falso PASS.');
    } else if (!UUID_RE.test(controlledTargetId)) {
      printSetupCase('P6', 'residente intenta UPDATE platform role controlado', 'residente', 'SETUP_FAIL', '`PLATFORM_MEMBERSHIP_TARGET_ID` no tiene formato UUID válido.');
      printSetupCase('P7', 'residente intenta DELETE platform membership controlado', 'residente', 'SETUP_FAIL', '`PLATFORM_MEMBERSHIP_TARGET_ID` no tiene formato UUID válido.');
    } else {
      const encodedTargetId = encodeURIComponent(controlledTargetId);
      const patchResult = await request({ method: 'PATCH', token: tokens.residente, query: `?id=eq.${encodedTargetId}`, body: { status: 'active' } });
      printCase('P6', 'residente intenta UPDATE platform role controlado', 'residente', 'PATCH /rest/v1/platform_memberships?id=eq.<uuid-controlado>', patchResult, classifyWrite(patchResult));

      const deleteResult = await request({ method: 'DELETE', token: tokens.residente, query: `?id=eq.${encodedTargetId}` });
      printCase('P7', 'residente intenta DELETE platform membership controlado', 'residente', 'DELETE /rest/v1/platform_memberships?id=eq.<uuid-controlado>', deleteResult, classifyWrite(deleteResult));
    }
  }

  if (tokens.superadmin) {
    const result = await request({ method: 'GET', token: tokens.superadmin, query: readQuery });
    printCase('P8', 'superadmin controlado lista platform_memberships', 'superadmin', `GET /rest/v1/platform_memberships${readQuery}`, result, classifyRead(result, 'superadmin'));
  } else {
    printSetupCase('P8', 'superadmin controlado', 'superadmin', 'NO APLICABLE / PENDIENTE POR SETUP', 'no se suministró `TOKEN_SUPERADMIN`; no crear credenciales para esta prueba.');
  }
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
