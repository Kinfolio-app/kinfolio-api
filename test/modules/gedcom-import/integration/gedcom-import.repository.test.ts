import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GedcomImportRepository } from '../../../../src/modules/gedcom-import/gedcom-import.repository.js';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { CoupleRelationshipRepository } from '../../../../src/modules/relationships/couple-relationship.repository.js';
import { CoupleRelationshipEventRepository } from '../../../../src/modules/relationships/couple-relationship-event.repository.js';
import { CoupleRelationshipEventType } from '../../../../src/modules/relationships/couple-relationship.types.js';
import {
    ParentChildRelationshipEvidenceStatus,
    ParentChildRelationshipType,
} from '../../../../src/modules/relationships/parent-child-relationship.types.js';

const TEST_DATABASE_NAME = 'kinfolio_test';

function getTestDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
        throw new Error('DATABASE_URL is required for integration tests.');
    }

    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests require database "${TEST_DATABASE_NAME}", received "${databaseName}".`,
        );
    }

    return databaseUrl;
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

describe('GedcomImportRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let repository: GedcomImportRepository;
    let personRepository: PersonRepository;

    beforeAll(async () => {
        pool = new Pool({
            connectionString: getTestDatabaseUrl(),
        });

        await pool.query('SELECT 1');
    });

    beforeEach(async () => {
        client = await pool.connect();
        await client.query('BEGIN');

        repository = new GedcomImportRepository(client);
        personRepository = new PersonRepository(client);
    });

    afterEach(async () => {
        try {
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }
    });

    afterAll(async () => {
        await pool.end();
    });

    it('creates, finds, and deletes an unused import source', async () => {
        const source = await repository.createSource('  Synthetic family tree  ');

        expect(source).toEqual({
            id: expect.any(String),
            name: 'Synthetic family tree',
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
        await expect(repository.findSourceById(source.id)).resolves.toEqual(source);
        await expect(repository.deleteSourceIfUnused(source.id)).resolves.toBe(true);
        await expect(repository.findSourceById(source.id)).resolves.toBeNull();
    });

    it('keeps one completed run for the same source and file fingerprint', async () => {
        const source = await repository.createSource('Synthetic family tree');
        const input = {
            sourceId: source.id,
            fileSha256: sha256('synthetic GEDCOM contents'),
            gedcomVersion: '7.0' as const,
            report: { entries: [{ action: 'created', planKey: 'person:0' }] },
        };

        const first = await repository.createOrFindRun(input);
        const repeated = await repository.createOrFindRun({
            ...input,
            report: { entries: [] },
        });

        expect(first.created).toBe(true);
        expect(first.run).toEqual({
            id: expect.any(String),
            sourceId: source.id,
            fileSha256: input.fileSha256,
            gedcomVersion: '7.0',
            report: input.report,
            createdAt: expect.any(Date),
        });
        expect(repeated).toEqual({
            run: first.run,
            created: false,
        });
        await expect(repository.deleteSourceIfUnused(source.id)).resolves.toBe(false);
    });

    it('allows the same fingerprint for separate import sources', async () => {
        const firstSource = await repository.createSource('First synthetic tree');
        const secondSource = await repository.createSource('Second synthetic tree');
        const fileSha256 = sha256('shared export bytes');

        const first = await repository.createOrFindRun({
            sourceId: firstSource.id,
            fileSha256,
            gedcomVersion: '5.5.1',
            report: {},
        });
        const second = await repository.createOrFindRun({
            sourceId: secondSource.id,
            fileSha256,
            gedcomVersion: '5.5.1',
            report: {},
        });

        expect(first.created).toBe(true);
        expect(second.created).toBe(true);
        expect(second.run.id).not.toBe(first.run.id);
    });

    it('rejects malformed SHA-256 fingerprints before querying PostgreSQL', async () => {
        const source = await repository.createSource('Synthetic family tree');

        await expect(
            repository.createOrFindRun({
                sourceId: source.id,
                fileSha256: 'not-a-sha256',
                gedcomVersion: '7.0',
                report: {},
            }),
        ).rejects.toThrow('exactly 64 hexadecimal characters');
    });

    it('persists person and family provenance for a completed run', async () => {
        const source = await repository.createSource('Synthetic family tree');
        const { run } = await repository.createOrFindRun({
            sourceId: source.id,
            fileSha256: sha256('provenance export'),
            gedcomVersion: '7.0.1',
            report: {},
        });
        const alex = await personRepository.create({ firstName: 'Alex' });
        const sam = await personRepository.create({ firstName: 'Sam' });
        const couple = await new CoupleRelationshipRepository(client).create({
            partner1Id: alex.id,
            partner2Id: sam.id,
        });

        const alexLink = await repository.saveIndividualLink({
            sourceId: source.id,
            gedcomId: '@I1@',
            personId: alex.id,
            identifiers: [{ type: 'UID', value: 'synthetic-alex' }],
            lastImportedData: { firstName: 'Alex' },
            lastSeenRunId: run.id,
        });
        await repository.saveIndividualLink({
            sourceId: source.id,
            gedcomId: '@I2@',
            personId: sam.id,
            identifiers: [],
            lastImportedData: { firstName: 'Sam' },
            lastSeenRunId: run.id,
        });
        const familyLink = await repository.saveFamilyLink({
            sourceId: source.id,
            gedcomId: '@F1@',
            coupleRelationshipId: couple.id,
            lastImportedData: { partnerIds: ['@I1@', '@I2@'] },
            lastSeenRunId: run.id,
        });

        await expect(repository.findIndividualLink(source.id, '@I1@')).resolves.toEqual(alexLink);
        await expect(repository.findFamilyLink(source.id, '@F1@')).resolves.toEqual(familyLink);
    });

    it('allows several GEDCOM individual identifiers to link to one person', async () => {
        const source = await repository.createSource('Synthetic duplicate tree');
        const { run } = await repository.createOrFindRun({
            sourceId: source.id,
            fileSha256: sha256('duplicate export'),
            gedcomVersion: '5.5.1',
            report: {},
        });
        const person = await personRepository.create({ firstName: 'Morgan' });

        const first = await repository.saveIndividualLink({
            sourceId: source.id,
            gedcomId: '@I1@',
            personId: person.id,
            identifiers: [],
            lastImportedData: { firstName: 'Morgan' },
            lastSeenRunId: run.id,
        });
        const second = await repository.saveIndividualLink({
            sourceId: source.id,
            gedcomId: '@I2@',
            personId: person.id,
            identifiers: [],
            lastImportedData: { firstName: 'Morgan' },
            lastSeenRunId: run.id,
        });

        expect(first.personId).toBe(person.id);
        expect(second.personId).toBe(person.id);
        expect(second.gedcomId).not.toBe(first.gedcomId);
    });

    it('persists parent-child and couple-event provenance', async () => {
        const source = await repository.createSource('Synthetic linked tree');
        const { run } = await repository.createOrFindRun({
            sourceId: source.id,
            fileSha256: sha256('relationship export'),
            gedcomVersion: '7.0',
            report: {},
        });
        const parent = await personRepository.create({ firstName: 'Taylor' });
        const child = await personRepository.create({ firstName: 'Jordan' });
        const partner = await personRepository.create({ firstName: 'Casey' });
        const { rows: relationshipRows } = await client.query<{ id: string }>(
            `INSERT INTO parent_child_relationships (
                parent_id,
                child_id,
                relationship_type,
                evidence_status
            ) VALUES ($1, $2, $3, $4)
            RETURNING id`,
            [
                parent.id,
                child.id,
                ParentChildRelationshipType.Biological,
                ParentChildRelationshipEvidenceStatus.Proven,
            ],
        );
        const relationshipId = relationshipRows[0]?.id;

        if (relationshipId === undefined) {
            throw new Error('PostgreSQL did not return the synthetic relationship.');
        }

        const couple = await new CoupleRelationshipRepository(client).create({
            partner1Id: parent.id,
            partner2Id: partner.id,
        });
        const event = await new CoupleRelationshipEventRepository(client).create(couple.id, {
            eventType: CoupleRelationshipEventType.Marriage,
            place: 'Synthetic City',
        });

        for (const [gedcomId, personId] of [
            ['@I1@', parent.id],
            ['@I2@', child.id],
            ['@I3@', partner.id],
        ] as const) {
            await repository.saveIndividualLink({
                sourceId: source.id,
                gedcomId,
                personId,
                identifiers: [],
                lastImportedData: {},
                lastSeenRunId: run.id,
            });
        }
        await repository.saveFamilyLink({
            sourceId: source.id,
            gedcomId: '@F1@',
            coupleRelationshipId: couple.id,
            lastImportedData: {},
            lastSeenRunId: run.id,
        });

        const parentChildLink = await repository.saveParentChildLink({
            sourceId: source.id,
            familyGedcomId: '@F1@',
            parentGedcomId: '@I1@',
            childGedcomId: '@I2@',
            relationshipId,
            lastImportedData: {
                relationshipType: ParentChildRelationshipType.Biological,
                evidenceStatus: ParentChildRelationshipEvidenceStatus.Proven,
            },
            lastSeenRunId: run.id,
        });
        const eventLink = await repository.saveCoupleEventLink({
            sourceId: source.id,
            familyGedcomId: '@F1@',
            gedcomEventTag: 'MARR',
            occurrenceIndex: 0,
            eventId: event.id,
            contentSha256: sha256('MARR|Synthetic City'),
            lastImportedData: { place: 'Synthetic City' },
            lastSeenRunId: run.id,
        });

        await expect(
            repository.findParentChildLink(source.id, '@F1@', '@I1@', '@I2@'),
        ).resolves.toEqual(parentChildLink);
        await expect(repository.findCoupleEventLink(source.id, '@F1@', 'MARR', 0)).resolves.toEqual(
            eventLink,
        );
    });
});
