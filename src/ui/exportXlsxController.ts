export interface ExportXlsxState {
  isExporting: boolean
  errorMessage: string | null
  successMessage: string | null
}

export const EXPORT_XLSX_SUCCESS_MESSAGE = 'Calendario exportado. Revisá la descarga del archivo XLSX.'

export const EXPORT_XLSX_ERROR_MESSAGE = 'No se pudo exportar el XLSX. Intentá nuevamente.'

export const initialExportXlsxState: ExportXlsxState = {
  isExporting: false,
  errorMessage: null,
  successMessage: null,
}

export function createExportXlsxController(
  onStateChange: (state: ExportXlsxState) => void,
) {
  let state = initialExportXlsxState

  function updateState(nextState: ExportXlsxState) {
    state = nextState
    onStateChange(state)
  }

  return {
    getState(): ExportXlsxState {
      return state
    },

    async run(exportTournament: () => Promise<void>): Promise<boolean> {
      if (state.isExporting) return false

      updateState({
        isExporting: true,
        errorMessage: null,
        successMessage: null,
      })

      try {
        await exportTournament()
        updateState({
          isExporting: false,
          errorMessage: null,
          successMessage: EXPORT_XLSX_SUCCESS_MESSAGE,
        })
        return true
      } catch (error) {
        console.error('Failed to export XLSX workbook', error)
        updateState({
          isExporting: false,
          errorMessage: EXPORT_XLSX_ERROR_MESSAGE,
          successMessage: null,
        })
        return false
      }
    },
  }
}
