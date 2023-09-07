/* eslint-disable @typescript-eslint/no-floating-promises */
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { type Request } from '../request'
import { type Response } from '../response'
import { type Blaze } from '../server'
import { type JSONSchemaType, generateIndexHtml, getContentType } from '../utils'

export class Swagger {
  private readonly swaggerUiAssetPath: string
  private readonly document: Swagger.Document

  constructor (
    httpServer: Blaze,
    info: Swagger.Info,
    private readonly options: Swagger.Options
  ) {
    this.swaggerUiAssetPath = path.resolve(__dirname, '..', '..', 'swagger-ui')

    if (!httpServer) {
      console.error('httpServer instance is not provided to Swagger class')
    }
    if (!info) {
      console.error('Swagger Info is not provided')
    }
    if (!this.options?.path || !this.options.port) {
      console.error('Swagger Options or its properties are missing')
    }
    if (!fs.existsSync(this.swaggerUiAssetPath)) {
      console.error(`Swagger UI Asset Directory doesn't exist at: ${this.swaggerUiAssetPath}`)
    }
    const files = fs.readdirSync(this.swaggerUiAssetPath)

    for (const file of files) {
      httpServer.route('GET', `/swagger-ui/${file}`, this.serveSwaggerStaticFiles)
    }

    httpServer.route('GET', '/swagger-ui/swagger.json', this.serveSwaggerStaticFiles)

    httpServer.route('GET', this.options.path, this.serveSwaggerDocs)

    this.document = {
      openapi: '3.0.0',
      info,
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      schemes: [
        'https',
        'http'
      ],
      paths: {}
    }
  }

  public updateSwaggerDoc (method: string, routePath: string, swaggerData: Swagger.EndpointConfig): void {
    const swaggerPath = this.formatSwaggerPath(routePath)

    this.updateDocumentPaths(swaggerPath, method, swaggerData)
    this.writeDocumentToFile()
  }

  private formatSwaggerPath (routePath: string): string {
    return routePath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}')
  }

  private updateDocumentPaths (swaggerPath: string, method: string, swaggerData: Swagger.EndpointConfig): void {
    this.document.paths[swaggerPath] = this.document.paths[swaggerPath] || {}
    this.document.paths[swaggerPath][method.toLowerCase()] = swaggerData
  }

  private async writeDocumentToFile (): Promise<void> {
    const filePath = `${this.swaggerUiAssetPath}/swagger.json`
    await fsp.writeFile(filePath, JSON.stringify(this.document))
  }

  private readonly serveSwaggerStaticFiles = async (req: Request, res: Response): Promise<void> => {
    const filePath = path.join(this.swaggerUiAssetPath, req.url!.replace('/swagger-ui', ''))

    try {
      await fsp.access(filePath, fsp.constants.F_OK)
      const fileContent = await fsp.readFile(filePath)
      const ext = path.extname(filePath)
      res.send(fileContent, 200, getContentType(ext) as any)
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.notFound()
      } else {
        // Handle other potential errors or log them
        console.error(`Error reading file: ${error.message}`)
        res.internalServerError(error)
      }
    }
  }

  private readonly serveSwaggerDocs = async (_req: Request, res: Response): Promise<void> => {
    try {
      const uiHtml = generateIndexHtml(this.options.port)
      if (!uiHtml) {
        console.error('Failed to generate Swagger UI HTML')
      }
      res.send(uiHtml, 200, 'text/html')
    } catch (error) {
      console.error('Error while serving Swagger Docs:', error)
      console.error('Detailed Error Stack:', error.stack)
    }
  }
}
export namespace Swagger {
  export type Info = {
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
  export type Document = {
    'openapi': '3.0.0'
    'info': any
    'components': {
      'securitySchemes': {
        'BearerAuth': {
          'type': 'http'
          'scheme': 'bearer'
          'bearerFormat': 'JWT'
        }
      }
    }
    'schemes': [
      'https',
      'http'
    ]
    'paths': any

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
