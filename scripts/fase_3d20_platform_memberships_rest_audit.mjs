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
const sanitizedPayload = {
  user_id: 'b46ab33c-9237-4f43-a010-ff95ca1263a6',
  role_name: 'platform_ops',
  status: 'active'
};

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
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { non_json_body: text ? '<redacted>' : '' };
  }
  return { status: response.status, parsed };
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
  if (result.status === 204) return 'PASS_NO_ROWS_AFFECTED';
  if (result.status >= 400 && result.status < 500) return 'PASS_REJECTED';
  if (Array.isArray(result.parsed) && result.parsed.length === 0) return 'PASS_NO_ROWS_AFFECTED';
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

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

  const tokens = Object.fromEntries(
    OPTIONAL_TOKENS.filter(([name]) => Boolean(process.env[name])).map(([name, role]) => [role, process.env[name]])
  );

  for (const [name, role] of OPTIONAL_TOKENS) {
    if (!process.env[name] && role !== 'superadmin') {
      console.log(`\n### ${role} — SETUP_FAIL`);
      console.log(`- Motivo: falta \`${name}\`; no se ejecutó prueba autenticada.`);
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
    const insertResult = await request({ method: 'POST', token: tokens.residente, body: sanitizedPayload });
    printCase('P5', 'residente intenta INSERT platform role', 'residente', 'POST /rest/v1/platform_memberships', insertResult, classifyWrite(insertResult));

    const patchResult = await request({ method: 'PATCH', token: tokens.residente, query: '?id=eq.00000000-0000-0000-0000-000000000000', body: { status: 'active' } });
    printCase('P6', 'residente intenta UPDATE platform role inexistente/saneado', 'residente', 'PATCH /rest/v1/platform_memberships?id=eq.<uuid-saneado>', patchResult, classifyWrite(patchResult));

    const deleteResult = await request({ method: 'DELETE', token: tokens.residente, query: '?id=eq.00000000-0000-0000-0000-000000000000' });
    printCase('P7', 'residente intenta DELETE platform membership inexistente/saneado', 'residente', 'DELETE /rest/v1/platform_memberships?id=eq.<uuid-saneado>', deleteResult, classifyWrite(deleteResult));
  }

  if (tokens.superadmin) {
    const result = await request({ method: 'GET', token: tokens.superadmin, query: readQuery });
    printCase('P8', 'superadmin controlado lista platform_memberships', 'superadmin', `GET /rest/v1/platform_memberships${readQuery}`, result, classifyRead(result, 'superadmin'));
  } else {
    console.log(`\n### P8 — superadmin controlado`);
    console.log('- Resultado: `NO APLICABLE / PENDIENTE POR SETUP`');
    console.log('- Motivo: no se suministró `TOKEN_SUPERADMIN`; no crear credenciales para esta prueba.');
  }
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
