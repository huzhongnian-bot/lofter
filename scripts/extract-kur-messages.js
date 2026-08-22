/**
 * 从 kur/source/last.json 中提取聊天消息数组节点。
 * 用法：node scripts/extract-kur-messages.js [--sort]
 *
 * last.json 顶层是接口响应数组，每个元素形如 { result: { data: { json, meta } } }，
 * 其中只有一个元素的 json 是聊天消息数组（含 role/content/createdAt）。
 * 脚本自动定位该节点，输出到 articles/kur/extracted/messages.json。
 * 加 --sort 时按 createdAt 升序（时间正序）输出。
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'articles', 'kur', 'source', 'last.json');
const OUT_DIR = path.join(__dirname, '..', 'articles', 'kur', 'extracted');
const OUT = path.join(OUT_DIR, 'messages.json');

function isMessageArray(value) {
    return Array.isArray(value) && value.length > 0
        && value.every(m => m && typeof m === 'object' && 'role' in m && 'content' in m && 'createdAt' in m);
}

function main() {
    if (!fs.existsSync(SRC)) {
        console.error(`源文件不存在：${SRC}`);
        process.exit(1);
    }

    const responses = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    if (!Array.isArray(responses)) {
        console.error('last.json 顶层不是数组，格式不符合预期。');
        process.exit(1);
    }

    // 遍历所有响应，定位 json 为消息数组的节点
    const found = [];
    responses.forEach((item, idx) => {
        const json = item && item.result && item.result.data && item.result.data.json;
        if (isMessageArray(json)) found.push({ idx, json });
    });

    if (found.length === 0) {
        console.error('未找到消息数组节点。');
        process.exit(1);
    }
    if (found.length > 1) {
        console.log(`找到 ${found.length} 个消息数组节点，取消息数最多的一个。`);
    }

    let messages = found.sort((a, b) => b.json.length - a.json.length)[0].json;
    console.log(`定位到顶层第 ${found[0].idx + 1} 个响应元素，共 ${messages.length} 条消息。`);

    if (process.argv.includes('--sort')) {
        messages = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        console.log('已按 createdAt 升序排列。');
    }

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(messages, null, 4), 'utf8');
    console.log(`完成：输出 ${messages.length} 条消息 -> articles/kur/extracted/messages.json`);
}

main();
