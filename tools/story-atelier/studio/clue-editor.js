function clueManager(project) {
  const draft = (project.clues || []).map(clue => ({ ...clue }));
  if (!draft.length) draft.push({ id: uid(), name: '', initial: false });
  const references = new Map();
  for (const chapter of project.chapters) {
    for (const choice of chapter.choices) {
      for (const rule of [choice.condition, choice.effect]) {
        if (rule) references.set(rule.clueId, (references.get(rule.clueId) || 0) + 1);
      }
    }
  }
  modal('本作线索', `<form id="clue-form">
    <p class="muted">给物品或已知事实起个名字，再到选项中设置何时获得、何时需要。</p>
    <div id="clue-list" class="clue-list"></div>
    <button type="button" id="add-clue">＋ 添加线索</button>
    <p id="clue-error" role="alert" class="danger-note"></p>
    <div class="actions mt"><button type="submit" class="primary">保存线索</button>
    <button type="button" data-action="close">取消</button></div></form>`);
  const list = $('#clue-list');
  function addRow(clue) {
    const uses = references.get(clue.id) || 0;
    const row = document.createElement('div');
    row.className = 'clue-row';
    row.dataset.clueId = clue.id;
    row.innerHTML = `<label class="clue-name">线索名称<input maxlength="60" value="${esc(clue.name)}" placeholder="例如：蓝色存根"></label>
      <label class="clue-initial"><input type="checkbox" ${clue.initial ? 'checked' : ''}> 开局持有</label>
      <button type="button" class="small ghost danger" ${uses ? 'disabled' : ''}>移除</button>
      ${uses ? `<small class="clue-uses">已用于 ${uses} 项规则，解除引用后可移除。</small>` : ''}`;
    row.querySelector('button').onclick = () => row.remove();
    list.append(row);
    return row;
  }
  draft.forEach(addRow);
  $('#add-clue').onclick = () => addRow({ id: uid(), name: '', initial: false }).querySelector('input').focus();
  $('#clue-form').onsubmit = event => {
    event.preventDefault();
    if (activeRun) return;
    const pending = [];
    for (const row of list.children) {
      const name = row.querySelector('input[maxlength]').value.trim();
      const initial = row.querySelector('[type=checkbox]').checked;
      if (!name && !initial && !draft.some(clue => clue.id === row.dataset.clueId && clue.name)) continue;
      pending.push({ id: row.dataset.clueId, name, initial });
    }
    try {
      project.clues = normalizeClueList(pending);
    } catch (error) {
      $('#clue-error').textContent = error.message;
      return;
    }
    project.updated = Date.now();
    save();
    closeModal();
    render();
  };
}

function choiceRulesEditor(project, choice, index) {
  const clues = project.clues || [];
  const summary = ['condition', 'effect'].map(key => clueRuleLabel(project, choice[key], key)).filter(Boolean).join(' · ');
  function select(field, label, empty, yes, no) {
    const value = choice[field] ? `${Number(choice[field].has)}:${choice[field].clueId}` : '';
    const groups = [[yes, 1], [no, 0]].map(([name, flag]) => {
      const options = clues.map(clue => {
        const key = `${flag}:${clue.id}`;
        return `<option value="${esc(key)}" ${value === key ? 'selected' : ''}>${name}「${esc(clue.name)}」</option>`;
      }).join('');
      return `<optgroup label="${name}">${options}</optgroup>`;
    }).join('');
    return `<label>${label}<select data-rule-index="${index}" data-rule-field="${field}">
      <option value="">${empty}</option>${groups}</select></label>`;
  }
  const fields = clues.length
    ? `<div class="clue-fields">${select('condition', '选择前', '始终可选', '需持有', '需未持有')}
         ${select('effect', '选择后', '线索不变', '获得', '交出')}</div>`
    : `<p class="tiny muted">先添加一条线索，即可给选项设置条件。</p>`;
  return `<details class="choice-rules" ${summary ? 'open' : ''}>
    <summary><span>线索规则</span> <small>${esc(summary || '无')}</small></summary>
    ${fields}${button(clues.length ? '管理本作线索' : '添加本作线索', 'clue-manager', 'small ghost')}</details>`;
}

function bindChoiceRules(project, chapter) {
  for (const select of $$('[data-rule-field]')) {
    select.onchange = () => {
      const choice = chapter.choices[Number(select.dataset.ruleIndex)];
      if (!choice || activeRun) return;
      const field = select.dataset.ruleField;
      if (!['condition', 'effect'].includes(field)) return;
      if (!select.value) delete choice[field];
      else choice[field] = { clueId: select.value.slice(2), has: select.value.startsWith('1:') };
      select.closest('details').querySelector('summary small').textContent =
        ['condition', 'effect'].map(key => clueRuleLabel(project, choice[key], key)).filter(Boolean).join(' · ') || '无';
      project.updated = Date.now();
      save();
    };
  }
}

function appendChapterDrafts(project, entries) {
  if (!Array.isArray(entries) || !entries.length || project.chapters.length + entries.length > 100) {
    throw Error('格式错误或章节总数超过 100');
  }
  const incoming = normalizeProject({ clues: project.clues, chapters: entries }).chapters;
  const used = new Set(project.chapters.map(chapter => chapter.id));
  const remap = new Map();
  for (const chapter of incoming) {
    const prior = chapter.id;
    while (used.has(chapter.id)) chapter.id = uid();
    used.add(chapter.id);
    remap.set(prior, chapter.id);
  }
  entries.forEach((entry, i) => {
    incoming[i].choices.forEach((choice, index) => {
      const source = entry.choices[index];
      if (source.targetIndex != null) {
        if (!Number.isInteger(source.targetIndex) || !incoming[source.targetIndex]) throw Error('追加章节中的目标序号无效');
        choice.target = incoming[source.targetIndex].id;
      } else {
        choice.target = remap.get(choice.target) || choice.target;
      }
    });
  });
  project.chapters.push(...incoming);
  project.chapterCount = project.chapters.length;
}
