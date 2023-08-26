import { type Request } from './request'
import { type Response } from './response'
import { type HttpServer } from './server'

export class Router {
  private routes: Record<string, { handler: HttpServer.RequestHandler, pattern: RegExp, paramNames: string[] }> = {}

  // Register a new route with a request handler
  register (method: Router.Method, path: string, requestHandler: HttpServer.RequestHandler): void {
    const { pattern, paramNames } = this.generatePatternAndParamNames(path)
    this.routes[`${method}|${pattern}`] = { handler: requestHandler, pattern, paramNames }
  }

  aggregate (otherRouter: Router): void {
    // Merge the other router's routes into this router's routes.
    this.routes = { ...this.routes, ...otherRouter.routes }
  }

  // Generate RegExp pattern and parameter names for the path
  private generatePatternAndParamNames (path: string): { pattern: RegExp, paramNames: string[] } {
    const paramNames: string[] = []
    let patternStr = '^' + path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName)
      return '([a-zA-Z0-9_]+)'
    })

    if (path.endsWith('/*')) {
      patternStr = patternStr.slice(0, -2) + '(?:/.*)?'
    }

    patternStr += '$'
    return { pattern: new RegExp(patternStr), paramNames }
  }

  // Route the request to the appropriate handler
  async route (req: Request, res: Response): Promise<void> {
    const urlPath = req.url?.split('?')[0] ?? '/'
    if (await this.matchAndHandleRoute(urlPath, req, res)) {
      return
    }
    res.notFound()
  }

  // Try to match the route and handle it if found
  private async matchAndHandleRoute (urlPath: string, req: Request, res: Response): Promise<boolean> {
    for (const key in this.routes) {
      const { pattern, paramNames, handler } = this.routes[key]
      const match = pattern.exec(urlPath)
      if (match) {
        this.populateRequestParams(req, match, paramNames)
        await handler(req, res)
        return true
      }
    }
    return false
  }

  // Populate request parameters from the URL
  private populateRequestParams (req: Request, match: RegExpExecArray, paramNames: string[]): void {
    req.params = paramNames.reduce<Record<string, string>>((params, paramName, index) => {
      params[paramName] = match[index + 1]
      return params
    }, {})
  }
}

export namespace Router {
  export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}
