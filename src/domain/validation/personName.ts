import { z } from 'zod'

// A dot may be followed by a space so initials like "J. Pérez" are valid.
const PERSON_NAME = /^\p{L}+((\. ?|[ '’-])\p{L}+)*$/u

/** A person's display name: letters joined by single spaces, apostrophes, hyphens, or dots. */
export const personNameSchema = z.string()
  .transform(value => value.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(z.string()
    .min(2, { error: issue => issue.input === '' ? 'Completá el nombre.' : 'El nombre debe tener al menos 2 letras.' })
    .max(40, 'El nombre puede tener hasta 40 caracteres.')
    .regex(PERSON_NAME, 'Usá solo letras, separadas por espacio, apóstrofo, guion o punto.'))
