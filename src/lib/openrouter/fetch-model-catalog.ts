import { z } from "zod";
import { OPENROUTER_MODELS_URL } from "@/lib/config";
import { fetchJson, type FetchLike } from "@/lib/http";
import type { OpenRouterCatalogEntry } from "@/lib/types";
import { toNullableNumber } from "@/lib/utils";

const OpenRouterCatalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      canonical_slug: z.string().optional().nullable(),
      hugging_face_id: z.string().optional().nullable(),
      name: z.string(),
      pricing: z
        .object({
          prompt: z.string().optional().nullable(),
          completion: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    }),
  ),
});

const toPerMillion = (value: string | null | undefined) => {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : parsed * 1_000_000;
};

export const fetchOpenRouterModelCatalog = async (
  fetchImpl: FetchLike,
): Promise<{
  fetchedAt: string;
  models: OpenRouterCatalogEntry[];
}> => {
  const payload = OpenRouterCatalogSchema.parse(
    await fetchJson(fetchImpl, OPENROUTER_MODELS_URL),
  );

  return {
    fetchedAt: new Date().toISOString(),
    models: payload.data.map((model) => ({
      id: model.id,
      canonicalSlug: model.canonical_slug ?? null,
      huggingFaceId: model.hugging_face_id ?? null,
      name: model.name,
      provider: model.id.split("/")[0] ?? "unknown",
      promptPricePerMillion: toPerMillion(model.pricing?.prompt ?? null),
      completionPricePerMillion: toPerMillion(
        model.pricing?.completion ?? null,
      ),
    })),
  };
};
