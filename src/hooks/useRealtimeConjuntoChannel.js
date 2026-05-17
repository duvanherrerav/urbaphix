import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';

export const useRealtimeConjuntoChannel = ({
    conjuntoId,
    channelName,
    table,
    event = '*',
    schema = 'public',
    debounceMs = 250,
    onRefresh,
    warningMessage = 'Realtime channel error'
}) => {
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!conjuntoId || !channelName || !table || !onRefreshRef.current) return undefined;

        let mounted = true;
        let refreshTimeout = null;
        let requestVersion = 0;

        const isActive = (requestId) => mounted && requestId === requestVersion;

        const refresh = () => {
            if (!mounted || !onRefreshRef.current) return;
            const currentRequest = ++requestVersion;
            onRefreshRef.current(conjuntoId, {
                isActive: () => isActive(currentRequest)
            });
        };

        const scheduleRefresh = () => {
            if (!mounted) return;
            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                refreshTimeout = null;
                refresh();
            }, debounceMs);
        };

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event, schema, table, filter: `conjunto_id=eq.${conjuntoId}` },
                scheduleRefresh
            )
            .subscribe((status) => {
                if (!mounted) return;
                if (status === 'SUBSCRIBED') {
                    scheduleRefresh();
                }
                if (status === 'CHANNEL_ERROR') {
                    logger.warn(warningMessage, { conjuntoId, channelName, table });
                }
            });

        refresh();

        return () => {
            mounted = false;
            requestVersion += 1;
            if (refreshTimeout) clearTimeout(refreshTimeout);
            supabase.removeChannel(channel);
        };
    }, [channelName, conjuntoId, debounceMs, event, schema, table, warningMessage]);
};
