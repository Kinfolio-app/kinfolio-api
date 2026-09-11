import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GedcomFileDetector } from '../../../../src/modules/gedcom-import/gedcom-file-detector.js';
import { GedcomImportDraftService } from '../../../../src/modules/gedcom-import/gedcom-import-draft.service.js';
import {
    GedcomImportDraftStatus,
    type GedcomImportDraft,
} from '../../../../src/modules/gedcom-import/gedcom-import-persistence.types.js';
import { GedcomMappingIssueKind } from '../../../../src/modules/gedcom-import/gedcom-import-plan.types.js';
import { GedcomImportService } from '../../../../src/modules/gedcom-import/gedcom-import.service.js';
import { GedcomParserSelector } from '../../../../src/modules/gedcom-import/gedcom-parser-selector.js';

const NOW = new Date('2026-09-10T12:00:00.000Z');
const SOURCE_ID = 'a3b81ff0-b4e7-4f8a-9469-13b55fb7ba78';
const DRAFT_ID = '852c276f-e3dc-4aeb-9a48-e58278979f33';

function createFile(): Uint8Array {
    return Buffer.from(
        ['0 HEAD', '1 GEDC', '2 VERS 7.0.18', '0 @I1@ INDI', '1 NAME Ada /Martin/', '0 TRLR'].join(
            '\n',
        ),
        'utf8',
    );
}

