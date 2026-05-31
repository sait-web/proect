/* app.js - Ритм (личное + корпоративное) */

// ========== ОБЩИЕ УТИЛИТЫ ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Тема
const themeToggle = $('#theme-toggle');
if (themeToggle) {
  const saved = localStorage.getItem('fb_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  themeToggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fb_theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

// Toast
function showToast(msg, isError = false) {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Конфетти
function fireConfetti() {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  cv.width = innerWidth;
  cv.height = innerHeight;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const particles = [];
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: cv.width / 2,
      y: cv.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16 - 5,
      c: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][Math.random() * 4 | 0],
      l: 90
    });
  }
  function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    particles.forEach(p => {
      if (p.l > 0) {
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
        p.l--;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 7, 7);
      }
    });
    alive ? requestAnimationFrame(loop) : cv.remove();
  }
  loop();
}

// Дата в YYYY-MM-DD
const getLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Импорт/экспорт (общий для личных данных)
const importBtn = $('#import-btn'), importInput = $('#import-input');
if (importBtn && importInput) {
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.app === "Ритм" || d.app === "FocusBoard") {
          if (d.tasks) localStorage.setItem('fb_tasks', JSON.stringify(d.tasks));
          if (d.calendarTasks) localStorage.setItem('fb_calTasks', JSON.stringify(d.calendarTasks));
          if (d.profile) localStorage.setItem('fb_profile', JSON.stringify(d.profile));
          showToast('✅ Восстановлено!');
          setTimeout(() => location.reload(), 800);
        } else showToast('❌ Неверный формат', true);
      } catch (err) { showToast('❌ Ошибка чтения', true); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// Авто-распределение задач (из первого сайта)
function autoDistributeTask(task, profile, calTasks) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateStr(today);
  const dp = task.deadline.split('-');
  const deadline = new Date(dp[0], dp[1] - 1, dp[2]);
  deadline.setHours(23, 59, 59, 999);
  if (deadline < today) return [];
  const diff = Math.abs(deadline - today);
  const daysUntil = Math.ceil(diff / 86400000) + 1;
  let remaining = task.totalH;
  const assignments = [], maxFocus = profile.maxFocus || 4, buffer = 0.5;
  const usedMap = new Map();
  calTasks.forEach(t => { if (t && t.date >= todayStr) usedMap.set(t.date, (usedMap.get(t.date) || 0) + t.hours); });
  for (let i = 0; i < daysUntil && remaining > 0.05; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const ds = getLocalDateStr(d);
    const used = usedMap.get(ds) || 0;
    let avail = Math.max(0, maxFocus - used - buffer);
    if (avail <= 0) continue;
    let freeDays = 0;
    for (let j = i; j < daysUntil; j++) {
      const fd = new Date(today); fd.setDate(fd.getDate() + j);
      if ((maxFocus - (usedMap.get(getLocalDateStr(fd)) || 0) - buffer) > 0) freeDays++;
    }
    if (freeDays === 0) break;
    let ideal = remaining / freeDays, assign = Math.min(avail, Math.round(ideal * 2) / 2);
    if (Math.random() > 0.6 && assign + 0.25 <= avail) assign += 0.25;
    else if (Math.random() > 0.6 && assign - 0.25 >= 0.5) assign -= 0.25;
    assignments.push({ id: task.id, title: task.title, date: ds, hours: assign });
    remaining -= assign;
    usedMap.set(ds, used + assign);
  }
  if (remaining > 0.05 && assignments.length) assignments[assignments.length - 1].hours += remaining;
  return assignments;
}

// ========== МОДУЛЬ ГЛАВНОЙ СТРАНИЦЫ ==========
function initHome() {
  const heroCanvas = $('#hero-canvas');
  if (!heroCanvas) return;
  // Печатный заголовок
  const heroTitle = $('#hero-title');
  if (heroTitle) {
    const txt = heroTitle.textContent;
    heroTitle.textContent = '';
    let i = 0;
    function type() {
      if (i < txt.length) {
        heroTitle.textContent += txt.charAt(i++);
        setTimeout(type, 35 + Math.random() * 25);
      }
    }
    type();
  }
  // Анимация частиц
  const ctx = heroCanvas.getContext('2d');
  let w, h;
  const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * (w = heroCanvas.offsetWidth),
    y: Math.random() * (h = heroCanvas.offsetHeight),
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
    s: Math.random() * 2.5 + 1,
    a: Math.random() * 0.35 + 0.1
  }));
  let mx = w / 2, my = h / 2;
  function resize() {
    w = heroCanvas.width = heroCanvas.offsetWidth;
    h = heroCanvas.height = heroCanvas.offsetHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      particles.forEach(p => { p.vx += (Math.random() - 0.5) * 10; p.vy += (Math.random() - 0.5) * 10; });
    }
  });
  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (Math.abs(mx - p.x) < 100) p.vx -= (mx - p.x) * 0.002;
      if (Math.abs(my - p.y) < 100) p.vy -= (my - p.y) * 0.002;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDark ? `rgba(96,165,250,${p.a})` : `rgba(59,130,246,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();

  // Анимация метрик (из второго сайта)
  const metricsSection = $('#metrics');
  if (metricsSection) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          $$('.stat-value[data-target]').forEach(el => {
            const target = parseInt(el.dataset.target);
            let current = 0;
            const step = () => {
              current += Math.ceil(target / 50);
              if (current >= target) el.textContent = target;
              else { el.textContent = current; requestAnimationFrame(step); }
            };
            requestAnimationFrame(step);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    observer.observe(metricsSection);
  }
}

// ========== МОДУЛЬ МЕТОДА (кольца, 3D карточки) ==========
function initMethod() {
  const ringsWrapper = $('#rings-wrapper');
  if (ringsWrapper) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const animateRing = (id, percent) => {
            const val = $(`#${id}`);
            if (val) val.textContent = percent + '%';
            const circ = $(`#ring-${id.split('-')[1]}`);
            if (circ) circ.style.strokeDashoffset = 314 - (314 * percent / 100);
          };
          animateRing('val-low', 45);
          animateRing('val-med', 60);
          animateRing('val-high', 85);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(ringsWrapper);
  }
  $$('.card-3d').forEach(el => {
    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
    });
    el.addEventListener('mouseleave', () => el.style.transform = 'perspective(800px) rotateY(0) rotateX(0)');
  });
}

