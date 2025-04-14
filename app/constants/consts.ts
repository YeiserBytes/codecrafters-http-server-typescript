import { HttpCodeEnum } from "./enums";

const CLRF = '\r\n'
const FILE_REGEX = /^\/files\/(.+)$/;
const DEFAULT_PORT = 4221
const DEFAULT_HOST = 'localhost'

const HttpFullMessage: Record<HttpCodeEnum, string> = {
	[HttpCodeEnum.OK]: "HTTP/1.1 200 OK",
	[HttpCodeEnum.Created]: "HTTP/1.1 201 Created",
	[HttpCodeEnum.NoContent]: "HTTP/1.1 204 No Content",
	[HttpCodeEnum.BadRequest]: "HTTP/1.1 400 Bad Request",
	[HttpCodeEnum.Unauthorized]: "HTTP/1.1 401 Unauthorized",
	[HttpCodeEnum.Forbidden]: "HTTP/1.1 403 Forbidden",
	[HttpCodeEnum.NotFound]: "HTTP/1.1 404 Not Found",
	[HttpCodeEnum.MethodNotAllowed]: "HTTP/1.1 405 Method Not Allowed",
	[HttpCodeEnum.InternalServerError]: "HTTP/1.1 500 Internal Server Error"
}

export {
    CLRF,
    FILE_REGEX,
    DEFAULT_PORT,
    DEFAULT_HOST,
	HttpFullMessage,
}
