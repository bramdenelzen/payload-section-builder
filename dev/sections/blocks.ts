import type { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'intro', type: 'textarea' },
    { name: 'buttonLabel', type: 'text' },
  ],
  labels: { plural: 'Heroes', singular: 'Hero' },
}

export const TextSection: Block = {
  slug: 'text',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
  ],
  labels: { plural: 'Text sections', singular: 'Text' },
}

export const CallToAction: Block = {
  slug: 'cta',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'buttonLabel', type: 'text', required: true },
    { name: 'buttonHref', type: 'text' },
  ],
  labels: { plural: 'Calls to action', singular: 'Call to action' },
}

export const allSections = [Hero, TextSection, CallToAction]
