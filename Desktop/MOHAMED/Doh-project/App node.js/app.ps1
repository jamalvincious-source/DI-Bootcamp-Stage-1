$listener = [System.Net.HttpListener]::new()
$prefix = 'http://localhost:5000/'
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host 'PowerShell web server at port 5000 is running..'

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.Url.AbsolutePath -eq '/welcome') {
            $content = '{"message":"Welcome New User"}'
            $response.StatusCode = 200
            $response.ContentType = 'application/json'
        }
        else {
            $content = 'Another page'
            $response.StatusCode = 200
            $response.ContentType = 'text/plain'
        }

        $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.OutputStream.Close()
        $response.Close()
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
