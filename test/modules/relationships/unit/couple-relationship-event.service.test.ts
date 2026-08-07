import { describe, expect, it, vi } from 'vitest';
import { CoupleRelationshipEventService } from '../../../../src/modules/relationships/couple-relationship-event.service.js';
import { CoupleRelationshipNotFoundError } from '../../../../src/modules/relationships/couple-relationship.error.js';
import {
    CoupleRelationshipEventType,
    type CoupleRelationshipEvent,
} from '../../../../src/modules/relationships/couple-relationship.types.js';
import { BadRequestError, NotFoundError } from '../../../../src/shared/errors/http-error.js';

const relationshipId = '65eb723e-82cf-4621-9c70-9ddfc3611b68';
const eventId = 'c3a3106d-d39e-4feb-979f-4c3813661a50';

const event: CoupleRelationshipEvent = {
    id: eventId,
    coupleRelationshipId: relationshipId,
    eventType: CoupleRelationshipEventType.Marriage,
    date: null,
    place: 'Paris',
    description: null,
    createdAt: new Date('2026-08-07T10:00:00.000Z'),
    updatedAt: new Date('2026-08-07T10:00:00.000Z'),
};

function createRepository() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findByRelationshipId: vi.fn(),
        update: vi.fn(),
    };
}

describe('CoupleRelationshipEventService', () => {
    it('normalizes and creates an event', async () => {
        const repository = createRepository();
        repository.create.mockResolvedValue(event);
        const service = new CoupleRelationshipEventService(repository);

        await expect(
            service.create(relationshipId, {
                eventType: CoupleRelationshipEventType.Marriage,
                place: ' Paris ',
                description: ' Ceremony ',
            }),
        ).resolves.toEqual(event);
        expect(repository.create).toHaveBeenCalledWith(relationshipId, {
            eventType: CoupleRelationshipEventType.Marriage,
            place: 'Paris',
            description: 'Ceremony',
        });
    });

    it('returns not found when creating an event for an unavailable relationship', async () => {
        const repository = createRepository();
        const domainError = new CoupleRelationshipNotFoundError();
        repository.create.mockRejectedValue(domainError);
        const service = new CoupleRelationshipEventService(repository);

        await expect(
            service.create(relationshipId, {
                eventType: CoupleRelationshipEventType.Other,
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                status: 404,
                detail: 'The requested couple relationship does not exist.',
                cause: domainError,
            }),
        );
    });

    it.each([
        { field: 'place', input: { place: '   ' } },
        { field: 'description', input: { description: '\t' } },
    ])('rejects a blank $field', async ({ field, input }) => {
        const repository = createRepository();
        const service = new CoupleRelationshipEventService(repository);

        await expect(
            service.create(relationshipId, {
                eventType: CoupleRelationshipEventType.Other,
                ...input,
            }),
        ).rejects.toEqual(
            new BadRequestError({
                detail: `The ${field} cannot be blank.`,
            }),
        );
        expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns an event by id', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(event);
        const service = new CoupleRelationshipEventService(repository);

        await expect(service.findById(eventId)).resolves.toEqual(event);
    });

    it('returns not found when an event does not exist', async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValue(null);
        const service = new CoupleRelationshipEventService(repository);

        await expect(service.findById(eventId)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested couple relationship event does not exist.',
            }),
        );
    });

    it('builds capped pagination metadata for relationship events', async () => {
        const repository = createRepository();
        repository.findByRelationshipId.mockResolvedValue({
            data: [event],
            totalItems: 201,
        });
        const service = new CoupleRelationshipEventService(repository);

        const result = await service.findByRelationshipId(relationshipId, 500, 2);

        expect(repository.findByRelationshipId).toHaveBeenCalledWith(relationshipId, 100, 2);
        expect(result).toEqual({
            data: [event],
            pagination: {
                page: 2,
                limit: 100,
                totalItems: 201,
                totalPages: 3,
            },
        });
    });

    it('returns not found when listing events for an unavailable relationship', async () => {
        const repository = createRepository();
        repository.findByRelationshipId.mockResolvedValue(null);
        const service = new CoupleRelationshipEventService(repository);

        await expect(service.findByRelationshipId(relationshipId, 20, 1)).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested couple relationship does not exist.',
            }),
        );
    });

    it('normalizes and updates an event', async () => {
        const repository = createRepository();
        const updatedEvent = {
            ...event,
            place: 'Lyon',
            description: null,
        };
        repository.update.mockResolvedValue(updatedEvent);
        const service = new CoupleRelationshipEventService(repository);

        await expect(
            service.update(eventId, {
                place: ' Lyon ',
                description: null,
            }),
        ).resolves.toEqual(updatedEvent);
        expect(repository.update).toHaveBeenCalledWith(eventId, {
            place: 'Lyon',
            description: null,
        });
    });

    it('returns not found when updating an unavailable event', async () => {
        const repository = createRepository();
        repository.update.mockResolvedValue(null);
        const service = new CoupleRelationshipEventService(repository);

        await expect(service.update(eventId, { place: 'Paris' })).rejects.toEqual(
            new NotFoundError({
                detail: 'The requested couple relationship event does not exist.',
            }),
        );
    });
});
