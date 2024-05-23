import * as net from 'node:net';

const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        const request = data.toString();
        console.log(request);
        const path = request.split(' ')[1];
        console.log(path.split('/')[1])
        const params = path.split('/')[1];
        let response: string;

        function changeResponse(response: string): void {
            socket.write(response);
            socket.end();
        }

        switch (params) {
            case '': {
                response = 'HTTP/1.1 200 OK\r\n\r\n'
                changeResponse(response)
                break;
            }
            case 'echo': {
                const message = path.split('/')[2]
                response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${message.length}\r\n\r\n${message}`
                changeResponse(response)
                break;
            }
            case 'user-agent': {
                const userAgent = request.split('User-Agent: ')[1].split('\r\n')[0]
                response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`
                changeResponse(response)
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
