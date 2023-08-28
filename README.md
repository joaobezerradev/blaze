# Blaze HTTP API Framework

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Server](#server)
  - [Routing](#routing)
  - [Request & Response](#request--response)
  - [Middleware](#middleware)
  - [Error Handling](#error-handling)
  - [Swagger Integration](#swagger-integration)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

Blaze HTTP API Framework is a powerful HTTP server framework built on top of Node.js that provides a set of high-level APIs for creating robust HTTP services. It extends Node's native IncomingMessage class for requests and provides a Response class for easy response handling.

## Features

- Extends Node.js' `IncomingMessage` for enhanced Request functionality.
- Custom Response class for handling HTTP responses.
- Easy-to-use Router for API endpoint configuration.
- Middleware support.
- Swagger integration for API documentation.
- Supports clustering for improved performance.
- Error handling capabilities.

## Installation

```bash
npm install blaze-http
```

## Usage

### Server

You can start a new server by creating an instance of `Blaze`.

```typescript
import { Blaze } from 'blaze-http';
const app = new Blaze({ port: 3000 });
app.listen(() => {
  console.log('Server started at http://localhost:3000');
});
```

### Routing

Create routes using the Router class and associate them with request handlers.

```typescript
import { Router } from 'blaze-http';

const router = new Router();
router.register('GET', '/hello', (req, res) => {
  res.ok({ message: 'Hello, world!' });
});
```

### Request & Response

Request and Response classes are extended and enhanced versions of Node's native IncomingMessage and ServerResponse classes.

```typescript
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;
  // Fetch user and send response
  res.ok({ id: userId, name: 'John Doe' });
});
```

### Middleware

Middleware functions can be used for request preprocessing.

```typescript
import { corsMiddleware } from 'blaze-http';
app.useMiddleware(corsMiddleware);
```

### Error Handling

You can specify custom error handlers.

```typescript
app.useError((error, req, res) => {
  if (error instanceof MyCustomError) {
    res.badRequest(error.message);
  }
});
```

### Swagger Integration

Integrate Swagger for API documentation.

```typescript
import { buildSwaggerDoc } from 'blaze-http';
app.enableSwagger(buildSwaggerDoc());
```

## Examples

Refer to the [examples](./examples) directory for full example projects.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License. See [LICENSE.md](./LICENSE.md) for more information.

---

That's it! This README is designed to be comprehensive and guide both new and experienced developers through the process of setting up, running, and extending the API. Feel free to update this document as the project evolves.
