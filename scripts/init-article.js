/**
 * 快速创建新文章模板。
 * 用法：node scripts/init-article.js <article-id> [标题] [--subtitle=副标题]
 * 示例：
 *   node scripts/init-article.js novel2
 *   node scripts/init-article.js novel2 "我的新小说" --subtitle="科幻 · 冒险"
 */
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = argv.slice(2);
    const article = args[0];
    const title = args[1] && !args[1].startsWith('--') ? args[1] : article;
    const subtitle = '';
    const options = {};
    for (const arg of args) {
        const m = arg.match(/^--([\w-]+)=(.*)$/);
        if (m) options[m[1]] = m[2];
    }
    return { article, title, subtitle: options.subtitle || '' };
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`创建：${filePath}`);
    } else {
        console.log(`已存在，跳过：${filePath}`);
    }
}

function main() {
    const { article, title, subtitle } = parseArgs(process.argv);
    if (!article) {
        console.error('用法：node scripts/init-article.js <article-id> [标题] [--subtitle=副标题]');
        process.exit(1);
    }

    const baseDir = path.join(__dirname, '..', 'articles', article);
    ensureDir(path.join(baseDir, 'source'));
    ensureDir(path.join(baseDir, 'extracted'));
    ensureDir(path.join(baseDir, 'archives'));

    const header = [`# ${title}`, '', subtitle ? `> ${subtitle}` : '', ''].join('\n').trim() + '\n\n';

    writeFile(path.join(baseDir, 'full.md'), header);
    writeFile(path.join(baseDir, 'prompt.md'), `${header}# 档案员提示词\n\n请在此写入该作品的档案员提示词。\n`);
    writeFile(path.join(baseDir, 'review.md'), `${header}# 锐评与修改建议\n\n请在此写入审阅意见。\n`);

    console.log(`\n文章模板已准备就绪：articles/${article}/`);
    console.log('后续步骤：');
    console.log(`  1. 将 ourdream 导出的 JSON 文件放入 articles/${article}/source/`);
    console.log(`  2. 运行 node extract.js ${article}        生成对话 txt`);
    console.log(`  3. 运行 node scripts/json-to-md.js ${article} --title="${title}" 生成 full.md`);
}

main();
