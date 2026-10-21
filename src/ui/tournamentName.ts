// Pure validation for the "Nuevo torneo" form: returns the message to show, or null when valid.
export function tournamentNameError(name: string): string | null {
  return name.trim() ? null : 'Escribí un nombre para el torneo.'
}
