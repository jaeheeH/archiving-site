export function getErrorMessage(error: unknown, fallback = "Internal server error") {
  return error instanceof Error && error.message ? error.message : fallback;
}
