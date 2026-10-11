const GENERIC_NAME_WORDS = new Set(['a', 'an', 'the', 'for', 'your', 'customer', 'appointment', 'drop', 'in', 'template']);

function actionName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word && !GENERIC_NAME_WORDS.has(word))
    .map(word => {
      if (/^cancell?ation$/.test(word) || /^cancell?ed$/.test(word)) return 'cancel';
      if (/^rescheduled?$/.test(word) || word === 'rescheduling') return 'reschedule';
      if (/^confirmed?$/.test(word) || word === 'confirming') return 'confirm';
      return word;
    })
    .sort()
    .join(' ');
}

export function availableDropInTemplates(templates, existingItems, status) {
  const existingActions = new Set(existingItems
    .filter(item => item.available_on_status === status)
    .map(item => actionName(item.name))
    .filter(Boolean));

  return templates.filter(template => {
    if (!template.statuses.includes(status)) return false;
    const action = actionName(template.name);
    return !action || !existingActions.has(action);
  });
}
