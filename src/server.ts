import cluster from 'node:cluster'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import * as os from 'node:os'

import { Request } from './request'
import { Response } from './response'
import { type RequestHandler, Router } from './router'
import { Swagger } from './swagger/swagger'

export class HttpServer {
  private readonly middlewares: RequestHandler[] = []
  private readonly router: Router = new Router()
  private errorClass?: new (...args: any[]) => Error
  private swagger: Swagger | undefined


  constructor (private readonly options: HttpServer.Options) {
    const numCPUs = os.cpus().length

    if (cluster.isPrimary) {
      for (let i = 0; i < numCPUs; i++) { cluster.fork() }

      cluster.on('exit', () => cluster.fork())

      options.callback?.()
    } else {
      createServer(this.handleRequest.bind(this)).listen(options.port)
    }
  }


  enableSwagger (params: Swagger.Document): void {
    this.swagger = new Swagger(this, params, { path: '/api-docs', port: this.options.port })
  }

  route (method: Router.Method, path: string, handler: RequestHandler, swagger?: Swagger.EndpointConfig): void {
    this.router.register(method, path, handler)

    if (swagger && this.swagger) {
      this.swagger.updateSwaggerDoc(method, path, swagger)
    }
  }

  apply (middleware: RequestHandler): void {
    this.middlewares.push(middleware)
  }

  useError (errorClass: new (...args: any[]) => Error): void {
    this.errorClass = errorClass
  }

  async handleRequest (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const request = await Request.create(req)
    const response = new Response(res)

    await Promise.all(this.middlewares.map(async middle => middle(request, response)))

    try {
      await this.router.route(request, response)
    } catch (error) {
      if (this.errorClass && error instanceof this.errorClass) {
        response.json(error, 400)
        return
      }
      response.internalServerError()
    }
  }
}


export namespace HttpServer {
  export type Options = { port: number, callback?: () => void }
}
