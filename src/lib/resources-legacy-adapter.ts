import type { SubjectSlug } from "@/lib/subjects";
import type { ResourceDocument } from "@/lib/resources-domain";
import {
  deleteResourceLibraryMeta,
  listAllResourceLibraryMeta,
  upsertResourceLibraryMeta,
} from "@/lib/resources-library-meta-store";
import {
  deletePdfResource,
  getPdfResourceBlob,
  listPdfResources,
  putPdfResource,
  RESOURCES_UPDATED_EVENT,
  updatePdfResourceMeta,
  type PdfResource,
} from "@/lib/resources-pdf-store";

export type LegacyResourceDocument = ResourceDocument & {
  pageStart: number;
  pageEnd: number;
  version: number;
};

type LegacyPutInput = {
  title: string;
  blob: Blob;
  pageStart?: number;
  pageEnd?: number;
  subjectSlug?: SubjectSlug;
};

type LegacyPatchInput = Partial<
  Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug"> & {
    folderPath: string | undefined;
    starred: boolean;
    tags: string[];
  }
>;

function emitResourcesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
}

function isSubjectSlug(value: unknown): value is SubjectSlug {
  return (
    value === "anatomia" ||
    value === "histologia" ||
    value === "embriologia" ||
    value === "biologia-celular" ||
    value === "ingles" ||
    value === "trabajo-online"
  );
}

function toLegacyResourceDocument(
  meta: PdfResource,
  libraryMeta: ReturnType<typeof listAllResourceLibraryMeta>[string] | undefined,
): LegacyResourceDocument {
  const updatedAtMs = Math.max(meta.createdAtMs, meta.updatedAtMs, libraryMeta?.updatedAtMs ?? meta.createdAtMs);
  const version = Math.max(1, meta.version, libraryMeta?.version ?? 1);
  return {
    id: meta.id,
    title: meta.title,
    subjectSlug: isSubjectSlug(meta.subjectSlug) ? meta.subjectSlug : undefined,
    sourceType: "upload",
    pageCount: Math.max(1, Math.floor(meta.pageEnd || 1)),
    sizeBytes: meta.sizeBytes,
    blobRef: `idb:pdfs:${meta.id}`,
    starred: libraryMeta?.starred ?? false,
    folderPath: libraryMeta?.folderPath,
    createdAtMs: meta.createdAtMs,
    updatedAtMs,
    version,
    pageStart: meta.pageStart,
    pageEnd: meta.pageEnd,
    tags: libraryMeta?.tags ?? [],
  };
}

export async function listLegacyResourceDocuments(): Promise<LegacyResourceDocument[]> {
  const all = await listPdfResources();
  const libraryMetaMap = listAllResourceLibraryMeta();
  return all.map((item) => toLegacyResourceDocument(item, libraryMetaMap[item.id]));
}

export async function getLegacyResourceBlob(documentId: string): Promise<Blob | null> {
  return getPdfResourceBlob(documentId);
}

export async function putLegacyResourceDocument(input: LegacyPutInput): Promise<LegacyResourceDocument> {
  const saved = await putPdfResource(input);
  const libraryMeta = upsertResourceLibraryMeta(saved.id, {
    starred: false,
    folderPath: undefined,
    tags: [],
  });
  return toLegacyResourceDocument(saved, libraryMeta);
}

export async function updateLegacyResourceDocumentMeta(documentId: string, patch: LegacyPatchInput): Promise<void> {
  const pdfPatch: Partial<Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug">> = {};
  if (patch.title !== undefined) pdfPatch.title = patch.title;
  if (patch.pageStart !== undefined) pdfPatch.pageStart = patch.pageStart;
  if (patch.pageEnd !== undefined) pdfPatch.pageEnd = patch.pageEnd;
  if (patch.subjectSlug !== undefined) pdfPatch.subjectSlug = patch.subjectSlug;

  const hasPdfPatch =
    pdfPatch.title !== undefined ||
    pdfPatch.pageStart !== undefined ||
    pdfPatch.pageEnd !== undefined ||
    pdfPatch.subjectSlug !== undefined;

  if (hasPdfPatch) {
    await updatePdfResourceMeta(documentId, pdfPatch);
  }

  const hasLibraryPatch = patch.starred !== undefined || patch.folderPath !== undefined || patch.tags !== undefined;
  if (hasLibraryPatch) {
    upsertResourceLibraryMeta(documentId, {
      starred: patch.starred,
      folderPath: patch.folderPath,
      tags: patch.tags,
    });
    if (!hasPdfPatch) {
      emitResourcesUpdated();
    }
  }
}

export async function deleteLegacyResourceDocument(documentId: string): Promise<void> {
  await deletePdfResource(documentId);
  deleteResourceLibraryMeta(documentId);
}

export { RESOURCES_UPDATED_EVENT };
