export class CoupleRelationshipPersonNotFoundError extends Error {
    constructor(options?: ErrorOptions) {
        super('One or both partners do not exist or are deleted.', options);
        this.name = 'CoupleRelationshipPersonNotFoundError';
    }
}

export class SelfCoupleRelationshipError extends Error {
    constructor(options?: ErrorOptions) {
        super('A person cannot be their own partner.', options);
        this.name = 'SelfCoupleRelationshipError';
    }
}

export class CoupleRelationshipNotFoundError extends Error {
    constructor(options?: ErrorOptions) {
        super('The requested couple relationship does not exist.', options);
        this.name = 'CoupleRelationshipNotFoundError';
    }
}
