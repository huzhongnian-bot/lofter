/**
 * 本地静态服务：提供对话展示页面及提取出的 txt 文件 API
 * 运行：node server.js
 * 访问：http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const EXTRACTED_DIR = path.join(__dirname, 'extracted');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

function send(res, status, type, body) {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
}

function listFiles() {
    return fs.readdirSync(EXTRACTED_DIR)
        .filter(f => f.endsWith('.txt') && f !== 'all.txt')
        .map(f => {
            const num = parseInt(f, 10);
            return { name: f, title: `第 ${num} 章`, num };
        })
        .sort((a, b) => a.num - b.num);
}

function parseDialogue(text) {
    const speakerRe = /^【(.+?)】/;
    const blocks = text.split(/\n{0,2}[─═]{10,}\n{0,2}/);
    const messages = [];
    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const lines = trimmed.split('\n');
        const first = lines[0].trim();
        const m = first.match(speakerRe);
        if (!m) continue;
        const speaker = m[1];
        const content = lines.slice(1).join('\n').trim();
        if (!content) continue;
        messages.push({ speaker, content });
    }
    return messages;
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/' || pathname === '/index.html') {
        const file = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(file)) return send(res, 200, MIME['.html'], fs.readFileSync(file));
        return send(res, 404, 'text/plain', 'Not found');
    }

    if (pathname === '/api/files') {
        return send(res, 200, MIME['.json'], JSON.stringify(listFiles()));
    }

    if (pathname.startsWith('/api/file/')) {
        const name = path.basename(pathname);
        const file = path.join(EXTRACTED_DIR, name);
        if (!file.startsWith(EXTRACTED_DIR) || !fs.existsSync(file)) {
            return send(res, 404, MIME['.json'], JSON.stringify({ error: 'file not found' }));
        }
        const text = fs.readFileSync(file, 'utf8');
        return send(res, 200, MIME['.json'], JSON.stringify({
            name,
            messages: parseDialogue(text)
        }));
    }

    // 静态资源兜底
    const file = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        return send(res, 200, MIME[ext] || 'application/octet-stream', fs.readFileSync(file));
    }

    send(res, 404, 'text/plain', 'Not found');
});

server.listen(PORT, () => {
    console.log(`对话展示服务已启动：http://localhost:${PORT}`);
});
