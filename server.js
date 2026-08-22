/**
 * 本地静态服务：支持多文章对话展示及提取出的 txt 文件 API
 * 运行：node server.js
 * 访问：http://localhost:3000/?article=cuff
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ARTICLES_DIR = path.join(__dirname, 'articles');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_ARTICLE = 'cuff';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8'
};

function send(res, status, type, body) {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
}

function safeJoin(base, ...segments) {
    const target = path.join(base, ...segments);
    return target.startsWith(base) ? target : null;
}

function articleDir(article) {
    return safeJoin(ARTICLES_DIR, article);
}

function extractedDir(article) {
    const dir = articleDir(article);
    return dir ? path.join(dir, 'extracted') : null;
}

function revisedDir(article) {
    const dir = articleDir(article);
    return dir ? path.join(dir, 'revised') : null;
}

// 读取请求体（限制 2MB，供草稿保存使用）
function readBody(req, limit = 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', c => {
            size += c.length;
            if (size > limit) {
                reject(new Error('body too large'));
                req.destroy();
            } else {
                chunks.push(c);
            }
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function listArticles() {
    if (!fs.existsSync(ARTICLES_DIR)) return [];
    return fs.readdirSync(ARTICLES_DIR)
        .filter(name => {
            const dir = path.join(ARTICLES_DIR, name);
            return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'extracted'));
        })
        .sort();
}

function listFiles(article) {
    const dir = extractedDir(article);
    if (!dir || !fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
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
    if (messages.length === 0) {
        return [{ type: 'prose', speaker: '', content: text }];
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

    if (pathname === '/api/articles') {
        return send(res, 200, MIME['.json'], JSON.stringify(listArticles()));
    }

    const filesMatch = pathname.match(/^\/api\/([^/]+)\/files$/);
    if (filesMatch) {
        const article = filesMatch[1];
        if (!articleDir(article)) return send(res, 404, MIME['.json'], JSON.stringify({ error: 'article not found' }));
        return send(res, 200, MIME['.json'], JSON.stringify(listFiles(article)));
    }

    // 草稿列表：返回 revised 目录下已有的草稿文件名与字数
    const draftsMatch = pathname.match(/^\/api\/([^/]+)\/drafts$/);
    if (draftsMatch) {
        const dir = revisedDir(draftsMatch[1]);
        if (!dir) return send(res, 404, MIME['.json'], JSON.stringify({ error: 'article not found' }));
        if (!fs.existsSync(dir)) return send(res, 200, MIME['.json'], JSON.stringify([]));
        const list = fs.readdirSync(dir)
            .filter(f => /^[\w.-]+$/.test(f))
            .map(f => {
                const content = fs.readFileSync(path.join(dir, f), 'utf8');
                return { name: f, chars: content.replace(/\s/g, '').length };
            });
        return send(res, 200, MIME['.json'], JSON.stringify(list));
    }

    // 草稿读写：GET 读取（不存在返回空内容），POST 保存
    const draftMatch = pathname.match(/^\/api\/([^/]+)\/draft\/(.+)$/);
    if (draftMatch) {
        const article = draftMatch[1];
        const name = path.basename(draftMatch[2]);
        const dir = revisedDir(article);
        if (!dir || !/^[\w.-]+$/.test(name)) {
            return send(res, 404, MIME['.json'], JSON.stringify({ error: 'not found' }));
        }
        const file = safeJoin(dir, name);
        if (!file) return send(res, 404, MIME['.json'], JSON.stringify({ error: 'not found' }));
        if (req.method === 'GET') {
            if (!fs.existsSync(file)) {
                return send(res, 200, MIME['.json'], JSON.stringify({ name, exists: false, content: '' }));
            }
            return send(res, 200, MIME['.json'], JSON.stringify({
                name,
                exists: true,
                content: fs.readFileSync(file, 'utf8')
            }));
        }
        if (req.method === 'POST') {
            readBody(req)
                .then(body => {
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(file, body, 'utf8');
                    send(res, 200, MIME['.json'], JSON.stringify({ ok: true, chars: body.replace(/\s/g, '').length }));
                })
                .catch(() => send(res, 400, MIME['.json'], JSON.stringify({ error: 'save failed' })));
            return;
        }
        return send(res, 405, MIME['.json'], JSON.stringify({ error: 'method not allowed' }));
    }

    const fileMatch = pathname.match(/^\/api\/([^/]+)\/file\/(.+)$/);
    if (fileMatch) {
        const article = fileMatch[1];
        const name = path.basename(fileMatch[2]);
        const dir = extractedDir(article);
        if (!dir) return send(res, 404, MIME['.json'], JSON.stringify({ error: 'article not found' }));
        const file = safeJoin(dir, name);
        if (!file || !fs.existsSync(file)) {
            return send(res, 404, MIME['.json'], JSON.stringify({ error: 'file not found' }));
        }
        const text = fs.readFileSync(file, 'utf8');
        return send(res, 200, MIME['.json'], JSON.stringify({
            name,
            article,
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
    console.log(`对话展示服务已启动：http://localhost:${PORT}/?article=${DEFAULT_ARTICLE}`);
});
