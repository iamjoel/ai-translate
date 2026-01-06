export function tokensToCost(tokens: number, pricePerMillion: number) {
  return (tokens / 1_000_000) * pricePerMillion;
}

export function formatTokens(value: number) {
  return value.toLocaleString("en-US");
}