function createDraft(overrides: Partial<GedcomImportDraft> = {}): GedcomImportDraft {
    return {
        id: DRAFT_ID,
        sourceId: SOURCE_ID,
        status: GedcomImportDraftStatus.Ready,
        fileSha256: createHash('sha256').update(createFile()).digest('hex'),
        fileContent: createFile(),
        gedcomVersion: '7.0.18',
        plan: {
            people: [],
            parentChildRelationships: [],
            coupleRelationships: [],
            coupleRelationshipEvents: [],
            issues: [],
        },
        resolutions: {},
        baseVersions: {},
        revision: 0,
        expiresAt: new Date('2026-09-11T12:00:00.000Z'),
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

function createDependencies() {
    const repository = {
        create: vi.fn(),
        createForNewSource: vi.fn(),
        findById: vi.fn(),
        updateResolutions: vi.fn(),
        deleteById: vi.fn(),
        deleteExpired: vi.fn(),
    };
    const importRepository = {
        findSourceById: vi.fn(),
        findRunByFingerprint: vi.fn(),
    };
    const importService = new GedcomImportService(
        new GedcomFileDetector(),
        new GedcomParserSelector(),
    );
    const service = new GedcomImportDraftService(
        repository,
        importRepository,
        importService,
        2 * 60 * 60 * 1_000,
        () => NOW,
    );

    return { repository, importRepository, service };
}

describe('GedcomImportDraftService', () => {
    it('builds and stores a ready draft with a new source', async () => {
        const { repository, service } = createDependencies();
        const storedDraft = createDraft();
        const file = createFile();
        repository.createForNewSource.mockResolvedValue(storedDraft);

        await expect(service.create({ file, sourceName: ' Synthetic tree ' })).resolves.toEqual({
            status: 'created',
            draft: storedDraft,
        });
        expect(repository.createForNewSource).toHaveBeenCalledWith(
            'Synthetic tree',
            expect.objectContaining({
                status: GedcomImportDraftStatus.Ready,
                fileSha256: createHash('sha256').update(file).digest('hex'),
                fileContent: file,
                gedcomVersion: '7.0.18',
                expiresAt: new Date('2026-09-10T14:00:00.000Z'),
                plan: expect.objectContaining({
                    people: [expect.objectContaining({ key: 'person:0' })],
                }),
            }),
        );
    });

    it('does not create a source or draft for an invalid file', async () => {
        const { repository, service } = createDependencies();

        const result = await service.create({
            file: Buffer.from('not a GEDCOM file', 'utf8'),
            sourceName: 'Invalid source',
        });

        expect(result.status).toBe('invalid_file');
        expect(repository.createForNewSource).not.toHaveBeenCalled();
    });

    it.each([
        {
            expectedStatus: GedcomImportDraftStatus.Blocked,
            records: [
                '0 @I1@ INDI',
                '1 NAME Alex /Martin/',
                '0 @F1@ FAM',
                '1 HUSB @I1@',
                '1 CHIL @I1@',
            ],
        },
        {
            expectedStatus: GedcomImportDraftStatus.NeedsResolution,
            records: [
                '0 @I1@ INDI',
                '1 NAME Alex /Martin/',
                '0 @I2@ INDI',
                '1 NAME Sam /Martin/',
                '1 FAMC @F1@',
                '2 PEDI UNRECOGNIZED',
                '0 @F1@ FAM',
                '1 HUSB @I1@',
                '1 CHIL @I2@',
            ],
        },
    ])(
        'derives the $expectedStatus status from the immutable plan',
        async ({ expectedStatus, records }) => {
            const { repository, service } = createDependencies();
            const file = Buffer.from(
                ['0 HEAD', '1 GEDC', '2 VERS 7.0.18', ...records, '0 TRLR'].join('\n'),
                'utf8',
            );
            repository.createForNewSource.mockResolvedValue(
                createDraft({ status: expectedStatus }),
            );

            await service.create({ file, sourceName: 'Status test source' });

            expect(repository.createForNewSource).toHaveBeenCalledWith(
                'Status test source',
                expect.objectContaining({ status: expectedStatus }),
            );
        },
    );

    it('keeps a draft blocked when its plan also contains an ambiguity', async () => {
        const { repository, service } = createDependencies();
        const file = Buffer.from(
            [
                '0 HEAD',
                '1 GEDC',
                '2 VERS 7.0.18',
                '0 @I1@ INDI',
                '1 NAME Alex /Martin/',
                '0 @I2@ INDI',
                '1 NAME Sam /Martin/',
                '1 FAMC @F1@',
                '2 PEDI UNRECOGNIZED',
                '0 @F1@ FAM',
                '1 HUSB @I1@',
                '1 CHIL @I1@',
                '1 CHIL @I2@',
                '0 TRLR',
            ].join('\n'),
            'utf8',
        );
        repository.createForNewSource.mockResolvedValue(
            createDraft({ status: GedcomImportDraftStatus.Blocked }),
        );

        await service.create({ file, sourceName: 'Mixed issue source' });

        const draftInput = repository.createForNewSource.mock.calls[0]?.[1];
        expect(draftInput?.plan.issues.map((issue) => issue.kind)).toEqual(
            expect.arrayContaining([
                GedcomMappingIssueKind.Invalid,
                GedcomMappingIssueKind.Ambiguous,
            ]),
        );
        expect(draftInput?.status).toBe(GedcomImportDraftStatus.Blocked);
    });

    it('creates a draft for an existing source that has not imported the file', async () => {
        const { repository, importRepository, service } = createDependencies();
        const storedDraft = createDraft();
        importRepository.findSourceById.mockResolvedValue({ id: SOURCE_ID });
        importRepository.findRunByFingerprint.mockResolvedValue(null);
        repository.create.mockResolvedValue(storedDraft);

        await expect(service.create({ file: createFile(), sourceId: SOURCE_ID })).resolves.toEqual({
            status: 'created',
            draft: storedDraft,
        });
        expect(repository.create).toHaveBeenCalledWith(
            expect.objectContaining({ sourceId: SOURCE_ID }),
        );
        expect(repository.createForNewSource).not.toHaveBeenCalled();
    });

    it('returns an existing completed run without creating a draft', async () => {
        const { repository, importRepository, service } = createDependencies();
        const run = {
            id: '02733976-4bab-42cc-b1b0-91158c67528f',
            sourceId: SOURCE_ID,
            fileSha256: createHash('sha256').update(createFile()).digest('hex'),
            gedcomVersion: '7.0.18' as const,
            report: {},
            createdAt: NOW,
        };
        importRepository.findSourceById.mockResolvedValue({ id: SOURCE_ID });
        importRepository.findRunByFingerprint.mockResolvedValue(run);

        await expect(service.create({ file: createFile(), sourceId: SOURCE_ID })).resolves.toEqual({
            status: 'already_imported',
            run,
        });
        expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a missing source and a blank new source name', async () => {
        const { importRepository, service } = createDependencies();
        importRepository.findSourceById.mockResolvedValue(null);

        await expect(
            service.create({ file: createFile(), sourceId: SOURCE_ID }),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
            service.create({ file: createFile(), sourceName: '   ' }),
        ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects missing and expired drafts', async () => {
        const { repository, service } = createDependencies();
        repository.findById
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(createDraft({ expiresAt: NOW }));

        await expect(service.findById(DRAFT_ID)).rejects.toMatchObject({ status: 404 });
        await expect(service.findById(DRAFT_ID)).rejects.toMatchObject({ status: 410 });
    });

    it('updates resolutions at the expected revision', async () => {
        const { repository, service } = createDependencies();
        const draft = createDraft();
        const updatedDraft = createDraft({
            revision: 1,
            resolutions: { 'person:0': { action: 'create' } },
        });
        repository.findById.mockResolvedValue(draft);
        repository.updateResolutions.mockResolvedValue(updatedDraft);

        await expect(
            service.updateResolutions(DRAFT_ID, {
                revision: 0,
                resolutions: { 'person:0': { action: 'create' } },
            }),
        ).resolves.toEqual(updatedDraft);
        expect(repository.updateResolutions).toHaveBeenCalledWith({
            id: DRAFT_ID,
            expectedRevision: 0,
            status: GedcomImportDraftStatus.Ready,
            resolutions: { 'person:0': { action: 'create' } },
        });
    });

    it('rejects an obsolete revision', async () => {
        const { repository, service } = createDependencies();
        repository.findById.mockResolvedValue(createDraft({ revision: 2 }));

        await expect(
            service.updateResolutions(DRAFT_ID, { revision: 1, resolutions: {} }),
        ).rejects.toMatchObject({ status: 409 });
        expect(repository.updateResolutions).not.toHaveBeenCalled();
    });

    it.each([
        { draftAfterUpdate: createDraft({ revision: 1 }), expectedStatus: 409 },
        { draftAfterUpdate: null, expectedStatus: 404 },
        { draftAfterUpdate: createDraft({ expiresAt: NOW }), expectedStatus: 410 },
    ])(
        'reports $expectedStatus when the draft changes during an update',
        async ({ draftAfterUpdate, expectedStatus }) => {
            const { repository, service } = createDependencies();
            repository.findById
                .mockResolvedValueOnce(createDraft())
                .mockResolvedValueOnce(draftAfterUpdate);
            repository.updateResolutions.mockResolvedValue(null);

            await expect(
                service.updateResolutions(DRAFT_ID, { revision: 0, resolutions: {} }),
            ).rejects.toMatchObject({ status: expectedStatus });
            expect(repository.updateResolutions).toHaveBeenCalledOnce();
            expect(repository.findById).toHaveBeenCalledTimes(2);
        },
    );

    it('deletes a draft and reports a missing one', async () => {
        const { repository, service } = createDependencies();
        repository.deleteById.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await expect(service.delete(DRAFT_ID)).resolves.toBeUndefined();
        await expect(service.delete(DRAFT_ID)).rejects.toMatchObject({ status: 404 });
    });

    it('uses the current time as the cleanup boundary', async () => {
        const { repository, service } = createDependencies();
        repository.deleteExpired.mockResolvedValue({ deletedDrafts: 2, deletedSources: 1 });

        await expect(service.cleanupExpired()).resolves.toEqual({
            deletedDrafts: 2,
            deletedSources: 1,
        });
        expect(repository.deleteExpired).toHaveBeenCalledWith(NOW);
    });

    it('rejects an invalid draft lifetime', () => {
        const { repository, importRepository } = createDependencies();

        expect(
            () =>
                new GedcomImportDraftService(repository, importRepository, { analyze: vi.fn() }, 0),
        ).toThrow('must be a positive integer');
    });
});
