/* ================================================================
 * TF家族模拟签售 — 游戏逻辑
 * 状态机/手势/阈值参考 hap Inc.「Theサイン会」；同人娱乐，禁止商用。
 * ================================================================ */
(() => {
'use strict';

/* ---------- 常量 ---------- */
const DURATIONS = [30, 40, 50, 60, Infinity];   // 秒；最后一档 = 无限时间
const BEST_KEY = 'tf-signing-best';
const PEN_WIDTH = 10;
const INK_COLOR = '#242a2c';
const ENTER_MS = 600;         // 开局整队入场动画时长
const DELIVER_MS = 390;       // 交付反馈时长（快照弹出）
const STEP_MS = 240;          // 队列前移一步动画时长
const TICK_MS = 250;          // 倒计时步进间隔
const LEAVE_REMOVE_MS = 260;  // 离场成员移出 DOM 延时
const FINAL_DELAY = 700;      // 签完最后一人后的结算延时（> LEAVE_REMOVE_MS）
const FINALIZE_MS = 1600;     // 结算兜底延时（> DELIVER_MS + STEP_MS）
const QUEUE_SLOTS = 5;        // 同屏排队人数：当前 1 人 + 左侧等候 4 人
const SWIPE_MIN = 48;       // 上滑最小距离 px
const SWIPE_RATIO = 0.65;   // dy 必须大于 dx × 该值才算上滑
const TRAVEL_MAX = 180;     // 纸张最大跟手上移距离
const TRAVEL_SCALE = 0.65;  // 纸张最大缩小比例
const TRAVEL_DX = 0.15;     // 横向跟手系数
const TRAVEL_ROT = 0.08;    // 横向旋转系数

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const views = {
  select: $('view-select'),
  play: $('view-play'),
  result: $('view-result'),
};
const canvas = $('ink');
const ctx = canvas.getContext('2d');
const paper = $('paper-wrap');
const handle = $('handle');
const gift = $('gift');

/* ---------- 状态 ---------- */
let view = 'select';
let durationIndex = DURATIONS.length - 1;   // 默认无限时间
let phase = 'idle';   // idle | enter | wait | play | deliver | ending
let selected = [];
let queue = [];
let queueIndex = 0;
let count = 0;
let currentMemberId = null;
let deadline = 0;
let timerStarted = false;
let startedAt = 0;
let elapsed = 0;
let records = [];     // [{ memberId, signatureDataURL }] 快照绑交付记录
let best = 0;
let gesture = null;
let sending = false;
let finalized = false;
let generating = false;
let resultFile = null;
let resultImageUrl = '';
const pending = new Set();

const MEMBERS = window.MEMBERS || [];
const MEMBER_GROUPS = window.MEMBER_GROUPS || [];
try { best = Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); } catch (e) {}

const isEndless = () => !Number.isFinite(DURATIONS[durationIndex]);
const durationMs = () => DURATIONS[durationIndex] * 1000;
const memberById = id => MEMBERS.find(m => m.id === id) || null;
const groupById = id => MEMBER_GROUPS.find(g => g.id === id) || null;
const later = (fn, delay) => {
  const id = setTimeout(() => { pending.delete(id); fn(); }, delay);
  pending.add(id);
};
const clearPending = () => { pending.forEach(clearTimeout); pending.clear(); };
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 成员图片（真图 / 占位兜底） ---------- */
function placeholderURI(member) {
  const color = (groupById(member.group) || {}).color || '#8a8a8a';
  const name = member.name || '?';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">'
    + '<rect width="300" height="450" fill="' + color + '"/>'
    + '<circle cx="150" cy="138" r="70" fill="#efe9da"/>'
    + '<path d="M20 450 Q150 205 280 450 Z" fill="#d8d0bd"/>'
    + '<text x="150" y="162" font-size="70" text-anchor="middle" fill="#6b6355" font-family="sans-serif">'
    + esc(name.slice(0, 1)) + '</text>'
    + '<text x="150" y="425" font-size="26" text-anchor="middle" fill="#ffffff" opacity="0.92" font-family="sans-serif">'
    + esc(name) + '</text>'
    + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const ASSET_VERSION = '20261110h';  // 素材更新后改这个数字：强制浏览器刷新缓存
function memberSrc(member) {
  const p = member.img || 'assets/members/' + member.id + '.png';
  return p.indexOf('?') >= 0 ? p : p + '?v=' + ASSET_VERSION;
}
/* 给 DOM img 绑定成员图：真图失败则回退占位 */
function attachMemberImg(imgEl, member) {
  imgEl.addEventListener('error', function onErr() {
    imgEl.removeEventListener('error', onErr);
    imgEl.src = placeholderURI(member);
  });
  imgEl.src = memberSrc(member);
}
/* 按成员裁切参数定位头像 img：脸在圆内大小一致、居中（真图失败回退占位时撤掉） */
function applyAvatarCrop(imgEl, member) {
  const crop = (window.AVATAR_CROP || {})[member.id];
  if (!crop) return;
  imgEl.style.width = (crop.z * 100) + '%';
  imgEl.style.top = (-crop.t * 100) + '%';
  if (crop.x) imgEl.style.left = 'calc(50% + ' + crop.x + '%)';   // 水平补偿：照片里脸不居中
  imgEl.addEventListener('error', function onErr() {
    imgEl.removeEventListener('error', onErr);
    imgEl.style.width = '';
    imgEl.style.top = '';
    imgEl.style.left = '';
  });
}
/* 签售页立绘定位（2026-11-10 终版，用户拍板：排队强硬贴左缘、被签售者固定居中）：
   身体位置用 PLAY_BODY 实测数据（L/R = 身体在图中的左右缘比例）计算，不依赖 l/k 反推。
   k=宽度倍数；img 中心锚点 left%（盒宽%）。
   排队槽 1–4：left 使身体左缘恒贴屏幕左缘（QUEUE_BOX_LEFT 与 style.css 槽位 transform 一致）；
   层次靠 CSS translateY(-13/-23/-32/-40px)+scale(.86/.73/.63/.54)+z-index。
   槽 0：盒由 CSS 固定在屏幕中央；left 使身体中心=盒中心（=屏幕中心）。 */
const QUEUE_BOX_LEFT = { 1: -10, 2: -32, 3: -54, 4: -76 };
function applyPlayShift(imgEl, member, slot) {
  const shift = (window.MEMBER_PLAY || {})[member.id];
  if (!shift) return;
  if (shift.k) imgEl.style.width = shift.k + '%';
  const body = (window.PLAY_BODY || {})[member.id];
  if (body && shift.k) {
    const leftPct = slot === 0
      ? shift.k / 2 + 50 - (body.L + body.R) * shift.k / 200   // 身体中心=盒中心（屏幕中央）
      : shift.k / 2 - body.L * shift.k / 100 - QUEUE_BOX_LEFT[slot];  // 身体左缘=屏幕左缘
    imgEl.style.left = leftPct + '%';
  } else if (shift.l !== undefined) {
    imgEl.style.left = shift.l + '%';
  }
}
/* 供分享合成使用：等待图片真正加载完成（含占位回退） */
const imgCache = new Map();   // memberId -> Promise<Image>
function loadMemberImage(member) {
  if (!imgCache.has(member.id)) {
    imgCache.set(member.id, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { img.onerror = null; img.src = placeholderURI(member); };
      img.src = memberSrc(member);
    }));
  }
  return imgCache.get(member.id);
}
function loadDataURLImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

