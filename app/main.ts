import fs from 'node:fs';
import NodePath from 'node:path';
import net from 'node:net';
import { argv } from 'node:process';
import zlib from 'node:zlib';

const CLRF = '\r\n'
const FILE_REGEX = /^\/files\/(.+)$/;
const DEFAULT_PORT = 4221
const DEFAULT_HOST = 'localhost'

interface HttpRequest {
    method: string
    path: string
    version: string
    headers: Map<string, string>
    body: string
    param: string
}

interface HttpResponse {
    statusLine: string
    headers: Map<string, string>
    body: string | Buffer
}

function parseRequest(rawRequest: string): HttpRequest {
    const [requestLine, ...rest] = rawRequest.split(CLRF);
    const [method, path, version] = requestLine.split(' ');
    const headers = new Map<string, string>();
    let body = '';
    let headerSection = true;

    for (const line of rest) {
        if (line === '') {
            headerSection = false;
            continue;
        }

        if (headerSection) {
            const [key, value] = line.split(': ');
            headers.set(key.toLowerCase(), value);
        } else {
            body += line;
        }
    }

    return {
        method,
        path,
        version,
        headers,
        body,
        param: path.split('/')[1] || ''
    }
}

function createHttpResponse({ statusLine, headers, body }: HttpResponse): Buffer {
    const headerLine = Array.from(headers.entries())
        .map(([key, value]) => `${key}: ${value}`);

    const responseHead = [
        statusLine,
        ...headerLine,
        '',
        ''
    ].join(CLRF);

    if (Buffer.isBuffer(body)) {
        return Buffer.concat([
            Buffer.from(responseHead),
            body
        ])
    }

    return Buffer.from(responseHead + body);
}

// Route Handlers
class RouteHandlers {
    private directory: string;

    constructor (directory: string) {
        this.directory = directory;
    }

    async handleRoot(): Promise<HttpResponse> {
        return {
            statusLine: 'HTTP/1.1 200 OK',
            headers: new Map([
                ['Content-Type', 'text/plain']
            ]),
            body: ''
        }
    }

    async handleEcho(request: HttpRequest): Promise<HttpResponse> {
        const message = request.path.split('/')[2];
        const acceptEncoding = request.headers.get('accept-encoding');
        let responseBody: string | Buffer = message;
        const headers = new Map<string, string>([
            ['Content-Type', 'text/plain']
        ]);

        if (acceptEncoding?.includes('gzip')) {
            responseBody = zlib.gzipSync(Buffer.from(message));
            headers.set('Content-Encoding', 'gzip');
        }

        headers.set('Content-Length', Buffer.byteLength(responseBody).toString());

        return {
            statusLine: 'HTTP/1.1 200 OK',
            headers,
            body: responseBody
        };
    }

    async handleUserAgent(request: HttpRequest): Promise<HttpResponse> {
        const userAgent = request.headers.get('user-agent') || '';

        return {
            statusLine: 'HTTP/1.1 200 OK',
            headers: new Map([
                ['Content-Type', 'text/plain'],
                ['Content-Length', Buffer.byteLength(userAgent).toString()]
            ]),
            body: userAgent
        };
    }

    async handleFiles(request: HttpRequest): Promise<HttpResponse> {
        const match = FILE_REGEX.exec(request.path);

        if (!match) {
            return {
                statusLine: 'HTTP/1.1 400 Bad Request',
                headers: new Map(),
                body: ''
            };
        }

        if (request.method === 'GET') {
            try {
                const filePath = NodePath.join(this.directory, match[1]);
                const file = await fs.promises.readFile(filePath);

                return {
                    statusLine: 'HTTP/1.1 200 OK',
                    headers: new Map([
                        ['Content-Type', 'application/octet-stream'],
                        ['Content-Length', file.length.toString()]
                    ]),
                    body: file
                };
            } catch (err) {
                return {
                    statusLine: 'HTTP/1.1 404 Not Found',
                    headers: new Map(),
                    body: ''
                };
            }
        } else if (request.method === 'POST') {
            const filePath = NodePath.join(this.directory, match[1]);
            await fs.promises.writeFile(filePath, request.body);

            return {
                statusLine: 'HTTP/1.1 201 Created',
                headers: new Map(),
                body: ''
            };
        }

        return {
            statusLine: 'HTTP/1.1 405 Method Not Allowed',
            headers: new Map(),
            body: ''
        };
    }
}

// Server Setup
async function startServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
    const directory = argv[argv.length - 1];
    const routeHandler = new RouteHandlers(directory);

    const server = net.createServer(async (socket) => {
        socket.on('data', async (data) => {
            try {
                const request = parseRequest(data.toString());
                let response: HttpResponse;

                switch (request.param) {
                    case '':
                        response = await routeHandler.handleRoot();
                        break;
                    case 'echo':
                        response = await routeHandler.handleEcho(request);
                        break;
                    case 'user-agent':
                        response = await routeHandler.handleUserAgent(request);
                        break;
                    case 'files':
                        response = await routeHandler.handleFiles(request);
                        break;
                    default:
                        response = {
                            statusLine: 'HTTP/1.1 404 Not Found',
                            headers: new Map(),
                            body: ''
                        };
                }
                socket.write(createHttpResponse(response));
            } catch (error) {
                console.error(error);
                socket.write(createHttpResponse({
                    statusLine: 'HTTP/1.1 500 Internal Server Error',
                    headers: new Map(),
                    body: ''
                }))
            } finally {
                socket.end();
            }
        });
    });
    return new Promise<void>((resolve, reject) => {
        server.listen(port, host, () => {
            console.log(`Server listening on http://${host}:${port}`);
            resolve();
        })

        server.on('error', reject)
    });
}

startServer().catch(console.error);