// ========== МОДУЛЬ ДОСКИ (ЛИЧНОЙ) ==========
function initBoard() {
  let tasks = JSON.parse(localStorage.getItem('fb_tasks')) || [];
  let calTasks = JSON.parse(localStorage.getItem('fb_calTasks')) || [];
  const profile = JSON.parse(localStorage.getItem('fb_profile')) || { maxFocus: 4 };
  const saveTasks = () => localStorage.setItem('fb_tasks', JSON.stringify(tasks));
  const saveCal = () => localStorage.setItem('fb_calTasks', JSON.stringify(calTasks));
  const updateCounts = () => {
    ['low', 'med', 'high', 'done'].forEach(c => {
      const count = tasks.filter(t => t.col === c || (!t.col && t.energy === c && c !== 'done')).length;
      const el = $(`#count-${c}`);
      if (el) { el.textContent = count; el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 300); }
    });
  };
  const renderBoard = (search = '') => {
    ['low', 'med', 'high', 'done'].forEach(column => {
      const list = $(`#list-${column}`);
      if (!list) return;
      list.innerHTML = '';
      tasks.forEach(task => {
        const taskColumn = task.col || (column !== 'done' && task.energy);
        if (taskColumn === column && (!search || task.title.toLowerCase().includes(search.toLowerCase()))) {
          const card = document.createElement('div');
          card.className = `task-card ${column === 'done' ? 'done' : ''}`;
          card.draggable = true;
          card.dataset.id = task.id;
          card.dataset.energy = task.energy;
          let planHtml = '';
          if (task.plan && task.plan.length) {
            const doneSteps = task.plan.filter(p => p.done).length;
            const pct = (doneSteps / task.plan.length) * 100;
            planHtml = `<div class="task-plan-bar"><div class="task-plan-fill ${pct === 100 ? 'complete' : ''}" style="width: ${pct}%"></div></div>`;
          }
          card.innerHTML = `<button class="task-open-btn">👁</button><h4>${task.title}</h4><div class="meta"><span>⏱️ ${task.totalH}ч | 📅 ${task.deadline}</span></div><button class="delete-btn">&times;</button>${planHtml}`;
          list.appendChild(card);
        }
      });
    });
    updateCounts();
  };
  const searchInput = $('#task-search');
  if (searchInput) searchInput.addEventListener('input', e => renderBoard(e.target.value));

  // Drag & drop
  $$('.column').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.col = col.dataset.col;
        if (col.dataset.col === 'done') {
          calTasks = calTasks.filter(ct => ct.id !== id);
          task.completedAt = getLocalDateStr(new Date());
          fireConfetti();
        }
        saveTasks();
        saveCal();
        renderBoard(searchInput?.value);
      }
    });
  });
  document.addEventListener('dragstart', e => {
    if (e.target.classList.contains('task-card')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.id);
      e.target.classList.add('dragging');
    }
  });
  document.addEventListener('dragend', e => e.target.classList.remove('dragging'));

  // Обработка кликов (удаление, открытие деталей)
  document.addEventListener('click', e => {
    if (e.target.classList.contains('delete-btn')) {
      const id = e.target.closest('.task-card').dataset.id;
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderBoard(searchInput?.value);
      return;
    }
    if (e.target.classList.contains('task-open-btn')) {
      const card = e.target.closest('.task-card');
      const task = tasks.find(t => t.id === card.dataset.id);
      if (!task) return;
      const modal = $('#task-detail-modal');
      $('#detail-title').textContent = task.title;
      const energyMap = { low: '🔋', med: '⚡', high: '🔥' };
      $('#detail-meta').textContent = `⏱️ ${task.totalH}ч | 📅 ${task.deadline} | ${energyMap[task.energy]} ${task.energy}`;
      const planSection = $('#detail-plan-section');
      const planList = $('#detail-plan-list');
      if (task.plan && task.plan.length) {
        planSection.style.display = 'block';
        planList.innerHTML = '';
        task.plan.forEach((step, idx) => {
          const li = document.createElement('li');
          li.className = `plan-check-item ${step.done ? 'checked' : ''}`;
          li.innerHTML = `<div class="plan-checkbox">${step.done ? '✓' : ''}</div><div class="plan-step-text">${step.text}</div>`;
          li.addEventListener('click', () => {
            task.plan[idx].done = !task.plan[idx].done;
            saveTasks();
            li.classList.toggle('checked');
            li.querySelector('.plan-checkbox').textContent = task.plan[idx].done ? '✓' : '';
            const cardDom = document.querySelector(`.task-card[data-id="${task.id}"]`);
            if (cardDom) {
              const doneSteps = task.plan.filter(p => p.done).length;
              const pct = (doneSteps / task.plan.length) * 100;
              const fill = cardDom.querySelector('.task-plan-fill');
              if (fill) fill.style.width = `${pct}%`;
            }
          });
          planList.appendChild(li);
        });
      } else planSection.style.display = 'none';
      modal.classList.add('open');
    }
  });

  // Модалки быстрой задачи и с планом
  const quickModal = $('#add-task-modal');
  const openQuick = $('#open-task-btn');
  if (openQuick && quickModal) {
    openQuick.addEventListener('click', () => quickModal.classList.add('open'));
    quickModal.querySelector('.modal-close').addEventListener('click', () => quickModal.classList.remove('open'));
    quickModal.addEventListener('click', e => { if (e.target === quickModal) quickModal.classList.remove('open'); });
    $('#manual-task-form').addEventListener('submit', e => {
      e.preventDefault();
      const newTask = {
        id: Date.now().toString(),
        title: $('#m-title').value,
        energy: $('#m-energy').value,
        totalH: parseInt($('#m-hours').value),
        deadline: $('#m-deadline').value,
        col: $('#m-energy').value,
        plan: []
      };
      tasks.push(newTask);
      const assignments = autoDistributeTask(newTask, profile, calTasks);
      calTasks.push(...assignments);
      saveTasks(); saveCal();
      renderBoard(searchInput?.value);
      fireConfetti();
      quickModal.classList.remove('open');
      $('#manual-task-form').reset();
      showToast(`✅ Задача создана на ${assignments.length} дней`);
    });
  }

  const planModal = $('#add-plan-modal');
  const openPlan = $('#open-plan-btn');
  let planStepCounter = 0;
  function addPlanStep(placeholder = '') {
    const container = $('#plan-steps-container');
    const div = document.createElement('div');
    div.className = 'form-group plan-step-group';
    div.style.marginBottom = '0.8rem';
    div.innerHTML = `<div style="display:flex;gap:8px;"><input type="text" class="form-input plan-step-input" placeholder="${placeholder || 'Опиши шаг...'}" required style="flex:1;"><button type="button" class="icon-btn small remove-step-btn">✕</button></div>`;
    container.appendChild(div);
  }
  if (openPlan && planModal) {
    openPlan.addEventListener('click', () => {
      planModal.classList.add('open');
      $('#plan-steps-container').innerHTML = '';
      addPlanStep('🚀 Стартовый шаг');
      addPlanStep('🧱 Главный барьер');
      addPlanStep('⚡ Микро-действие');
    });
    planModal.querySelector('.modal-close').addEventListener('click', () => planModal.classList.remove('open'));
    planModal.addEventListener('click', e => { if (e.target === planModal) planModal.classList.remove('open'); });
    $('#add-plan-step-btn').addEventListener('click', () => addPlanStep());
    $('#plan-steps-container').addEventListener('click', e => {
      if (e.target.classList.contains('remove-step-btn')) e.target.closest('.plan-step-group').remove();
    });
    $('#plan-task-form').addEventListener('submit', e => {
      e.preventDefault();
      const steps = [...$$('.plan-step-input')].map(inp => ({ text: inp.value, done: false }));
      if (!steps.length) { showToast('Добавь хотя бы один шаг', true); return; }
      const newTask = {
        id: Date.now().toString(),
        title: $('#p-title').value,
        energy: $('#p-energy').value,
        totalH: parseInt($('#p-hours').value),
        deadline: $('#p-deadline').value,
        col: $('#p-energy').value,
        plan: steps
      };
      tasks.push(newTask);
      const assignments = autoDistributeTask(newTask, profile, calTasks);
      calTasks.push(...assignments);
      saveTasks(); saveCal();
      renderBoard(searchInput?.value);
      fireConfetti();
      planModal.classList.remove('open');
      $('#plan-task-form').reset();
      showToast(`✅ Задача с планом создана на ${assignments.length} дней`);
    });
  }

  const detailModal = $('#task-detail-modal');
  if (detailModal) {
    detailModal.querySelector('.modal-close').addEventListener('click', () => detailModal.classList.remove('open'));
    detailModal.addEventListener('click', e => { if (e.target === detailModal) detailModal.classList.remove('open'); });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      quickModal?.classList.remove('open');
      planModal?.classList.remove('open');
      detailModal?.classList.remove('open');
    }
  });
  renderBoard();
  // Мобильный режим (tap to move)
  const isMobile = window.matchMedia('(max-width:768px)').matches || 'ontouchstart' in window;
  if (isMobile) {
    let selectedCard = null;
    document.addEventListener('click', e => {
      const task = e.target.closest('.task-card');
      const column = e.target.closest('.column');
      if (task && !column) {
        e.stopPropagation();
        $$('.task-card').forEach(c => c.classList.remove('mobile-selected'));
        task.classList.add('mobile-selected');
        selectedCard = task;
      } else if (column && selectedCard) {
        const taskId = selectedCard.dataset.id;
        const newStatus = column.dataset.col;
        const taskObj = tasks.find(t => t.id === taskId);
        if (taskObj) {
          taskObj.col = newStatus;
          if (newStatus === 'done') {
            calTasks = calTasks.filter(ct => ct.id !== taskId);
            taskObj.completedAt = getLocalDateStr(new Date());
            fireConfetti();
          }
          saveTasks(); saveCal();
          renderBoard(searchInput?.value);
          selectedCard.classList.remove('mobile-selected');
          selectedCard = null;
        }
      } else if (!task && !column) {
        $$('.task-card').forEach(c => c.classList.remove('mobile-selected'));
        selectedCard = null;
      }
    });
  }
}

