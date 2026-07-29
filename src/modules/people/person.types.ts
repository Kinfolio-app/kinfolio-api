export const LivingStatus = {
    Unknown: 'unknown',
    Living: 'living',
    Deceased: 'deceased',
} as const;

export type LivingStatus = (typeof LivingStatus)[keyof typeof LivingStatus];

export const Gender = {
    Male: 'male',
    Female: 'female',
    NonBinary: 'non_binary',
    Unspecified: 'unspecified',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export type Person = {
    id: string;
    firstName: string | null;
    middleNames: string | null;
    lastName: string | null;
    birthName: string | null;
    gender: Gender;
    birthDate: string | null;
    birthPlace: string | null;
    deathDate: string | null;
    deathPlace: string | null;
    livingStatus: LivingStatus;
    biography: string | null;
    createdAt: Date;
    updatedAt: Date;
};
