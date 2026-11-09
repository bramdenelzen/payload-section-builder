'use client'

import type { Row } from 'payload'

import { useForm, useFormFields, useLivePreviewContext } from '@payloadcms/ui'
import { useCallback, useEffect, useRef } from 'react'

import type { AdminToPreviewMessage, PreviewToAdminMessage } from '../protocol.js'

import { isEnvelope, wrap } from '../protocol.js'

export type SectionBridgeProps = {
  fieldPath: string
  previewOrigin?: string
}

const rowElementID = (path: string, index: number) => `${path.split('.').join('-')}-row-${index}`

/**
 * Lives inside the document form. Receives intents from the preview overlay and
 * applies them to the form, so drafts, validation and autosave keep working as usual.
 */
export const SectionBridge = ({ fieldPath, previewOrigin }: SectionBridgeProps) => {
  const { dispatchFields, moveFieldRow } = useForm()
  const rows = useFormFields(([fields]) => fields[fieldPath]?.rows) as Row[] | undefined
  const { iframeRef, loadedURL, popupRef, previewWindowType } = useLivePreviewContext()

  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows ?? []

  const targetOrigin = previewOrigin ?? (loadedURL ? new URL(loadedURL).origin : undefined)

  const getPreviewWindow = useCallback((): null | Window | undefined => {
    if (previewWindowType === 'popup') {
      return popupRef?.current
    }
    return iframeRef.current?.contentWindow
  }, [iframeRef, popupRef, previewWindowType])

  const send = useCallback(
    (message: AdminToPreviewMessage) => {
      const target = getPreviewWindow()
      if (target && targetOrigin) {
        target.postMessage(wrap(message), targetOrigin)
      }
    },
    [getPreviewWindow, targetOrigin],
  )

  const selectRow = useCallback(
    (index: number) => {
      const current = rowsRef.current
      if (index < 0 || index >= current.length) {
        return
      }

      // Collapse every other section so the sidebar only shows the selected one.
      dispatchFields({
        type: 'SET_ALL_ROWS_COLLAPSED',
        path: fieldPath,
        updatedRows: current.map((row, i) => ({ ...row, collapsed: i !== index })),
      })

      requestAnimationFrame(() => {
        const element = document.getElementById(rowElementID(fieldPath, index))
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        const firstInput = element?.querySelector<HTMLElement>(
          '.blocks-field__row input, .blocks-field__row textarea, input, textarea',
        )
        firstInput?.focus({ preventScroll: true })
      })
    },
    [dispatchFields, fieldPath],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isEnvelope(event.data)) {
        return
      }
      if (targetOrigin && event.origin !== targetOrigin) {
        return
      }
      if (event.source !== getPreviewWindow()) {
        return
      }

      const message = event.data as unknown as PreviewToAdminMessage

      switch (message.type) {
        case 'move-block': {
          const count = rowsRef.current.length
          const { from, to } = message
          if (from === to || from < 0 || to < 0 || from >= count || to >= count) {
            return
          }
          moveFieldRow({ moveFromIndex: from, moveToIndex: to, path: fieldPath })
          send({ type: 'selection-changed', index: to })
          break
        }
        case 'overlay-hello': {
          send({ type: 'editor-ready', blockCount: rowsRef.current.length })
          break
        }
        case 'select-block': {
          selectRow(message.index)
          send({ type: 'selection-changed', index: message.index })
          break
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [fieldPath, getPreviewWindow, moveFieldRow, selectRow, send, targetOrigin])

  // Announce ourselves whenever a (new) preview page finishes loading.
  useEffect(() => {
    if (loadedURL) {
      send({ type: 'editor-ready', blockCount: rowsRef.current.length })
    }
  }, [loadedURL, send])

  return null
}
