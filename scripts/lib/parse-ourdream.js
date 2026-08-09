/**
 * ourdream JSON 公共解析模块
 * 兼容规范：
 * - assistant 的 content 为 [{type,text}] 数组，user 的 content 为纯字符串（兜底读 parts）
 * - 同一文件内按 id 去重、createdAt 时间排序
 * - 跳过 14.json（仅含会话摘要）
 * - 识别 4/6/5/7.json 为重复导出文件
 */
const fs = require('fs');
const path = require('path');

const ROLE_NAMES = {
    assistant: '凯·默瑟',
    user: '裘德'
};

// 已知重复导出的文件名（不含扩展名）
const DUPLICATED_IDS = new Set(['4', '5', '6', '7']);

// 从消息对象中提取纯文本
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

// 从顶层结构中收集所有消息
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

// 列出并过滤有效的 JSON 源文件
function listSourceFiles(srcDir) {
    if (!fs.existsSync(srcDir)) return [];
    return fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ fullPath: path.join(srcDir, f), name: f, num: parseInt(f, 10) }))
        .filter(item => {
            const base = path.basename(item.name, '.json');
            // 跳过非数字命名、14.json 摘要以及已知重复导出
            if (Number.isNaN(item.num)) return false;
            if (base === '14') return false;
            if (DUPLICATED_IDS.has(base)) return false;
            return true;
        })
        .sort((a, b) => a.num - b.num);
}

// 读取并解析单个 JSON 文件，返回 { name, num, messages } 或 null
function parseSourceFile(item) {
    const raw = fs.readFileSync(item.fullPath, 'utf8').trim();
    if (!raw) {
        console.log(`跳过空文件: ${item.name}`);
        return null;
    }
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.warn(`跳过无法解析的文件: ${item.name} (${e.message})`);
        return null;
    }
    const messages = collectMessages(data);
    if (messages.length === 0) {
        console.log(`无消息内容: ${item.name}`);
        return null;
    }
    return {
        name: item.name,
        num: item.num,
        messages: messages.map(msg => ({
            role: msg.role,
            speaker: ROLE_NAMES[msg.role] || msg.role,
            content: getMessageText(msg)
        })).filter(m => m.content)
    };
}

// 读取整个文章的所有有效章节
function readArticleChapters(srcDir) {
    const items = listSourceFiles(srcDir);
    return items.map(parseSourceFile).filter(Boolean);
}

module.exports = {
    ROLE_NAMES,
    DUPLICATED_IDS,
    getMessageText,
    collectMessages,
    listSourceFiles,
    parseSourceFile,
    readArticleChapters
};
