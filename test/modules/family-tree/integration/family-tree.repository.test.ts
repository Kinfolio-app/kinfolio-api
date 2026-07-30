import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FamilyTreeRepository } from '../../../../src/modules/family-tree/family-tree.repository.js';
import {
    MAX_FAMILY_TREE_PEOPLE,
    FamilyTreeTruncationReason,
    TreeDirection,
} from '../../../../src/modules/family-tree/family-tree.types.js';
import { PersonRepository } from '../../../../src/modules/people/person.repository.js';
import { ParentChildRelationshipType } from '../../../../src/modules/relationships/parent-child-relationship.types.js';

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

describe('FamilyTreeRepository integration', () => {
    let pool: Pool;
    let client: PoolClient;
    let familyTreeRepository: FamilyTreeRepository;
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

        familyTreeRepository = new FamilyTreeRepository(client);
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

    async function createRelationship(parentId: string, childId: string): Promise<string> {
        const { rows } = await client.query<{ id: string }>(
            `INSERT INTO parent_child_relationships (
                parent_id,
                child_id,
                relationship_type
            )
            VALUES ($1, $2, $3)
            RETURNING id`,
            [parentId, childId, ParentChildRelationshipType.Biological],
        );
        const row = rows[0];

        if (row === undefined) {
            throw new Error('PostgreSQL did not return the created relationship.');
        }

        return row.id;
    }

    it('returns null when the root person does not exist', async () => {
        const branch = await familyTreeRepository.findBranch(
            randomUUID(),
            TreeDirection.Ancestors,
            3,
        );

        expect(branch).toBeNull();
    });

    it('returns the root person when it has no relationships', async () => {
        const root = await personRepository.create({ firstName: 'Alice' });

        const branch = await familyTreeRepository.findBranch(root.id, TreeDirection.Ancestors, 3);

        expect(branch).toEqual({
            people: [root],
            relationships: [],
            reachedDepth: 0,
            truncationReasons: [],
        });
    });

    it('returns deduplicated ancestors and detects a truncated next generation', async () => {
        const root = await personRepository.create({ firstName: 'Alice' });
        const firstParent = await personRepository.create({ firstName: 'Bob' });
        const secondParent = await personRepository.create({ firstName: 'Charlie' });
        const sharedGrandparent = await personRepository.create({ firstName: 'Diane' });

        await createRelationship(firstParent.id, root.id);
        await createRelationship(secondParent.id, root.id);
        await createRelationship(sharedGrandparent.id, firstParent.id);
        await createRelationship(sharedGrandparent.id, secondParent.id);

        const truncatedBranch = await familyTreeRepository.findBranch(
            root.id,
            TreeDirection.Ancestors,
            1,
        );
        const completeBranch = await familyTreeRepository.findBranch(
            root.id,
            TreeDirection.Ancestors,
            2,
        );

        expect(truncatedBranch).toMatchObject({
            people: expect.arrayContaining([
                expect.objectContaining({ id: root.id }),
                expect.objectContaining({ id: firstParent.id }),
                expect.objectContaining({ id: secondParent.id }),
            ]),
            relationships: expect.arrayContaining([
                expect.objectContaining({
                    parentId: firstParent.id,
                    childId: root.id,
                }),
                expect.objectContaining({
                    parentId: secondParent.id,
                    childId: root.id,
                }),
            ]),
            reachedDepth: 1,
            truncationReasons: [FamilyTreeTruncationReason.DepthLimit],
        });
        expect(truncatedBranch?.people).toHaveLength(3);
        expect(truncatedBranch?.relationships).toHaveLength(2);

        expect(completeBranch?.people).toHaveLength(4);
        expect(completeBranch?.people.filter(({ id }) => id === sharedGrandparent.id)).toHaveLength(
            1,
        );
        expect(completeBranch?.relationships).toHaveLength(4);
        expect(completeBranch).toMatchObject({
            reachedDepth: 2,
            truncationReasons: [],
        });
    });

    it('supports descendant and bidirectional traversals', async () => {
        const parent = await personRepository.create({ firstName: 'Alice' });
        const root = await personRepository.create({ firstName: 'Bob' });
        const child = await personRepository.create({ firstName: 'Charlie' });
        const grandchild = await personRepository.create({ firstName: 'Diane' });

        await createRelationship(parent.id, root.id);
        await createRelationship(root.id, child.id);
        await createRelationship(child.id, grandchild.id);

        const descendants = await familyTreeRepository.findBranch(
            root.id,
            TreeDirection.Descendants,
            2,
        );
        const bothDirections = await familyTreeRepository.findBranch(
            root.id,
            TreeDirection.Both,
            1,
        );

        expect(descendants?.people.map(({ id }) => id)).toEqual(
            expect.arrayContaining([root.id, child.id, grandchild.id]),
        );
        expect(descendants?.people).toHaveLength(3);
        expect(descendants?.relationships).toHaveLength(2);
        expect(descendants?.reachedDepth).toBe(2);
        expect(descendants?.truncationReasons).toEqual([]);

        expect(bothDirections?.people.map(({ id }) => id)).toEqual(
            expect.arrayContaining([parent.id, root.id, child.id]),
        );
        expect(bothDirections?.people).toHaveLength(3);
        expect(bothDirections?.relationships).toHaveLength(2);
        expect(bothDirections?.reachedDepth).toBe(1);
        expect(bothDirections?.truncationReasons).toEqual([FamilyTreeTruncationReason.DepthLimit]);
    });

    it('deduplicates people reached through multiple bidirectional paths', async () => {
        const root = await personRepository.create({ firstName: 'Alice' });
        const firstBranch = await personRepository.create({ firstName: 'Bob' });
        const secondBranch = await personRepository.create({ firstName: 'Charlie' });
        const sharedPerson = await personRepository.create({ firstName: 'Diane' });

        await createRelationship(root.id, firstBranch.id);
        await createRelationship(root.id, secondBranch.id);
        await createRelationship(firstBranch.id, sharedPerson.id);
        await createRelationship(secondBranch.id, sharedPerson.id);

        const branch = await familyTreeRepository.findBranch(root.id, TreeDirection.Both, 2);

        expect(branch?.people.map(({ id }) => id)).toEqual(
            expect.arrayContaining([root.id, firstBranch.id, secondBranch.id, sharedPerson.id]),
        );
        expect(branch?.people).toHaveLength(4);
        expect(branch?.people.filter(({ id }) => id === sharedPerson.id)).toHaveLength(1);
        expect(branch?.relationships).toHaveLength(4);
        expect(branch?.reachedDepth).toBe(2);
        expect(branch?.truncationReasons).toEqual([]);
    });

    it('does not traverse through a soft-deleted person', async () => {
        const root = await personRepository.create({ firstName: 'Alice' });
        const parent = await personRepository.create({ firstName: 'Bob' });
        const grandparent = await personRepository.create({ firstName: 'Charlie' });

        await createRelationship(parent.id, root.id);
        await createRelationship(grandparent.id, parent.id);
        await personRepository.deleteById(parent.id);

        const branch = await familyTreeRepository.findBranch(root.id, TreeDirection.Ancestors, 3);

        expect(branch).toEqual({
            people: [root],
            relationships: [],
            reachedDepth: 0,
            truncationReasons: [],
        });
    });

    it('limits the branch size while preserving the closest people', async () => {
        const root = await personRepository.create({ firstName: 'Alice' });

        await client.query(
            `WITH parents AS (
                INSERT INTO persons (first_name)
                SELECT 'Parent ' || number
                FROM generate_series(1, $2) AS series(number)
                RETURNING id
            )
            INSERT INTO parent_child_relationships (
                parent_id,
                child_id,
                relationship_type
            )
            SELECT id, $1, $3
            FROM parents`,
            [root.id, MAX_FAMILY_TREE_PEOPLE + 1, ParentChildRelationshipType.Biological],
        );

        const branch = await familyTreeRepository.findBranch(root.id, TreeDirection.Ancestors, 1);

        expect(branch?.people).toHaveLength(MAX_FAMILY_TREE_PEOPLE);
        expect(branch?.people[0]?.id).toBe(root.id);
        expect(branch?.relationships).toHaveLength(MAX_FAMILY_TREE_PEOPLE - 1);
        expect(branch?.reachedDepth).toBe(1);
        expect(branch?.truncationReasons).toEqual([FamilyTreeTruncationReason.SizeLimit]);
    });
});
