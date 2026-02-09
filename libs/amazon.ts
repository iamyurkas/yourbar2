import Constants from "expo-constants";

export type AmazonStore = "us" | "uk";
export type AmazonStorePref = "auto" | "us" | "uk" | "off";
export type DefaultAmazonStore = "US" | "UK" | "UNKNOWN";

export function buildAmazonSearchUrl(store: AmazonStore, query: string, tag?: string): string {
  const baseUrl = store === "us" ? "https://www.amazon.com/s" : "https://www.amazon.co.uk/s";
  const params = new URLSearchParams();
  params.set("k", query);

  const normalizedTag = tag?.trim();
  if (normalizedTag) {
    params.set("tag", normalizedTag);
  }

  return `${baseUrl}?${params.toString()}`;
}

export function getAmazonDomainLabel(store: AmazonStore): "Amazon.com" | "Amazon.co.uk" {
  return store === "us" ? "Amazon.com" : "Amazon.co.uk";
}

export function resolveEffectiveAmazonStore(
  preference: AmazonStorePref,
  defaultStore: DefaultAmazonStore,
): AmazonStore | null {
  if (preference === "off") {
    return null;
  }

  if (preference === "us" || preference === "uk") {
    return preference;
  }

  if (defaultStore === "US") {
    return "us";
  }

  return null;
}

export function getDefaultAmazonStore(): DefaultAmazonStore {
  // Expo apps do not expose a reliable install-store country. We use locale region as a
  // best-effort heuristic and only auto-enable links when we can confidently infer US.
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
  const region = locale.split(/[-_]/)[1]?.toUpperCase();

  if (region === "US") {
    return "US";
  }

  if (region === "GB") {
    return "UK";
  }

  return "UNKNOWN";
}

export function getAffiliateTagForStore(store: AmazonStore): string | undefined {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest2?.extra;
  const value = store === "us" ? extra?.amazonAffiliateTagUS : extra?.amazonAffiliateTagUK;

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
