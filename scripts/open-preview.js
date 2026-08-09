/**
 * 启动本地服务并自动打开浏览器预览
 * 用法：node scripts/open-preview.js [article] [port]
 * 示例：node scripts/open-preview.js nte
 */
const { exec } = require('child_process');
const path = require('path');

let article = process.argv[2] || process.env.ARTICLE || 'cuff';
const port = process.argv[3] || process.env.PORT || 3000;

// 只允许字母、数字、下划线、横线，防止 shell 注入
if (!/^[a-zA-Z0-9_-]+$/.test(article)) {
    console.warn(`非法的文章名 "${article}"，已回退为默认值 cuff`);
    article = 'cuff';
}

const url = `http://localhost:${port}/?article=${encodeURIComponent(article)}`;

// 启动 server.js（非阻塞）
require(path.join(__dirname, '..', 'server.js'));

// 等服务器起来后打开默认浏览器
setTimeout(() => {
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
        cmd = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        cmd = `open "${url}"`;
    } else {
        cmd = `xdg-open "${url}"`;
    }
    exec(cmd, (err) => {
        if (err) console.error('打开浏览器失败：', err.message);
    });
    console.log(`预览地址：${url}`);
}, 1200);
