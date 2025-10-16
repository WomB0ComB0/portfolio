import type { SchemaTypeDefinition } from 'sanity';
import { certificationType } from './certification';
import { experienceType } from './experience';
import { placeType } from './place';
import { projectType } from './project';
import { resumeType } from './resume';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [projectType, experienceType, certificationType, placeType, resumeType],
};
