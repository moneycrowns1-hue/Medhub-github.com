import type { SubjectSlug } from "@/lib/subjects";
import {
  deleteLegacyResourceDocument,
  getLegacyResourceBlob,
  listLegacyResourceDocuments,
  putLegacyResourceDocument,
  RESOURCES_UPDATED_EVENT,
  updateLegacyResourceDocumentMeta,
} from "@/lib/resources-legacy-adapter";
import {
  exportPdfResourcesBackup,
  importPdfResourcesBackup,
  type PdfResourceBackupItem,
} from "@/lib/resources-pdf-store";
import {
  listAllResourceLibraryMeta,
  mergeResourceLibraryMeta,
  type ResourceLibraryMeta,
} from "@/lib/resources-library-meta-store";

export type PdfResource = {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  version: number;
  pageStart: number;
  pageEnd: number;
  sizeBytes: number;
  subjectSlug?: SubjectSlug;
  starred: boolean;
  folderPath?: string;
  tags: string[];
};

function toPdfResource(input: Awaited<ReturnType<typeof listLegacyResourceDocuments>>[number]): PdfResource {
  return {
    id: input.id,
    title: input.title,
    createdAtMs: input.createdAtMs,
    updatedAtMs: input.updatedAtMs,
    version: input.version,
    pageStart: input.pageStart,
    pageEnd: input.pageEnd,
    sizeBytes: input.sizeBytes,
    subjectSlug: input.subjectSlug,
    starred: input.starred,
    folderPath: input.folderPath,
    tags: input.tags,
  };
}

export async function listPdfResources(): Promise<PdfResource[]> {
  const docs = await listLegacyResourceDocuments();
  return docs.map(toPdfResource);
}

export async function putPdfResource(input: {
  title: string;
  blob: Blob;
  pageStart?: number;
  pageEnd?: number;
  subjectSlug?: SubjectSlug;
}): Promise<PdfResource> {
  const saved = await putLegacyResourceDocument(input);
  return toPdfResource(saved);
}

export async function getPdfResourceBlob(id: string): Promise<Blob | null> {
  return getLegacyResourceBlob(id);
}

export async function updatePdfResourceMeta(
  id: string,
  patch: Partial<Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug" | "starred" | "folderPath" | "tags">>,
): Promise<void> {
  await updateLegacyResourceDocumentMeta(id, patch);
}

export async function deletePdfResource(id: string): Promise<void> {
  await deleteLegacyResourceDocument(id);
}

export type ResourcesLibraryBackup = {
  version: 1;
  exportedAtMs: number;
  resources: PdfResourceBackupItem[];
  libraryMeta: ResourceLibraryMeta[];
};

export async function exportResourcesLibraryBackup(): Promise<ResourcesLibraryBackup> {
  const [resources, libraryMetaMap] = await Promise.all([exportPdfResourcesBackup(), Promise.resolve(listAllResourceLibraryMeta())]);
  return {
    version: 1,
    exportedAtMs: Date.now(),
    resources,
    libraryMeta: Object.values(libraryMetaMap),
  };
}

export async function importResourcesLibraryBackup(input: { data: unknown }): Promise<{
  importedResources: number;
  skippedResources: number;
  importedMeta: number;
  skippedMeta: number;
}> {
  const parsed = input.data as Partial<ResourcesLibraryBackup>;
  const resources = Array.isArray(parsed?.resources) ? parsed.resources : [];
  const libraryMetaRows = Array.isArray(parsed?.libraryMeta) ? parsed.libraryMeta : [];

  const resourcesResult = await importPdfResourcesBackup({ items: resources as PdfResourceBackupItem[] });

  let importedMeta = 0;
  let skippedMeta = 0;
  for (const row of libraryMetaRows) {
    const candidate = row as Partial<ResourceLibraryMeta>;
    if (!candidate?.resourceId || typeof candidate.resourceId !== "string") {
      skippedMeta += 1;
      continue;
    }
    const merged = mergeResourceLibraryMeta({
      resourceId: candidate.resourceId,
      starred: !!candidate.starred,
      folderPath: candidate.folderPath,
      tags: Array.isArray(candidate.tags) ? candidate.tags : [],
      updatedAtMs: typeof candidate.updatedAtMs === "number" ? candidate.updatedAtMs : Date.now(),
      version: typeof candidate.version === "number" ? candidate.version : 1,
    });
    if (merged.applied) importedMeta += 1;
    else skippedMeta += 1;
  }

  return {
    importedResources: resourcesResult.imported,
    skippedResources: resourcesResult.skipped,
    importedMeta,
    skippedMeta,
  };
}

export { RESOURCES_UPDATED_EVENT };
