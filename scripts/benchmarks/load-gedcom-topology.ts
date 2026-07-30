import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { loadGedcomTopology, parseGedcomTopology } from './gedcom-topology.ts';

const arguments_ = process.argv.slice(2);
const replace = arguments_.includes('--replace');
const filePaths = arguments_.filter((argument) => !argument.startsWith('--'));
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
}

if (filePaths.length !== 1) {
    throw new Error('Provide exactly one GEDCOM file path.');
}

const startedAt = performance.now();
const content = await readFile(filePaths[0] as string, 'utf8');
const topology = parseGedcomTopology(content);
const parsedAt = performance.now();
const loaded = await loadGedcomTopology(databaseUrl, topology, replace);
const finishedAt = performance.now();

process.stdout.write(
    `${JSON.stringify(
        {
            gedcomVersion: topology.gedcomVersion,
            characterSet: topology.characterSet,
            families: topology.families,
            people: loaded.people,
            relationships: loaded.relationships,
            duplicateRelationshipsIgnored: topology.duplicateRelationships,
            parsingMilliseconds: Number((parsedAt - startedAt).toFixed(2)),
            loadingMilliseconds: Number((finishedAt - parsedAt).toFixed(2)),
        },
        null,
        2,
    )}\n`,
);
