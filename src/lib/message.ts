type Payload = {
  target: string
  from: string
  passing: string[]
  uuid: string
  message: any
  _internal?: boolean
}

export class MessagePipe<T = string> {
  /**
   * processed payloads
   */
  payloads: Payload[] = []

  /**
   * payloads that are waiting to be processed
   */
  wattingPayloads: Payload[] = []

  id: string

  messageListeners: ((message: any) => unknown)[] = []

  payloadListeners: ((payload: Payload) => void)[] = []

  sendListeners: ((payload: Payload) => void)[] = []

  constructor(id: string) {
    this.id = id
  }

  get current() {
    return this.id
  }

  isCurrent(payload: Payload) {
    return payload.target === this.current
  }

  isHandled(payload: Payload) {
    return this.payloads.some((p) => p.uuid === payload.uuid)
  }

  private isTargetOnline(target: string) {
    // broadcast message
    // target is current
    // target is in payloads
    return !target || this.payloads.some((p) => p.from === target)
  }

  private addPayload(payload: Payload) {
    this.payloads.push(payload)
    this.payloadListeners.forEach((listener) => listener(payload))

    // if target is not online, add to wattingPayloads
    if (!this.isTargetOnline(payload.target)) {
      this.wattingPayloads.push(payload)
    }
  }

  private checkWattingPayloads() {
    this.wattingPayloads = this.wattingPayloads.filter((payload) => {
      if (this.isTargetOnline(payload.target)) {
        this.send(payload)
        return false
      }
      return true
    })
  }

  private send(payload: Payload) {
    let sending = payload
    if (this.wattingPayloads.includes(payload)) {
      sending = this.generateGreeting()
    }
    this.sendListeners.forEach((listener) => {
      listener({
        ...sending,
        passing: [...sending.passing, this.current],
      })
    })
  }

  generateUUID() {
    return Math.random().toString(36).substring(7)
  }

  getTimestamp() {
    return new Date().getTime()
  }

  private generatePayload(message: any, target: string) {
    return {
      target,
      from: this.current,
      passing: [],
      uuid: [this.current, this.generateUUID(), this.getTimestamp()].join('-'),
      message,
    }
  }

  isInternal(payload: Payload) {
    return payload._internal
  }

  private generateGreeting() {
    return {
      ...this.generatePayload('greeting', ''),
      _internal: true,
    }
  }

  private handleInternal(payload: Payload) {
    if (payload.message === 'greeting') {
      const greetingBack = {
        ...this.generatePayload('greeting too', payload.from),
        _internal: true,
      }
      this.addPayload(greetingBack)
      this.send(greetingBack)
    }
  }

  listen(payload: Payload) {
    if (this.isHandled(payload)) return
    this.addPayload(payload)

    const isInternal = this.isInternal(payload)
    const isCurrent = this.isCurrent(payload)

    if (isCurrent && !isInternal) {
      this.messageListeners.forEach((listener) => listener(payload.message))
    }

    if (isInternal) {
      this.handleInternal(payload)
    }

    if (!isCurrent) {
      this.send(payload)
    }

    this.checkWattingPayloads()
  }

  onSend(cb: (payload: Payload) => void) {
    this.sendListeners.push(cb)
    const greeting = this.generateGreeting()
    this.addPayload(greeting)
    cb(greeting)
  }

  postMessage(message: any, target: string) {
    const payload = this.generatePayload(message, target)
    this.addPayload(payload)
    this.send(payload)
  }

  onMessage(cb: (message: any) => unknown) {
    this.messageListeners.push(cb)
  }

  offMessage(cb: (message: any) => unknown) {
    this.messageListeners = this.messageListeners.filter((listener) => listener !== cb)
  }

  onPayload(cb: (payload: Payload) => void) {
    this.payloadListeners.push(cb)
  }

  offPayload(cb: (payload: Payload) => void) {
    this.payloadListeners = this.payloadListeners.filter((listener) => listener !== cb)
  }
}
