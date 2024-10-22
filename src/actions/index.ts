import { MessagePipe } from '@/lib/message'
import chalk from 'chalk'

export enum NameType {
  BACKGROUND = 'BACKGROUND',
  CONTENT_SCRIPT = 'CONTENT_SCRIPT',
  POPUP = 'POPUP',
  SIDE_PANEL = 'SIDE_PANEL',
  OPTIONS = 'OPTIONS',
  DEVTOOLS = 'DEVTOOLS',
  USER_SCRIPT = 'USER_SCRIPT',
}

const MessageColors = {
  [NameType.BACKGROUND]: chalk.bgBlueBright.yellow,
  [NameType.CONTENT_SCRIPT]: chalk.bgGreenBright.red,
  [NameType.POPUP]: chalk.bgGreen.yellowBright,
  [NameType.SIDE_PANEL]: chalk.bgCyanBright.black,
  [NameType.OPTIONS]: chalk.bgYellowBright.black,
  [NameType.DEVTOOLS]: chalk.bgYellow.greenBright,
  [NameType.USER_SCRIPT]: chalk.bgRedBright.white,
}

const MessageType = 'actions channel'

function CreateElementMessage(message: any) {
  return new CustomEvent(MessageType, {
    detail: message,
  })
}

function createMessageElement(pipe: MessagePipe) {
  const extensionId = '__CRX_DEVTOOLS_EXTENSION_ID__'
  const ele = document.createElement('div')
  ele.style.display = 'none'
  ele.id = `${extensionId}-${MessageType}`
  document.documentElement.appendChild(ele)
  pipe.onSend((payload) => {
    log(NameType.USER_SCRIPT, 'send', payload)
    ele.dispatchEvent(CreateElementMessage(payload))
  })
  ele.addEventListener(MessageType, (event) => {
    // console.log('element message', event)
    if (event instanceof CustomEvent) {
      log(NameType.USER_SCRIPT, event.detail)
      pipe.listen(event.detail)
    }
  })
}

function listenMessageElement(pipe: MessagePipe) {
  const targetEle = document.getElementById(`${chrome.runtime.id}-${MessageType}`)

  if (!targetEle) {
    setTimeout(() => {
      listenMessageElement(pipe)
    }, 500)
    return
  }

  targetEle?.addEventListener(MessageType, (event) => {
    if (event instanceof CustomEvent) {
      log(NameType.CONTENT_SCRIPT, event.detail)
      pipe.listen(event.detail)
    }
  })
  pipe.onSend((payload) => {
    log(NameType.CONTENT_SCRIPT, 'send', payload)
    sendMessageByElement(payload)
  })
}

function sendMessageByElement(request: any) {
  const targetEle = document.getElementById(`${chrome.runtime.id}-${MessageType}`)
  targetEle?.dispatchEvent(
    new CustomEvent(MessageType, {
      detail: request,
    }),
  )
}

function log(type: NameType, ...args: any[]) {
  console.log(MessageColors[type](`[${type}]`), ...args)
}

export function createMessageLogger(type: NameType, onMessage?: (message: string) => void) {
  const pipe = new MessagePipe(type)

  const tabs: chrome.tabs.Tab[] = []

  let messageCB: (message: string) => void = onMessage || (() => {})

  pipe.onMessage((message) => {
    log(type, message)
    typeof message === 'string' && messageCB?.(message)
  })

  if (type === NameType.USER_SCRIPT) {
    createMessageElement(pipe)
  } else {
    if (type === NameType.CONTENT_SCRIPT) {
      listenMessageElement(pipe)
    }

    pipe.onSend((payload) => {
      log(type, 'send', payload)
      chrome.runtime.sendMessage(payload)
      tabs.forEach((tab) => {
        tab.id && chrome.tabs.sendMessage(tab.id, payload)
      })
    })

    chrome.runtime.onMessage.addListener((request: any, sender) => {
      if (type === NameType.BACKGROUND && sender.tab) {
        const from = sender.tab
        if (tabs.every((tab) => tab.id !== from.id)) {
          tabs.push(from)
        }
      }

      log(type, request, { ...sender })
      pipe.listen(request)
    })
  }

  return {
    onMessage: (cb: (message: string) => void) => {
      messageCB = cb
    },
    notify(targetType: NameType, message = `Hello Message from ${type} to ${targetType}`) {
      pipe.postMessage(message, targetType)
    },
  }
}

let currentLogger: ReturnType<typeof createMessageLogger> | null = null

export function getMessageLogger(type: NameType, onMessage?: (message: string) => void) {
  const logger = currentLogger || createMessageLogger(type)

  currentLogger = logger
  onMessage && logger.onMessage(onMessage)

  return logger.notify
}
