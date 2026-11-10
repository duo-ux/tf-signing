/* ================================================================
 * TF家族模拟签售 — 成员数据（用户唯一需要编辑的文件）
 * ----------------------------------------------------------------
 * ★ 图片替换说明：
 * 1. MEMBER_GROUPS：分组信息，可改名称 name 与代表色 color。
 * 2. MEMBERS：成员名单。字段：
 *    - id     全局唯一英文 id，同时也是立绘文件名（id 为 wjk 则图片
 *             放在 assets/members/wjk.png）
 *    - name   显示名字
 *    - group  所属分组 id（必须是 MEMBER_GROUPS 中存在的 id）
 *    - img    可选。留空时自动加载 assets/members/<id>.png；
 *             也可显式写 'assets/members/xxx.webp' 等自定义路径
 * 3. 立绘图片规范：竖版半身/全身，宽 600–900px、高 1200–1800px
 *    （约 1:2），透明底 PNG 效果最佳；人物主体占画面宽度 55–80%；
 *    头顶留 ≥3% 边距。同一张图兼作：选人卡（整图）、签售半身立绘
 *    （裁上半身）、结算头像（头部圆形裁剪）。
 * 4. 图片缺失或加载失败时，游戏自动显示"剪影+名字"占位图，不影响
 *    运行；图片到位后按 id 命名放入 assets/members/ 即可，无需改代码。
 * ================================================================ */

window.MEMBER_GROUPS = [
  { id: 'tfboys', name: 'TFBOYS',      color: '#f28c28' },
  { id: 'tnt',    name: '时代少年团',  color: '#8e6fd8' },
  { id: 'top',    name: 'TOP登陆少年', color: '#3b82c4' },
  { id: 'ing',    name: 'TF_ING',      color: '#3aa876' },
  { id: 'solo3',  name: 'SOLO',        color: '#c9a45c' },
  { id: 'gen4',   name: '四代',        color: '#d86a8a' },
];

window.MEMBERS = [
  /* ── 一代 TFBOYS ── */
  { id: 'wjk',  name: '王俊凯',  group: 'tfboys' },
  { id: 'wy',   name: '王源',    group: 'tfboys' },
  { id: 'yyqx', name: '易烊千玺', group: 'tfboys' },

  /* ── 二代 时代少年团 ── */
  { id: 'mjq', name: '马嘉祺', group: 'tnt' },
  { id: 'dcx', name: '丁程鑫', group: 'tnt' },
  { id: 'syx', name: '宋亚轩', group: 'tnt' },
  { id: 'lyw', name: '刘耀文', group: 'tnt' },
  { id: 'zzy', name: '张真源', group: 'tnt' },
  { id: 'yhx', name: '严浩翔', group: 'tnt' },
  { id: 'hjl', name: '贺峻霖', group: 'tnt' },

  /* ── 三代 TOP登陆少年 ── */
  { id: 'zhuzhixin',  name: '朱志鑫', group: 'top' },
  { id: 'zhangzeyu',  name: '张泽禹', group: 'top' },
  { id: 'zhangji',    name: '张极',   group: 'top' },
  { id: 'zuohang',    name: '左航',   group: 'top' },
  { id: 'suxinhao',   name: '苏新皓', group: 'top' },

  /* ── 三代 TF_ING ── */
  { id: 'tongyukun',   name: '童禹坤', group: 'ing' },
  { id: 'chentianrun', name: '陈天润', group: 'ing' },
  { id: 'dengjiaxin',  name: '邓佳鑫', group: 'ing' },
  { id: 'muzhicheng',  name: '穆祉丞', group: 'ing' },
  { id: 'huangshuo',   name: '黄朔',   group: 'ing' },
  { id: 'zhangzimo',   name: '张子墨', group: 'ing' },

  /* ── 三代 单飞SOLO ── */
  { id: 'zhangjunhao', name: '张峻豪', group: 'solo3' },
  { id: 'yuyuhan',     name: '余宇涵', group: 'solo3' },

  /* ── 四代 ── */
  { id: 'guanjunchen',  name: '官俊臣', group: 'gen4' },
  { id: 'zhangguiyuan', name: '张桂源', group: 'gen4' },
  { id: 'zhanghanrui',  name: '张函瑞', group: 'gen4' },
  { id: 'wanglujie',    name: '王橹杰', group: 'gen4' },
  { id: 'wangshuoran',  name: '王烁然', group: 'gen4' },
  { id: 'zuoqihan',     name: '左奇函', group: 'gen4' },
  { id: 'chenyiheng',   name: '陈奕恒', group: 'gen4' },
  { id: 'yangbowen',    name: '杨博文', group: 'gen4' },
  { id: 'yanghanbo',    name: '杨涵博', group: 'gen4' },
  { id: 'zhangyiran',   name: '张奕然', group: 'gen4' },
  { id: 'nieweichen',   name: '聂玮辰', group: 'gen4' },
  { id: 'chensihan',    name: '陈思罕', group: 'gen4' },
  { id: 'weizichen',    name: '魏子宸', group: 'gen4' },
  { id: 'liyudong',     name: '李煜东', group: 'gen4' },
  { id: 'chenjunming',  name: '陈浚铭', group: 'gen4' },
];

