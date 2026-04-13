import type { SubjectSlug } from "@/lib/subjects";

export type ResourceId = string;
export type ResourceTagId = string;
export type ResourceJobId = string;
export type ResourceEventId = string;

export type ResourceSourceType = "upload" | "scan" | "import" | "generated";

export type ResourceAnnotationType = "highlight" | "note" | "ink";

export type ResourceAiArtifactType = "summary" | "flashcards" | "qa" | "mindmap" | "translation";

export type ResourceJobType = "ocr" | "thumbnail" | "extract" | "compress" | "split" | "merge" | "reorder";

export type ResourceJobStatus = "queued" | "running" | "done" | "error";

export type ResourceDocument = {
  id: ResourceId;
  title: string;
  subjectSlug?: SubjectSlug;
  sourceType: ResourceSourceType;
  pageCount: number;
  sizeBytes: number;
  blobRef: string;
  folderPath?: string;
  tags: string[];
  starred: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceProgress = {
  documentId: ResourceId;
  lastPage: number;
  readingMinutes: number;
  completionPct: number;
  lastReadAtMs: number;
  updatedAtMs: number;
};

export type ResourceBookmark = {
  id: string;
  documentId: ResourceId;
  page: number;
  label?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceAnnotation = {
  id: string;
  documentId: ResourceId;
  page: number;
  type: ResourceAnnotationType;
  payload: Record<string, unknown>;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceTag = {
  id: ResourceTagId;
  name: string;
  color?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceDocumentTag = {
  documentId: ResourceId;
  tagId: ResourceTagId;
  createdAtMs: number;
};

export type ResourceAiArtifact = {
  id: string;
  documentId: ResourceId;
  type: ResourceAiArtifactType;
  pageStart?: number;
  pageEnd?: number;
  inputHash?: string;
  payload: Record<string, unknown>;
  version: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceJob = {
  id: ResourceJobId;
  documentId: ResourceId;
  type: ResourceJobType;
  status: ResourceJobStatus;
  progressPct: number;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ResourceDomainEventName =
  | "resource.document.created"
  | "resource.document.updated"
  | "resource.document.deleted"
  | "resource.progress.updated"
  | "resource.bookmark.created"
  | "resource.bookmark.deleted"
  | "resource.annotation.created"
  | "resource.annotation.updated"
  | "resource.annotation.deleted"
  | "resource.ai_artifact.created"
  | "resource.job.updated";

export type ResourceDomainEvent = {
  id: ResourceEventId;
  name: ResourceDomainEventName;
  documentId?: ResourceId;
  atMs: number;
  payload: Record<string, unknown>;
};

export interface ResourceDocumentRepository {
  list(): Promise<ResourceDocument[]>;
  getById(id: ResourceId): Promise<ResourceDocument | null>;
  create(input: Omit<ResourceDocument, "createdAtMs" | "updatedAtMs">): Promise<ResourceDocument>;
  update(id: ResourceId, patch: Partial<Omit<ResourceDocument, "id" | "createdAtMs">>): Promise<ResourceDocument | null>;
  delete(id: ResourceId): Promise<void>;
}

export interface ResourceProgressRepository {
  getByDocumentId(documentId: ResourceId): Promise<ResourceProgress | null>;
  upsert(input: ResourceProgress): Promise<ResourceProgress>;
}

export interface ResourceBookmarkRepository {
  listByDocumentId(documentId: ResourceId): Promise<ResourceBookmark[]>;
  create(input: Omit<ResourceBookmark, "createdAtMs" | "updatedAtMs">): Promise<ResourceBookmark>;
  delete(id: string): Promise<void>;
}

export interface ResourceAnnotationRepository {
  listByDocumentId(documentId: ResourceId): Promise<ResourceAnnotation[]>;
  create(input: Omit<ResourceAnnotation, "createdAtMs" | "updatedAtMs">): Promise<ResourceAnnotation>;
  update(id: string, patch: Partial<Omit<ResourceAnnotation, "id" | "documentId" | "createdAtMs">>): Promise<ResourceAnnotation | null>;
  delete(id: string): Promise<void>;
}

export interface ResourceTagRepository {
  list(): Promise<ResourceTag[]>;
  create(input: Omit<ResourceTag, "createdAtMs" | "updatedAtMs">): Promise<ResourceTag>;
  assignTag(input: ResourceDocumentTag): Promise<void>;
  unassignTag(documentId: ResourceId, tagId: ResourceTagId): Promise<void>;
  listDocumentTags(documentId: ResourceId): Promise<ResourceTag[]>;
}

export interface ResourceAiArtifactRepository {
  listByDocumentId(documentId: ResourceId): Promise<ResourceAiArtifact[]>;
  create(input: Omit<ResourceAiArtifact, "createdAtMs" | "updatedAtMs">): Promise<ResourceAiArtifact>;
}

export interface ResourceJobRepository {
  listByDocumentId(documentId: ResourceId): Promise<ResourceJob[]>;
  create(input: Omit<ResourceJob, "createdAtMs" | "updatedAtMs">): Promise<ResourceJob>;
  update(id: ResourceJobId, patch: Partial<Omit<ResourceJob, "id" | "documentId" | "createdAtMs">>): Promise<ResourceJob | null>;
}

export interface ResourceEventLogRepository {
  append(event: Omit<ResourceDomainEvent, "id" | "atMs">): Promise<ResourceDomainEvent>;
  listSince(atMs: number): Promise<ResourceDomainEvent[]>;
}

export interface ResourceRepositories {
  documents: ResourceDocumentRepository;
  progress: ResourceProgressRepository;
  bookmarks: ResourceBookmarkRepository;
  annotations: ResourceAnnotationRepository;
  tags: ResourceTagRepository;
  artifacts: ResourceAiArtifactRepository;
  jobs: ResourceJobRepository;
  events: ResourceEventLogRepository;
}

export const RESOURCES_DOMAIN_EVENT = "somagnus:resources:domain";