/* ---------- 视图切换 ---------- */
function showView(name) {
  view = name;
  Object.keys(views).forEach(k => { views[k].hidden = k !== name; });
  if (name === 'result') window.scrollTo(0, 0);
}

/* ════════════ 视图 1：选人 ════════════ */
function renderGroupChips() {
  const box = $('group-chips');
  box.replaceChildren();
  MEMBER_GROUPS.forEach(g => {
    const ids = MEMBERS.filter(m => m.group === g.id).map(m => m.id);
    if (!ids.length) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'group-chip';
    chip.dataset.group = g.id;
    chip.style.setProperty('--gc', g.color);
    chip.textContent = g.name;
    chip.addEventListener('click', () => {
      const allOn = ids.every(id => selected.includes(id));
      if (allOn) setSelected(selected.filter(id => !ids.includes(id)));
      else setSelected([...selected, ...ids.filter(id => !selected.includes(id))]);
    });
    box.append(chip);
  });
}
function setSelected(list) {
  selected = [...new Set(list)];
  refreshSelectUI();
}
function refreshSelectUI() {
  $('selected-count').textContent = String(selected.length);
  $('btn-start').disabled = selected.length === 0;
  document.querySelectorAll('.group-chip').forEach(chip => {
    const ids = MEMBERS.filter(m => m.group === chip.dataset.group).map(m => m.id);
    const n = ids.filter(id => selected.includes(id)).length;
    chip.classList.toggle('on', n > 0);
    chip.classList.toggle('full', n === ids.length);
  });
}
function updateDurationLabel() {
  const v = DURATIONS[durationIndex];
  $('duration-label').textContent = Number.isFinite(v) ? v + ' 秒' : '∞ 无限时间';
}
function setMode(m) {
  $('mode-group').classList.toggle('active', m === 'group');
  $('mode-shuffle').classList.toggle('active', m === 'shuffle');
  $('mode-group').setAttribute('aria-selected', String(m === 'group'));
  $('mode-shuffle').setAttribute('aria-selected', String(m === 'shuffle'));
  $('group-chips').hidden = m !== 'group';
}

