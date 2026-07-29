export const LivingStatus = {
    Unknown: 'unknown',
    Living: 'living',
    Deceased: 'deceased',
} as const;

export type LivingStatus = (typeof LivingStatus)[keyof typeof LivingStatus];

export type Person = {
    id: string;
    firstName: string | null;
    middleNames: string | null;
    lastName: string | null;
    birthName: string | null;
    birthDate: string | null;
    birthPlace: string | null;
    deathDate: string | null;
    deathPlace: string | null;
    livingStatus: LivingStatus;
    biography: string | null;
    createdAt: Date;
    updatedAt: Date;
};
