import type { FastifyPluginAsync } from 'fastify';
import gedcomAnalysisRoutes from './gedcom-analysis.routes.js';
import { GedcomParserSelector } from './gedcom-parser-selector.js';
import { GedcomImportService } from './gedcom-import.service.js';
import { GedcomFileDetector } from './gedcom-file-detector.js';
import { GedcomImportDraftRepository } from './gedcom-import-draft.repository.js';
import { GedcomImportDraftService } from './gedcom-import-draft.service.js';
import gedcomImportDraftRoutes from './gedcom-import-draft.routes.js';
import { GedcomImportRepository } from './gedcom-import.repository.js';

const gedcomImportModule: FastifyPluginAsync = async (app) => {
    const fileDetector = new GedcomFileDetector();
    const parserSelector = new GedcomParserSelector();
    const importService = new GedcomImportService(fileDetector, parserSelector);
    const importRepository = new GedcomImportRepository(app.pg.pool);
    const draftRepository = new GedcomImportDraftRepository(app.pg.pool);
    const draftService = new GedcomImportDraftService(
        draftRepository,
        importRepository,
        importService,
    );

    await app.register(gedcomAnalysisRoutes, {
        prefix: '/gedcom-imports',
        importService,
    });
    await app.register(gedcomImportDraftRoutes, {
        prefix: '/gedcom-import-drafts',
        draftService,
    });
};

export default gedcomImportModule;
