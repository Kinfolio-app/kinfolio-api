import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Pool, type QueryResult } from 'pg';
import { FamilyTreeRepository } from '../../dist/modules/family-tree/family-tree.repository.js';
import {
    MAX_FAMILY_TREE_PEOPLE,
    TreeDirection,
} from '../../dist/modules/family-tree/family-tree.types.js';
import type {
    FamilyTreeBranch,
    TreeDirection as TreeDirectionValue,
} from '../../src/modules/family-tree/family-tree.types.ts';

const BENCHMARK_DATABASE_NAME = 'kinfolio_benchmark';
const STATEMENT_TIMEOUT_MILLISECONDS = 5_000;
const WARM_RUNS = 5;
const TESTED_DEPTHS = [1, 3, 5, 10];

type PersonRow = {
    id: string;
};

type RelationshipRow = {
    parent_id: string;
    child_id: string;
};

type Profile = {
    name: string;
    personId: string;
    direction: TreeDirectionValue;
    selectionDepth: number;
    reachablePeopleAtSelectionDepth: number;
};

type CapturedQuery = {
    text: string;
    values: unknown[];
};

type ExplainPlan = {
    'Node Type'?: string;
    'Actual Rows'?: number;
    'Actual Loops'?: number;
    'Shared Hit Blocks'?: number;
    'Shared Read Blocks'?: number;
    Plans?: ExplainPlan[];
};

type ExplainDocument = {
    Plan: ExplainPlan;
    'Planning Time': number;
    'Execution Time': number;
};

type BenchmarkResult = {
    queryVariant: 'legacy' | 'current';
    profile: string;
    direction: TreeDirectionValue;
    depth: number;
    status: 'completed' | 'timeout';
    firstRunMilliseconds?: number;
    warmMedianMilliseconds?: number;
    warmP95Milliseconds?: number;
    returnedPeople?: number;
    returnedRelationships?: number;
    responseBytes?: number;
    truncationReasons?: string[];
    planningMilliseconds?: number;
    executionMilliseconds?: number;
    sharedHitBlocks?: number;
    sharedReadBlocks?: number;
    recursiveRows?: number;
};

type ScenarioMeasurement = {
    result: BenchmarkResult;
    branch?: FamilyTreeBranch;
};

function validateBenchmarkDatabaseUrl(databaseUrl: string): void {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));

    if (databaseName !== BENCHMARK_DATABASE_NAME) {
        throw new Error(
            `The family-tree benchmark only accepts the "${BENCHMARK_DATABASE_NAME}" database.`,
        );
    }
}

function addNeighbor(adjacency: Map<string, string[]>, personId: string, neighborId: string): void {
    const neighbors = adjacency.get(personId);

    if (neighbors === undefined) {
        adjacency.set(personId, [neighborId]);
        return;
    }

    neighbors.push(neighborId);
}

function countReachablePeople(
    rootPersonId: string,
    adjacency: Map<string, string[]>,
    depth: number,
): number {
    const visited = new Set([rootPersonId]);
    let frontier = [rootPersonId];

    for (let currentDepth = 0; currentDepth < depth && frontier.length > 0; currentDepth += 1) {
        const nextFrontier: string[] = [];

        for (const personId of frontier) {
            for (const neighborId of adjacency.get(personId) ?? []) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    nextFrontier.push(neighborId);
                }
            }
        }

        frontier = nextFrontier;
    }

    return visited.size;
}

function selectMedianProfile(
    people: PersonRow[],
    adjacency: Map<string, string[]>,
    direction: TreeDirectionValue,
    depth: number,
): Profile {
    const counts = people
        .map(({ id }) => ({
            personId: id,
            reachablePeople: countReachablePeople(id, adjacency, depth),
        }))
        .sort((left, right) => left.reachablePeople - right.reachablePeople);
    const selected = counts[Math.floor(counts.length / 2)];

    if (selected === undefined) {
        throw new Error('The benchmark database does not contain any people.');
    }

    return {
        name: 'typical_both',
        personId: selected.personId,
        direction,
        selectionDepth: depth,
        reachablePeopleAtSelectionDepth: selected.reachablePeople,
    };
}

function selectMaximumProfile(
    name: string,
    people: PersonRow[],
    adjacency: Map<string, string[]>,
    direction: TreeDirectionValue,
    depth: number,
): Profile {
    let selectedPersonId: string | undefined;
    let maximumReachablePeople = -1;

    for (const { id } of people) {
        const reachablePeople = countReachablePeople(id, adjacency, depth);

        if (reachablePeople > maximumReachablePeople) {
            selectedPersonId = id;
            maximumReachablePeople = reachablePeople;
        }
    }

    if (selectedPersonId === undefined) {
        throw new Error('The benchmark database does not contain any people.');
    }

    return {
        name,
        personId: selectedPersonId,
        direction,
        selectionDepth: depth,
        reachablePeopleAtSelectionDepth: maximumReachablePeople,
    };
}

