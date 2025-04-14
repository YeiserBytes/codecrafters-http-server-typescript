import fs from "node:fs";
import NodePath from "node:path";
import net from "node:net";
import { argv } from "node:process";
import zlib from "node:zlib";
import type { HttpRequest, HttpResponse } from "./types/types";
import {
	CLRF,
	DEFAULT_PORT,
	DEFAULT_HOST,
	FILE_REGEX,
	HttpFullMessage,
} from "./constants/consts";
import { HeadersEnum, HttpMethodEnum, HttpParamEnum } from "./constants/enums";

function parseRequest(rawRequest: string): HttpRequest {
	const [requestLine, ...rest] = rawRequest.split(CLRF);
	const [method, path, version] = requestLine.split(" ");
	const headers = new Map<string, string>();
	let body = "";
	let headerSection = true;

	for (const line of rest) {
		if (line === "") {
			headerSection = false;
			continue;
		}

		if (headerSection) {
			const [key, value] = line.split(": ");
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
		param: path.split("/")[1] || "",
	};
}

function createHttpResponse({
	statusLine,
	headers,
	body,
}: HttpResponse): Buffer {
	const headerLine = Array.from(headers.entries()).map(
		([key, value]) => `${key}: ${value}`,
	);

	const responseHead = [statusLine, ...headerLine, "", ""].join(CLRF);

	if (Buffer.isBuffer(body)) {
		return Buffer.concat([Buffer.from(responseHead), body]);
	}

	return Buffer.from(responseHead + body);
}

// Route Handlers
class RouteHandlers {
	private directory: string;
	statusLine = HttpFullMessage[200];
	constructor(directory: string) {
		this.directory = directory;
	}

	async handleRoot(request: HttpRequest): Promise<HttpResponse> {
		const connectionHeader = request.headers.get(
			HeadersEnum.CONNECTION.toLowerCase(),
		);
		const headers = new Map([[HeadersEnum.CONTENT_TYPE, "text/plain"]]);

		if (connectionHeader === "keep-alive") {
			headers.set(HeadersEnum.CONNECTION, "keep-alive");
		} else if (connectionHeader === "close") {
			headers.set(HeadersEnum.CONNECTION, "close");
		} else {
			headers.set(HeadersEnum.CONNECTION, "close");
		}

		return {
			statusLine: this.statusLine,
			headers,
			body: "",
		};
	}

	async handleEcho(request: HttpRequest): Promise<HttpResponse> {
		const message = request.path.split("/")[2];
		const acceptEncoding =
			request.headers.get(HeadersEnum.ACCEPT_ENCODING.toLowerCase()) || "";
		const connectionHeader = request.headers.get(
			HeadersEnum.CONNECTION.toLowerCase(),
		);
		let responseBody: string | Buffer = message;

		const headers = new Map<string, string>([
			[HeadersEnum.CONTENT_TYPE, "text/plain"],
		]);

		if (acceptEncoding?.includes("gzip")) {
			responseBody = zlib.gzipSync(Buffer.from(message));
			headers.set(HeadersEnum.CONTENT_ENCODING.toLowerCase(), "gzip");
		}

		if (connectionHeader === "keep-alive") {
			headers.set(HeadersEnum.CONNECTION, "keep-alive");
		} else if (connectionHeader === "close") {
			headers.set(HeadersEnum.CONNECTION, "close");
		} else {
			headers.set(HeadersEnum.CONNECTION, "close");
		}

		headers.set(
			HeadersEnum.CONTENT_LENGTH,
			Buffer.byteLength(responseBody).toString(),
		);

		return {
			statusLine: this.statusLine,
			headers,
			body: responseBody,
		};
	}

	async handleUserAgent(request: HttpRequest): Promise<HttpResponse> {
		const userAgent =
			request.headers.get(HeadersEnum.USER_AGENT.toLowerCase()) || "";
		const headers = new Map([
			[HeadersEnum.CONTENT_TYPE, "text/plain"],
			[HeadersEnum.CONTENT_LENGTH, Buffer.byteLength(userAgent).toString()],
		]);
		const connectionHeader = request.headers.get(
			HeadersEnum.CONNECTION.toLowerCase(),
		);

		if (connectionHeader === "keep-alive") {
			headers.set(HeadersEnum.CONNECTION, "keep-alive");
		} else if (connectionHeader === "close") {
			headers.set(HeadersEnum.CONNECTION, "close");
		} else {
			headers.set(HeadersEnum.CONNECTION, "close");
		}

		return {
			statusLine: this.statusLine,
			headers,
			body: userAgent,
		};
	}

	async handleFiles(request: HttpRequest): Promise<HttpResponse> {
		const match = FILE_REGEX.exec(request.path);

		if (!match) {
			this.statusLine = HttpFullMessage[400];

			return {
				statusLine: this.statusLine,
				headers: new Map(),
				body: "",
			};
		}

		if (request.method === HttpMethodEnum.GET) {
			try {
				const filePath = NodePath.join(this.directory, match[1]);
				const file = await fs.promises.readFile(filePath);
                const headers = new Map([
                    [HeadersEnum.CONTENT_TYPE, "application/octet-stream"],
                    [HeadersEnum.CONTENT_LENGTH, file.length.toString()],
                ])

				return {
					statusLine: this.statusLine,
					headers,
					body: file,
				};
			} catch (err) {
				this.statusLine = HttpFullMessage[404];

				return {
					statusLine: this.statusLine,
					headers: new Map(),
					body: "",
				};
			}
		} else if (request.method === HttpMethodEnum.POST) {
			const filePath = NodePath.join(this.directory, match[1]);
			await fs.promises.writeFile(filePath, request.body);
			this.statusLine = HttpFullMessage[201];

			return {
				statusLine: this.statusLine,
				headers: new Map(),
				body: "",
			};
		}

		this.statusLine = HttpFullMessage[405];
		return {
			statusLine: this.statusLine,
			headers: new Map(),
			body: "",
		};
	}
}

// Server Setup
async function startServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
	const directory = argv[argv.length - 1];
	const routeHandler = new RouteHandlers(directory);

	const server = net.createServer((socket) => {
		socket.on("data", async (data) => {
			const request = parseRequest(data.toString());
			try {
				let response: HttpResponse;

				switch (request.param) {
					case HttpParamEnum.EMPTY:
						response = await routeHandler.handleRoot(request);
						break;
					case HttpParamEnum.ECHO:
						response = await routeHandler.handleEcho(request);
						break;
					case HttpParamEnum.USER_AGENT:
						response = await routeHandler.handleUserAgent(request);
						break;
					case HttpParamEnum.FILES:
						response = await routeHandler.handleFiles(request);
						break;
					default:
						response = {
							statusLine: HttpFullMessage[404],
							headers: new Map(),
							body: "",
						};
				}
				socket.write(createHttpResponse(response));

				// Keep the connection open if the request has a specific parameter
				if (request.headers.get("connection")?.toLowerCase() === "keep-alive") {
					return; // Do not close the socket
				}
				if (request.headers.get("connection")?.toLowerCase() === "close") {
					socket.end(); // Close the socket
				}
			} catch (error) {
				console.error(error);
				socket.write(
					createHttpResponse({
						statusLine: HttpFullMessage[500],
						headers: new Map(),
						body: "",
					}),
				);
			}
		});

		socket.on("error", (err) => {
			console.error("Socket error:", err);
		});

		socket.on("close", () => {
			console.log("Socket closed");
			socket.end();
		});
	});

	return new Promise<void>((resolve, reject) => {
		server.listen(port, host, () => {
			console.log(`Server listening on http://${host}:${port}`);
			resolve();
		});

		server.on("error", reject);
	});
}

startServer().catch(console.error);
// server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
// 	console.log(`Server listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
// });
