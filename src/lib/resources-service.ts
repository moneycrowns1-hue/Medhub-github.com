import type { SubjectSlug } from "@/lib/subjects";
import {
  deleteLegacyResourceDocument,
  getLegacyResourceBlob,
  listLegacyResourceDocuments,
  putLegacyResourceDocument,
  RESOURCES_UPDATED_EVENT,
  updateLegacyResourceDocumentMeta,
} from "@/lib/resources-legacy-adapter";

export type PdfResource = {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
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

export { RESOURCES_UPDATED_EVENT };
