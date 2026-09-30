/**
 * 将 kur 的 extracted txt 按「第一世 / 第二世」切分
 *
 * 背景：source/7.json 同时包含第一世尾声与第二世开篇。
 * 第一世止于 60 岁的阿贝尔出海遇风暴、应下「再来一世」；
 * 第二世从凉在清晨海滩捡到船骸开始。
 *
 * 切分规则：
 * - 1.txt ~ 6.txt 不动，补上「第一世」书头
 * - 7.txt 拆为 7.txt（第一世 · 终章）与 8.txt（第二世 · 开篇）
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'articles', 'kur', 'extracted');

// 第二世开篇的起句（7.txt 内唯一定位锚点）
const MARKER = '清晨的海滩上还留着昨夜风暴的腥气';
const SEPARATOR = '─'.repeat(40);

const FIRST_HEADER = '# 库尔之河 · 第一世\n\n' + SEPARATOR + '\n\n';
const SECOND_HEADER = '# 库尔之河 · 第二世\n\n' + SEPARATOR + '\n\n';

function withHeader(content, header) {
    return content.startsWith('#') ? content : header + content;
}

function main() {
    // 1-6 章补第一世书头
    for (let n = 1; n <= 6; n++) {
        const p = path.join(dir, n + '.txt');
        const content = fs.readFileSync(p, 'utf8');
        fs.writeFileSync(p, withHeader(content, FIRST_HEADER), 'utf8');
        console.log(`${n}.txt：已加「第一世」书头`);
    }

    // 拆分 7.txt
    const p7 = path.join(dir, '7.txt');
    const text = fs.readFileSync(p7, 'utf8');
    const markerIdx = text.indexOf(MARKER);
    if (markerIdx < 0) {
        console.error('未找到第二世定位锚点，7.txt 未改动。');
        process.exit(1);
    }

    // 向前回退到该消息所属块之前的分隔线，第二世部分保留【说话人】行
    const blockStart = text.lastIndexOf('\n\n' + SEPARATOR, markerIdx);
    if (blockStart < 0) {
        console.error('未找到锚点前的分隔线，7.txt 未改动。');
        process.exit(1);
    }

    const part1 = text.slice(0, blockStart).trimEnd() + '\n';
    const part2 = text.slice(blockStart + 2 + SEPARATOR.length).replace(/^\s+/, '') ;

    fs.writeFileSync(p7, withHeader(part1, FIRST_HEADER), 'utf8');
    fs.writeFileSync(path.join(dir, '8.txt'), withHeader(part2.trimEnd() + '\n', SECOND_HEADER), 'utf8');

    console.log(`7.txt：第一世部分 ${part1.replace(/\s/g, '').length} 字（含风暴与「再来一世」终幕）`);
    console.log(`8.txt：第二世部分 ${part2.replace(/\s/g, '').length} 字（海滩重逢开篇）`);

    // 9.txt 起的后续第二世章节（source 编号偏移 +1 的产物）补第二世书头
    for (const f of fs.readdirSync(dir)) {
        if (!/^\d+\.txt$/.test(f)) continue;
        const n = parseInt(f, 10);
        if (n < 9) continue;
        const p = path.join(dir, f);
        fs.writeFileSync(p, withHeader(fs.readFileSync(p, 'utf8'), SECOND_HEADER), 'utf8');
        console.log(`${f}：已加「第二世」书头`);
    }

    console.log('切分完成。all.txt 保留为未切分的原始合并备份。');
}

main();
