/* eslint-disable @typescript-eslint/no-floating-promises */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'

import { type Request } from '../request'
import { type Response } from '../response'
import { type Blaze } from '../server'
import { type JSONSchemaType } from '../utils/build-swagger-doc'
import { getContentType } from '../utils/content-type'
import { generateIndexHtml } from '../utils/swagger-html'

export class Swagger {
  private readonly swaggerUiAssetPath: string

  constructor (
    httpServer: Blaze,
    private readonly document: Swagger.Document,
    private readonly options: Swagger.Options
  ) {
    this.swaggerUiAssetPath = path.resolve('..', 'swagger-ui')
    // Register routes
    httpServer.get(this.options.path, this.serveSwaggerDocs)
    httpServer.get('/swagger-ui/*', this.serveSwaggerStaticFiles)
  }

  // Public Methods
  // -----------------------------

  public updateSwaggerDoc (method: string, routePath: string, swaggerData: Swagger.EndpointConfig): void {
    const swaggerPath = this.formatSwaggerPath(routePath)
    this.updateDocumentPaths(swaggerPath, method, swaggerData)
    this.writeDocumentToFile()
  }

  // Private Methods
  // -----------------------------

  private formatSwaggerPath (routePath: string): string {
    return routePath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')
  }

  private updateDocumentPaths (swaggerPath: string, method: string, swaggerData: Swagger.EndpointConfig): void {
    this.document.paths[swaggerPath] = this.document.paths[swaggerPath] || {}
    this.document.paths[swaggerPath][method.toLowerCase()] = swaggerData
  }

  private writeDocumentToFile (): void {
    const filePath = `${this.swaggerUiAssetPath}/swagger.json`
    writeFileSync(filePath, JSON.stringify(this.document))
  }

  private readonly serveSwaggerDocs = async (_req: Request, res: Response): Promise<void> => {
    const uiHtml = generateIndexHtml(this.options.port)
    res.send(uiHtml, 200, 'text/html')
  }

  private readonly serveSwaggerStaticFiles = async (req: Request, res: Response): Promise<void> => {
    const filePath = path.join(this.swaggerUiAssetPath, req.url!.replace('/swagger-ui', ''))
    if (existsSync(filePath)) {
      const fileContent = readFileSync(filePath)
      const ext = path.extname(filePath)
      res.send(fileContent, 200, getContentType(ext) as any)
    } else {
      res.notFound()
    }
  }
}

export namespace Swagger {
  export type Document = {
    [key: string]: any
    description: string
    version: string
    title: string
    termsOfService: string
    contact: {
      email: string
    }
    license: {
      name: string
      url: string
    }
  }
  export type Options = { path: string, port: number }

  export type RouteParam = {
    name: string
    in: 'path' | 'query' | 'header' | 'cookie'
    description?: string
    required?: boolean
    type: JSONSchemaType
    example?: string | number | boolean | object | []
  }

  export type EndpointConfig = {
    summary: string
    tags?: string[]
    deprecated?: boolean
    authentication?: boolean
    operationId?: string
    input?: object
    output?: object
    statusCode?: number
    contentType?: string
    routeParams?: RouteParam[]
  }
}
