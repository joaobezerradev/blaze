import { type Request } from '../request'
import { type Response } from '../response'
import { HttpServer } from '../server'

export const corsMiddleware = (): HttpServer.RequestHandler => {
  return async (_req: Request, res: Response) => {
    res.setResponseHeaders({
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers':'Content-Type, Authorization'
    })
  }
}
