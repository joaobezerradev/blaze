import { IncomingMessage } from 'node:http'

import { type Response } from './response'

export class Request extends IncomingMessage {
  params: any = {}
  query: any = {}
  body: any = {}
  user: any = {}
  file: Record<string, { toBuffer: () => Promise<Buffer> }> = {}

  public static async create (req: IncomingMessage, res: Response): Promise<Request> {
    const request = new Request(req)
    await request.initialize(req, res)
    return request
  }

  private constructor (incomingMessage: IncomingMessage) {
    super(incomingMessage.socket)
    Object.assign(this, incomingMessage)
  }

  private async initialize (req: IncomingMessage, res: Response): Promise<void> {
    await this.parseBodyIfNecessary(req, res)
    this.parseQueryParams(req)
  }

  private async parseBodyIfNecessary (req: IncomingMessage, res: Response): Promise<void> {
    if (this.isBodyParsingNecessary(req.method)) {
      await this.parseBody(req, res)
    }
  }

  private isBodyParsingNecessary (method?: string): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(method ?? '')
  }

  private async parseBody (req: IncomingMessage, res: Response): Promise<void> {
    if (this.isMultipartFormData(req)) {
      await this.parseMultipartFormData(req, res)
    } else {
      let body = Buffer.alloc(0)
      try {
        for await (const chunk of req) {
          body = Buffer.concat([body, chunk])
        }
        this.body = JSON.parse(body.toString())
      } catch (err) {
        res.internalServerError(err) // Assume this method sends a 500 Internal Server Error
      }
    }
  }

  private isMultipartFormData (req: IncomingMessage): boolean {
    const contentType = req.headers['content-type'] ?? ''
    return contentType.startsWith('multipart/form-data')
  }

  private async parseMultipartFormData (req: IncomingMessage, res: Response): Promise<void> {
    try {
      const contentType = req.headers['content-type']!
      const boundary = contentType.split('boundary=')[1]
      const delimiter = `--${boundary}`
      const closeDelimiter = `${delimiter}--`

      let buffer = Buffer.alloc(0)

      return new Promise<void>((resolve, reject) => {
        req.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk])
          let start = 0
          let end = buffer.indexOf(delimiter)

          while (end !== -1) {
            if (buffer.slice(start, end).toString() === closeDelimiter) {
              resolve()
              return
            }

            const part = buffer.slice(start, end)
            this.processPart(part)

            buffer = buffer.slice(end + delimiter.length)
            start = 0
            end = buffer.indexOf(delimiter)
          }
        })

        req.on('end', () => {
          if (buffer.length > 0) {
            this.processPart(buffer)
          }
          resolve()
        })

        req.on('error', reject)
      })
    } catch (error) {
      res.internalServerError(error)
    }
  }

  private processPart (part: Buffer): void {
    const [header, body] = part.toString().split('\r\n\r\n')

    if (!header || !body) return

    const nameMatch = header.match(/name="(.+?)"/)
    if (!nameMatch) return

    const name = nameMatch[1]
    this.file[name] = {
      toBuffer: async () => Promise.resolve(Buffer.from(body))
    }
  }

  private parseQueryParams (req: IncomingMessage): void {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    this.query = Object.fromEntries(url.searchParams) as any
  }
}

export namespace Request {
  export type RequestInput = Record<string, any>
}
