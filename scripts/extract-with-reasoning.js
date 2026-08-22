/**
 * 从 ourdream JSON 提取原文与 reasoning 思考记录。
 * 用法：node scripts/extract-with-reasoning.js <article> [options]
 * 示例：
 *   node scripts/extract-with-reasoning.js nte --assistant=卡厄斯 --user=零
 *   node scripts/extract-with-reasoning.js nte --assistant=卡厄斯 --user=零 --file=8.json
 *   node scripts/extract-with-reasoning.js nte --file=all.json（从合并后的 all.json 导出全文）
 * 输出：
 *   articles/<article>/extracted/<num>.txt
 *   articles/<article>/thinking.md
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = argv.slice(2);
    const article = args.find(a => !a.startsWith('--'));
    const options = {};
    for (const arg of args) {
        const m = arg.match(/^--([\w-]+)=(.*)$/);
        if (m) options[m[1]] = m[2];
    }
    return { article, options };
}

function collectMessages(data) {
    const items = Array.isArray(data) ? data : [data];
    const messages = [];
    for (const item of items) {
        // 兼容 all.json 等已合并的扁平消息数组
        if (item && item.role) {
            messages.push(item);
            continue;
        }
        const list = item?.result?.data?.json;
        if (!Array.isArray(list)) continue;
        messages.push(...list);
    }
    messages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    return messages;
}

function splitContent(msg) {
    const textParts = [];
    const reasoningParts = [];

    function collect(parts) {
        if (!Array.isArray(parts)) return;
        for (const p of parts) {
            if (!p || typeof p.text !== 'string') continue;
            if (p.type === 'reasoning') reasoningParts.push(p.text);
            else if (p.type === 'text' || !p.type) textParts.push(p.text);
        }
    }

    if (typeof msg.content === 'string') {
        textParts.push(msg.content);
    } else if (Array.isArray(msg.content)) {
        collect(msg.content);
    }

    // content 缺少某部分时，从 parts 补充
    if (textParts.length === 0 && msg.parts) {
        collect(msg.parts);
    } else if (reasoningParts.length === 0 && msg.parts) {
        const savedText = textParts.slice();
        textParts.length = 0;
        reasoningParts.length = 0;
        collect(msg.parts);
        // 如果 parts 导致 text 重复，还原 content 中的 text
        if (textParts.length > 0 && savedText.length > 0) {
            textParts.length = 0;
            textParts.push(...savedText);
        }
    }

    return {
        text: textParts.join('\n').trim(),
        reasoning: reasoningParts.join('\n').trim()
    };
}

function processFile(srcPath, roleNames, characterMap) {
    const raw = fs.readFileSync(srcPath, 'utf8').trim();
    if (!raw) return null;
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        console.warn(`无法解析：${srcPath} (${e.message})`);
        return null;
    }

    const messages = collectMessages(data);
    const dialogueLines = [];
    const thinkingLines = [];

    for (const msg of messages) {
        const { text, reasoning } = splitContent(msg);
        // 跳过平台系统旁白（如 [NARRATION: 灵可 has left the scene]）
        if (msg.role === 'system' || /^\[NARRATION:/.test(text)) continue;
        const speaker = resolveSpeaker(msg, roleNames, characterMap);
        if (text) dialogueLines.push(`【${speaker}】\n${text}`);
        if (reasoning) {
            thinkingLines.push(`## ${speaker} 的思考`);
            thinkingLines.push('');
            thinkingLines.push(reasoning);
            thinkingLines.push('');
        }
    }

    return { dialogueLines, thinkingLines };
}

function resolveSpeaker(msg, roleNames, characterMap) {
    // assistant 消息可能由不同角色（如卡厄斯、白藏、灵可）发出，优先按 characterId 判断
    if (msg.role === 'assistant' && msg.characterId && characterMap[msg.characterId]) {
        return characterMap[msg.characterId];
    }
    return roleNames[msg.role] || msg.role;
}

function main() {
    const { article, options } = parseArgs(process.argv);
    if (!article) {
        console.error('用法：node scripts/extract-with-reasoning.js <article> [--assistant=角色名] [--user=角色名] [--file=指定文件.json]');
        process.exit(1);
    }

    const roleNames = {
        assistant: options.assistant || '卡厄斯',
        user: options.user || '零'
    };

    // 根据 characterId 识别 assistant 消息的实际发言角色（支持同一对话中切换角色）
    const characterMap = {
        'da947050-1a87-4b95-b562-62ffc5cf9f78': options.assistant || '卡厄斯',
        '8c5470ae-1a9f-4ea1-b19f-11efc6e9581b': '白藏',
        '70138c4e-c01b-489a-94ae-49825aac61ad': '灵可'
    };

    const srcDir = path.join(__dirname, '..', 'articles', article, 'source');
    const outDir = path.join(__dirname, '..', 'articles', article);
    const extractedDir = path.join(outDir, 'extracted');

    if (!fs.existsSync(srcDir)) {
        console.error(`源目录不存在：${srcDir}`);
        process.exit(1);
    }
    if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir, { recursive: true });

    let files;
    if (options.file) {
        files = [path.join(srcDir, options.file)];
    } else {
        files = fs.readdirSync(srcDir)
            .filter(f => f.endsWith('.json'))
            .map(f => path.join(srcDir, f))
            .sort();
    }

    const allThinkingLines = ['# 思考记录（reasoning）\n'];
    let processed = 0;

    for (const srcPath of files) {
        const base = path.basename(srcPath, '.json');
        const result = processFile(srcPath, roleNames, characterMap);
        if (!result || result.dialogueLines.length === 0) {
            console.log(`跳过：${path.basename(srcPath)}`);
            continue;
        }

        const outName = base + '.txt';
        const content = result.dialogueLines.join('\n\n' + '─'.repeat(40) + '\n\n');
        fs.writeFileSync(path.join(extractedDir, outName), content, 'utf8');
        console.log(`已提取原文：${outName}（${result.dialogueLines.length} 段）`);

        if (result.thinkingLines.length > 0) {
            allThinkingLines.push(`## 来源：${path.basename(srcPath)}`);
            allThinkingLines.push('');
            allThinkingLines.push(...result.thinkingLines);
        }
        processed++;
    }

    if (allThinkingLines.length > 1) {
        fs.writeFileSync(path.join(outDir, 'thinking.md'), allThinkingLines.join('\n') + '\n', 'utf8');
        console.log(`已提取思考记录：articles/${article}/thinking.md`);
    }

    console.log(`\n完成：处理 ${processed} 个文件`);
}

main();
