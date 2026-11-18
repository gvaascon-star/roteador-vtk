-- Historico de encaminhamentos do Roteador VTK
-- Execute este arquivo no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.get_routing_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    occurred_at TIMESTAMPTZ,
    event_type TEXT,
    seller_name TEXT,
    actor_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'Autenticacao necessaria';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_profiles AS up
        WHERE up.id = (SELECT auth.uid())
          AND up.role IN ('admin', 'assistant')
    ) THEN
        RAISE EXCEPTION 'Usuario sem permissao';
    END IF;

    RETURN QUERY
    SELECT
        e.created_at,
        e.event_type::TEXT,
        COALESCE(s.name, 'Vendedor removido')::TEXT,
        COALESCE(up.full_name, 'Usuario')::TEXT
    FROM public.routing_events AS e
    LEFT JOIN public.sellers AS s
        ON s.id = e.seller_id
    LEFT JOIN public.user_profiles AS up
        ON up.id = e.actor_user_id
    ORDER BY e.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_routing_history(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_routing_history(INTEGER) TO authenticated;