// ========== МОДУЛЬ КАЛЕНДАРЯ (и помодоро) ==========
function initCalendar() {
  const profileDefault = {
    sleep: '23:00', wake: '07:00', workS: '09:00', workE: '15:00',
    meal1: '08:00', meal2: '13:00', meal3: '19:00', breakEvery: 90, maxFocus: 4
  };
  let profile = { ...profileDefault, ...JSON.parse(localStorage.getItem('fb_profile') || '{}') };
  let calTasks = JSON.parse(localStorage.getItem('fb_calTasks')) || [];
  const todayStr = getLocalDateStr(new Date());
  let currentMonth = new Date();
  let currentTimeline = [], selectedDate = null, timelineCounter = 0;

  const saveCal = () => localStorage.setItem('fb_calTasks', JSON.stringify(calTasks));
  const saveProfile = () => localStorage.setItem('fb_profile', JSON.stringify(profile));

  const timeToMin = t => { if (!t) return 0; const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
  const minToTime = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  function generateTimeline(dateStr) {
    const wake = timeToMin(profile.wake), sleep = timeToMin(profile.sleep);
    if (wake >= sleep) return [];
    let cur = wake;
    const blocks = [];
    const addBlock = (type, title, duration, locked = false) => {
      const start = cur, end = start + duration * 60;
      blocks.push({ id: timelineCounter++, type, title, start, end, duration, locked });
      cur = end;
      return cur;
    };
    // Завтрак
    if (timeToMin(profile.meal1) > cur) cur = timeToMin(profile.meal1);
    addBlock('meal', '🍳 Завтрак', 0.5, true);
    cur = timeToMin(profile.meal1) + 30;
    if (timeToMin(profile.workS) > cur) cur = timeToMin(profile.workS);
    addBlock('blocked', '🏢 Работа/Учёба', (timeToMin(profile.workE) - timeToMin(profile.workS)) / 60, true);
    cur = timeToMin(profile.workE);
    if (cur < timeToMin(profile.meal2)) addBlock('meal', '🍽️ Обед', 1, true);
    cur = Math.max(cur, timeToMin(profile.meal2) + 60);
    if (cur < timeToMin(profile.meal3)) addBlock('meal', '🍲 Ужин', 1, true);
    cur = Math.max(cur, timeToMin(profile.meal3) + 60);
    const dayTasks = calTasks.filter(t => t && t.date === dateStr && t.hours > 0);
    let focusAcc = 0;
    for (let task of dayTasks) {
      let remain = task.hours;
      while (remain > 0 && cur < sleep) {
        let step = Math.min(remain, 2);
        if (focusAcc >= profile.breakEvery / 60) {
          addBlock('break', '☕ Перерыв', 0.25, true);
          focusAcc = 0;
        }
        addBlock('work', task.title, step);
        remain -= step;
        focusAcc += step;
      }
    }
    addBlock('sleep', '😴 Сон', (1440 - sleep) / 60, true);
    return blocks.filter(b => b.duration > 0 && b.end <= 1440);
  }

  function renderCalendar() {
    const grid = $('#calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const year = currentMonth.getFullYear(), month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = calTasks.filter(t => t && t.date === ds);
      const totalHours = dayTasks.reduce((s, t) => s + (t.hours || 0), 0);
      const cell = document.createElement('div');
      cell.className = `day-cell ${ds === todayStr ? 'today' : ''}`;
      cell.dataset.date = ds;
      cell.innerHTML = `<div class="day-num">${d}</div>${dayTasks.slice(0, 2).map(t => `<div class="task-chip ${t.hours > 2 ? 'chip-high' : t.hours > 1 ? 'chip-med' : 'chip-low'}">${t.title || 'Блок'} (${t.hours}ч)</div>`).join('')}${dayTasks.length > 2 ? `<div style="font-size:0.65rem;">+${dayTasks.length - 2}</div>` : ''}<div class="day-load">📊 ${totalHours.toFixed(1)}ч</div>`;
      grid.appendChild(cell);
    }
  }

  function updateTimelineUI() {
    const timelineDiv = $('#day-timeline');
    if (!timelineDiv) return;
    timelineDiv.innerHTML = '';
    currentTimeline.forEach(block => {
      const div = document.createElement('div');
      div.className = `timeline-block t-${block.type}`;
      div.dataset.id = block.id;
      div.innerHTML = `<div class="block-time">${minToTime(block.start)}-${minToTime(block.end)}</div><div class="block-info"><div class="block-title">${block.title}</div><div class="block-meta">${block.duration.toFixed(1)} ч${block.locked ? ' (авто)' : ''}</div><div class="edit-controls"><input class="edit-input short" type="number" step="0.25" min="0" value="${block.duration}" data-field="duration" ${block.locked ? 'disabled' : ''}><input class="edit-input title" type="text" value="${block.title}" data-field="title" ${block.locked ? 'disabled' : ''}><button class="btn-xs lock ${block.locked ? '' : 'unlocked'}" data-action="lock">${block.locked ? '🔓' : '🔒'}</button><button class="btn-xs del" data-action="del">🗑️</button></div></div>`;
      timelineDiv.appendChild(div);
    });
    const total = currentTimeline.reduce((s, b) => s + b.duration, 0);
    const summary = $('#day-summary');
    if (summary) {
      summary.textContent = `Итого: ${total.toFixed(1)}ч / 24ч | Свободно: ${Math.max(0, 24 - total).toFixed(1)}ч`;
      summary.className = `day-summary ${total > 24 ? 'warn' : ''}`;
    }
  }

  $('#calendar-grid')?.addEventListener('click', e => {
    const cell = e.target.closest('.day-cell');
    if (!cell) return;
    selectedDate = cell.dataset.date;
    timelineCounter = 0;
    currentTimeline = generateTimeline(selectedDate);
    updateTimelineUI();
    $('#panel-day-title').textContent = new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU');
    const area = $('#calendar-area');
    if (area) area.classList.add('panel-open');
  });
  $('#panel-close-btn')?.addEventListener('click', () => $('#calendar-area')?.classList.remove('panel-open'));

  $('#day-timeline')?.addEventListener('input', e => {
    if (e.target.matches('.edit-input')) {
      const id = parseInt(e.target.closest('.timeline-block').dataset.id);
      const block = currentTimeline.find(b => b.id === id);
      if (block) {
        if (e.target.dataset.field === 'duration') block.duration = parseFloat(e.target.value) || 0;
        if (e.target.dataset.field === 'title') block.title = e.target.value;
        updateTimelineUI();
      }
    }
  });
  $('#day-timeline')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-xs');
    if (!btn) return;
    const id = parseInt(btn.closest('.timeline-block').dataset.id);
    const block = currentTimeline.find(b => b.id === id);
    if (!block) return;
    if (btn.dataset.action === 'lock') {
      block.locked = !block.locked;
      btn.textContent = block.locked ? '' : '🔓';
      btn.classList.toggle('unlocked', !block.locked);
      const inputs = btn.closest('.edit-controls').querySelectorAll('input');
      inputs.forEach(i => i.disabled = block.locked);
    }
    if (btn.dataset.action === 'del') {
      currentTimeline = currentTimeline.filter(b => b.id !== id);
      updateTimelineUI();
    }
  });

  $('#save-day-btn')?.addEventListener('click', () => {
    calTasks = calTasks.filter(t => t.date !== selectedDate);
    currentTimeline.filter(b => b.type === 'work').forEach(b => {
      calTasks.push({ id: `manual-${selectedDate}-${b.title}`, title: b.title, date: selectedDate, hours: b.duration });
    });
    saveCal();
    renderCalendar();
    $('#calendar-area')?.classList.remove('panel-open');
    showToast('Сохранено');
  });
  $('#reset-day-btn')?.addEventListener('click', () => {
    timelineCounter = 0;
    currentTimeline = generateTimeline(selectedDate);
    updateTimelineUI();
  });

  // Навигация по месяцам
  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const minDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const maxDate = new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1);
  function updateMonthTitle() {
    $('#current-month-title').textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    $('#prev-month-btn').disabled = currentMonth <= minDate;
    $('#next-month-btn').disabled = currentMonth >= maxDate;
  }
  $('#prev-month-btn')?.addEventListener('click', () => {
    const newDate = new Date(currentMonth); newDate.setMonth(newDate.getMonth() - 1);
    if (newDate >= minDate) { currentMonth = newDate; renderCalendar(); updateMonthTitle(); }
  });
  $('#next-month-btn')?.addEventListener('click', () => {
    const newDate = new Date(currentMonth); newDate.setMonth(newDate.getMonth() + 1);
    if (newDate <= maxDate) { currentMonth = newDate; renderCalendar(); updateMonthTitle(); }
  });
  $('#current-month-title')?.addEventListener('click', () => $('#month-picker')?.classList.add('open'));
  $('#month-picker')?.addEventListener('click', e => { if (e.target === $('#month-picker')) $('#month-picker').classList.remove('open'); });
  function renderMonthPicker() {
    const year = currentMonth.getFullYear();
    $('#picker-year').textContent = year;
    const grid = $('#picker-grid');
    grid.innerHTML = '';
    monthNames.forEach((name, idx) => {
      const btn = document.createElement('div');
      btn.className = 'picker-month';
      btn.textContent = name;
      const testDate = new Date(year, idx, 1);
      if (testDate < minDate || testDate > maxDate) btn.classList.add('disabled');
      else {
        if (idx === currentMonth.getMonth() && year === currentMonth.getFullYear()) btn.classList.add('current');
        btn.addEventListener('click', () => {
          currentMonth = new Date(year, idx, 1);
          renderCalendar();
          updateMonthTitle();
          $('#month-picker').classList.remove('open');
        });
      }
      grid.appendChild(btn);
    });
  }
  $('#picker-grid') && renderMonthPicker();

  // Профиль
  $('#open-profile-btn')?.addEventListener('click', () => $('#profile-modal').classList.add('open'));
  $('#profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    profile.wake = $('#prof-wake').value;
    profile.sleep = $('#prof-sleep').value;
    profile.workS = $('#prof-work-s').value;
    profile.workE = $('#prof-work-e').value;
    profile.meal1 = $('#prof-meal1').value;
    profile.meal2 = $('#prof-meal2').value;
    profile.meal3 = $('#prof-meal3').value;
    profile.breakEvery = parseInt($('#prof-break').value);
    profile.maxFocus = parseInt($('#prof-max-focus').value);
    saveProfile();
    $('#profile-modal').classList.remove('open');
    renderCalendar();
    showToast('Профиль сохранён');
  });
  $('#move-today-btn')?.addEventListener('click', () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateStr(tomorrow);
    calTasks.forEach(t => { if (t && t.date === todayStr) t.date = tomorrowStr; });
    saveCal();
    renderCalendar();
    showToast('Задачи перенесены на завтра');
  });

  // Помодоро на странице календаря
  let pomoTime = 25 * 60, pomoInterval = null, isPomoRunning = false;
  function updatePomoDisplay() {
    const m = Math.floor(pomoTime / 60).toString().padStart(2, '0');
    const s = (pomoTime % 60).toString().padStart(2, '0');
    const el = $('#pomo-time');
    if (el) el.textContent = `${m}:${s}`;
  }
  function startPomo() { if (isPomoRunning) return; isPomoRunning = true; $('#pomo-toggle').textContent = '⏸'; pomoInterval = setInterval(() => { pomoTime--; updatePomoDisplay(); if (pomoTime <= 0) { clearInterval(pomoInterval); isPomoRunning = false; $('#pomo-toggle').textContent = '▶'; showToast('Время вышло!'); pomoTime = 5 * 60; updatePomoDisplay(); } }, 1000); }
  function pausePomo() { clearInterval(pomoInterval); isPomoRunning = false; $('#pomo-toggle').textContent = '▶'; }
  $('#pomo-toggle')?.addEventListener('click', () => isPomoRunning ? pausePomo() : startPomo());
  $$('.pomo-btn[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      pausePomo();
      pomoTime = parseInt(btn.dataset.time) * 60;
      updatePomoDisplay();
      $$('.pomo-btn[data-time]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.addEventListener('keydown', e => { if (e.code === 'Space' && !e.target.matches('input,select')) { e.preventDefault(); isPomoRunning ? pausePomo() : startPomo(); } });
  updatePomoDisplay();
  renderCalendar();
  updateMonthTitle();
}

// ========== МОДУЛЬ СТАТИСТИКИ ==========
function initStats() {
  const tasks = JSON.parse(localStorage.getItem('fb_tasks')) || [];
  const completed = tasks.filter(t => t.col === 'done' && t.completedAt);
  // Стрик
  const dates = [...new Set(completed.map(t => t.completedAt))].sort();
  let currentStreak = 0, maxStreak = 0, streak = 1;
  const today = getLocalDateStr(new Date());
  const yesterday = getLocalDateStr(new Date(Date.now() - 86400000));
  if (dates.includes(today) || dates.includes(yesterday)) {
    let cur = dates.includes(today) ? today : yesterday;
    let idx = dates.indexOf(cur);
    currentStreak = 1;
    while (idx < dates.length - 1) {
      const curDate = new Date(dates[idx] + 'T00:00:00');
      const nextDate = new Date(dates[idx + 1] + 'T00:00:00');
      if ((curDate - nextDate) / 86400000 === 1) { currentStreak++; idx++; } else break;
    }
  }
  for (let i = 0; i < dates.length - 1; i++) {
    const diff = (new Date(dates[i] + 'T00:00:00') - new Date(dates[i + 1] + 'T00:00:00')) / 86400000;
    if (diff === 1) streak++;
    else { maxStreak = Math.max(maxStreak, streak); streak = 1; }
  }
  maxStreak = Math.max(maxStreak, streak);
  $('#streak-value').textContent = currentStreak;
  $('#max-streak-value').textContent = maxStreak;
  const totalHours = completed.reduce((s, t) => s + (t.totalH || 0), 0);
  $('#total-hours-value').textContent = totalHours.toFixed(1) + 'ч';

  // Тепловая карта (3 месяца)
  const heatGrid = $('#heatmap-grid');
  const heatMonths = $('#heatmap-months');
  if (heatGrid && heatMonths) {
    heatGrid.innerHTML = '';
    heatMonths.innerHTML = '';
    const dayMap = {};
    completed.forEach(t => { if (t.completedAt && t.totalH) dayMap[t.completedAt] = (dayMap[t.completedAt] || 0) + t.totalH; });
    const endDate = new Date();
    const startDate = new Date(); startDate.setDate(startDate.getDate() - 90);
    let lastMonth = -1;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const str = getLocalDateStr(d);
      const hours = dayMap[str] || 0;
      const block = document.createElement('div');
      block.className = 'heatmap-block';
      if (hours >= 4) block.classList.add('level-4');
      else if (hours >= 2.5) block.classList.add('level-3');
      else if (hours >= 1) block.classList.add('level-2');
      else if (hours > 0) block.classList.add('level-1');
      else block.classList.add('empty');
      block.title = `${str}: ${hours.toFixed(1)}ч`;
      heatGrid.appendChild(block);
      if (d.getMonth() !== lastMonth) {
        const monthLabel = document.createElement('div');
        monthLabel.textContent = d.toLocaleDateString('ru-RU', { month: 'short' });
        heatMonths.appendChild(monthLabel);
        lastMonth = d.getMonth();
      }
    }
  }

  // Распределение энергии
  const energyBars = $('#energy-bars');
  if (energyBars) {
    const counts = { high: 0, med: 0, low: 0 };
    completed.forEach(t => { if (t.energy) counts[t.energy]++; });
    const total = completed.length || 1;
    const renderBar = (label, count, cls) => {
      const percent = (count / total) * 100;
      energyBars.innerHTML += `<div class="energy-bar-row"><div class="energy-label">${label}</div><div class="energy-track"><div class="energy-fill ${cls}" style="width: ${percent}%">${count > 0 ? count + ' задач' : ''}</div></div></div>`;
    };
    renderBar('🔥 Высокая', counts.high, 'fill-high');
    renderBar('⚡ Средняя', counts.med, 'fill-med');
    renderBar('🔋 Низкая', counts.low, 'fill-low');
  }

  // Базовый OKR-виджет (только отображение прогресса по корпоративным OKR)
  const okrList = $('#okr-list-stats');
  if (okrList) {
    let okrs = JSON.parse(localStorage.getItem('ritm_okr') || '[]');
    let tasksCorp = JSON.parse(localStorage.getItem('ritm_kanban') || '[]');
    function calcKrProgress(kr) {
      if (!kr.linkedTasks || !kr.linkedTasks.length) return 0;
      const done = kr.linkedTasks.filter(tid => tasksCorp.find(t => t.id === tid && t.status === 'done')).length;
      return Math.round((done / kr.linkedTasks.length) * 100);
    }
    function renderStatsOKR() {
      okrList.innerHTML = '';
      okrs.forEach(okr => {
        const okrDiv = document.createElement('div');
        okrDiv.className = 'okr-item';
        okrDiv.innerHTML = `<div class="okr-header"><div class="okr-title">🎯 ${okr.title}</div></div>`;
        okr.krs.forEach(kr => {
          const prog = calcKrProgress(kr);
          okrDiv.innerHTML += `<div class="kr-block"><div class="kr-text">${kr.text}</div><div class="okr-progress-track"><div class="okr-progress-fill" style="width: ${prog}%"></div></div><div style="font-size:0.8rem;">${prog}%</div></div>`;
        });
        okrList.appendChild(okrDiv);
      });
    }
    renderStatsOKR();
  }
}

