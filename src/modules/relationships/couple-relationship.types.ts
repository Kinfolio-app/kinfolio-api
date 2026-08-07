import type { GenealogicalDate } from '../../shared/genealogy/genealogical-date.types.js';

export const CoupleRelationshipEventType = {
    Engagement: 'engagement',
    Marriage: 'marriage',
    CivilUnion: 'civil_union',
    Separation: 'separation',
    Divorce: 'divorce',
    Annulment: 'annulment',
    Other: 'other',
} as const;

export type CoupleRelationshipEventType =
    (typeof CoupleRelationshipEventType)[keyof typeof CoupleRelationshipEventType];

export type CoupleRelationship = {
    id: string;
    partner1Id: string;
    partner2Id: string;
    createdAt: Date;
    updatedAt: Date;
};

export type CoupleRelationshipEvent = {
    id: string;
    coupleRelationshipId: string;
    eventType: CoupleRelationshipEventType;
    date: GenealogicalDate | null;
    place: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type CoupleRelationshipPage = {
    data: CoupleRelationship[];
    totalItems: number;
};

export type CoupleRelationshipEventPage = {
    data: CoupleRelationshipEvent[];
    totalItems: number;
};