function percentile(values: number[], percentileValue: number): number {
    const sortedValues = [...values].sort((left, right) => left - right);
    const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;

    return sortedValues[Math.max(0, index)] ?? 0;
}

function roundMilliseconds(value: number): number {
    return Number(value.toFixed(2));
}

function findPlanNode(plan: ExplainPlan, nodeType: string): ExplainPlan | undefined {
    if (plan['Node Type'] === nodeType) {
        return plan;
    }

    for (const child of plan.Plans ?? []) {
        const match = findPlanNode(child, nodeType);

        if (match !== undefined) {
            return match;
        }
    }

    return undefined;
}

async function captureRepositoryQuery(): Promise<CapturedQuery> {
    let capturedQuery: CapturedQuery | undefined;
    const captureDatabase = {
        query: async (text: string, values?: unknown[]): Promise<QueryResult<never>> => {
            capturedQuery = {
                text,
                values: values ?? [],
            };

            return {
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                rows: [],
                fields: [],
            };
        },
    };
    const repository = new FamilyTreeRepository(captureDatabase as unknown as Pool);

    await repository.findBranch('00000000-0000-0000-0000-000000000000', TreeDirection.Both, 1);

    if (capturedQuery === undefined) {
        throw new Error('The family-tree repository did not execute a query.');
    }

    return capturedQuery;
}

function replaceExactlyOnce(
    queryText: string,
    currentFragment: string,
    replacementFragment: string,
): string {
    const fragments = queryText.split(currentFragment);

    if (fragments.length !== 2) {
        throw new Error('The repository query no longer matches the expected benchmark structure.');
    }

    return `${fragments[0]}${replacementFragment}${fragments[1]}`;
}

function buildLegacyTraversalQuery(currentQueryText: string): string {
    let queryText = replaceExactlyOnce(
        currentQueryText,
        '0 AS depth',
        `0 AS depth,
                    ARRAY[root.id] AS path`,
    );

    queryText = replaceExactlyOnce(queryText, 'UNION', 'UNION ALL');
    queryText = replaceExactlyOnce(
        queryText,
        'traversal.depth + 1 AS depth',
        `traversal.depth + 1 AS depth,
                    traversal.path || next_person.id AS path`,
    );
    queryText = replaceExactlyOnce(
        queryText,
        'WHERE traversal.depth < $3 + 1',
        `WHERE traversal.depth < $3 + 1
                    AND NOT next_person.id = ANY(traversal.path)`,
    );

    return queryText;
}

function isStatementTimeout(error: unknown): boolean {
    return (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code?: string }).code === '57014'
    );
}