// ========== КОРПОРАТИВНЫЙ МОДУЛЬ ==========
function initCorporate() {
  // Канвас фон
  const canvas = $('#corp-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, nodes = [];
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
    for (let i = 0; i < 15; i++) {
      nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: 12 });
    }
    let mouse = { x: -1000, y: -1000 };
    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    function draw() {
      ctx.clearRect(0, 0, w, h);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.strokeStyle = isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.5)';
      nodes.forEach((a, i) => {
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (d < 200) { a.vx += (mouse.x - a.x) * 0.0005; a.vy += (mouse.y - a.y) * 0.0005; }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 200) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.5)';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  // Мастер доступа (flow)
  let currentStep = 'step-0';
  let selectedPlan = 'business';
  let generatedCode = '';
  const flowContainer = $('#flow-container');
  const dashboardContainer = $('#dashboard-container');
  
  function showStep(stepId) {
    currentStep = stepId;
    $$('.flow-step').forEach(s => s.classList.remove('active'));
    $(`#${stepId}`)?.classList.add('active');
  }
  
  $$('.flow-back').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); showStep(e.target.dataset.target); }));
  $('#btn-create-org')?.addEventListener('click', () => showStep('step-create-1'));
  $('#btn-join-org')?.addEventListener('click', () => showStep('step-join-1'));
  
  document.addEventListener('keydown', e => {
    if (currentStep === 'step-0') {
      if (e.key === '1') $('#btn-create-org')?.click();
      if (e.key === '2') $('#btn-join-org')?.click();
    }
  });
  
  $$('.pricing-card').forEach(card => {
    card.addEventListener('click', () => {
      $$('.pricing-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPlan = card.dataset.plan;
    });
  });
  
  $$('.flow-next').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    const target = e.target.dataset.target;
    if (target === 'step-create-2' && !$('#input-org-name').value.trim()) { showToast('Введите название организации', true); return; }
    if (target === 'step-create-3') {
      generatedCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      $('#generated-code').textContent = generatedCode;
      localStorage.setItem('ritm_org_code', generatedCode);
      localStorage.setItem('ritm_org_name', $('#input-org-name').value.trim());
    }
    if (target === 'step-join-2' && !$('#input-user-name').value.trim()) { showToast('Введите ваше имя', true); return; }
    if (target === 'step-join-3') {
      const code = $('#input-join-code').value.trim();
      const savedCode = localStorage.getItem('ritm_org_code');
      if (!savedCode) { showToast('Код организации не найден. Сначала создайте организацию.', true); return; }
      if (code !== savedCode) { showToast('Неверный код', true); return; }
      localStorage.setItem('ritm_user_name', $('#input-user-name').value.trim());
    }
    showStep(target);
  }));
  
  const enterDashboard = () => {
    if(flowContainer) flowContainer.style.display = 'none';
    if(dashboardContainer) dashboardContainer.style.display = 'block';
    initCorporateDashboard();
  };
  
  $('#btn-enter-dashboard')?.addEventListener('click', enterDashboard);
  $('#btn-enter-dashboard-2')?.addEventListener('click', enterDashboard);
  $('#btn-exit-dashboard')?.addEventListener('click', () => {
    if(flowContainer) flowContainer.style.display = 'block';
    if(dashboardContainer) dashboardContainer.style.display = 'none';
    showStep('step-0');
  });

  function initCorporateDashboard() {
    const title = $('#dash-title');
    const orgName = localStorage.getItem('ritm_org_name');
    if (title && orgName) title.textContent = `Пространство: ${orgName}`;
    
    // Помодоро (отдельный экземпляр)
    let pomoTime = 25 * 60, pomoInterval = null, isPomoRunning = false;
    const pomoDisplay = $('#pomo-time');
    const pomoToggle = $('#pomo-toggle');
    function updatePomo() { if (pomoDisplay) { const m = Math.floor(pomoTime / 60).toString().padStart(2,'0'); const s = (pomoTime % 60).toString().padStart(2,'0'); pomoDisplay.textContent = `${m}:${s}`; } }
    function startPomo() { if (isPomoRunning) return; isPomoRunning = true; if(pomoToggle) pomoToggle.textContent = '⏸'; pomoInterval = setInterval(() => { pomoTime--; updatePomo(); if (pomoTime <= 0) { clearInterval(pomoInterval); isPomoRunning = false; if(pomoToggle) pomoToggle.textContent = '▶'; showToast('Сессия завершена!'); pomoTime = 5 * 60; updatePomo(); } }, 1000); }
    function pausePomo() { clearInterval(pomoInterval); isPomoRunning = false; if(pomoToggle) pomoToggle.textContent = '▶'; }
    pomoToggle?.addEventListener('click', () => isPomoRunning ? pausePomo() : startPomo());
    $$('.pomo-btn[data-time]').forEach(btn => {
      btn.addEventListener('click', () => { pausePomo(); pomoTime = parseInt(btn.dataset.time) * 60; updatePomo(); $$('.pomo-btn[data-time]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); });
    });
    updatePomo();

    // Канбан
    let tasks = JSON.parse(localStorage.getItem('ritm_kanban') || '[]');
    if (!tasks.length) tasks = [
      { id: 1, text: 'Настроить CI/CD', status: 'queue' },
      { id: 2, text: 'Дизайн авторизации', status: 'progress' },
      { id: 3, text: 'Согласовать ТЗ', status: 'done' }
    ];
    function saveKanban() { localStorage.setItem('ritm_kanban', JSON.stringify(tasks)); }
    function renderKanban() {
      ['queue', 'progress', 'done'].forEach(status => {
        const list = $(`#list-${status}`);
        const countSpan = $(`#count-${status}`);
        const filtered = tasks.filter(t => t.status === status);
        if (countSpan) countSpan.textContent = filtered.length;
        if (list) {
          list.innerHTML = '';
          filtered.forEach(task => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.dataset.id = task.id;
            card.innerHTML = `<span>${task.text}</span><button class="kanban-del-btn" data-id="${task.id}">✕</button>`;
            list.appendChild(card);
          });
        }
      });
      saveKanban();
    }
    renderKanban();

    // Drag & drop канбан
    dashboardContainer.addEventListener('dragstart', e => {
      if (e.target.classList.contains('kanban-card')) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
      }
    });
    dashboardContainer.addEventListener('dragend', e => e.target.classList.remove('dragging'));
    dashboardContainer.addEventListener('dragover', e => { e.preventDefault(); const col = e.target.closest('.kanban-column'); if (col) col.classList.add('drag-over'); });
    dashboardContainer.addEventListener('dragleave', e => { const col = e.target.closest('.kanban-column'); if (col) col.classList.remove('drag-over'); });
    dashboardContainer.addEventListener('drop', e => {
      e.preventDefault();
      const col = e.target.closest('.kanban-column');
      if (!col) return;
      col.classList.remove('drag-over');
      const taskId = parseInt(e.dataTransfer.getData('text/plain'));
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== col.dataset.status) {
        task.status = col.dataset.status;
        renderKanban();
        if (task.status === 'done') {
          showToast('✅ Задача выполнена!');
          updateOKRFromTaskDone(task.id);
        }
      }
    });
    
    // OKR
    let okrs = JSON.parse(localStorage.getItem('ritm_okr') || '[]');
    if (!okrs.length) okrs = [{ id: 1, title: "Внедрить новый отчёт за Q3", krs: [{ id: 'kr1', text: "Собрать требования", linkedTasks: [3], log: [] }, { id: 'kr2', text: "Сверстать дашборд", linkedTasks: [2], log: [] }] }];
    function saveOKR() { localStorage.setItem('ritm_okr', JSON.stringify(okrs)); }
    function calculateKRProgress(kr) {
      if (!kr.linkedTasks || !kr.linkedTasks.length) return 0;
      const doneTasks = kr.linkedTasks.filter(tid => tasks.find(t => t.id === tid && t.status === 'done')).length;
      return Math.round((doneTasks / kr.linkedTasks.length) * 100);
    }
    function updateOKRFromTaskDone(taskId) {
      let changed = false;
      okrs.forEach(o => {
        o.krs.forEach(kr => {
          if (kr.linkedTasks && kr.linkedTasks.includes(taskId)) {
            if (!kr.log) kr.log = [];
            kr.log.push(`✅ Задача выполнена`);
            changed = true;
          }
        });
      });
      if (changed) { saveOKR(); renderOKR(); }
    }

    function renderOKR() {
      const list = $('#okr-list');
      if (!list) return;
      list.innerHTML = '';
      okrs.forEach(okr => {
        const okrDiv = document.createElement('div');
        okrDiv.className = `okr-item ${okr.krs.every(kr => calculateKRProgress(kr) === 100) ? 'complete' : ''}`;
        okrDiv.innerHTML = `<div class="okr-header"><div class="okr-title">🎯 ${okr.title}</div><button class="okr-del" data-id="${okr.id}">✕</button></div>`;
        
        okr.krs.forEach(kr => {
          const progress = calculateKRProgress(kr);
          const linkedHtml = (kr.linkedTasks || []).map(tid => {
            const task = tasks.find(t => t.id === tid);
            if (!task) return '';
            return `<div class="kr-task-item ${task.status === 'done' ? 'done-task' : ''}"><div class="kr-task-status"></div>${task.text}</div>`;
          }).join('');

          const availableTasks = tasks.filter(t => t.status !== 'done' && !(kr.linkedTasks || []).includes(t.id));
          const selectHtml = availableTasks.length ? `<select class="link-task-select" data-kr-id="${kr.id}" data-okr-id="${okr.id}"><option value="">+ Привязать задачу</option>${availableTasks.map(t => `<option value="${t.id}">${t.text}</option>`).join('')}</select>` : '<div style="font-size:0.8rem;">Нет свободных задач</div>';
          
          const logHtml = (kr.log || []).slice(-3).map(l => `<p>${l}</p>`).join('');
          
          okrDiv.innerHTML += `
            <div class="kr-block">
              <div class="kr-header" data-kr-id="${kr.id}" data-okr-id="${okr.id}">
                <div class="kr-text">${kr.text}</div>
                <div><span class="kr-pct">${progress}%</span> <span class="kr-toggle">▼</span></div>
              </div>
              <div class="okr-progress-track"><div class="okr-progress-fill" style="width: ${progress}%"></div></div>
              <div class="kr-details" id="kr-details-${kr.id}">
                <div class="kr-linked-tasks">${linkedHtml}</div>
                ${selectHtml}
                <div class="kr-activity">${logHtml || '<p>Нет активности</p>'}</div>
              </div>
            </div>`;
        });
        list.appendChild(okrDiv);
      });
    }
    
    renderOKR();

    // Обработчики кликов для Канбана и OKR
    dashboardContainer.addEventListener('click', e => {
      // Удаление задачи
      if (e.target.classList.contains('kanban-del-btn')) {
        const id = parseInt(e.target.dataset.id);
        tasks = tasks.filter(t => t.id !== id);
        renderKanban();
        okrs.forEach(o => o.krs.forEach(kr => { if (kr.linkedTasks) kr.linkedTasks = kr.linkedTasks.filter(tid => tid !== id); }));
        saveOKR(); renderOKR();
        showToast('Задача удалена');
      }
      // Добавление задачи
      if (e.target.id === 'add-queue-btn') {
        const input = $('#add-queue-input');
        if (input && input.value.trim()) {
          tasks.push({ id: Date.now(), text: input.value.trim(), status: 'queue' });
          input.value = '';
          renderKanban();
          showToast('Задача добавлена');
        }
      }
      // Раскрытие деталей KR
      if (e.target.closest('.kr-header')) {
        const header = e.target.closest('.kr-header');
        const krId = header.dataset.krId;
        const details = $(`#kr-details-${krId}`);
        const toggle = header.querySelector('.kr-toggle');
        if (details) details.classList.toggle('open');
        if (toggle) toggle.classList.toggle('open');
      }
      // Удаление OKR
      if (e.target.classList.contains('okr-del')) {
        const id = parseInt(e.target.dataset.id);
        okrs = okrs.filter(o => o.id !== id);
        saveOKR(); renderOKR();
      }
    });

    // Привязка задачи к KR
    dashboardContainer.addEventListener('change', e => {
      if (e.target.classList.contains('link-task-select')) {
        const taskId = parseInt(e.target.value);
        const krId = e.target.dataset.krId;
        const okrId = parseInt(e.target.dataset.okrId);
        if (taskId && krId && okrId) {
          const okr = okrs.find(o => o.id === okrId);
          if (okr) {
            const kr = okr.krs.find(k => k.id === krId);
            if (kr) {
              if (!kr.linkedTasks) kr.linkedTasks = [];
              if (!kr.log) kr.log = [];
              kr.linkedTasks.push(taskId);
              kr.log.push(`🔗 Привязана задача`);
              saveOKR(); renderOKR();
              showToast('Задача привязана к KR');
            }
          }
        }
      }
    });
    
    $('#add-queue-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') $('#add-queue-btn')?.click(); });
  }
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем, какие элементы есть на странице, и запускаем нужные модули
  if ($('#hero-canvas')) initHome();
  if ($('#rings-wrapper')) initMethod();
  if ($('#list-low')) initBoard();
  if ($('#calendar-grid')) initCalendar();
  if ($('#streak-value')) initStats();
  if ($('#flow-container') || $('#dashboard-container')) initCorporate();
});