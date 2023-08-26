import { corsMiddleware } from "../src/middlewares";
import { HttpServer } from "../src/server";
import { buildSwaggerDoc } from "../src/utils/build-swagger-doc";
// User schema for the response
const UserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'User ID', example: 'uuid' },
    name: { type: 'string', description: 'User Name' },
    email: { type: 'string', description: 'User Email' },
    age: { type: 'number', description: 'User Age' }
  }
};

// Error schema for NotFound error
const NotFoundErrorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  }
};


const app = new HttpServer({ port: 3000 })

app.useMiddleware(corsMiddleware())

app.get('/user/:id', async (req, res) => {


  res.json({
    params: req.params
  })

  // res.notFoundError()


}, buildSwaggerDoc({
  summary: 'Retrieve user by JORGE',
  tags: ['User'],
  authentication: true,
  operationId: 'getUserById',
  input: { id: { type: 'string', description: 'User ID', example: 'uuid' } },  // Represents path parameter 'id'
  output: UserSchema,
  statusCode: 200,
  contentType: 'application/json',
  routeParams: [{ in: 'path', name: 'id', description: 'the Identifier', required: true, type: 'string', example: 'uuid' }],
  errorMapping: {
    404: { description: 'User Not Found', schema: NotFoundErrorSchema }
  }
}))

app.enableSwagger({
  "description": "This is a sample server clinic server.  You can find out more about Swagger at [http://swagger.io](http://swagger.io) or on [irc.freenode.net, #swagger](http://swagger.io/irc/).  For this sample, you can use the api key `special-key` to test the authorization filters.",
  "version": "0.0.1",
  "title": "Swagger Clinic Backend",
  "termsOfService": "http://swagger.io/terms/",
  "contact": {
    "email": "contact@clinic.io"
  },
  "license": {
    "name": "Apache 2.0",
    "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
  }
})


app.listen(() => console.log('FOI'))



// Params for the user/:id route
