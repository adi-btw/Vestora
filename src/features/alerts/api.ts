import { z } from 'zod';

import type { NewAlert } from '@/features/alerts/schemas';
import type { AlertEventRow, AlertRow } from '@/lib/database.types';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export async function fetchAlerts(): Promise<AlertRow[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAlertEvents(): Promise<AlertEventRow[]> {
  const { data, error } = await supabase
    .from('alert_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data ?? [];
}

export async function createAlert(userId: string, alert: NewAlert): Promise<AlertRow> {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      symbol: alert.symbol.toUpperCase(),
      kind: alert.kind,
      threshold: alert.threshold,
      keyword: alert.keyword,
      cooldown_minutes: alert.cooldownMinutes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setAlertActive(alertId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('alerts').update({ is_active: isActive }).eq('id', alertId);
  if (error) throw error;
}

export async function deleteAlert(alertId: string): Promise<void> {
  const { error } = await supabase.from('alerts').delete().eq('id', alertId);
  if (error) throw error;
}

export async function clearAlertEvents(): Promise<void> {
  const { error } = await supabase.from('alert_events').delete().not('id', 'is', null);
  if (error) throw error;
}

const registerResponseSchema = z.object({ registered: z.boolean() });

export function registerPushToken(token: string, platform: 'ios' | 'android' | 'web' | 'unknown') {
  return invokeFunction('register-push-token', { token, platform }, registerResponseSchema);
}
