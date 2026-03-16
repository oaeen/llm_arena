import { z } from "zod";
import type { ArenaLeaderboard } from "@/lib/types";
import { toNullableNumber } from "@/lib/utils";

const ArenaEntrySchema = z.object({
  rank: z.number(),
  rankUpper: z.number().optional().nullable(),
  rankLower: z.number().optional().nullable(),
  rating: z.number(),
  ratingUpper: z.number().optional().nullable(),
  ratingLower: z.number().optional().nullable(),
  votes: z.number().optional().nullable(),
  modelDisplayName: z.string(),
  modelOrganization: z.string().catch("Unknown"),
  modelUrl: z.string().optional().nullable(),
  license: z.string().optional().nullable(),
  inputPricePerMillion: z.number().optional().nullable(),
  outputPricePerMillion: z.number().optional().nullable(),
  contextLength: z.number().optional().nullable(),
});

const ArenaLeaderboardPayloadSchema = z.object({
  id: z.string().optional().nullable(),
  voteCutoffISOString: z.string().optional().nullable(),
  totalVotes: z.number().optional().nullable(),
  totalModels: z.number().optional().nullable(),
  entries: z.array(ArenaEntrySchema),
});

const FLIGHT_CHUNK_PATTERN =
  /self\.__next_f\.push\(\[\d+,"([\s\S]*?)"\]\)<\/script>/g;

const decodeFlightChunk = (rawChunk: string) =>
  JSON.parse(`"${rawChunk}"`) as string;

const decodeFlightPayload = (html: string) => {
  const decodedChunks: string[] = [];

  for (const match of html.matchAll(FLIGHT_CHUNK_PATTERN)) {
    try {
      decodedChunks.push(decodeFlightChunk(match[1]));
    } catch {
      continue;
    }
  }

  return decodedChunks.join("\n");
};

const extractJsonObject = (source: string, key: string) => {
  let offset = 0;

  while (offset < source.length) {
    const keyIndex = source.indexOf(key, offset);

    if (keyIndex === -1) {
      return null;
    }

    const startIndex = source.indexOf("{", keyIndex + key.length);
    if (startIndex === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
      const character = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          return source.slice(startIndex, index + 1);
        }
      }
    }

    offset = keyIndex + key.length;
  }

  return null;
};

export const parseArenaLeaderboardHtml = (
  html: string,
  leaderboardSlug: string,
  sourceUrl: string,
): ArenaLeaderboard => {
  const decodedPayload = decodeFlightPayload(html);
  const leaderboardJson = extractJsonObject(decodedPayload, '"leaderboard":');

  if (!leaderboardJson) {
    throw new Error("Unable to locate leaderboard payload in Arena HTML");
  }

  const parsedPayload = ArenaLeaderboardPayloadSchema.parse(
    JSON.parse(leaderboardJson),
  );

  return {
    id: parsedPayload.id,
    leaderboardSlug,
    voteCutoffISOString: parsedPayload.voteCutoffISOString,
    totalVotes: toNullableNumber(parsedPayload.totalVotes),
    totalModels: toNullableNumber(parsedPayload.totalModels),
    fetchedAt: new Date().toISOString(),
    sourceUrl,
    entries: parsedPayload.entries.map((entry) => ({
      ...entry,
      votes: toNullableNumber(entry.votes),
      rankUpper: toNullableNumber(entry.rankUpper),
      rankLower: toNullableNumber(entry.rankLower),
      ratingUpper: toNullableNumber(entry.ratingUpper),
      ratingLower: toNullableNumber(entry.ratingLower),
      inputPricePerMillion: toNullableNumber(entry.inputPricePerMillion),
      outputPricePerMillion: toNullableNumber(entry.outputPricePerMillion),
      contextLength: toNullableNumber(entry.contextLength),
    })),
  };
};
