import fs from 'node:fs';
import * as NodePath from 'node:path';
import * as net from 'node:net';
import { argv } from 'node:process';
import * as zlib from 'node:zlib';

const CLRF = '\r\n'
const FILE_REGEX = /^\/files\/(.+)$/;

function createHttpResponse(
    startLine: string,
    headers: string[] = [],
    data: string | Buffer = '',
    acceptEncoding?: string
): string {
    if (acceptEncoding) {
        headers.push(`Content-Encoding: ${acceptEncoding}`);
    }

    const stringHeaders = headers.reduce((final, header) => final + header + CLRF, '');
    return `${startLine}${CLRF}${stringHeaders}${CLRF}${data}`;
}

const parseHttpRequest = (data: Buffer) => {
    const request = data.toString();
    const lines = request.split('\r\n');
    const startLine = lines[0];
    const headers = lines.slice(1);

    const method = startLine.split(' ')[0];
    const fullPath = startLine.split(' ')[1];
    const path = fullPath.split('?')[0];
    const params = fullPath.split('?')[1] || '';

    const body = request.split('\r\n\r\n')[1] || '';
    const acceptEncodings = ['gzip', 'deflate', 'br'];

    let acceptEncoding = '';
    let foundAcceptEncoding = false;

    for (const header of headers) {
        if (header.toLowerCase().startsWith('accept-encoding:')) {
            const encodings = header.split(':')[1].trim().split(',').map(enc => enc.trim());
            for (const encoding of encodings) {
                if (acceptEncodings.includes(encoding)) {
                    acceptEncoding = encoding;
                    foundAcceptEncoding = true;
                    break;
                }
            }
        }
        if (foundAcceptEncoding) break;
    }

    return { path, params, method, body, acceptEncoding };
};

const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        const request = data.toString();
        const path = request.split(' ')[1];
        const params = path.split('/')[1];
        const method = request.split(' ')[0];
        console.log('request', request)
        const { acceptEncoding } = parseHttpRequest(data);
        let response: string;

        function changeResponse(response: string): void {
            socket.write(response);
            socket.end();
        }

        switch (params) {
            case '': {
                response = createHttpResponse('HTTP/1.1 200 OK', ['Content-Type: text/plain']);

                changeResponse(response)
                break;
            }
            case 'echo': {
                const message = path.split('/')[2]
                response = createHttpResponse('HTTP/1.1 200 OK', ['Content-Type: text/plain', `Content-Length: ${message.length}`], message, acceptEncoding === '' ? undefined : acceptEncoding)

                const buffer = Buffer.from(message, 'utf-8')
                const zipped = zlib.gzipSync(buffer)

                if (acceptEncoding === 'gzip') {
                    response = createHttpResponse('HTTP/1.1 200 OK', ['Content-Type: text/plain', `Content-Length: ${zipped.length}`], zipped, acceptEncoding)
                }

                changeResponse(response)
                break;
            }
            case 'user-agent': {
                const userAgent = request.split('User-Agent: ')[1].split('\r\n')[0]
                response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`
                changeResponse(response)
                break;
            }
            case 'files': {
                const fileName = path.split('/')[2]
                const dir = argv[argv.length - 1];

                if (method === 'GET') {
                    try {
                        const file = fs.readFileSync(`${dir}/${fileName}`);

                        if (file) {
                            const response = createHttpResponse('HTTP/1.1 200 OK', ['Content-Type: application/octet-stream', `Content-Length: ${file.length}`], file);
                            changeResponse(response)
                        }
                    } catch (err) {
                        const response = createHttpResponse('HTTP/1.1 404 Not Found');
                        changeResponse(response);
                    }
                } else if (method === 'POST') {
                    const match = FILE_REGEX.exec(path);

                    if (!match) {
                        const response = createHttpResponse('HTTP/1.1 400 Bad Request');
                        changeResponse(response);
                    } else {
                        const args = argv[argv.length - 1]
                        const filePath = NodePath.join(args, match[1])
                        const data = request.split('\r\n\r\n')[1]

                        fs.writeFile(filePath, data, () => {});
                        const response = createHttpResponse('HTTP/1.1 201 Created');
                        changeResponse(response);
                    }
                }
                break;
            }
            default: {
                response = 'HTTP/1.1 404 Not Found\r\n\r\n'
                changeResponse(response)
                break;
            }
        }

        socket.end()
    })
});

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this to pass the first stage
server.listen(4221, 'localhost', () => {
    console.log('Server is running on port 4221');
});
