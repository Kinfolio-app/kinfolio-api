import type { GedcomImportDraft, GedcomImportRun } from './gedcom-import-persistence.types.js';
import type {
    AlreadyImportedGedcomResponseDto,
    GedcomImportDraftResponseDto,
} from './gedcom-import-draft.schema.js';

export function toGedcomImportDraftResponseDto(
    draft: GedcomImportDraft,
): GedcomImportDraftResponseDto {
    return {
        id: draft.id,
        sourceId: draft.sourceId,
        status: draft.status,
        fileSha256: draft.fileSha256,
        gedcomVersion: draft.gedcomVersion,
        plan: draft.plan,
        resolutions: draft.resolutions,
        baseVersions: draft.baseVersions,
        revision: draft.revision,
        expiresAt: draft.expiresAt.toISOString(),
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
    };
}

export function toAlreadyImportedGedcomResponseDto(
    run: GedcomImportRun,
): AlreadyImportedGedcomResponseDto {
    return {
        status: 'already_imported',
        runId: run.id,
        sourceId: run.sourceId,
        report: run.report,
        createdAt: run.createdAt.toISOString(),
    };
}
