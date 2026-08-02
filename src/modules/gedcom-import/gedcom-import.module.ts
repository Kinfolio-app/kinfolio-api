import type { FastifyPluginAsync } from 'fastify';
import gedcomAnalysisRoutes from './gedcom-analysis.routes.js';
import { GedcomParserSelector } from './gedcom-parser-selector.js';
import { GedcomImportService } from './gedcom-import.service.js';
import { GedcomFileDetector } from './gedcom-file-detector.js';

const gedcomImportModule: FastifyPluginAsync = async (app) => {
    const fileDetector = new GedcomFileDetector();
    const parserSelector = new GedcomParserSelector();
    const importService = new GedcomImportService(fileDetector, parserSelector);

    await app.register(gedcomAnalysisRoutes, {
        prefix: '/gedcom-imports',
        importService,
    });
};

export default gedcomImportModule;
