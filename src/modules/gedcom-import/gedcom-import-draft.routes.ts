import type { FastifyPluginCallback } from 'fastify';
import { HttpStatus } from '../../shared/http/http-status.js';
import { MediaType } from '../../shared/http/media-type.js';
import { toGedcomAnalysisResponseDto } from './gedcom-import.mapper.js';
import {
    toAlreadyImportedGedcomResponseDto,
    toGedcomImportDraftResponseDto,
} from './gedcom-import-draft.mapper.js';
import {
    AlreadyImportedGedcomResponseDtoSchema,
    CreateGedcomImportDraftBodyDtoSchema,
    GedcomImportDraftIdParamsDtoSchema,
    GedcomImportDraftResponseDtoSchema,
    InvalidGedcomDraftProblemDtoSchema,
    UpdateGedcomImportDraftResolutionsBodyDtoSchema,
    type AlreadyImportedGedcomResponseDto,
    type CreateGedcomImportDraftBodyDto,
    type GedcomImportDraftIdParamsDto,
    type GedcomImportDraftResponseDto,
    type InvalidGedcomDraftProblemDto,
    type UpdateGedcomImportDraftResolutionsBodyDto,
} from './gedcom-import-draft.schema.js';
import type { GedcomImportDraftService } from './gedcom-import-draft.service.js';

type GedcomImportDraftRoutesOptions = {
    draftService: GedcomImportDraftService;
};

const gedcomImportDraftRoutes: FastifyPluginCallback<GedcomImportDraftRoutesOptions> = (
    app,
    { draftService },
) => {
    app.post<{
        Body: CreateGedcomImportDraftBodyDto;
        Reply:
            | GedcomImportDraftResponseDto
            | AlreadyImportedGedcomResponseDto
            | InvalidGedcomDraftProblemDto;
    }>(
        '/',
        {
            schema: {
                body: CreateGedcomImportDraftBodyDtoSchema,
                response: {
                    [HttpStatus.Ok]: AlreadyImportedGedcomResponseDtoSchema,
                    [HttpStatus.Created]: GedcomImportDraftResponseDtoSchema,
                    [HttpStatus.BadRequest]: InvalidGedcomDraftProblemDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const result = await draftService.create(request.body);

            if (result.status === 'invalid_file') {
                const { diagnostics } = toGedcomAnalysisResponseDto(result.analysis);

                return reply.code(HttpStatus.BadRequest).type(MediaType.ProblemJson).send({
                    type: 'about:blank',
                    title: 'Bad Request',
                    status: HttpStatus.BadRequest,
                    detail: 'The GEDCOM file could not be converted into an import draft.',
                    requestId: request.id,
                    diagnostics,
                });
            }

            if (result.status === 'already_imported') {
                return reply
                    .code(HttpStatus.Ok)
                    .send(toAlreadyImportedGedcomResponseDto(result.run));
            }

            return reply
                .code(HttpStatus.Created)
                .send(toGedcomImportDraftResponseDto(result.draft));
        },
    );

    app.get<{ Params: GedcomImportDraftIdParamsDto; Reply: GedcomImportDraftResponseDto }>(
        '/:id',
        {
            schema: {
                params: GedcomImportDraftIdParamsDtoSchema,
                response: {
                    [HttpStatus.Ok]: GedcomImportDraftResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const draft = await draftService.findById(request.params.id);

            return reply.code(HttpStatus.Ok).send(toGedcomImportDraftResponseDto(draft));
        },
    );

    app.patch<{
        Params: GedcomImportDraftIdParamsDto;
        Body: UpdateGedcomImportDraftResolutionsBodyDto;
        Reply: GedcomImportDraftResponseDto;
    }>(
        '/:id/resolutions',
        {
            schema: {
                params: GedcomImportDraftIdParamsDtoSchema,
                body: UpdateGedcomImportDraftResolutionsBodyDtoSchema,
                response: {
                    [HttpStatus.Ok]: GedcomImportDraftResponseDtoSchema,
                },
            },
        },
        async (request, reply) => {
            const draft = await draftService.updateResolutions(request.params.id, request.body);

            return reply.code(HttpStatus.Ok).send(toGedcomImportDraftResponseDto(draft));
        },
    );

    app.delete<{ Params: GedcomImportDraftIdParamsDto }>(
        '/:id',
        {
            schema: {
                params: GedcomImportDraftIdParamsDtoSchema,
            },
        },
        async (request, reply) => {
            await draftService.delete(request.params.id);

            return reply.code(HttpStatus.NoContent).send();
        },
    );
};

export default gedcomImportDraftRoutes;
