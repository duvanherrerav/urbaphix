begin;

-- Structural security checks that do not depend on production test users.
do $$
begin
  if to_regprocedure('public.fn_session_bootstrap(uuid)') is null then
    raise exception 'fn_session_bootstrap(uuid) is missing';
  end if;

  if has_function_privilege('anon', 'public.fn_session_bootstrap(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute fn_session_bootstrap';
  end if;

  if not has_function_privilege('authenticated', 'public.fn_session_bootstrap(uuid)', 'EXECUTE') then
    raise exception 'authenticated must execute fn_session_bootstrap';
  end if;

  if not has_function_privilege('service_role', 'public.fn_session_bootstrap(uuid)', 'EXECUTE') then
    raise exception 'service_role must execute fn_session_bootstrap';
  end if;
end;
$$;

-- Unauthenticated calls must fail because auth.uid() is null.
do $$
begin
  perform public.fn_session_bootstrap(null);
  raise exception 'unauthenticated call unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

rollback;
