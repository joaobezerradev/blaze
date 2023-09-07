import cluster from 'node:cluster'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import * as os from 'node:os'

import { Request } from './request'
import { Response } from './response'
import { Router } from './router'
import { Swagger } from './swagger/swagger'

export class Blaze {
  private readonly middlewares: Blaze.RequestHandler[] = []
  private readonly router: Router = new Router()
  private readonly errorHandlers: Blaze.ErrorHandler[] = []
  private swagger: Swagger | undefined

  constructor (private readonly options: Blaze.Options) {}

  enableSwagger (params: Swagger.Info): void {
    this.swagger = new Swagger(this, params, { path: '/api-docs', port: this.options.port })
    this.router.enableSwagger(this.swagger)
  }

  route (method: Router.Method, path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): void {
    this.router.register(method, path, handler, swagger)
  }

  useRouter (router: Router): void {
    this.router.aggregate(router)
  }

  useMiddleware (middleware: Blaze.RequestHandler): void {
    this.middlewares.push(middleware)
  }

  useError (handler: Blaze.ErrorHandler): void {
    this.errorHandlers.push(handler)
  }

  listen (callback?: () => void): void {
    if (cluster.isPrimary) {
      this.setupCluster()
      callback?.()
    } else {
      if (this.swagger) {
        this.router.enableSwagger(this.swagger)
      }
      this.startServer()
    }
  }

  private setupCluster (): void {
    const numCPUs = os.cpus().length

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', () => cluster.fork())
  }

  private startServer (): void {
    createServer(this.handleRequest.bind(this)).listen(this.options.port)
  }

  private async handleRequest (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const response = new Response(res)
    const request = await Request.create(req, response)

    try {
      await Promise.all(this.middlewares.map(async middleware => middleware(request, response)))

      await this.router.route(request, response)
    } catch (error) {
      if (res.headersSent) return

      for (const errorHandler of this.errorHandlers) {
        try {
          await errorHandler(error, request, response)
          if (res.headersSent) return
        } catch (handlerError) {
          response.internalServerError(handlerError)
          break
        }
      }

      response.internalServerError(error)
    }
  }
}

export namespace Blaze {
  export type Options = { port: number }
  export type RequestHandler = (req: Request, res: Response) => Promise<void>
  export type ErrorHandler = (error: Error, req: Request, res: Response) => Promise<void>
}
