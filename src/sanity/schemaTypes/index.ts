import { type SchemaTypeDefinition } from 'sanity'
import { projectType } from './project'
import { experienceType } from './experience'
import { certificationType } from './certification'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [projectType, experienceType, certificationType],
}
