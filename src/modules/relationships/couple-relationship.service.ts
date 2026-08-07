import { ConflictError, NotFoundError } from '../../shared/errors/http-error.js';
import {
    CoupleRelationshipPersonNotFoundError,
    SelfCoupleRelationshipError,
} from './couple-relationship.error.js';
import type { CoupleRelationshipRepository } from './couple-relationship.repository.js';
import type { CreateCoupleRelationshipDto } from './couple-relationship.schema.js';
import type { CoupleRelationship } from './couple-relationship.types.js';
import { MAX_PAGE_LIMIT, type CollectionResponse } from '../../shared/http/collection-response.js';

type CoupleRelationshipRepositoryContract = Pick<
    CoupleRelationshipRepository,
    'create' | 'findById' | 'findByPersonId'
>;

export class CoupleRelationshipService {
    constructor(private readonly repository: CoupleRelationshipRepositoryContract) {}

    async create(input: CreateCoupleRelationshipDto): Promise<CoupleRelationship> {
        try {
            return await this.repository.create(input);
        } catch (error) {
            if (error instanceof CoupleRelationshipPersonNotFoundError) {
                throw new NotFoundError({
                    detail: error.message,
                    cause: error,
                });
            }

            if (error instanceof SelfCoupleRelationshipError) {
                throw new ConflictError({
                    detail: error.message,
                    cause: error,
                });
            }

            throw error;
        }
    }

    async findById(id: string): Promise<CoupleRelationship> {
        const coupleRelationship = await this.repository.findById(id);

        if (coupleRelationship === null) {
            throw new NotFoundError({
                detail: 'The requested couple relationship does not exist.',
            });
        }

        return coupleRelationship;
    }

    async findByPersonId(
        id: string,
        limit: number,
        page: number,
    ): Promise<CollectionResponse<CoupleRelationship>> {
        const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
        const coupleRelationshipPage = await this.repository.findByPersonId(
            id,
            effectiveLimit,
            page,
        );

        if (coupleRelationshipPage === null) {
            throw new NotFoundError({
                detail: 'The requested person does not exist.',
            });
        }

        const { data, totalItems } = coupleRelationshipPage;

        return {
            data,
            pagination: {
                page,
                limit: effectiveLimit,
                totalItems,
                totalPages: Math.ceil(totalItems / effectiveLimit),
            },
        };
    }
}
