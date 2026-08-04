export const ParentChildRelationshipType = {
    Biological: 'biological',
    Adoptive: 'adoptive',
    Step: 'step',
    Foster: 'foster',
    Other: 'other',
    Unspecified: 'unspecified',
} as const;

export type ParentChildRelationshipType =
    (typeof ParentChildRelationshipType)[keyof typeof ParentChildRelationshipType];

export const ParentChildRelationshipEvidenceStatus = {
    Unassessed: 'unassessed',
    Proven: 'proven',
    Challenged: 'challenged',
} as const;

export type ParentChildRelationshipEvidenceStatus =
    (typeof ParentChildRelationshipEvidenceStatus)[keyof typeof ParentChildRelationshipEvidenceStatus];

export type ParentChildRelationship = {
    id: string;
    parentId: string;
    childId: string;
    relationshipType: ParentChildRelationshipType;
    evidenceStatus: ParentChildRelationshipEvidenceStatus;
    createdAt: Date;
    updatedAt: Date;
};