async function benchmarkScenario(
    queryVariant: BenchmarkResult['queryVariant'],
    repository: FamilyTreeRepository,
    pool: Pool,
    queryText: string,
    profile: Profile,
    depth: number,
): Promise<ScenarioMeasurement> {
    const startedAt = performance.now();
    let branch;

    try {
        branch = await repository.findBranch(profile.personId, profile.direction, depth);
    } catch (error) {
        if (isStatementTimeout(error)) {
            return {
                result: {
                    queryVariant,
                    profile: profile.name,
                    direction: profile.direction,
                    depth,
                    status: 'timeout',
                },
            };
        }

        throw error;
    }

    const firstRunMilliseconds = performance.now() - startedAt;

    if (branch === null) {
        throw new Error('A selected benchmark person no longer exists.');
    }

    const warmDurations: number[] = [];

    for (let run = 0; run < WARM_RUNS; run += 1) {
        const warmStartedAt = performance.now();
        await repository.findBranch(profile.personId, profile.direction, depth);
        warmDurations.push(performance.now() - warmStartedAt);
    }

    const { rows } = await pool.query<{ 'QUERY PLAN': ExplainDocument[] }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryText}`,
        [profile.personId, profile.direction, depth, MAX_FAMILY_TREE_PEOPLE],
    );
    const explainDocument = rows[0]?.['QUERY PLAN'][0];

    if (explainDocument === undefined) {
        throw new Error('PostgreSQL did not return an execution plan.');
    }

    const recursiveUnion = findPlanNode(explainDocument.Plan, 'Recursive Union');

    return {
        result: {
            queryVariant,
            profile: profile.name,
            direction: profile.direction,
            depth,
            status: 'completed',
            firstRunMilliseconds: roundMilliseconds(firstRunMilliseconds),
            warmMedianMilliseconds: roundMilliseconds(percentile(warmDurations, 50)),
            warmP95Milliseconds: roundMilliseconds(percentile(warmDurations, 95)),
            returnedPeople: branch.people.length,
            returnedRelationships: branch.relationships.length,
            responseBytes: Buffer.byteLength(JSON.stringify(branch)),
            truncationReasons: branch.truncationReasons,
            planningMilliseconds: roundMilliseconds(explainDocument['Planning Time']),
            executionMilliseconds: roundMilliseconds(explainDocument['Execution Time']),
            sharedHitBlocks: explainDocument.Plan['Shared Hit Blocks'] ?? 0,
            sharedReadBlocks: explainDocument.Plan['Shared Read Blocks'] ?? 0,
            recursiveRows:
                recursiveUnion?.['Actual Rows'] === undefined
                    ? undefined
                    : recursiveUnion['Actual Rows'] * (recursiveUnion['Actual Loops'] ?? 1),
        },
        branch,
    };
}

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
}

validateBenchmarkDatabaseUrl(databaseUrl);

const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
});

try {
    await pool.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MILLISECONDS}`);

    const [peopleResult, relationshipsResult, capturedQuery] = await Promise.all([
        pool.query<PersonRow>('SELECT id FROM persons WHERE deleted_at IS NULL'),
        pool.query<RelationshipRow>(
            `SELECT parent_id, child_id
            FROM parent_child_relationships`,
        ),
        captureRepositoryQuery(),
    ]);
    const ancestorAdjacency = new Map<string, string[]>();
    const descendantAdjacency = new Map<string, string[]>();
    const bothAdjacency = new Map<string, string[]>();

    for (const relationship of relationshipsResult.rows) {
        addNeighbor(ancestorAdjacency, relationship.child_id, relationship.parent_id);
        addNeighbor(descendantAdjacency, relationship.parent_id, relationship.child_id);
        addNeighbor(bothAdjacency, relationship.parent_id, relationship.child_id);
        addNeighbor(bothAdjacency, relationship.child_id, relationship.parent_id);
    }

    const profiles = [
        selectMedianProfile(peopleResult.rows, bothAdjacency, TreeDirection.Both, 3),
        selectMaximumProfile(
            'maximum_ancestors',
            peopleResult.rows,
            ancestorAdjacency,
            TreeDirection.Ancestors,
            10,
        ),
        selectMaximumProfile(
            'maximum_descendants',
            peopleResult.rows,
            descendantAdjacency,
            TreeDirection.Descendants,
            10,
        ),
        selectMaximumProfile(
            'maximum_both',
            peopleResult.rows,
            bothAdjacency,
            TreeDirection.Both,
            10,
        ),
    ];
    const legacyQueryText = buildLegacyTraversalQuery(capturedQuery.text);
    const currentRepository = new FamilyTreeRepository(pool);
    const legacyDatabase = {
        query: (queryText: string, values?: unknown[]) => {
            if (queryText !== capturedQuery.text) {
                throw new Error('The benchmark received an unexpected repository query.');
            }

            return pool.query(legacyQueryText, values);
        },
    };
    const legacyRepository = new FamilyTreeRepository(legacyDatabase as unknown as Pool);
    const results: BenchmarkResult[] = [];
    let equivalentScenarios = 0;

    for (const profile of profiles) {
        for (const depth of TESTED_DEPTHS) {
            const legacyMeasurement = await benchmarkScenario(
                'legacy',
                legacyRepository,
                pool,
                legacyQueryText,
                profile,
                depth,
            );
            const currentMeasurement = await benchmarkScenario(
                'current',
                currentRepository,
                pool,
                capturedQuery.text,
                profile,
                depth,
            );

            if (legacyMeasurement.branch === undefined || currentMeasurement.branch === undefined) {
                throw new Error(
                    `A query timed out before equivalence could be checked for ${profile.name} at depth ${depth}.`,
                );
            }

            assert.deepStrictEqual(
                currentMeasurement.branch,
                legacyMeasurement.branch,
                `The current query changed ${profile.name} at depth ${depth}.`,
            );

            equivalentScenarios += 1;
            results.push(legacyMeasurement.result, currentMeasurement.result);
        }
    }

    process.stdout.write(
        `${JSON.stringify(
            {
                measuredAt: new Date().toISOString(),
                database: BENCHMARK_DATABASE_NAME,
                statementTimeoutMilliseconds: STATEMENT_TIMEOUT_MILLISECONDS,
                warmRuns: WARM_RUNS,
                people: peopleResult.rowCount,
                relationships: relationshipsResult.rowCount,
                equivalentScenarios,
                profiles: profiles.map(
                    ({ name, direction, selectionDepth, reachablePeopleAtSelectionDepth }) => ({
                        name,
                        direction,
                        selectionDepth,
                        reachablePeopleAtSelectionDepth,
                    }),
                ),
                results,
            },
            null,
            2,
        )}\n`,
    );
} finally {
    await pool.end();
}
