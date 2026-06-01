import "server-only";

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDING_DIMENSION = 768;

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: unknown;
  };
  error?: {
    message?: string;
  };
};

function normalizeEmbeddingValues(values: unknown) {
  if (!Array.isArray(values)) {
    throw new Error("Gemini embedding response did not include values");
  }

  const embedding = values.map((value) => Number(value));
  if (embedding.length === 0 || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Gemini embedding response included invalid values");
  }

  return embedding;
}

export async function generateGeminiTextEmbedding(apiKey: string, text: string) {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("Embedding text is required");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: normalizedText }],
        },
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: GEMINI_EMBEDDING_DIMENSION,
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  const payload = (await response.json().catch(() => null)) as GeminiEmbeddingResponse | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Gemini embedding request failed with status ${response.status}`
    );
  }

  return normalizeEmbeddingValues(payload?.embedding?.values);
}