/* ════════════ 时间 ════════════ */
function showRemainingTime(remainingMs) {
  $('time-num').textContent = String(Math.max(0, Math.ceil(remainingMs / 1000)));
  $('time-pill').classList.toggle('urgent', remainingMs <= 5000);
}
/* 倒计时：250ms 步进全程运行（不限于 play 阶段）。
   用 setTimeout 而非 rAF：后台节流/低电量模式下也能准点发现归零 */
function tick() {
  if (isEndless() || !timerStarted || finalized || phase === 'ending') return;
  const remaining = Math.max(0, deadline - performance.now());
  showRemainingTime(remaining);
  if (remaining <= 0) { finish(); return; }
  later(tick, TICK_MS);
}
/* wait → play：首笔落纸或首次滑纸时启动计时（原版同款时序） */
function beginPlay() {
  if (phase !== 'wait') return;
  phase = 'play';
  if (!isEndless() && !timerStarted) {
    timerStarted = true;
    deadline = performance.now() + durationMs();
    tick();
  }
}
/* 归零统一检查入口：链条定时器 / tick / 回前台 三处调用 */
function deadlineCheck() {
  if (isEndless() || !timerStarted) return;
  if (['enter', 'wait', 'play', 'deliver'].indexOf(phase) < 0) return;
  if (performance.now() >= deadline) finish();
}

/* ════════════ 页 2：成员与阶段 ════════════ */
function setPhase(next) {
  phase = next;
  handle.disabled = !(next === 'wait' || next === 'play');
}
function playFanVoice(memberId) {
  /* 预留：音效/语音素材到位后实现 */
}

/* 排队系统（原版 resetFans/advanceFans 同款）：
   槽 0 = 正在签的成员；槽 1–4 = 左侧排队等候的半身立绘 */
function makeQueueMember(memberId, slot) {
  const el = document.createElement('div');
  el.className = 'member';
  el.dataset.slot = String(slot);
  el.dataset.memberId = memberId;
  const member = memberById(memberId);
  const img = document.createElement('img');
  img.alt = member ? member.name : '';
  img.draggable = false;
  if (member) { attachMemberImg(img, member); applyPlayShift(img, member, slot); }
  el.append(img);
  return el;
}
function resetQueue() {
  const box = $('member-queue');
  box.replaceChildren();
  for (let i = 0; i < QUEUE_SLOTS; i++) {
    if (queueIndex + i >= queue.length) break;
    box.append(makeQueueMember(queue[queueIndex + i], i));
  }
  currentMemberId = queue[queueIndex] || null;
  box.classList.remove('entering');
  void box.offsetWidth;   // 强制重排，保证每局入场动画都触发
  box.classList.add('entering');
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('entering')));
  if (queueIndex + QUEUE_SLOTS < queue.length) {
    loadMemberImage(memberById(queue[queueIndex + QUEUE_SLOTS]));   // 预载下一批
  }
}
/* 当前成员向右滑出、全队前移一步、队尾补新人 */
function advanceQueue() {
  const box = $('member-queue');
  const fans = [...box.children];
  const leaving = fans[0];
  if (leaving) {
    leaving.classList.add('leaving');
    leaving.dataset.slot = '9';   // 退出槽位选择器，离场中不再匹配槽位样式
    later(() => leaving.remove(), LEAVE_REMOVE_MS);
  }
  fans.slice(1).forEach((el, i) => {
    el.dataset.slot = String(i);
    const img = el.querySelector('img');
    const m = memberById(el.dataset.memberId);
    if (img && m) applyPlayShift(img, m, i);   // 槽位前移：排队贴边 ↔ 槽0 贴槽1 语义切换
  });
  queueIndex++;
  const farIndex = queueIndex + fans.length - 1;
  if (farIndex < queue.length) {
    box.append(makeQueueMember(queue[farIndex], fans.length - 1));
    if (farIndex + 1 < queue.length) {
      loadMemberImage(memberById(queue[farIndex + 1]));   // 预载下下一位
    }
  }
  currentMemberId = queue[queueIndex] || null;
}

