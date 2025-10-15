import { defineField, defineType } from 'sanity'

export const placeType = defineType({
  name: 'place',
  title: 'Place',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Place Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Hackathon', value: 'Hackathon' },
          { title: 'Conference', value: 'Conference' },
          { title: 'Research', value: 'Research' },
          { title: 'Tech Office', value: 'Tech Office' },
          { title: 'Mentorship', value: 'Mentorship' },
          { title: 'Event', value: 'Event' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'latitude',
      title: 'Latitude',
      type: 'number',
      validation: (Rule) => Rule.required().min(-90).max(90),
    }),
    defineField({
      name: 'longitude',
      title: 'Longitude',
      type: 'number',
      validation: (Rule) => Rule.required().min(-180).max(180),
    }),
    defineField({
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [
        {
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alternative Text',
            },
            {
              name: 'caption',
              type: 'string',
              title: 'Caption',
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Used to order places in lists (lower numbers appear first)',
      validation: (Rule) => Rule.required(),
      initialValue: 0,
    }),
    defineField({
      name: 'featured',
      title: 'Featured Place',
      type: 'boolean',
      description: 'Highlight this place on the map',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'category',
      media: 'photos.0',
    },
  },
})
