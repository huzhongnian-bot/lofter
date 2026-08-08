/**
 * 提取 ourdream 目录下非空 json 文件中对话消息的 text 字段。
 * assistant -> 凯·默瑟，user -> 裘德
 * 输出到 extracted/ 目录，每个 json 对应一个同名 txt，另生成合并文件 all.txt
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'ourdream');
const OUT_DIR = path.join(__dirname, 'extracted');

const ROLE_NAMES = {
    assistant: '凯·默瑟',
    user: '裘德'
};

// 从消息对象中提取纯文本（content 可能是字符串或 [{type,text}] 数组，兜底用 parts）
function getMessageText(msg) {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
        const text = msg.content
            .filter(c => c && c.type === 'text' && typeof c.text === 'string')
            .map(c => c.text)
            .join('\n');
        if (text) return text;
    }
    if (Array.isArray(msg.parts)) {
        return msg.parts
            .filter(p => p && p.type === 'text' && typeof p.text === 'string')
            .map(p => p.text)
            .join('\n');
    }
    return '';
}

// 从一个 json 文件的顶层结构中收集所有消息（按 id 去重，按 createdAt 排序）
function collectMessages(data) {
    const items = Array.isArray(data) ? data : [data];
    const seen = new Set();
    const messages = [];
    for (const item of items) {
        const list = item?.result?.data?.json;
        if (!Array.isArray(list)) continue;
        for (const msg of list) {
            if (!msg || !msg.role) continue;
            if (msg.id && seen.has(msg.id)) continue;
            if (msg.id) seen.add(msg.id);
            messages.push(msg);
        }
    }
    messages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    return messages;
}

function main() {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

    const files = fs.readdirSync(SRC_DIR)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => parseInt(a) - parseInt(b));

    const allParts = [];
    let extracted = 0, skipped = 0;

    for (const file of files) {
        const fullPath = path.join(SRC_DIR, file);
        const raw = fs.readFileSync(fullPath, 'utf8').trim();
        if (!raw) {
            console.log(`跳过空文件: ${file}`);
            skipped++;
            continue;
        }

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.warn(`跳过无法解析的文件: ${file} (${e.message})`);
            skipped++;
            continue;
        }

        const messages = collectMessages(data);
        if (messages.length === 0) {
            console.log(`无消息内容: ${file}`);
            skipped++;
            continue;
        }

        const lines = messages.map(msg => {
            const name = ROLE_NAMES[msg.role] || msg.role;
            return `【${name}】\n${getMessageText(msg)}`;
        });

        const outName = file.replace(/\.json$/, '.txt');
        const content = lines.join('\n\n' + '─'.repeat(40) + '\n\n');
        fs.writeFileSync(path.join(OUT_DIR, outName), content, 'utf8');
        allParts.push(`═══════════ ${file} ═══════════\n\n${content}`);
        console.log(`已提取: ${file} -> extracted/${outName} (${messages.length} 条消息)`);
        extracted++;
    }

    fs.writeFileSync(path.join(OUT_DIR, 'all.txt'), allParts.join('\n\n\n'), 'utf8');
    console.log(`\n完成：提取 ${extracted} 个文件，跳过 ${skipped} 个，合并输出 extracted/all.txt`);
}

main();
