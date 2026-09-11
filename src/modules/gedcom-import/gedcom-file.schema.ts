import Type from 'typebox';
import {
    GEDCOM_551_VERSION,
    GEDCOM_7_BASE_VERSION,
    GEDCOM_7_PATCH_VERSION_PATTERN,
} from './gedcom-file.types.js';

export const SupportedGedcomVersionSchema = Type.Union([
    Type.Literal(GEDCOM_551_VERSION),
    Type.Literal(GEDCOM_7_BASE_VERSION),
    Type.String({ pattern: GEDCOM_7_PATCH_VERSION_PATTERN }),
]);
