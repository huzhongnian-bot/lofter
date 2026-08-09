/**
 * 按文章提取 ourdream JSON 文件中的对话消息。
 * 用法：node extract.js [article]
 * 默认 article 为 cuff。
 * 从 articles/<article>/source/ 读取 .json，输出到 articles/<article>/extracted/。
 */
const fs = require('fs');
const path = require('path');
const { readArticleChapters } = require('./scripts/lib/parse-ourdream');

const ARTICLE = process.argv[2] || 'cuff';
const SRC_DIR = path.join(__dirname, 'articles', ARTICLE, 'source');
const OUT_DIR = path.join(__dirname, 'articles', ARTICLE, 'extracted');

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`源目录不存在：${SRC_DIR}`);
        console.error(`请确认 articles/${ARTICLE}/source/ 目录下已放入 ourdream 导出的 JSON 文件。`);
        process.exit(1);
    }
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const chapters = readArticleChapters(SRC_DIR);
    if (chapters.length === 0) {
        console.log(`源目录为空或没有有效内容：${SRC_DIR}`);
        return;
    }

    const allParts = [];
    for (const chapter of chapters) {
        const lines = chapter.messages.map(m => `【${m.speaker}】\n${m.content}`);
        const outName = chapter.num + '.txt';
        const content = lines.join('\n\n' + '─'.repeat(40) + '\n\n');
        fs.writeFileSync(path.join(OUT_DIR, outName), content, 'utf8');
        allParts.push(`═══════════ ${chapter.name} ═══════════\n\n${content}`);
        console.log(`已提取: ${chapter.name} -> articles/${ARTICLE}/extracted/${outName} (${chapter.messages.length} 条消息)`);
    }

    fs.writeFileSync(path.join(OUT_DIR, 'all.txt'), allParts.join('\n\n\n'), 'utf8');
    console.log(`\n完成：提取 ${chapters.length} 个文件，合并输出 articles/${ARTICLE}/extracted/all.txt`);
}

main();
