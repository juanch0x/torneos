import { describe, expect, it, vi } from 'vitest'
import {
  createExportXlsxController,
  EXPORT_XLSX_ERROR_MESSAGE,
  initialExportXlsxState,
  type ExportXlsxState,
} from '../exportXlsxController'

function deferredPromise() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

describe('createExportXlsxController', () => {
  it('ignores another export attempt while one is already in flight', async () => {
    const states: ExportXlsxState[] = []
    const controller = createExportXlsxController((state) => states.push(state))
    const firstExport = deferredPromise()
    const exporter = vi.fn(() => firstExport.promise)

    const firstRun = controller.run(exporter)
    const secondRun = await controller.run(exporter)

    expect(secondRun).toBe(false)
    expect(exporter).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toEqual({ isExporting: true, errorMessage: null })
    expect(states).toEqual([{ isExporting: true, errorMessage: null }])

    firstExport.resolve()
    await firstRun

    expect(controller.getState()).toEqual(initialExportXlsxState)
    expect(states).toEqual([
      { isExporting: true, errorMessage: null },
      { isExporting: false, errorMessage: null },
    ])
  })

  it('maps export failures to a visible message path and clears it after a successful retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const controller = createExportXlsxController(() => undefined)
    const failingExporter = vi.fn(async () => {
      throw new Error('write failed')
    })
    const successfulExporter = vi.fn(async () => undefined)

    await expect(controller.run(failingExporter)).resolves.toBe(false)
    expect(failingExporter).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('Failed to export XLSX workbook', expect.any(Error))
    expect(controller.getState()).toEqual({
      isExporting: false,
      errorMessage: EXPORT_XLSX_ERROR_MESSAGE,
    })

    await expect(controller.run(successfulExporter)).resolves.toBe(true)
    expect(successfulExporter).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toEqual(initialExportXlsxState)

    consoleError.mockRestore()
  })
})
