import { type SchemaTypeDefinition } from 'sanity'
import { projectType } from './project'
import { experienceType } from './experience'
import { certificationType } from './certification'
import { placeType } from './place'
import { resumeType } from './resume'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [projectType, experienceType, certificationType, placeType, resumeType],
}
