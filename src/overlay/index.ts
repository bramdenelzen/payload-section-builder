import type { AdminToPreviewMessage, PreviewToAdminMessage } from '../protocol.js'

import { isEnvelope, SECTION_INDEX_ATTR, SECTION_TYPE_ATTR, wrap } from '../protocol.js'

export type SectionOverlayOptions = {
  /** Origin of the Payload admin, e.g. `https://cms.client.com`. Required for security. */
  adminOrigin: string
  /**
   * Inject the default editor chrome styles. Set to `false` to style the `.psb-*`
   * classes yourself. Default: `true`.
   */
  injectStyles?: boolean
}

const STYLE_ID = 'payload-section-builder-overlay-style'

/**
 * Editor chrome only (outlines, label, toolbar), never your site's sections.
 * Colours and fonts are CSS variables, so a client project can restyle the chrome
 * without touching the plugin, or pass `injectStyles: false` and style the
 * `.psb-*` classes itself.
 */
const CSS = `
:root {
  --psb-accent: #3b5bdb;
  --psb-accent-soft: rgba(59, 91, 219, .18);
  --psb-on-accent: #fff;
  --psb-toolbar-bg: #1c2333;
  --psb-toolbar-fg: #fff;
  --psb-focus: #91a7ff;
  --psb-font: 500 13px/1 system-ui, sans-serif;
  --psb-z: 2147483000;
}
.psb-box { position: fixed; pointer-events: none; z-index: var(--psb-z); border-radius: 4px; transition: opacity .12s; }
.psb-hover { outline: 2px dashed var(--psb-accent); outline-offset: -2px; }
.psb-selected { outline: 2px solid var(--psb-accent); outline-offset: -2px; box-shadow: 0 0 0 4px var(--psb-accent-soft); }
.psb-label { position: absolute; top: 0; left: 0; transform: translateY(-100%); background: var(--psb-accent);
  color: var(--psb-on-accent); font: var(--psb-font); font-weight: 600; padding: 5px 8px; border-radius: 4px 4px 0 0; white-space: nowrap; }
.psb-toolbar { position: fixed; z-index: calc(var(--psb-z) + 1); display: flex; gap: 2px; background: var(--psb-toolbar-bg);
  border-radius: 6px; padding: 3px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.psb-toolbar button { all: unset; cursor: pointer; color: var(--psb-toolbar-fg); font: var(--psb-font); padding: 6px 9px; border-radius: 4px; }
.psb-toolbar button:hover { background: rgba(255,255,255,.14); }
.psb-toolbar button:focus-visible { outline: 2px solid var(--psb-focus); }
.psb-toolbar button[disabled] { opacity: .35; cursor: default; }
`

const humanize = (blockType: string) =>
  blockType.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/**
 * Framework-free overlay for the preview page. Does nothing unless the page is
 * inside the Payload live preview AND the admin has answered the handshake.
 * Returns a cleanup function.
 */
