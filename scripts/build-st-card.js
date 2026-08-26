// build-st-card.js — 生成 SillyTavern PNG 角色卡
// 用法:
//   node scripts/build-st-card.js                                  （默认：W2 阿贝尔卡）
//   node scripts/build-st-card.js <卡json路径> <底图png路径> <输出png路径>
// 将角色卡 JSON 以 base64 写入 keyword 为 "chara" 的 tEXt chunk，插入 IEND 之前，
// 不改动任何图像数据 chunk。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const [CARD_JSON, SRC_PNG, OUT_PNG] = process.argv.length >= 5
  ? process.argv.slice(2, 5).map(p => path.resolve(p))
  : [
      path.join(ROOT, 'articles/kur/st/阿贝尔-角色卡.json'),
      path.join(ROOT, 'articles/kur/W2木屋重逢-晨光.png'),
      path.join(ROOT, 'articles/kur/st/阿贝尔.png'),
    ];

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  // Node 20+ 提供 zlib.crc32；旧版本退回纯 JS 实现
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function build() {
  const card = JSON.parse(fs.readFileSync(CARD_JSON, 'utf8'));
  const png = fs.readFileSync(SRC_PNG);

  if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error('源文件不是合法 PNG（签名不匹配）');
  if (png.length < 8 + 12) throw new Error('PNG 文件过小');
  // IEND 是最后一个 chunk：length=0 + "IEND" + CRC(4)
  const iendStart = png.length - 12;
  if (png.toString('ascii', iendStart + 4, iendStart + 8) !== 'IEND') {
    throw new Error('未在文件末尾找到 IEND chunk');
  }

  // SillyTavern PNG 卡规范：tEXt chunk，keyword "chara"，值为 JSON 的 base64
  const payload = Buffer.concat([
    Buffer.from('chara\x00', 'latin1'),
    Buffer.from(Buffer.from(JSON.stringify(card), 'utf8').toString('base64'), 'latin1'),
  ]);
  const textChunk = makeChunk('tEXt', payload);

  const out = Buffer.concat([png.subarray(0, iendStart), textChunk, png.subarray(iendStart)]);
  fs.writeFileSync(OUT_PNG, out);
  console.log(`写入 ${path.relative(ROOT, OUT_PNG)}（${out.length} 字节，新增 tEXt chunk ${textChunk.length} 字节）`);
}

function verify() {
  const png = fs.readFileSync(OUT_PNG);
  if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error('输出 PNG 签名不匹配');
  let off = 8;
  let found = null;
  while (off + 12 <= png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = png.readUInt32BE(off + 8 + len);
    if (crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) !== crc) {
      throw new Error(`chunk ${type} CRC 校验失败`);
    }
    if (type === 'tEXt') {
      const nul = data.indexOf(0);
      if (data.toString('latin1', 0, nul) === 'chara') found = data.subarray(nul + 1);
    }
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (!found) throw new Error('输出 PNG 中未找到 chara tEXt chunk');
  const card = JSON.parse(Buffer.from(found.toString('latin1'), 'base64').toString('utf8'));
  if (card.spec !== 'chara_card_v2') throw new Error('spec 不符');
  const srcName = JSON.parse(fs.readFileSync(CARD_JSON, 'utf8')).data.name;
  if (card.data.name !== srcName) throw new Error(`name 不符: ${card.data.name} !== ${srcName}`);
  console.log(`验证通过：tEXt chunk 读回成功，spec=${card.spec}，name=${card.data.name}，tags=${card.data.tags.join('/')}`);
}

build();
verify();
