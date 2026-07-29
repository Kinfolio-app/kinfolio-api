export class SelfParentChildRelationshipError extends Error {
    constructor() {
        super('A person cannot be their own parent.');
        this.name = 'SelfParentChildRelationshipError';
    }
}

export class RelatedPersonNotFoundError extends Error {
    constructor(options?: ErrorOptions) {
        super('The parent or child does not exist.', options);
        this.name = 'RelatedPersonNotFoundError';
    }
}

export class DuplicateParentChildRelationshipError extends Error {
    constructor(options?: ErrorOptions) {
        super('This parent-child relationship already exists.', options);
        this.name = 'DuplicateParentChildRelationshipError';
    }
}

export class ParentChildRelationshipCycleError extends Error {
    constructor() {
        super('This parent-child relationship would create a cycle.');
        this.name = 'ParentChildRelationshipCycleError';
    }
}
