/**
 * ourdream JSON 公共解析模块
 * 兼容规范：
 * - assistant 的 content 为 [{type,text}] 数组，user 的 content 为纯字符串（兜底读 parts）
 * - 同一文件内按 id 去重、createdAt 时间排序
 * - 跳过 14.json（仅含会话摘要）
 */
const fs = require('fs');
const path = require('path');

// 默认角色名（cuff）
const ROLE_NAMES = {
    assistant: '凯·默瑟',
    user: '裘德'
};

// 各文章的角色名覆盖（依据 source JSON 中 reasoning 的自述确认）
const ARTICLE_ROLE_NAMES = {
    nte: { assistant: '卡厄斯', user: '零' },
    kur: { assistant: '阿贝尔', user: '凉' }
};

// 同一对话中 assistant 由多个 characterId 扮演时，按 characterId 区分发言角色
const ARTICLE_CHARACTER_NAMES = {
    nte: {
        'da947050-1a87-4b95-b562-62ffc5cf9f78': '卡厄斯',
        '8c5470ae-1a9f-4ea1-b19f-11efc6e9581b': '白藏',
        '70138c4e-c01b-489a-94ae-49825aac61ad': '灵可'
    },
    kur: {
        '01f2b0b5-19a9-42d7-a489-8fee7911a10b': '阿贝尔',
        'c2cb2063-5766-413f-ab9a-4547efadfe54': '丽希娅'
    }
};

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
            // 跳过非数字命名以及 14.json 摘要
            if (Number.isNaN(item.num)) return false;
            if (base === '14') return false;
            return true;
        })
        .sort((a, b) => a.num - b.num);
}

// 读取并解析单个 JSON 文件，返回 { name, num, messages } 或 null
function parseSourceFile(item, roleNames, characterNames) {
    const roles = roleNames || ROLE_NAMES;
    const characters = characterNames || {};
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
            // assistant 消息可能由不同角色发出，优先按 characterId 判断
            speaker: (msg.role === 'assistant' && characters[msg.characterId])
                ? characters[msg.characterId]
                : (roles[msg.role] || msg.role),
            content: getMessageText(msg)
        })).filter(m => m.content)
    };
}

// 读取整个文章的所有有效章节（按目录名套用对应角色名）
function readArticleChapters(srcDir) {
    const article = path.basename(path.dirname(srcDir));
    const roleNames = ARTICLE_ROLE_NAMES[article] || ROLE_NAMES;
    const characterNames = ARTICLE_CHARACTER_NAMES[article];
    const items = listSourceFiles(srcDir);
    return items.map(item => parseSourceFile(item, roleNames, characterNames)).filter(Boolean);
}

module.exports = {
    ROLE_NAMES,
    ARTICLE_ROLE_NAMES,
    ARTICLE_CHARACTER_NAMES,
    getMessageText,
    collectMessages,
    listSourceFiles,
    parseSourceFile,
    readArticleChapters
};
