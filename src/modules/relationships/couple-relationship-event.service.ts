import { BadRequestError, NotFoundError } from '../../shared/errors/http-error.js';
import { MAX_PAGE_LIMIT, type CollectionResponse } from '../../shared/http/collection-response.js';
import { CoupleRelationshipNotFoundError } from './couple-relationship.error.js';
import type { CoupleRelationshipEventRepository } from './couple-relationship-event.repository.js';
import type {
    CreateCoupleRelationshipEventDto,
    UpdateCoupleRelationshipEventDto,
} from './couple-relationship.schema.js';
import type { CoupleRelationshipEvent } from './couple-relationship.types.js';

type CoupleRelationshipEventRepositoryContract = Pick<
    CoupleRelationshipEventRepository,
    'create' | 'findById' | 'findByRelationshipId' | 'update'
>;

function normalizeText(value: string, fieldName: 'place' | 'description'): string {
    const normalized = value.trim();

    if (normalized.length === 0) {
        throw new BadRequestError({
            detail: `The ${fieldName} cannot be blank.`,
        });
    }

    return normalized;
}

function normalizeCreateInput(
    input: CreateCoupleRelationshipEventDto,
): CreateCoupleRelationshipEventDto {
    const normalized = { ...input };

    if (input.place !== undefined) {
        normalized.place = normalizeText(input.place, 'place');
    }

    if (input.description !== undefined) {
        normalized.description = normalizeText(input.description, 'description');
    }

    return normalized;
}

function normalizeUpdateInput(
    input: UpdateCoupleRelationshipEventDto,
): UpdateCoupleRelationshipEventDto {
    const normalized = { ...input };

    if (input.place !== undefined && input.place !== null) {
        normalized.place = normalizeText(input.place, 'place');
    }

    if (input.description !== undefined && input.description !== null) {
        normalized.description = normalizeText(input.description, 'description');
    }

    return normalized;
}

export class CoupleRelationshipEventService {
    constructor(private readonly repository: CoupleRelationshipEventRepositoryContract) {}

    async create(
        coupleRelationshipId: string,
        input: CreateCoupleRelationshipEventDto,
    ): Promise<CoupleRelationshipEvent> {
        try {
            return await this.repository.create(coupleRelationshipId, normalizeCreateInput(input));
        } catch (error) {
            if (error instanceof CoupleRelationshipNotFoundError) {
                throw new NotFoundError({
                    detail: error.message,
                    cause: error,
                });
            }

            throw error;
        }
    }

    async findById(id: string): Promise<CoupleRelationshipEvent> {
        const event = await this.repository.findById(id);

        if (event === null) {
            throw new NotFoundError({
                detail: 'The requested couple relationship event does not exist.',
            });
        }

        return event;
    }

    async findByRelationshipId(
        coupleRelationshipId: string,
        limit: number,
        page: number,
    ): Promise<CollectionResponse<CoupleRelationshipEvent>> {
        const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);
        const result = await this.repository.findByRelationshipId(
            coupleRelationshipId,
            effectiveLimit,
            page,
        );

        if (result === null) {
            throw new NotFoundError({
                detail: 'The requested couple relationship does not exist.',
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

    async update(
        id: string,
        input: UpdateCoupleRelationshipEventDto,
    ): Promise<CoupleRelationshipEvent> {
        const event = await this.repository.update(id, normalizeUpdateInput(input));

        if (event === null) {
            throw new NotFoundError({
                detail: 'The requested couple relationship event does not exist.',
            });
        }

        return event;
    }
}
