/**
 * Reading a Server-Sent Events stream on React Native.
 *
 * There is no `EventSource` here, and `fetch` on RN 0.81 resolves with the
 * whole body rather than handing back a readable stream, so neither can hold a
 * connection open and deliver events as they arrive. `XMLHttpRequest` can: it
 * fires `readystatechange` repeatedly at `readyState === 3` while the body
 * grows, and `responseText` carries everything received so far. The reader
 * below keeps an offset into that text so every chunk is parsed exactly once.
 *
 * A library would do the same thing and would not know about the app's
 * single-flight token refresh, which a stream that outlives its access token
 * has to use. That is why this lives in the repo (GoGo-MobileApp#286).
 */

/** One decoded event. `type` is the SSE `event:` field, `message` when absent. */
export interface SseEvent {
  type: string
  id: string | null
  data: string
}

export interface SseConnectOptions {
  url: string
  headers: Record<string, string>
  /** Headers received and the status was not an error. */
  onOpen: () => void
  onEvent: (event: SseEvent) => void
  /**
   * The stream ended. `status` is the HTTP status when there was one, and null
   * when the connection failed before answering. Classifying it is the
   * transport's business, not the reader's.
   */
  onClose: (reason: { status: number | null }) => void
}

export interface SseConnection {
  close: () => void
}

export type SseConnector = (options: SseConnectOptions) => SseConnection

const FIELD = /^([^:]*)(?:: ?(.*))?$/

/**
 * Decodes whole events out of a buffer and returns what is left.
 *
 * Pure, and exported for the tests: the framing is the part worth pinning, and
 * it does not need an XHR to exercise. An event ends at a blank line; `data`
 * repeats to build multi-line payloads; a line starting with `:` is a comment
 * and is dropped.
 */
export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  let rest = buffer

  for (;;) {
    const boundary = /\r?\n\r?\n/.exec(rest)
    if (!boundary) break

    const block = rest.slice(0, boundary.index)
    rest = rest.slice(boundary.index + boundary[0].length)

    let type = 'message'
    let id: string | null = null
    const data: string[] = []
    let sawField = false

    for (const line of block.split(/\r?\n/)) {
      if (line === '' || line.startsWith(':')) continue
      const match = FIELD.exec(line)
      if (!match) continue
      const [, field, rawValue] = match
      const value = rawValue ?? ''
      sawField = true
      if (field === 'event') type = value
      else if (field === 'id') id = value
      else if (field === 'data') data.push(value)
      // `retry` is the server's reconnect hint. The transport's own backoff
      // has to respect a per-actor rate limit, so it is deliberately ignored.
    }

    if (sawField) events.push({ type, id, data: data.join('\n') })
  }

  return { events, rest }
}

/**
 * The reader the app ships. Kept out of the transport so tests can drive the
 * transport with a fake and never touch a native module.
 */
export const xhrSseConnector: SseConnector = ({ url, headers, onOpen, onEvent, onClose }) => {
  const xhr = new XMLHttpRequest()
  let consumed = 0
  let buffer = ''
  let opened = false
  let finished = false
  let abandoned = false

  const finish = (status: number | null) => {
    if (finished || abandoned) return
    finished = true
    onClose({ status })
  }

  const drain = () => {
    const text: string = xhr.responseText ?? ''
    if (text.length <= consumed) return
    buffer += text.slice(consumed)
    consumed = text.length
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest
    for (const event of parsed.events) onEvent(event)
  }

  xhr.onreadystatechange = () => {
    if (abandoned) return

    // An error status still arrives with headers, so opening is only reported
    // once the status says the stream is really starting.
    if (xhr.readyState >= 2 && !opened && xhr.status > 0 && xhr.status < 400) {
      opened = true
      onOpen()
    }

    if (xhr.readyState >= 3 && opened) drain()

    if (xhr.readyState === 4) finish(xhr.status || null)
  }

  // A transport error (no answer, DNS, dropped socket) has no status.
  xhr.onerror = () => finish(null)
  xhr.ontimeout = () => finish(null)

  xhr.open('GET', url, true)
  for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
  xhr.setRequestHeader('accept', 'text/event-stream')
  // Without this a proxy may buffer the whole response and the stream only
  // arrives when it ends, which is never.
  xhr.setRequestHeader('cache-control', 'no-cache')
  xhr.send()

  return {
    close() {
      abandoned = true
      try {
        xhr.abort()
      } catch {
        // Aborting an already-finished request throws on some engines and
        // means the same thing as succeeding here.
      }
    },
  }
}
