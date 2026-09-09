import { describe, expect, it, vi } from 'vitest';
import { GedcomImportDraftService } from '../../../../src/modules/gedcom-import/gedcom-import-draft.service.js';
import { GedcomImportDraftStatus } from '../../../../src/modules/gedcom-import/gedcom-import-persistence.types.js';

describe('GedcomImportDraftService', () => {
    it('applies the configured lifetime when creating a draft', async () => {
        const create = vi.fn().mockResolvedValue({ id: 'draft-id' });
        const deleteExpired = vi.fn();
        const now = new Date('2026-09-09T12:00:00.000Z');
        const service = new GedcomImportDraftService(
            { create, deleteExpired },
            2 * 60 * 60 * 1_000,
            () => now,
        );
        const input = {
            sourceId: 'source-id',
            status: GedcomImportDraftStatus.Ready,
            fileSha256: 'a'.repeat(64),
            fileContent: new Uint8Array([1]),
            gedcomVersion: '7.0' as const,
            plan: {},
        };

        await service.create(input);

        expect(create).toHaveBeenCalledWith({
            ...input,
            expiresAt: new Date('2026-09-09T14:00:00.000Z'),
        });
    });

    it('uses the current time as the cleanup boundary', async () => {
        const create = vi.fn();
        const deleteExpired = vi.fn().mockResolvedValue({
            deletedDrafts: 2,
            deletedSources: 1,
        });
        const now = new Date('2026-09-09T12:00:00.000Z');
        const service = new GedcomImportDraftService(
            { create, deleteExpired },
            undefined,
            () => now,
        );

        await expect(service.cleanupExpired()).resolves.toEqual({
            deletedDrafts: 2,
            deletedSources: 1,
        });
        expect(deleteExpired).toHaveBeenCalledWith(now);
    });

    it('rejects an invalid draft lifetime', () => {
        expect(
            () => new GedcomImportDraftService({ create: vi.fn(), deleteExpired: vi.fn() }, 0),
        ).toThrow('must be a positive integer');
    });
});