/* ════════════════════════════════════════════════════════════════
 * 头像按成员裁切参数（自动检测初值 + 调头像.html 微调定稿）
 * ----------------------------------------------------------------
 * z = 放大倍数（相对圆形头像容器宽度；1.52 即图片宽 152%）
 * t = 图片上移量（相对容器高度的小数；CSS top 取 -t，画布合成取 -t×头像高）
 * x = 水平偏移（%圆形宽度，正=图片右移；补偿照片里脸不在正中的情况）
 * 作用：让每个人的脸在圆形头像里大小一致、居中，不再有的全露有的半露。
 * 若某成员缺省，回退 CSS 默认（宽 190%、顶对齐 2%）。
 * ════════════════════════════════════════════════════════════════ */
window.AVATAR_CROP = {
  wjk:          { z: 1.52, t: 0.13, x: 23.8 },
  wy:           { z: 1.71, t: 0.24, x: -1.8 },
  yyqx:         { z: 1.75, t: 0.21, x: -7.9 },
  mjq:          { z: 1.82, t: 0.23, x: -1.2 },
  dcx:          { z: 1.55, t: 0.17, x: -0.3 },
  syx:          { z: 1.52, t: 0.15, x: 1.2 },
  lyw:          { z: 1.66, t: 0.20, x: 7.9 },
  zzy:          { z: 1.69, t: 0.20, x: 2.1 },
  yhx:          { z: 1.46, t: 0.13, x: -0.3 },
  hjl:          { z: 1.30, t: 0.11, x: -1.2 },
  zhuzhixin:    { z: 1.66, t: 0.14, x: 2.4 },
  zhangzeyu:    { z: 1.71, t: 0.11, x: 0.9 },
  zhangji:      { z: 1.73, t: 0.11, x: -1.5 },
  zuohang:      { z: 1.80, t: 0.12, x: -2.1 },
  suxinhao:     { z: 1.76, t: 0.11, x: -4.6 },
  tongyukun:    { z: 1.85, t: 0.10, x: 8.8 },
  chentianrun:  { z: 1.76, t: 0.12, x: -0.2 },
  dengjiaxin:   { z: 1.59, t: 0.05, x: 16.1 },
  muzhicheng:   { z: 1.73, t: 0.11, x: 3.4 },
  huangshuo:    { z: 1.76, t: 0.13, x: 11.3 },
  zhangzimo:    { z: 1.71, t: 0.11, x: 0.9 },
  zhangjunhao:  { z: 1.76, t: 0.12, x: 2.6 },
  yuyuhan:      { z: 1.73, t: 0.10, x: 2.7 },
  guanjunchen:  { z: 1.37, t: 0.12, x: 13.4 },
  zhangguiyuan: { z: 1.28, t: 0.09, x: -5.5 },
  zhanghanrui:  { z: 1.23, t: 0.10, x: 0.5 },
  wanglujie:    { z: 1.34, t: 0.12, x: -0.2 },
  wangshuoran:  { z: 1.30, t: 0.09, x: 2.3 },
  zuoqihan:     { z: 1.41, t: 0.10, x: 12.8 },
  chenyiheng:   { z: 1.28, t: 0.11, x: 14.6 },
  yangbowen:    { z: 1.39, t: 0.13, x: 9.7 },
  yanghanbo:    { z: 1.44, t: 0.12, x: 0.0 },
  zhangyiran:   { z: 1.37, t: 0.14, x: 0.8 },
  nieweichen:   { z: 1.39, t: 0.15, x: 4.7 },
  chensihan:    { z: 1.37, t: 0.15, x: 1.5 },
  weizichen:    { z: 1.37, t: 0.10, x: 21.3 },
  liyudong:     { z: 1.27, t: 0.09, x: 11.6 },
  chenjunming:  { z: 1.28, t: 0.12, x: -15.8 },
};

/* ════════════════════════════════════════════════════════════════
 * 签售页立绘按成员参数（统一人物大小：所有成员屏上头宽一致 ≈260，
 * 整体缩小露出更多上半身；排队槽位 1–4 的 img 由 style.css 强制居中，
 * 保证队伍间隔均匀，这里的 l 只作用于槽 0）
 * ----------------------------------------------------------------
 * k = 立绘宽度倍数（%，默认 170）：按图中头宽反推 k = 170×260/头宽，
 *     头小的拉近、头大的拉远；身体够不到桌沿时再放大（k ≥ 95172/主体底y，
 *     保证照片底边压到桌面线，不悬空露背景）
 * l = 立绘 left 偏移（%）：人物身体站桌面中央（槽 0 盒居中，2026-11-10 改版），
 *     l = 50 + k×(0.5 − 身体中心分数)，身体中心 = 主体每行中心平均
 * ════════════════════════════════════════════════════════════════ */
