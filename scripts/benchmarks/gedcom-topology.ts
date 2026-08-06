import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const INSERT_BATCH_SIZE = 1_000;
const BENCHMARK_DATABASE_NAME = 'kinfolio_benchmark';
const UNSPECIFIED_RELATIONSHIP_TYPE = 'unspecified';

type FamilyRecord = {
    parents: Set<string>;
    children: Set<string>;
};

export type GedcomTopologyRelationship = {
    parentExternalId: string;
    childExternalId: string;
};

export type GedcomTopology = {
    gedcomVersion: string | null;
    characterSet: string | null;
    personExternalIds: string[];
    relationships: GedcomTopologyRelationship[];
    families: number;
    duplicateRelationships: number;
};

export type LoadedTopology = {
    people: number;
    relationships: number;
};

function parseGedcomLine(rawLine: string):
    | {
          level: number;
          xref: string | null;
          tag: string;
          value: string | null;
      }
    | undefined {
    // Match one complete GEDCOM line:
    // - ^(\d+) captures the hierarchy level at the start of the line.
    // - \s+ requires whitespace after the level.
    // - (?:(@[^@]+@)\s+)? optionally captures an xref such as "@I123@".
    // - ([A-Za-z0-9_]+) captures the GEDCOM tag, such as INDI, FAM, or CHIL.
    // - (?:\s+(.*))? optionally captures the remaining value, including spaces.
    // - $ ensures that no unparsed characters remain at the end of the line.
    const match = rawLine.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/);

    if (match === null) {
        return undefined;
    }

    return {
        level: Number(match[1]),
        xref: match[2] ?? null,
        tag: match[3] ?? '',
        value: match[4] ?? null,
    };
}

export function parseGedcomTopology(content: string): GedcomTopology {
    const people = new Set<string>();
    const families: FamilyRecord[] = [];
    const tagStack: string[] = [];
    let currentFamily: FamilyRecord | null = null;
    let gedcomVersion: string | null = null;
    let characterSet: string | null = null;
    let malformedLines = 0;

    function finishFamily(): void {
        if (currentFamily !== null) {
            families.push(currentFamily);
            currentFamily = null;
        }
    }

    // Remove a possible UTF-8 byte-order mark only when it appears at the
    // beginning of the file. It would otherwise prevent the first level from
    // matching the GEDCOM line expression.
    const contentWithoutByteOrderMark = content.replace(/^\uFEFF/, '');

    // Split on both Unix line endings ("\n") and Windows line endings
    // ("\r\n"). The optional \r keeps the parser portable across GEDCOM files.
    for (const rawLine of contentWithoutByteOrderMark.split(/\r?\n/)) {
        if (rawLine.length === 0) {
            continue;
        }

        const line = parseGedcomLine(rawLine);

        if (line === undefined) {
            malformedLines += 1;
            continue;
        }

        if (line.level === 0) {
            finishFamily();

            if (line.tag === 'INDI' && line.xref !== null) {
                if (people.has(line.xref)) {
                    throw new Error('The GEDCOM file contains a duplicate individual record.');
                }

                people.add(line.xref);
            }

            if (line.tag === 'FAM') {
                currentFamily = {
                    parents: new Set(),
                    children: new Set(),
                };
            }
        }

        tagStack[line.level] = line.tag;
        tagStack.length = line.level + 1;

        if (line.level === 1 && line.tag === 'CHAR' && line.value !== null) {
            characterSet = line.value;
        }

        if (
            line.level === 2 &&
            line.tag === 'VERS' &&
            tagStack[1] === 'GEDC' &&
            line.value !== null
        ) {
            gedcomVersion = line.value;
        }

        if (currentFamily !== null && line.level === 1 && line.value !== null) {
            if (line.tag === 'HUSB' || line.tag === 'WIFE') {
                currentFamily.parents.add(line.value);
            }

            if (line.tag === 'CHIL') {
                currentFamily.children.add(line.value);
            }
        }
    }

    finishFamily();

    if (malformedLines > 0) {
        throw new Error(`The GEDCOM file contains ${malformedLines} malformed lines.`);
    }

    const relationships: GedcomTopologyRelationship[] = [];
    const relationshipKeys = new Set<string>();
    let missingReferences = 0;
    let selfRelationships = 0;
    let duplicateRelationships = 0;

    for (const family of families) {
        for (const parentExternalId of family.parents) {
            for (const childExternalId of family.children) {
                if (!people.has(parentExternalId) || !people.has(childExternalId)) {
                    missingReferences += 1;
                    continue;
                }

                if (parentExternalId === childExternalId) {
                    selfRelationships += 1;
                    continue;
                }

                const key = `${parentExternalId}\u0000${childExternalId}`;

                if (relationshipKeys.has(key)) {
                    duplicateRelationships += 1;
                    continue;
                }

                relationshipKeys.add(key);
                relationships.push({
                    parentExternalId,
                    childExternalId,
                });
            }
        }
    }

    if (missingReferences > 0) {
        throw new Error(
            `The GEDCOM file contains ${missingReferences} relationships with missing people.`,
        );
    }

    if (selfRelationships > 0) {
        throw new Error(
            `The GEDCOM file contains ${selfRelationships} self parent-child relationships.`,
        );
    }

    return {
        gedcomVersion,
        characterSet,
        personExternalIds: [...people],
        relationships,
        families: families.length,
        duplicateRelationships,
    };
}

