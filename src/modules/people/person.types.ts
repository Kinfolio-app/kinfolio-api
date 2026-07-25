export enum LivingStatus {
    Unknown = 'unknown',
    Living = 'living',
    Deceased = 'deceased',
}

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

export type CreatePersonInput = {
    firstName?: string;
    middleNames?: string;
    lastName?: string;
    birthName?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    livingStatus?: LivingStatus;
    biography?: string;
};
