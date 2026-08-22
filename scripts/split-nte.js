/**
 * 将 nte 的 1.txt 按章节切分为多个文件
 */
const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/admin/Documents/workspace/lofter/articles/nte/extracted';
const srcPath = path.join(dir, 'all.txt');
const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

// 章节切分点（endLine 为分隔线所在行号，1-based；最后一章切到文件末尾）
const chapters = [
    { endLine: 204, title: '留声机疑案' },
    { endLine: 426, title: '一咖舍的合作' },
    { endLine: 741, title: '未闻浦码头' },
    { endLine: 1035, title: '铁脊环线' },
    { endLine: 1217, title: '担保人与孤儿院的画' },
    { endLine: 1646, title: '管理局培训与白藏' },
    { endLine: 1747, title: '一咖舍的周末与助教邀约' },
    { endLine: 2007, title: '资格证实战考' },
    { endLine: 2271, title: '框外风景' },
    { endLine: 2502, title: '苏醒与约定' },
    { endLine: Infinity, title: '尾声' }
];

const BOOK_TITLE = '# Nowhere to Everywhere\n\n────────────────────────────────────────\n\n';

// 备份全文
fs.writeFileSync(path.join(dir, 'all.txt'), lines.join('\n'), 'utf8');

let startIdx = 0;
for (let i = 0; i < chapters.length; i++) {
    const endIdx = chapters[i].endLine;
    const chapterLines = lines.slice(startIdx, endIdx);
    const chapterPath = path.join(dir, (i + 1) + '.txt');
    const content = BOOK_TITLE + chapterLines.join('\n');
    fs.writeFileSync(chapterPath, content, 'utf8');
    const shownEnd = Math.min(endIdx, lines.length);
    console.log(`第 ${i + 1} 章：${chapters[i].title}，行 ${startIdx + 1}-${shownEnd}，共 ${chapterLines.length} 行`);
    startIdx = endIdx;
}

console.log('切分完成，原文已备份为 all.txt');
