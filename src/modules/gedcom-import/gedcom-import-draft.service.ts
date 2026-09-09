import type {
    CreateGedcomImportDraftInput,
    GedcomImportDraftCleanupResult,
    GedcomImportDraftRepository,
} from './gedcom-import-draft.repository.js';
import type { GedcomImportDraft } from './gedcom-import-persistence.types.js';

export const DEFAULT_GEDCOM_IMPORT_DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;

type DraftStore = Pick<GedcomImportDraftRepository, 'create' | 'deleteExpired'>;
type CreateDraftInput = Omit<CreateGedcomImportDraftInput, 'expiresAt'>;

export class GedcomImportDraftService {
    constructor(
        private readonly repository: DraftStore,
        private readonly ttlMs = DEFAULT_GEDCOM_IMPORT_DRAFT_TTL_MS,
        private readonly now: () => Date = () => new Date(),
    ) {
        if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
            throw new Error('The GEDCOM import draft lifetime must be a positive integer.');
        }
    }

    async create(input: CreateDraftInput): Promise<GedcomImportDraft> {
        const currentTime = this.now();
        const expiresAt = new Date(currentTime.getTime() + this.ttlMs);

        return this.repository.create({
            ...input,
            expiresAt,
        });
    }

    cleanupExpired(): Promise<GedcomImportDraftCleanupResult> {
        return this.repository.deleteExpired(this.now());
    }
}
