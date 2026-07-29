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

export type ParentChildRelationship = {
    id: string;
    parentId: string;
    childId: string;
    relationshipType: ParentChildRelationshipType;
    createdAt: Date;
    updatedAt: Date;
};