function validateBenchmarkDatabaseUrl(databaseUrl: string): void {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== BENCHMARK_DATABASE_NAME) {
        throw new Error(
            `The topology loader only accepts the "${BENCHMARK_DATABASE_NAME}" database.`,
        );
    }
}

async function insertPeople(client: Client, personIds: Map<string, string>): Promise<void> {
    const entries = [...personIds.entries()];

    for (let offset = 0; offset < entries.length; offset += INSERT_BATCH_SIZE) {
        const batch = entries.slice(offset, offset + INSERT_BATCH_SIZE);
        const values: string[] = [];
        const placeholders = batch.map(([externalId, id], index) => {
            const parameter = index * 3;
            const sequence = String(offset + index + 1).padStart(6, '0');

            values.push(id, 'Benchmark', `Person ${sequence}`);
            personIds.set(externalId, id);

            return `($${parameter + 1}, $${parameter + 2}, $${parameter + 3})`;
        });

        await client.query(
            `INSERT INTO persons (id, first_name, last_name)
            VALUES ${placeholders.join(', ')}`,
            values,
        );
    }
}

async function insertRelationships(
    client: Client,
    relationships: GedcomTopologyRelationship[],
    personIds: Map<string, string>,
): Promise<void> {
    for (let offset = 0; offset < relationships.length; offset += INSERT_BATCH_SIZE) {
        const batch = relationships.slice(offset, offset + INSERT_BATCH_SIZE);
        const values: string[] = [];
        const placeholders = batch.map((relationship, index) => {
            const parentId = personIds.get(relationship.parentExternalId);
            const childId = personIds.get(relationship.childExternalId);

            if (parentId === undefined || childId === undefined) {
                throw new Error('The topology contains an unresolved person reference.');
            }

            const parameter = index * 4;
            values.push(randomUUID(), parentId, childId, UNSPECIFIED_RELATIONSHIP_TYPE);

            return `($${parameter + 1}, $${parameter + 2}, $${parameter + 3}, $${parameter + 4})`;
        });

        await client.query(
            `INSERT INTO parent_child_relationships (
                id,
                parent_id,
                child_id,
                relationship_type
            )
            VALUES ${placeholders.join(', ')}`,
            values,
        );
    }
}

export async function loadGedcomTopology(
    databaseUrl: string,
    topology: GedcomTopology,
    replace: boolean,
): Promise<LoadedTopology> {
    validateBenchmarkDatabaseUrl(databaseUrl);

    const client = new Client({
        connectionString: databaseUrl,
    });
    let transactionStarted = false;

    await client.connect();

    try {
        const { rows } = await client.query<{
            people: number;
            relationships: number;
        }>(
            `SELECT
                (SELECT COUNT(*)::integer FROM persons) AS people,
                (
                    SELECT COUNT(*)::integer
                    FROM parent_child_relationships
                ) AS relationships`,
        );
        const currentCounts = rows[0];

        if (
            !replace &&
            currentCounts !== undefined &&
            (currentCounts.people > 0 || currentCounts.relationships > 0)
        ) {
            throw new Error('The benchmark database is not empty. Use --replace to overwrite it.');
        }

        await client.query('BEGIN');
        transactionStarted = true;

        if (replace) {
            await client.query('TRUNCATE TABLE parent_child_relationships, persons');
        }

        const personIds = new Map(
            topology.personExternalIds.map((externalId) => [externalId, randomUUID()]),
        );

        await insertPeople(client, personIds);
        await insertRelationships(client, topology.relationships, personIds);

        const { rows: loadedRows } = await client.query<{
            people: number;
            relationships: number;
            anonymous_people: number;
            people_with_private_fields: number;
            unspecified_relationships: number;
        }>(
            `SELECT
                (SELECT COUNT(*)::integer FROM persons) AS people,
                (
                    SELECT COUNT(*)::integer
                    FROM parent_child_relationships
                ) AS relationships,
                (
                    SELECT COUNT(*)::integer
                    FROM persons
                    WHERE first_name = 'Benchmark'
                        AND last_name LIKE 'Person %'
                ) AS anonymous_people,
                (
                    SELECT COUNT(*)::integer
                    FROM persons
                    WHERE middle_names IS NOT NULL
                        OR birth_name IS NOT NULL
                        OR birth_date_id IS NOT NULL
                        OR birth_place IS NOT NULL
                        OR death_date_id IS NOT NULL
                        OR death_place IS NOT NULL
                        OR biography IS NOT NULL
                ) AS people_with_private_fields,
                (
                    SELECT COUNT(*)::integer
                    FROM parent_child_relationships
                    WHERE relationship_type = 'unspecified'
                ) AS unspecified_relationships`,
        );
        const loadedCounts = loadedRows[0];

        if (loadedCounts === undefined) {
            throw new Error('PostgreSQL did not return the loaded topology counts.');
        }

        if (
            loadedCounts.people !== topology.personExternalIds.length ||
            loadedCounts.relationships !== topology.relationships.length ||
            loadedCounts.anonymous_people !== loadedCounts.people ||
            loadedCounts.people_with_private_fields !== 0 ||
            loadedCounts.unspecified_relationships !== loadedCounts.relationships
        ) {
            throw new Error('The loaded topology failed its anonymization checks.');
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return {
            people: loadedCounts.people,
            relationships: loadedCounts.relationships,
        };
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        throw error;
    } finally {
        await client.end();
    }
}
