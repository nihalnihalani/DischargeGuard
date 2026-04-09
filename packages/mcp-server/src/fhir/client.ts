import type { FhirBundle } from "./types.js";

const FHIR_BASE_URL = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";

async function fhirFetch<T>(path: string): Promise<T> {
  const url = `${FHIR_BASE_URL}/${path}`;
  const response = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
  });
  if (!response.ok) {
    throw new Error(`FHIR request failed [${response.status}]: GET ${url}`);
  }
  return response.json() as Promise<T>;
}

/** Read a single FHIR resource by type and id */
export async function fhirRead<T>(resourceType: string, id: string): Promise<T> {
  return fhirFetch<T>(`${resourceType}/${id}`);
}

/** Search FHIR resources, following pagination (next links) up to maxPages */
export async function fhirSearch<T>(
  resourceType: string,
  params: Record<string, string>,
  maxPages = 5
): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  let url: string | null = `${FHIR_BASE_URL}/${resourceType}?${qs}&_count=100`;
  const results: T[] = [];
  let pages = 0;

  while (url && pages < maxPages) {
    const bundle: FhirBundle = await fhirFetch<FhirBundle>(
      url.replace(FHIR_BASE_URL + "/", "")
    );
    const entries = bundle.entry ?? [];
    for (const entry of entries) {
      if (entry.resource) results.push(entry.resource as T);
    }
    const nextLink: { relation: string; url: string } | undefined = bundle.link?.find((l: { relation: string; url: string }) => l.relation === "next");
    url = nextLink?.url ?? null;
    pages++;
  }

  return results;
}
