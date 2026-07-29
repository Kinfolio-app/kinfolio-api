import { ConflictError, NotFoundError } from '../../shared/errors/http-error.js';
import { MAX_PAGE_LIMIT, type CollectionResponse } from '../../shared/http/collection-response.js';
import {
    DuplicateParentChildRelationshipError,
    ParentChildRelationshipCycleError,
    RelatedPersonNotFoundError,
    SelfParentChildRelationshipError,
} from './parent-child-relationship.error.js';
import type { ParentChildRelationshipRepository } from './parent-child-relationship.repository.js';
import type { CreateParentChildRelationshipDto } from './parent-child-relationship.schema.js';
import type { ParentChildRelationship } from './parent-child-relationship.types.js';

type ParentChildRelationshipRepositoryContract = Pick<
    ParentChildRelationshipRepository,
    'create' | 'findById' | 'findByPersonId'
>;

export class ParentChildRelationshipService {
    constructor(private readonly repository: ParentChildRelationshipRepositoryContract) {}

    async create(input: CreateParentChildRelationshipDto): Promise<ParentChildRelationship> {
        try {
            if (input.parentId === input.childId) {
                throw new SelfParentChildRelationshipError();
            }

            return await this.repository.create(input);
        } catch (error) {
            if (error instanceof RelatedPersonNotFoundError) {
                throw new NotFoundError({
                    detail: error.message,
                    cause: error,
                });
            }

            if (error instanceof DuplicateParentChildRelationshipError) {
                throw new ConflictError({
                    detail: error.message,
                    cause: error,
                });
            }

            if (
                error instanceof SelfParentChildRelationshipError ||
                error instanceof ParentChildRelationshipCycleError
            ) {
                throw new ConflictError({
                    detail: error.message,
                    cause: error,
                });
            }

            throw error;
        }
    }

    async findById(id: string): Promise<ParentChildRelationship> {
        const relationship = await this.repository.findById(id);

        if (relationship === null) {
            throw new NotFoundError({
                detail: 'The requested parent-child relationship does not exist.',
            });
        }

        return relationship;
    }

    async findByPersonId(
        personId: string,
        limit: number,
        page: number,
    ): Promise<CollectionResponse<ParentChildRelationship>> {
        const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
        const result = await this.repository.findByPersonId(personId, effectiveLimit, page);

        if (result === null) {
            throw new NotFoundError({
                detail: 'The requested person does not exist.',
            });
        }

        return {
            data: result.data,
            pagination: {
                page,
                limit: effectiveLimit,
                totalItems: result.totalItems,
                totalPages: Math.ceil(result.totalItems / effectiveLimit),
            },
        };
    }
}