/* ════════════ 画布 ════════════ */
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) / r.width * canvas.width)),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) / r.height * canvas.height)),
  };
}
function clearPaper() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function releaseGesture() {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  if (g.target.hasPointerCapture(g.id)) g.target.releasePointerCapture(g.id);
}
function resetPaperTransform() {
  paper.classList.add('returning');
  paper.style.transform = '';
  later(() => paper.classList.remove('returning'), 170);
}

canvas.addEventListener('pointerdown', e => {
  if (phase !== 'wait' && phase !== 'play') return;
  if (gesture || !e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  beginPlay();
  canvas.setPointerCapture(e.pointerId);
  gesture = { type: 'draw', id: e.pointerId, target: canvas, last: point(e) };
  ctx.fillStyle = INK_COLOR;
  ctx.beginPath();
  ctx.arc(gesture.last.x, gesture.last.y, PEN_WIDTH / 2, 0, Math.PI * 2);
  ctx.fill();
  playFanVoice(currentMemberId);
});
function draw(e) {
  if (!gesture || gesture.type !== 'draw' || gesture.id !== e.pointerId) return;
  if (phase !== 'wait' && phase !== 'play') return;
  e.preventDefault();
  const samples = e.getCoalescedEvents ? (e.getCoalescedEvents() || [e]) : [e];
  for (const s of (samples.length ? samples : [e])) {
    const next = point(s);
    const last = gesture.last;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = PEN_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    gesture.last = next;
  }
}
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', e => {
  if (!gesture || gesture.id !== e.pointerId) return;
  draw(e);
  releaseGesture();
});
function cancelPointer(e) {
  if (!gesture || gesture.id !== e.pointerId) return;
  const wasSend = gesture.type === 'send';
  releaseGesture();
  if (wasSend) resetPaperTransform();
}
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);

/* ════════════ 滑纸交付 ════════════ */
handle.addEventListener('pointerdown', e => {
  if (phase !== 'wait' && phase !== 'play') return;
  if (gesture || !e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  beginPlay();
  handle.setPointerCapture(e.pointerId);
  paper.classList.remove('returning');
  gesture = { type: 'send', id: e.pointerId, target: handle, x: e.clientX, y: e.clientY };
});
handle.addEventListener('pointermove', e => {
  if (!gesture || gesture.type !== 'send' || gesture.id !== e.pointerId) return;
  if (phase !== 'wait' && phase !== 'play') return;
  e.preventDefault();
  const dy = Math.min(0, e.clientY - gesture.y);
  const dx = (e.clientX - gesture.x) * TRAVEL_DX;
  const travel = Math.min(TRAVEL_MAX, -dy);
  const scale = 1 - (travel / TRAVEL_MAX) * TRAVEL_SCALE;
  paper.style.transform = 'translate(' + dx + 'px,' + (-travel) + 'px) rotate('
    + (dx * TRAVEL_ROT) + 'deg) scale(' + scale + ')';
});
handle.addEventListener('pointerup', e => {
  if (!gesture || gesture.type !== 'send' || gesture.id !== e.pointerId) return;
  const dy = gesture.y - e.clientY;
  const dx = Math.abs(gesture.x - e.clientX);
  releaseGesture();
  if (dy >= SWIPE_MIN && dy > dx * SWIPE_RATIO) send();
  else resetPaperTransform();
});
handle.addEventListener('pointercancel', cancelPointer);
handle.addEventListener('lostpointercapture', cancelPointer);
handle.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!gesture) send();
  }
});