export function initSectionOverlay({
  adminOrigin,
  injectStyles = true,
}: SectionOverlayOptions): () => void {
  if (typeof window === 'undefined' || window.parent === window) {
    return () => {}
  }

  const parentWindow = window.parent
  let active = false
  let blockCount = 0
  let hovered: HTMLElement | null = null
  let selected: null | number = null
  let frame = 0

  const post = (message: PreviewToAdminMessage) => parentWindow.postMessage(wrap(message), adminOrigin)

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS

  const hoverBox = document.createElement('div')
  hoverBox.className = 'psb-box psb-hover'
  const hoverLabel = document.createElement('div')
  hoverLabel.className = 'psb-label'
  hoverBox.append(hoverLabel)

  const selectedBox = document.createElement('div')
  selectedBox.className = 'psb-box psb-selected'

  const toolbar = document.createElement('div')
  toolbar.className = 'psb-toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Section actions')
  const upButton = document.createElement('button')
  upButton.type = 'button'
  upButton.textContent = '↑ Move up'
  const downButton = document.createElement('button')
  downButton.type = 'button'
  downButton.textContent = '↓ Move down'
  toolbar.append(upButton, downButton)

  const sectionAt = (index: number) =>
    document.querySelector<HTMLElement>(`[${SECTION_INDEX_ATTR}="${index}"]`)

  const sectionFrom = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(`[${SECTION_INDEX_ATTR}]`) : null

  const indexOf = (element: HTMLElement) => Number(element.getAttribute(SECTION_INDEX_ATTR))

  const place = (box: HTMLElement, element: HTMLElement | null) => {
    if (!element) {
      box.style.opacity = '0'
      return
    }
    const rect = element.getBoundingClientRect()
    box.style.opacity = '1'
    box.style.top = `${rect.top}px`
    box.style.left = `${rect.left}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
  }

  const render = () => {
    const selectedElement = selected === null ? null : sectionAt(selected)
    place(hoverBox, hovered && hovered !== selectedElement ? hovered : null)
    place(selectedBox, selectedElement)

    if (selectedElement && selected !== null) {
      const rect = selectedElement.getBoundingClientRect()
      toolbar.style.display = 'flex'
      toolbar.style.top = `${Math.max(rect.top + 8, 8)}px`
      toolbar.style.left = `${Math.max(rect.right - toolbar.offsetWidth - 8, 8)}px`
      upButton.disabled = selected === 0
      downButton.disabled = selected >= blockCount - 1
    } else {
      toolbar.style.display = 'none'
    }

    frame = requestAnimationFrame(render)
  }

  const activate = () => {
    if (active) {
      return
    }
    active = true
    document.documentElement.dataset.sectionBuilder = 'on'
    if (injectStyles && !document.getElementById(STYLE_ID)) {
      document.head.append(style)
    }
    document.body.append(hoverBox, selectedBox, toolbar)
    frame = requestAnimationFrame(render)
  }

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== adminOrigin || event.source !== parentWindow || !isEnvelope(event.data)) {
      return
    }
    const message = event.data as unknown as AdminToPreviewMessage
    if (message.type === 'editor-ready') {
      blockCount = message.blockCount
      activate()
    } else if (message.type === 'selection-changed') {
      selected = message.index
    }
  }

  const onPointerOver = (event: PointerEvent) => {
    if (active) {
      hovered = sectionFrom(event.target)
      if (hovered) {
        hoverLabel.textContent = humanize(hovered.getAttribute(SECTION_TYPE_ATTR) ?? 'Section')
      }
    }
  }

  const onPointerLeave = () => {
    hovered = null
  }

  const onClick = (event: MouseEvent) => {
    if (!active || toolbar.contains(event.target as Node)) {
      return
    }
    const section = sectionFrom(event.target)
    if (!section) {
      return
    }
    // Editing mode: clicks select sections instead of following links.
    event.preventDefault()
    event.stopPropagation()
    selected = indexOf(section)
    post({ type: 'select-block', index: selected })
  }

  const move = (delta: -1 | 1) => {
    if (selected === null) {
      return
    }
    const to = selected + delta
    if (to < 0 || to >= blockCount) {
      return
    }
    post({ type: 'move-block', from: selected, to })
    selected = to // optimistic; the admin confirms with selection-changed
  }

  upButton.addEventListener('click', () => move(-1))
  downButton.addEventListener('click', () => move(1))

  window.addEventListener('message', onMessage)
  document.addEventListener('pointerover', onPointerOver)
  document.documentElement.addEventListener('pointerleave', onPointerLeave)
  document.addEventListener('click', onClick, true)

  // Ask the admin to identify itself; it answers with editor-ready.
  post({ type: 'overlay-hello' })

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('message', onMessage)
    document.removeEventListener('pointerover', onPointerOver)
    document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    document.removeEventListener('click', onClick, true)
    hoverBox.remove()
    selectedBox.remove()
    toolbar.remove()
    style.remove()
    delete document.documentElement.dataset.sectionBuilder
  }
}

export { sectionAttributes } from '../protocol.js'
