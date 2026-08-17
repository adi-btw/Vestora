import { z } from 'zod';

export const scoreFactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  weight: z.number(),
  detail: z.string(),
});
export type ScoreFactor = z.infer<typeof scoreFactorSchema>;

export const signalsSchema = z.object({
  name: z.string().nullable().optional(),
  aiGenerated: z.boolean().optional(),
  factors: z.array(scoreFactorSchema).default([]),
});
export type Signals = z.infer<typeof signalsSchema>;

export const recommendationSchema = z.object({
  symbol: z.string(),
  score: z.number(),
  thesis: z.string(),
  risks: z.string(),
  confidence: z.number(),
  signals: signalsSchema,
  generatedAt: z.string(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const refreshResponseSchema = z.object({
  recommendations: z.array(recommendationSchema),
  aiEnabled: z.boolean(),
});
