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
