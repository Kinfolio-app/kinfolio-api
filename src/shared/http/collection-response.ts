import Type, { type TSchema } from 'typebox';

export const MAX_PAGE_LIMIT: number = 100;

export type Pagination = {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
};

export type CollectionResponse<Item> = {
    data: Item[];
    pagination: Pagination;
};

export const PaginationResponseSchema = Type.Object(
    {
        page: Type.Integer({ minimum: 1 }),
        limit: Type.Integer({ minimum: 1 }),
        totalItems: Type.Integer({ minimum: 0 }),
        totalPages: Type.Integer({ minimum: 0 }),
    },
    {
        additionalProperties: false,
    },
);

export function createCollectionResponseSchema<ItemSchema extends TSchema>(itemSchema: ItemSchema) {
    return Type.Object(
        {
            data: Type.Array(itemSchema),
            pagination: PaginationResponseSchema,
        },
        {
            additionalProperties: false,
        },
    );
}