window.MEMBER_PLAY = {
  wjk:           { k: 161.3, l: 57.1 },
  wy:            { k: 165.4, l: 49.1 },
  yyqx:          { k: 173.9, l: 46.5 },
  mjq:           { k: 160.1, l: 52.8 },
  dcx:           { k: 160.2, l: 45.7 },
  syx:           { k: 160.1, l: 53.7 },
  lyw:           { k: 160.2, l: 55.5 },
  zzy:           { k: 165.5, l: 46.3 },
  yhx:           { k: 161.1, l: 46.7 },
  hjl:           { k: 160.3, l: 47.3 },
  zhuzhixin:     { k: 164.1, l: 51.2 },
  zhangzeyu:     { k: 209.5, l: 51.0 },
  zhangji:       { k: 203.7, l: 48.5 },
  zuohang:       { k: 207.2, l: 49.2 },
  suxinhao:      { k: 195.0, l: 46.4 },
  tongyukun:     { k: 198.2, l: 54.9 },
  chentianrun:   { k: 198.2, l: 49.8 },
  dengjiaxin:    { k: 174.8, l: 57.6 },
  muzhicheng:    { k: 187.3, l: 52.0 },
  huangshuo:     { k: 183.4, l: 55.6 },
  zhangzimo:     { k: 194.7, l: 51.1 },
  zhangjunhao:   { k: 205.6, l: 51.7 },
  yuyuhan:       { k: 196.4, l: 51.6 },
  guanjunchen:   { k: 138.8, l: 56.0 },
  zhangguiyuan:  { k: 142.6, l: 45.1 },
  zhanghanrui:   { k: 137.3, l: 53.9 },
  wanglujie:     { k: 142.1, l: 51.5 },
  wangshuoran:   { k: 139.3, l: 50.2 },
  zuoqihan:      { k: 138.3, l: 54.3 },
  chenyiheng:    { k: 143.8, l: 56.5 },
  yangbowen:     { k: 150.3, l: 52.0 },
  yanghanbo:     { k: 136.0, l: 51.0 },
  zhangyiran:    { k: 140.7, l: 47.8 },
  nieweichen:    { k: 154.0, l: 50.1 },
  chensihan:     { k: 150.3, l: 47.3 },
  weizichen:     { k: 139.6, l: 61.0 },
  liyudong:      { k: 133.1, l: 54.2 },
  chenjunming:   { k: 145.9, l: 41.1 },
};

// ==PLAY_BODY== 立绘实心身体在图中的左右缘比例(%图宽)，自动检测生成（排队贴边/槽0对齐用），勿手改
window.PLAY_BODY = {
  chenjunming: { L: 1.000, R: 99.286 },
  chensihan: { L: 0.857, R: 99.286 },
  chentianrun: { L: 13.714, R: 86.143 },
  chenyiheng: { L: 9.286, R: 90.714 },
  dcx: { L: 10.143, R: 89.429 },
  dengjiaxin: { L: 13.571, R: 86.143 },
  guanjunchen: { L: 5.143, R: 95.000 },
  hjl: { L: 7.714, R: 91.714 },
  huangshuo: { L: 13.571, R: 86.143 },
  liyudong: { L: 1.571, R: 99.000 },
  lyw: { L: 17.571, R: 82.857 },
  mjq: { L: 8.857, R: 91.429 },
  muzhicheng: { L: 13.571, R: 86.143 },
  nieweichen: { L: 0.857, R: 99.143 },
  suxinhao: { L: 14.571, R: 85.143 },
  syx: { L: 10.571, R: 89.714 },
  tongyukun: { L: 13.571, R: 86.286 },
  wanglujie: { L: 0.857, R: 99.286 },
  wangshuoran: { L: 14.714, R: 85.286 },
  weizichen: { L: 1.714, R: 98.286 },
  wjk: { L: 10.143, R: 90.286 },
  wy: { L: 12.571, R: 87.571 },
  yangbowen: { L: 0.857, R: 99.286 },
  yanghanbo: { L: 1.429, R: 98.714 },
  yhx: { L: 8.714, R: 91.000 },
  yuyuhan: { L: 13.714, R: 85.857 },
  yyqx: { L: 3.857, R: 96.143 },
  zhangguiyuan: { L: 0.714, R: 99.286 },
  zhanghanrui: { L: 9.143, R: 91.000 },
  zhangji: { L: 14.571, R: 85.143 },
  zhangjunhao: { L: 13.714, R: 85.857 },
  zhangyiran: { L: 8.571, R: 91.429 },
  zhangzeyu: { L: 14.571, R: 85.143 },
  zhangzimo: { L: 13.429, R: 86.143 },
  zhuzhixin: { L: 14.286, R: 85.286 },
  zuohang: { L: 14.429, R: 85.286 },
  zuoqihan: { L: 4.571, R: 95.714 },
  zzy: { L: 8.857, R: 91.143 },
};
