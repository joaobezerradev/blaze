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
  private readonly errorHandlers: Array<(error: Error, request: Request, response: Response) => void> = []
  private swagger: Swagger | undefined

  constructor (private readonly options: Blaze.Options) { }

  enableSwagger (params: Swagger.Info): void {
    this.swagger = new Swagger(this, params, { path: '/api-docs', port: this.options.port })
  }

  protected routeWithMethod (method: Router.Method, path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): void {
    this.router.register(method, path, handler)

    if (swagger && this.swagger) {
      this.swagger.updateSwaggerDoc(method, path, swagger)
    }
  }

  async get (path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): Promise<void> {
    this.routeWithMethod('GET', path, handler, swagger)
  }

  async post (path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): Promise<void> {
    this.routeWithMethod('POST', path, handler, swagger)
  }

  async put (path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): Promise<void> {
    this.routeWithMethod('PUT', path, handler, swagger)
  }

  async patch (path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): Promise<void> {
    this.routeWithMethod('PATCH', path, handler, swagger)
  }

  async delete (path: string, handler: Blaze.RequestHandler, swagger?: Swagger.EndpointConfig): Promise<void> {
    this.routeWithMethod('DELETE', path, handler, swagger)
  }

  useMiddleware (middleware: Blaze.RequestHandler): void {
    this.middlewares.push(middleware)
  }

  useRouter (router: Router): void {
    this.router.aggregate(router)
  }

  public useError (handler: (error: Error, request: Request, response: Response) => void): void {
    this.errorHandlers.push(handler)
  }

  public listen (callback?: () => void): void {
    if (cluster.isPrimary) {
      this.setupCluster()
      callback?.()
    } else {
      this.startServer()
    }
  }

  private setupCluster (): void {
    const numCPUs = os.cpus().length

    // Inicia um processo filho para cada CPU
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    // Caso um processo filho seja encerrado, cria um novo para substituí-lo
    cluster.on('exit', () => cluster.fork())
  }

  // Inicia o servidor HTTP
  private startServer (): void {
    createServer(this.handleRequest.bind(this)).listen(this.options.port)
  }

  private async handleRequest (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const response = new Response(res)
    const request = await Request.create(req, response)

    try {
      await Promise.all(this.middlewares.map(async middle => middle(request, response)))
      await this.router.route(request, response)
    } catch (error) {
      if (res.headersSent) return

      for (const errorHandler of this.errorHandlers) {
        try {
          errorHandler(error, request, response)
          if (res.headersSent) return
        } catch (handlerError) {
          response.internalServerError(handlerError)
          break // Exit if an errorHandler throws an error
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