function send() {
  if (phase !== 'play' || sending) return;
  sending = true;
  count++;
  const dataURL = canvas.toDataURL('image/png');   // ★ 快照必须先于清空画布
  records.push({ memberId: currentMemberId, signatureDataURL: dataURL });
  $('play-count').textContent = String(count);
  const counter = $('count-wrap');
  counter.classList.remove('pop');
  void counter.offsetWidth;
  counter.classList.add('pop');
  setPhase('deliver');
  gift.style.backgroundImage = 'url(' + dataURL + ')';
  later(() => gift.classList.add('show'), 150);
  paper.classList.remove('returning');
  paper.style.transform = '';
  paper.classList.add('sending');
  playFanVoice(currentMemberId);

  later(() => {
    deadlineCheck();
    gift.classList.remove('show');
    clearPaper();
    paper.classList.remove('sending');
    paper.className = 'paper-wrap';
    paper.style.transform = '';
    advanceQueue();                    // 当前成员右滑、全队前移一步
    sending = false;                   // 交付链条结束，允许下一次交付
    if (phase === 'deliver') {
      if (queueIndex >= queue.length) {
        setPhase('ending');
        later(finalize, FINAL_DELAY);  // 等最后一人滑出再结算
      } else {
        setPhase('enter');
        later(() => {
          deadlineCheck();
          if (phase === 'enter') setPhase('wait');
        }, STEP_MS);
      }
    }
  }, DELIVER_MS);
}

/* ════════════ 结束与结算 ════════════ */
function finish() {
  if (['enter', 'wait', 'play', 'deliver'].indexOf(phase) < 0) return;
  const prev = phase;
  setPhase('ending');
  releaseGesture();
  $('btn-end').disabled = true;
  if (!sending) {
    paper.classList.remove('sending');
    paper.className = 'paper-wrap';
    paper.style.transform = '';
    gift.classList.remove('show');
  }
  if (prev === 'wait' || prev === 'play') finalize();
  else later(finalize, FINALIZE_MS);   // 等交付/离场链条走完；兜底防后台节流
}
function finalize() {
  if (finalized) return;
  finalized = true;
  releaseGesture();
  if (isEndless()) elapsed = Math.max(0, performance.now() - startedAt);
  if (!isEndless()) {
    best = Math.max(best, count);
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
  }
  buildResult();
  showView('result');
}
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return m + '分' + (s % 60) + '秒';
  return s + '秒';
}
function buildResult() {
  const grid = $('result-grid');
  grid.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'result-empty';
    empty.textContent = '本次没有交付任何签名';
    grid.append(empty);
    $('btn-share').disabled = true;
  } else {
    $('btn-share').disabled = false;
    records.forEach(rec => {
      const member = memberById(rec.memberId) || { name: '未知', group: '' };
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = '<div class="avatar-wrap"><img alt="" draggable="false"></div>'
        + '<img class="sig" alt="" draggable="false">'
        + '<span class="result-name"></span>';
      const avatarImg = card.querySelector('.avatar-wrap img');
      attachMemberImg(avatarImg, member);
      applyAvatarCrop(avatarImg, member);
      card.querySelector('.sig').src = rec.signatureDataURL;
      card.querySelector('.sig').alt = member.name + ' 的签名';
      card.querySelector('.result-name').textContent = member.name;
      grid.append(card);
    });
  }
  $('result-sub').textContent = '今天你辛苦啦！';
}

