enum HttpCodeEnum {
	OK = 200,
	Created = 201,
	NoContent = 204,
	BadRequest = 400,
	Unauthorized = 401,
	Forbidden = 403,
	NotFound = 404,
	MethodNotAllowed = 405,
	InternalServerError = 500,
}

enum HttpMethodEnum {
	GET = 'GET',
	POST = 'POST',
	PUT = 'PUT',
	DELETE = 'DELETE',
	PATCH = 'PATCH',
	OPTIONS = 'OPTIONS',
	HEAD = 'HEAD',
	CONNECT = 'CONNECT',
	TRACE = 'TRACE',
}

enum HttpParamEnum {
	EMPTY = "",
	ECHO = "echo",
	USER_AGENT = "user-agent",
	FILES = "files",
}

enum HeadersEnum {
	CONTENT_TYPE = "Content-Type",
	CONTENT_LENGTH = "Content-Length",
	CONTENT_ENCODING = "Content-Encoding",
	USER_AGENT = "User-Agent",
	ACCEPT_ENCODING = "Accept-Encoding",
}

export {
	HttpCodeEnum,
	HttpMethodEnum,
	HttpParamEnum,
	HeadersEnum
}
