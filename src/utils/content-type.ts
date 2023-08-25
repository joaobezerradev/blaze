export const getContentType = (extension: string): string => {
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
