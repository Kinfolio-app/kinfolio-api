import type { FastifyPluginCallback } from 'fastify';
import type { GedcomImportService } from './gedcom-import.service.js';
import { HttpStatus } from '../../shared/http/http-status.js';
import {
    GedcomAnalysisResponseDtoSchema,
    GedcomAnalysisBodyDtoSchema,
    type GedcomAnalysisResponseDto,
    type GedcomAnalysisBodyDto,
} from './gedcom-analysis.schema.js';
import { toGedcomAnalysisResponseDto } from './gedcom-import.mapper.js';

type ImportRoutesOptions = {
    importService: GedcomImportService;
};

const gedcomAnalysisRoutes: FastifyPluginCallback<ImportRoutesOptions> = (
    app,
    { importService },
) => {
    app.post<{ Body: GedcomAnalysisBodyDto; Reply: GedcomAnalysisResponseDto }>(
        '/analysis',
        {
            schema: {
                body: GedcomAnalysisBodyDtoSchema,
                response: {
                    [HttpStatus.Ok]: GedcomAnalysisResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const fileBytes = request.body.file;

            const analysis = importService.analyze(fileBytes);

            return reply.code(HttpStatus.Ok).send(toGedcomAnalysisResponseDto(analysis));
        },
    );
};

export default gedcomAnalysisRoutes;
