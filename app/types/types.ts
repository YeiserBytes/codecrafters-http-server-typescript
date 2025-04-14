export interface HttpRequest {
    method: string
    path: string
    version: string
    headers: Map<string, string>
    body: string
    param: string
}

export interface HttpResponse {
    statusLine: string
    headers: Map<string, string>
    body: string | Buffer
}
