import * as fs from 'node:fs'
import cluster from 'node:cluster'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'

import { Request } from './request'
import { Response } from './response'
import { type RequestHandler, Router } from './router'
import { generateIndexHtml } from './utils/swagger-html'

export class HttpServer {
  private readonly middlewares: RequestHandler[] = []
  private readonly router: Router = new Router()
  private errorClass?: new (...args: any[]) => Error
  private swaggerDoc: any = {
    "openapi": "3.0.0",
    "info": {},
    "components": {
      "securitySchemes": {
        "BearerAuth": {
          "type": "http",
          "scheme": "bearer",
          "bearerFormat": "JWT"
        }
      }
    },
    "schemes": [
      "https",
      "http"
    ],
    "paths": {}
  }

  constructor (swagger: {
    description: string,
    version: string,
    title: string,
    termsOfService: string,
    contact: {
      email: string
    },
    license: {
      name: string,
      url: string
    }
  }) {
    this.swaggerDoc.info = swagger

    this.route('GET', '/api-docs', this.serveSwagger)
    this.route('GET', '/swagger-ui/*', this.serveSwaggerStaticFiles)
  }

  route (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, handler: RequestHandler, swagger?: object): void {
    this.router.register(method, path, handler)

    if (swagger) {
      const swaggerPath = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      this.swaggerDoc.paths[swaggerPath] = this.swaggerDoc.paths[path] || {}
      this.swaggerDoc.paths[swaggerPath][method.toLowerCase()] = swagger

      writeFileSync('./swagger-ui/swagger.json', JSON.stringify(this.swaggerDoc));

    }
  }

  apply (middleware: RequestHandler): void {
    this.middlewares.push(middleware)
  }

  useError (errorClass: new (...args: any[]) => Error): void {
    this.errorClass = errorClass
  }

  private async serveSwaggerStaticFiles (req: Request, res: Response): Promise<void> {
    const publicDir = path.resolve(__dirname, 'swagger-ui')
    const filePath = path.join(publicDir, req.url!.replace('/swagger-ui', ''))
    if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const fileContent = readFileSync(filePath)
      const ext = path.extname(filePath)
      const contentType = getContentType(ext)
      res.send(fileContent, 200, { 'Content-Type': contentType })
    } else {
      res.notFoundError()
    }
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


  listen (port: number, callback?: () => void): void {


    const numCPUs = os.cpus().length

    if (cluster.isPrimary) {
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork()
      }

      cluster.on('exit', () => {
        cluster.fork()
      })

      callback?.()
    } else {
      createServer(this.handleRequest.bind(this)).listen(port)
    }

    writeFileSync('./swagger-ui/index.html', generateIndexHtml(port));
  }

  private async serveSwagger (req: Request, res: Response): Promise<void> {
    const swaggerUiAssetPath = path.resolve(__dirname, 'swagger-ui')
    writeFileSync('./swagger-ui/index.html', generateIndexHtml(3333));

    if (req.url === '/api-docs') {
      const uiHtml = fs.readFileSync(path.join(swaggerUiAssetPath, 'index.html'), 'utf8')
      res.send(uiHtml, 200, { 'Content-Type': 'text/html' })
    } else if (req.url!.startsWith('/swagger-ui') || req.url!.startsWith('/favicon')) {
      const assetPath = path.join(swaggerUiAssetPath, req.url!.replace('/swagger-ui', ''))
      if (fs.existsSync(assetPath)) {
        const asset = fs.readFileSync(assetPath)
        const ext = path.extname(req.url!)
        let contentType = 'application/javascript'
        if (ext === '.css') contentType = 'text/css'
        if (ext === '.html') contentType = 'text/html'
        if (ext === '.png') contentType = 'image/png'
        res.send(asset, 200, { 'Content-Type': contentType })
      } else {
        res.notFoundError()
      }
    }
  }
}

function getContentType (extension: string): string {
  switch (extension) {
    case '.css':
      return 'text/css'
    case '.html':
      return 'text/html'
    case '.png':
      return 'image/png'
    case '.json':
      return 'application/json'
    case '.js':
      return 'application/javascript'
    default:
      return 'application/octet-stream'
  }
}
