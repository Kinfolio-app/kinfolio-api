import { createHash } from 'node:crypto';
import {
    BadRequestError,
    ConflictError,
    GoneError,
    NotFoundError,
} from '../../shared/errors/http-error.js';
import type {
    CreateGedcomImportDraftForNewSourceInput,
    CreateGedcomImportDraftInput,
    GedcomImportDraftCleanupResult,
    GedcomImportDraftRepository,
} from './gedcom-import-draft.repository.js';
import {
    GedcomImportDraftStatus,
    type GedcomImportDraft,
    type GedcomImportRun,
    type StoredGedcomImportData,
} from './gedcom-import-persistence.types.js';
import { createGedcomImportPlan } from './gedcom-import-plan.mapper.js';
import { GedcomMappingIssueKind } from './gedcom-import-plan.types.js';
import {
    GedcomImportAnalysisStatus,
    type GedcomImportAnalysisResult,
    type GedcomImportService,
} from './gedcom-import.service.js';
import type { GedcomImportRepository } from './gedcom-import.repository.js';

export const DEFAULT_GEDCOM_IMPORT_DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;

type DraftStore = Pick<
    GedcomImportDraftRepository,
    | 'create'
    | 'createForNewSource'
    | 'findById'
    | 'updateResolutions'
    | 'deleteById'
    | 'deleteExpired'
>;

type ImportStore = Pick<GedcomImportRepository, 'findSourceById' | 'findRunByFingerprint'>;

export type CreateGedcomImportDraftRequest =
    { file: Uint8Array; sourceId: string } | { file: Uint8Array; sourceName: string };

export type CreateGedcomImportDraftResult =
    | { status: 'created'; draft: GedcomImportDraft }
    | { status: 'already_imported'; run: GedcomImportRun }
    | { status: 'invalid_file'; analysis: GedcomImportAnalysisResult };

export type UpdateGedcomImportDraftRequest = {
    revision: number;
    resolutions: StoredGedcomImportData;
};

function determineDraftStatus(plan: GedcomImportDraft['plan']): GedcomImportDraftStatus {
    if (plan.issues.some((issue) => issue.kind === GedcomMappingIssueKind.Invalid)) {
        return GedcomImportDraftStatus.Blocked;
    }

    if (plan.issues.some((issue) => issue.kind === GedcomMappingIssueKind.Ambiguous)) {
        return GedcomImportDraftStatus.NeedsResolution;
    }

    return GedcomImportDraftStatus.Ready;
}

export class GedcomImportDraftService {
    constructor(
        private readonly repository: DraftStore,
        private readonly importRepository: ImportStore,
        private readonly importService: Pick<GedcomImportService, 'analyze'>,
        private readonly ttlMs = DEFAULT_GEDCOM_IMPORT_DRAFT_TTL_MS,
        private readonly now: () => Date = () => new Date(),
    ) {
        if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
            throw new Error('The GEDCOM import draft lifetime must be a positive integer.');
        }
    }

    async create(input: CreateGedcomImportDraftRequest): Promise<CreateGedcomImportDraftResult> {
        const analysis = this.importService.analyze(input.file);

        if (
            analysis.status === GedcomImportAnalysisStatus.DetectionFailed ||
            analysis.parseResult.document === null
        ) {
            return { status: 'invalid_file', analysis };
        }

        const fileSha256 = createHash('sha256').update(input.file).digest('hex');
        const plan = createGedcomImportPlan(analysis.parseResult.document);
        const commonDraftInput: CreateGedcomImportDraftForNewSourceInput = {
            status: determineDraftStatus(plan),
            fileSha256,
            fileContent: input.file,
            gedcomVersion: analysis.version,
            plan,
            expiresAt: new Date(this.now().getTime() + this.ttlMs),
        };

        if ('sourceId' in input) {
            return this.createForExistingSource(input.sourceId, commonDraftInput);
        }

        const sourceName = input.sourceName.trim();

        if (sourceName.length === 0) {
            throw new BadRequestError({
                detail: 'The GEDCOM import source name must not be blank.',
            });
        }

        return {
            status: 'created',
            draft: await this.repository.createForNewSource(sourceName, commonDraftInput),
        };
    }

    async findById(id: string): Promise<GedcomImportDraft> {
        const draft = await this.repository.findById(id);

        if (draft === null) {
            throw new NotFoundError({
                detail: 'The requested GEDCOM import draft does not exist.',
            });
        }

        if (draft.expiresAt.getTime() <= this.now().getTime()) {
            throw new GoneError({
                detail: 'The requested GEDCOM import draft has expired.',
            });
        }

        return draft;
    }

    async updateResolutions(
        id: string,
        input: UpdateGedcomImportDraftRequest,
    ): Promise<GedcomImportDraft> {
        const currentDraft = await this.findById(id);

        if (currentDraft.revision !== input.revision) {
            throw new ConflictError({
                detail: 'The GEDCOM import draft was modified by another request.',
            });
        }

        const updatedDraft = await this.repository.updateResolutions({
            id,
            expectedRevision: input.revision,
            status: currentDraft.status,
            resolutions: input.resolutions,
        });

        if (updatedDraft !== null) return updatedDraft;

        await this.findById(id);
        throw new ConflictError({
            detail: 'The GEDCOM import draft was modified by another request.',
        });
    }

    async delete(id: string): Promise<void> {
        if (!(await this.repository.deleteById(id))) {
            throw new NotFoundError({
                detail: 'The requested GEDCOM import draft does not exist.',
            });
        }
    }

    cleanupExpired(): Promise<GedcomImportDraftCleanupResult> {
        return this.repository.deleteExpired(this.now());
    }

    private async createForExistingSource(
        sourceId: string,
        input: CreateGedcomImportDraftForNewSourceInput,
    ): Promise<CreateGedcomImportDraftResult> {
        const source = await this.importRepository.findSourceById(sourceId);

        if (source === null) {
            throw new NotFoundError({
                detail: 'The requested GEDCOM import source does not exist.',
            });
        }

        const previousRun = await this.importRepository.findRunByFingerprint(
            source.id,
            input.fileSha256,
        );

        if (previousRun !== null) {
            return { status: 'already_imported', run: previousRun };
        }

        const draftInput: CreateGedcomImportDraftInput = {
            ...input,
            sourceId: source.id,
        };

        return {
            status: 'created',
            draft: await this.repository.create(draftInput),
        };
    }
}