/* ════════════ 分享合成（原生 canvas，无外部依赖） ════════════ */
async function generateShareImage() {
  if (generating || !records.length) return;
  generating = true;
  $('btn-share').disabled = true;
  try {
    const cols = records.length <= 4 ? 2 : 4;
    const gap = 24;
    const width = 1200;
    const cellWidth = (width - gap * (cols + 1)) / cols;
    const cellHeight = cellWidth / 1.15;
    const avatarSize = 76;
    const avatarGap = 12;
    const rowH = avatarSize + avatarGap + cellHeight;
    const headerH = 180;
    const rows = Math.max(1, Math.ceil(records.length / cols));
    const sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = Math.ceil(headerH + rows * rowH + gap * (rows - 1) + 60);
    const c = sheet.getContext('2d');
    c.fillStyle = '#f5efdf';
    c.fillRect(0, 0, sheet.width, sheet.height);
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#424a45';
    c.font = 'bold 48px sans-serif';
    c.fillText('TF家族签售 · ' + count + '人', width / 2, 106);

    const items = await Promise.all(records.map(async rec => {
      const member = memberById(rec.memberId) || { id: '', name: '未知', group: '' };
      const avatar = await loadMemberImage(member);
      const sig = await loadDataURLImage(rec.signatureDataURL);
      return { member, avatar, sig };
    }));

    // file:// 下本地图片可能污染画布：先逐张探测，再决定头像画法
    let tainted = false;
    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 10;
      const pc = probe.getContext('2d');
      for (const item of items) {
        pc.drawImage(item.avatar, 0, 0, 10, 10);
        pc.getImageData(0, 0, 1, 1);
      }
    } catch (e) { tainted = true; }

    items.forEach((item, i) => {
      const x = gap + (i % cols) * (cellWidth + gap);
      const y = headerH + Math.floor(i / cols) * (rowH + gap);
      // 圆形头像（卡片上方中央）
      const ax = x + cellWidth / 2;
      const ay = y + avatarSize / 2;
      c.save();
      c.beginPath();
      c.arc(ax, ay, avatarSize / 2, 0, Math.PI * 2);
      c.clip();
      if (tainted) {
        c.fillStyle = (groupById(item.member.group) || { color: '#8a8a8a' }).color;
        c.fillRect(ax - avatarSize / 2, ay - avatarSize / 2, avatarSize, avatarSize);
        c.fillStyle = '#fff';
        c.font = 'bold 34px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText((item.member.name || '?').slice(0, 1), ax, ay + 2);
      } else {
        /* 按成员裁切参数（与结算卡一致）：z 倍放大、上移 t×头像高 */
        const crop = (window.AVATAR_CROP || {})[item.member.id] || { z: 1.9, t: 0 };
        const iw = item.avatar.naturalWidth;
        const ih = item.avatar.naturalHeight;
        const drawW = avatarSize * crop.z;
        const drawH = drawW * ih / iw;
        c.drawImage(item.avatar, 0, 0, iw, ih,
          ax - drawW / 2 + (crop.x || 0) / 100 * avatarSize,
          ay - avatarSize / 2 - crop.t * avatarSize, drawW, drawH);
      }
      c.restore();
      // 签名卡
      const sy = y + avatarSize + avatarGap;
      c.fillStyle = '#cdb05d';
      c.fillRect(x, sy, cellWidth, cellHeight);
      c.fillStyle = '#fffefa';
      c.fillRect(x + 5, sy + 5, cellWidth - 10, cellHeight - 10);
      c.drawImage(item.sig, x + 5, sy + 5, cellWidth - 10, cellHeight - 10);
    });

    const blob = await new Promise(resolve => sheet.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob 失败');
    resultFile = new File([blob], 'TF签售-' + count + '人.png', { type: 'image/png' });
    if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    resultImageUrl = URL.createObjectURL(blob);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
      || ((navigator.maxTouchPoints || 0) > 1 && /Mac/i.test(navigator.platform || ''));
    if (isMobile && navigator.share && navigator.canShare
        && navigator.canShare({ files: [resultFile] })) {
      try {
        await navigator.share({ files: [resultFile], title: 'TF家族签售会' });
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          saveResultImage();
        }
      }
    } else {
      saveResultImage();
    }
  } catch (err) {
    console.error('分享图生成失败：', err);
    alert('分享图生成失败。若以本地文件方式打开，请改用本地服务器'
      + '（如 python -m http.server）或部署到线上后重试。');
  } finally {
    generating = false;
    $('btn-share').disabled = records.length === 0;
  }
}
function saveResultImage() {
  if (!resultImageUrl) return;
  const a = document.createElement('a');
  a.href = resultImageUrl;
  a.download = resultFile ? resultFile.name : 'TF签售.png';
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}
/* 轻提示（保存分享图后的引导） */
let toastTimer = 0;
function showToast(msg, ms) {
  const t = $('toast');
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2400);
}

