/**
 * 从已提取的 txt 对话文件生成文章 Markdown（full.md）。
 * 用法：node scripts/txt-to-md.js <article> [--title=标题] [--subtitle=副标题]
 * 示例：node scripts/txt-to-md.js cuff --title="手铐" --subtitle="校园青春 · 凯·默瑟 & 裘德"
 * 输入：articles/<article>/extracted/*.txt（不含 all.txt）
 * 输出：articles/<article>/full.md
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

function txtToMarkdown(text, chapterNum) {
    const speakerRe = /^【(.+?)】/;
    const blocks = text.split(/\n{0,2}[─═]{10,}\n{0,2}/);
    const mdBlocks = [];
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
        mdBlocks.push(`**${speaker}**\n\n${content}`);
    }
    return `## 第 ${chapterNum} 章\n\n` + mdBlocks.join('\n\n');
}

function main() {
    const { article, options } = parseArgs(process.argv);
    if (!article) {
        console.error('用法：node scripts/txt-to-md.js <article> [--title=标题] [--subtitle=副标题]');
        process.exit(1);
    }

    const extractedDir = path.join(__dirname, '..', 'articles', article, 'extracted');
    const outPath = path.join(__dirname, '..', 'articles', article, 'full.md');

    if (!fs.existsSync(extractedDir)) {
        console.error(`目录不存在：${extractedDir}`);
        console.error(`请先运行：node extract.js ${article}`);
        process.exit(1);
    }

    const files = fs.readdirSync(extractedDir)
        .filter(f => f.endsWith('.txt') && f !== 'all.txt')
        .map(f => ({ name: f, num: parseInt(f, 10) }))
        .filter(f => !Number.isNaN(f.num))
        .sort((a, b) => a.num - b.num);

    if (files.length === 0) {
        console.log(`没有可用的 txt 章节：${extractedDir}`);
        return;
    }

    const title = options.title || article;
    const subtitle = options.subtitle || '';
    const header = [`# ${title}`, '', subtitle ? `> ${subtitle}` : '', '']
        .filter(line => line !== '')
        .join('\n') + '\n';

    const chapters = files.map(f => {
        const text = fs.readFileSync(path.join(extractedDir, f.name), 'utf8');
        return txtToMarkdown(text, f.num);
    });

    fs.writeFileSync(outPath, header + chapters.join('\n\n---\n\n') + '\n', 'utf8');
    console.log(`已生成：${outPath}`);
    console.log(`章节数：${chapters.length}`);
}

main();
