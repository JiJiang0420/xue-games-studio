function createStoryEngine(book) {
  const chapters = book.chapters;
  const clues = book.clues || [];
  const names = new Map(clues.map(clue => [clue.id, clue.name]));
  const chapterIndex = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const startingClues = clues.filter(clue => clue.initial).map(clue => clue.id).sort();

  function start() {
    return { index: 0, clues: [...startingClues] };
  }

  function options(step) {
    const chapter = chapters[step.index];
    if (!chapter) return [];
    const choices = chapter.choices || [];
    if (!choices.length && book.type !== '分支互动剧情' && step.index + 1 < chapters.length) {
      return [{ label: '下一章', next: { index: step.index + 1, clues: step.clues }, reason: '' }];
    }
    return choices.map(choice => {
      const { condition, effect } = choice;
      const index = chapterIndex.get(choice.target);
      let reason = '';
      if (index === undefined) reason = '目标章节不存在';
      else if ([condition, effect].some(rule => rule && (!names.has(rule.clueId) || typeof rule.has !== 'boolean'))) {
        reason = '选项引用的线索无效';
      } else if (condition && step.clues.includes(condition.clueId) !== condition.has) {
        const name = names.get(condition.clueId);
        reason = condition.has ? `需要持有「${name}」` : `需要尚未持有「${name}」`;
      }

      if (reason) return { label: choice.label, reason, next: null };
      let nextClues = step.clues;
      if (effect && nextClues.includes(effect.clueId) !== effect.has) {
        nextClues = effect.has
          ? [...nextClues, effect.clueId].sort()
          : nextClues.filter(id => id !== effect.clueId);
      }
      return { label: choice.label, reason: '', next: { index, clues: nextClues } };
    });
  }

  function session() {
    let step = start();
    const history = [];
    return {
      get step() { return step; },
      history,
      choose(index) {
        const next = options(step)[index]?.next;
        if (!next) return false;
        history.push(step);
        step = next;
        return true;
      },
      back() {
        if (!history.length) return false;
        step = history.pop();
        return true;
      },
      restart() {
        history.length = 0;
        step = start();
      }
    };
  }
  return { start, options, session, nameOf: id => names.get(id) };
}

function hasClueRules(project) {
  return project.chapters.some(chapter => chapter.choices?.some(choice => choice.condition || choice.effect));
}

function clueRuleLabel(project, rule, field) {
  if (!rule) return '';
  const name = (project.clues || []).find(clue => clue.id === rule.clueId)?.name || '未知线索';
  const verb = field === 'condition'
    ? (rule.has ? '需持有' : '需未持有')
    : (rule.has ? '获得' : '交出');
  return `${verb}「${name}」`;
}

function inspectClueRoutes(project, limit = 4096) {
  const errors = new Set();
  const engine = createStoryEngine(project);
  if (!project.chapters.length || !hasClueRules(project)) {
    return { checked: false, complete: true, states: 0, endings: 0, errors: [] };
  }
  const ids = new Set((project.clues || []).map(clue => clue.id));
  for (const chapter of project.chapters) {
    for (const choice of chapter.choices || []) {
      for (const rule of [choice.condition, choice.effect]) {
        if (rule && (!ids.has(rule.clueId) || typeof rule.has !== 'boolean')) {
          errors.add(`“${chapter.title}”的选项“${choice.label}”引用了无效的线索规则`);
        }
      }
    }
  }
  const records = [];
  const visited = new Map();
  const reachableChapters = new Set();
  const usableChoices = new Set();
  const endings = new Set();
  const endingStates = [];
  let complete = true;
  function visit(step, parent = -1) {
    const key = JSON.stringify([step.index, step.clues]);
    let id = visited.get(key);
    if (id === undefined) {
      if (records.length >= limit) {
        complete = false;
        return;
      }
      id = records.length;
      visited.set(key, id);
      records.push({ step, parents: new Set() });
    }
    if (parent !== -1) records[id].parents.add(parent);
  }
  function stateLabel(step) {
    const inventory = step.clues.map(engine.nameOf).join('、') || '无';
    return `“${project.chapters[step.index].title}”（持有线索：${inventory}）`;
  }
  visit(engine.start());
  for (let id = 0; id < records.length; id++) {
    const { step } = records[id];
    reachableChapters.add(step.index);
    const options = engine.options(step);
    if (!options.length) {
      endings.add(step.index);
      endingStates.push(id);
    } else if (options.every(choice => !choice.next)) {
      errors.add(`${stateLabel(step)}没有可用出口`);
    }
    options.forEach((choice, index) => {
      if (!choice.next) return;
      usableChoices.add(`${step.index}/${index}`);
      visit(choice.next, id);
    });
  }

  // A bounded search may prove a particular dead end, but not global unreachability.
  if (complete) {
    const canFinish = new Set(endingStates);
    const queue = [...endingStates];
    for (let index = 0; index < queue.length; index++) {
      for (const parent of records[queue[index]].parents) {
        if (canFinish.has(parent)) continue;
        canFinish.add(parent);
        queue.push(parent);
      }
    }
    project.chapters.forEach((chapter, index) => {
      if (!reachableChapters.has(index)) {
        errors.add(`“${chapter.title}”在现有线索条件下无法到达`);
        return;
      }
      (chapter.choices || []).forEach((choice, number) => {
        if (!usableChoices.has(`${index}/${number}`)) {
          errors.add(`“${chapter.title}”中的“${choice.label}”在所有可达路线都无法选择`);
        }
      });
    });
    const reported = new Set();
    records.forEach(({ step }, id) => {
      if (canFinish.has(id) || reported.has(step.index) || !engine.options(step).some(choice => choice.next)) return;
      reported.add(step.index);
      errors.add(`${stateLabel(step)}起的路线无法抵达任何结局`);
    });
  }
  return { checked: true, complete, states: records.length, endings: endings.size, errors: [...errors] };
}

function normalizeClueList(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw Error('线索清单格式错误');
  const ids = new Set();
  const names = new Set();
  return input.map(clue => {
    const name = typeof clue?.name === 'string' ? clue.name.trim() : '';
    if (typeof clue?.id !== 'string' || !clue.id || !name || name.length > 60) {
      throw Error('每条线索都需要有效的 ID 和 1–60 字的名称');
    }
    if (ids.has(clue.id) || names.has(name)) throw Error(`线索重复：${name}`);
    if (clue.initial != null && typeof clue.initial !== 'boolean') throw Error(`“${name}”的初始状态无效`);
    ids.add(clue.id);
    names.add(name);
    return { id: clue.id, name, initial: clue.initial === true };
  });
}

function normalizeStoryChoice(choice, clueIds) {
  if (!choice || typeof choice !== 'object') throw Error('选项格式错误');
  const clean = { label: String(choice.label || ''), target: String(choice.target || '') };
  for (const key of ['condition', 'effect']) {
    const rule = choice[key];
    if (rule == null) continue;
    if (typeof rule.has !== 'boolean' || !clueIds.has(rule.clueId)) {
      throw Error(`“${clean.label || '未命名选项'}”的线索规则无效，请先核对线索清单`);
    }
    clean[key] = { clueId: rule.clueId, has: rule.has };
  }
  return clean;
}