/* ════════════ 开始 / 重置 ════════════ */
function startSession() {
  if (!selected.length || view !== 'select') return;
  queue = [...new Set(selected)];
  // 签售顺序一律随机（组选模式也只是决定"谁来"，出场顺序仍洗牌）
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
  }
  queueIndex = 0;
  count = 0;
  records = [];
  finalized = false;
  sending = false;
  elapsed = 0;
  timerStarted = false;
  startedAt = performance.now();
  phase = 'idle';
  clearPaper();
  paper.className = 'paper-wrap';
  paper.style.transform = '';
  gift.classList.remove('show');
  gift.style.backgroundImage = '';
  $('play-count').textContent = '0';
  $('btn-end').disabled = false;
  if (isEndless()) {
    $('time-pill').hidden = true;
  } else {
    $('time-pill').hidden = false;
    showRemainingTime(durationMs());
  }
  showView('play');
  resetQueue();
  setPhase('enter');
  later(() => {
    deadlineCheck();
    if (phase === 'enter') setPhase('wait');
  }, ENTER_MS);
}
function returnToSelect() {
  clearPending();
  releaseGesture();
  if (resultImageUrl) { URL.revokeObjectURL(resultImageUrl); resultImageUrl = ''; }
  resultFile = null;
  finalized = false;
  sending = false;
  generating = false;
  records = [];
  queue = [];
  queueIndex = 0;
  count = 0;
  selected = [];
  currentMemberId = null;
  timerStarted = false;
  elapsed = 0;
  deadline = 0;
  durationIndex = DURATIONS.length - 1;   // 重置回默认无限时间
  updateDurationLabel();
  phase = 'idle';
  clearPaper();
  paper.className = 'paper-wrap';
  paper.style.transform = '';
  gift.classList.remove('show');
  gift.style.backgroundImage = '';
  const box = $('member-queue');
  box.replaceChildren();
  box.classList.remove('entering');
  $('play-count').textContent = '0';
  $('btn-end').disabled = false;
  refreshSelectUI();
  showView('select');
}

/* ════════════ 事件绑定 ════════════ */
$('duration-toggle').addEventListener('click', () => {
  durationIndex = (durationIndex + 1) % DURATIONS.length;
  updateDurationLabel();
});
$('mode-group').addEventListener('click', () => setMode('group'));
$('mode-shuffle').addEventListener('click', () => {
  setMode('shuffle');
  setSelected(MEMBERS.map(m => m.id));   // 随机排队：直接默认全选
});
$('btn-start').addEventListener('click', startSession);
$('btn-end').addEventListener('click', () => {
  if (view === 'play') finish();
});
$('btn-again').addEventListener('click', returnToSelect);
$('btn-share').addEventListener('click', generateShareImage);
/* 小红书分享 = 直接唤起小红书 App（没装 App 时 iOS 停在原地 / Android 无反应，属正常） */
$('btn-xhs').addEventListener('click', () => { location.href = 'xhsdiscover://'; });

/* ════════════ 移动端防护（仅页 2 生效，页 1/3 保持正常滚动） ════════════ */
function preventNativeGesture(e) { if (e.cancelable) e.preventDefault(); }
for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick',
                    'contextmenu', 'selectstart']) {
  views.play.addEventListener(type, e => {
    if (view === 'play') preventNativeGesture(e);
  }, { passive: false });
}
for (const type of ['touchstart', 'touchmove']) {
  views.play.addEventListener(type, e => {
    if (view !== 'play') return;
    if (e.target && e.target.closest && e.target.closest('#btn-end')) return;
    preventNativeGesture(e);
  }, { passive: false });
}
/* 拦截游戏区外落下的第二根手指 */
for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'touchmove']) {
  document.addEventListener(type, e => {
    if (view !== 'play') return;
    if (type !== 'touchmove' || (e.touches && e.touches.length > 1)) {
      preventNativeGesture(e);
    }
  }, { passive: false });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseGesture();
    if (!sending) paper.style.transform = '';
  } else {
    deadlineCheck();
  }
});
window.addEventListener('blur', () => {
  releaseGesture();
  if (!sending) resetPaperTransform();
});

/* ════════════ 可选便签金边素材 ════════════ */
(function tryNoteFrame() {
  const img = new Image();
  img.onload = () => { $('note-frame').hidden = false; };
  img.src = 'assets/ui/note_frame.png';
})();

/* ════════════ 初始化 ════════════ */
if (!MEMBERS.length) {
  console.warn('members.js 为空或缺失：请检查 members.js 是否正常加载');
}
renderGroupChips();
updateDurationLabel();
refreshSelectUI();
setMode('group');
clearPaper();
showView('select');
})();
