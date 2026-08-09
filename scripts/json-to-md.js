/**
 * 从 ourdream JSON 导出文章 Markdown（full.md）。
 * 用法：node scripts/json-to-md.js <article> [options]
 * 示例：
 *   node scripts/json-to-md.js cuff
 *   node scripts/json-to-md.js cuff --title="手铐" --subtitle="校园青春 · 凯·默瑟 & 裘德"
 * 输出：articles/<article>/full.md
 */
const fs = require('fs');
const path = require('path');
const { readArticleChapters } = require('./lib/parse-ourdream');

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

function chapterToMarkdown(chapter) {
    const blocks = chapter.messages.map(m => `**${m.speaker}**\n\n${m.content}`);
    return `## 第 ${chapter.num} 章\n\n` + blocks.join('\n\n');
}

function main() {
    const { article, options } = parseArgs(process.argv);
    if (!article) {
        console.error('用法：node scripts/json-to-md.js <article> [--title=标题] [--subtitle=副标题]');
        process.exit(1);
    }

    const srcDir = path.join(__dirname, '..', 'articles', article, 'source');
    const outPath = path.join(__dirname, '..', 'articles', article, 'full.md');

    if (!fs.existsSync(srcDir)) {
        console.error(`源目录不存在：${srcDir}`);
        console.error(`请先运行：node scripts/init-article.js ${article}`);
        process.exit(1);
    }

    const chapters = readArticleChapters(srcDir);
    if (chapters.length === 0) {
        console.log(`没有可用的 JSON 章节：${srcDir}`);
        return;
    }

    const title = options.title || article;
    const subtitle = options.subtitle || '';
    const header = [`# ${title}`, '', subtitle ? `> ${subtitle}` : '', '']
        .filter(line => line !== '')
        .join('\n') + '\n';

    const body = chapters.map(chapterToMarkdown).join('\n\n---\n\n');
    fs.writeFileSync(outPath, header + body + '\n', 'utf8');

    console.log(`已生成：${outPath}`);
    console.log(`章节数：${chapters.length}`);
}

main();
