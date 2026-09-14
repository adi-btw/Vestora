import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { useQuotes } from '@/features/market/hooks';
import * as api from '@/features/portfolio/api';
import type { PortfolioSummary, Position } from '@/features/portfolio/schemas';
import { queryKeys } from '@/lib/query-keys';

export function usePortfolio() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.portfolio.summary(),
    queryFn: api.fetchPortfolio,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

function usePositions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.portfolio.all, 'positions'] as const,
    queryFn: api.fetchPositions,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

/**
 * The portfolio as the screen needs it: stored rows valued against live quotes.
 *
 * Cost basis and realised P&L come from Postgres; market value and unrealised P&L
 * are derived here so they move with the quote refresh rather than a page reload.
 */
export function usePortfolioSummary() {
  const portfolio = usePortfolio();
  const positions = usePositions();

  const symbols = useMemo(
    () => (positions.data ?? []).map((position) => position.symbol),
    [positions.data],
  );
  const quotes = useQuotes(symbols);

  const summary = useMemo<PortfolioSummary | null>(() => {
    if (!portfolio.data) return null;

    const cash = Number(portfolio.data.cash);
    const startingCash = Number(portfolio.data.starting_cash);

    const enriched: Position[] = (positions.data ?? []).map((row) => {
      const quantity = Number(row.quantity);
      const avgCost = Number(row.avg_cost);
      const quote = quotes.quotesBySymbol.get(row.symbol);
      const price = quote?.price ?? null;

      // Before the first quote lands, value the position at cost so equity does
      // not flash a misleading number.
      const marketValue = (price ?? avgCost) * quantity;
      const unrealizedPnl = price === null ? 0 : (price - avgCost) * quantity;

      return {
        symbol: row.symbol,
        quantity,
        avgCost,
        realizedPnl: Number(row.realized_pnl),
        price,
        marketValue,
        unrealizedPnl,
        unrealizedPercent: avgCost > 0 && price !== null ? (price / avgCost - 1) * 100 : null,
        dayChangePercent: quote?.changePercent ?? null,
      };
    });

    const positionsValue = enriched.reduce((sum, position) => sum + position.marketValue, 0);
    const equity = cash + positionsValue;

    return {
      cash,
      startingCash,
      positionsValue,
      equity,
      totalReturn: equity - startingCash,
      totalReturnPercent: startingCash > 0 ? (equity / startingCash - 1) * 100 : 0,
      unrealizedPnl: enriched.reduce((sum, position) => sum + position.unrealizedPnl, 0),
      realizedPnl: enriched.reduce((sum, position) => sum + position.realizedPnl, 0),
      positions: enriched.sort((a, b) => b.marketValue - a.marketValue),
    };
  }, [portfolio.data, positions.data, quotes.quotesBySymbol]);

  return {
    summary,
    isLoading: portfolio.isLoading || positions.isLoading,
    isError: portfolio.isError || positions.isError,
    error: portfolio.error ?? positions.error,
    refetch: () => {
      void portfolio.refetch();
      void positions.refetch();
      void quotes.refetch();
    },
  };
}

export function useOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.portfolio.orders(),
    queryFn: api.fetchOrders,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

export function useEquityCurve() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.portfolio.history(),
    queryFn: api.fetchEquityCurve,
    enabled: Boolean(user),
    // Snapshots are written once a day by the scheduled sweep.
    staleTime: 60 * 60_000,
  });
}

function useInvalidatePortfolio() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all });
  };
}

export function usePlaceOrder() {
  const invalidate = useInvalidatePortfolio();

  return useMutation({
    mutationFn: api.placeOrder,
    // A rejected order is a successful response with a reason, so refresh either
    // way: cash and positions may have changed.
    onSuccess: invalidate,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidatePortfolio();

  return useMutation({
    mutationFn: api.cancelOrder,
    onSuccess: invalidate,
  });
}
