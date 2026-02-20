// Вспомогательные функции и константы

// Очищает строку от специальных символов (переносы строк и кавычки), заменяя их на безопасные альтернативы, или возвращает дефолтное значение, если вход пустой.
const safe = s => {
  if (!s) return "-";
  const str = String(s);
  if (!str.includes('\r') && !str.includes('\n') && !str.includes('"')) {
    return str;
  }
  return str.replace(/[\r\n]+/g, " ").replace(/\"/g, "'");
};

const decodeUriComponentSafe = value => {
  if (typeof value !== 'string' || !value.length) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const coalesceInputValue = (input, candidateKeys = []) => {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  for (const key of candidateKeys) {
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (typeof value === "string") {
      if (value.trim().length === 0) {
        continue;
      }
      return value;
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        continue;
      }
      return value;
    }
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const parseJsonLoose = raw => {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
    if (looksJson) {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch (secondaryError) {
        return null;
      }
    }
  }
  return null;
};

const parseArrayValues = raw => {
  if (Array.isArray(raw)) {
    return raw.map(item => String(item).trim()).filter(Boolean);
  }
  if (raw === undefined || raw === null) {
    return [];
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    const parsed = parseJsonLoose(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean);
    }
    const normalized = trimmed.replace(/^\[|\]$/g, "");
    return normalized
      .split(/[,;|]/)
      .map(item => item.replace(/^['"]+|['"]+$/g, "").trim())
      .filter(Boolean);
  }
  return [String(raw).trim()].filter(Boolean);
};

const isSelectAllToken = value => {
  if (value === undefined || value === null) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "выбрать все" || normalized === "select all" || normalized === "all" || normalized === "*";
};

const formatIssuesList = issues => {
  const items = Array.isArray(issues) ? issues.map(item => String(item).trim()).filter(Boolean) : [];
  if (!items.length || items.some(isSelectAllToken)) {
    return "все задачи";
  }
  return items.map(issue => safe(issue)).join(", ");
};

const parseBinaryToggle = value => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) {
      return null;
    }
    if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const describeBotSubscriptionScope = (subscriptionNames = [], fallbackName = "") => {
  const normalized = Array.isArray(subscriptionNames) ? subscriptionNames.filter(Boolean) : [];
  if (normalized.length > 1) {
    return { text: "для перечисленных подписок", hasList: true };
  }
  if (normalized.length === 1) {
    return { text: `для подписки **${safe(normalized[0])}**`, hasList: false };
  }
  if (fallbackName) {
    return { text: `для подписки **${safe(fallbackName)}**`, hasList: false };
  }
  return { text: "для выбранной подписки", hasList: false };
};

const buildNotificationsFromBotMessage = (flag, subscriptionNames = [], fallbackName = "", actor = "Ты", useColon = false) => {
  if (flag === null) {
    return null;
  }
  const { text: scopeText, hasList } = describeBotSubscriptionScope(subscriptionNames, fallbackName);
  const action = flag ? "включил" : "отключил";
  const ending = useColon && hasList ? ":" : ".";
  return `${actor} ${action} уведомления от автоматизированных почтовых ящиков (robotjira@infomaximum.com, automation_bot@infomaximum.com) ${scopeText}${ending}`;
};

const buildNotificationsFromBotNote = (flag, subscriptionNames = [], fallbackName = "", actor = "Ты") => {
  return buildNotificationsFromBotMessage(flag, subscriptionNames, fallbackName, actor, false);
};

const normalizeParameterizedEntry = (project, issues) => {
  const normalizedProject = typeof project === "string" ? project.trim() : (project ?? "");
  const normalizedIssues = Array.isArray(issues) ? issues.filter(Boolean) : [];
  if (!normalizedProject && !normalizedIssues.length) {
    return null;
  }
  return { project: normalizedProject, issues: normalizedIssues };
};

const collectParameterizedEntries = input => {
  const buckets = { initial: [], addition: [], removal: [] };

  const baseProject = coalesceInputValue(input, ["project", "project_name"]);
  const baseIssues = parseArrayValues(coalesceInputValue(input, ["issues", "issues[]", "issue_types"]));
  const baseEntry = normalizeParameterizedEntry(baseProject, baseIssues);
  if (baseEntry) {
    buckets.initial.push(baseEntry);
  }

  const additionProject = coalesceInputValue(input, ["project_to_add", "project_to_subscribe"]);
  const additionIssues = parseArrayValues(coalesceInputValue(input, ["issues_to_add", "issues_to_add[]"]));
  const additionEntry = normalizeParameterizedEntry(additionProject, additionIssues);
  if (additionEntry) {
    buckets.addition.push(additionEntry);
  }

  const deletionProject = coalesceInputValue(input, ["project_to_delete", "project_to_remove"]);
  const deletionIssues = parseArrayValues(coalesceInputValue(input, ["issues_to_delete", "issues_to_delete[]", "issue_types_to_delete"]));
  const deletionEntry = normalizeParameterizedEntry(deletionProject, deletionIssues);
  if (deletionEntry) {
    buckets.removal.push(deletionEntry);
  }

  let mode = "none";
  let entries = [];
  if (buckets.initial.length) {
    mode = "initial";
    entries = buckets.initial;
  } else if (buckets.addition.length) {
    mode = "addition";
    entries = buckets.addition;
  } else if (buckets.removal.length) {
    mode = "removal";
    entries = buckets.removal;
  }

  return { mode, entries };
};

const formatParameterizedEntry = entry => {
  if (!entry) {
    return null;
  }
  const project = entry.project ? `**${safe(entry.project)}**` : "**проект не указан**";
  const issuesText = formatIssuesList(entry.issues);
  return `${project}:  ${issuesText}`;
};

const buildParameterizedLines = (entries, mode) => {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  return entries
    .map((entry, index) => {
      const formatted = formatParameterizedEntry(entry);
      if (!formatted) {
        return null;
      }
      if (mode === "initial" && index === 0) {
        return `*Параметры:* ${formatted}`;
      }
      return formatted;
    })
    .filter(Boolean);
};

const stripUrlParams = value => {
  if (typeof value !== 'string' || !value.length) {
    return value;
  }
  const questionIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  let cutoff = value.length;
  if (questionIndex >= 0) {
    cutoff = Math.min(cutoff, questionIndex);
  }
  if (hashIndex >= 0) {
    cutoff = Math.min(cutoff, hashIndex);
  }
  return value.slice(0, cutoff);
};

const highlightMentionsInInlines = inlines => {
  if (!Array.isArray(inlines) || !inlines.length) {
    return inlines;
  }
  const mentionRegex = /@[A-Za-z0-9._-]+/g;
  const isBoundary = char => !char || /[\s([<>{},.!?:;"'\-]/.test(char);
  const result = [];
  inlines.forEach(inline => {
    if (!inline || inline.type !== 'TextRun' || typeof inline.text !== 'string' || !inline.text.length) {
      result.push(inline);
      return;
    }
    const text = inline.text;
    mentionRegex.lastIndex = 0;
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      const prevChar = startIndex > 0 ? text[startIndex - 1] : '';
      const nextChar = endIndex < text.length ? text[endIndex] : '';
      if (!isBoundary(prevChar) || !isBoundary(nextChar)) {
        continue;
      }
      if (startIndex > lastIndex) {
        result.push({ ...inline, text: text.slice(lastIndex, startIndex) });
      }
      result.push({
        ...inline,
        text: match[0],
        weight: 'Bolder',
        color: 'Warning',
        size: 'Large'
      });
      lastIndex = endIndex;
    }
    if (lastIndex === 0 || lastIndex < text.length) {
      result.push({ ...inline, text: text.slice(lastIndex) });
    }
  });
  return result;
};

const buildRichTextInlines = rawText => {
  const text = typeof rawText === 'string' ? rawText : String(rawText ?? '');
  if (!text.length) {
    return [{ type: 'TextRun', text: '', wrap: true }];
  }

  const inlines = [];
  let buffer = '';
  let bold = false;
  let italic = false;
  let code = false;

  const pushBuffer = () => {
    if (!buffer.length) {
      return;
    }
    const run = { type: 'TextRun', text: buffer, wrap: true };
    if (bold) {
      run.weight = 'Bolder';
    }
    if (italic) {
      run.italic = true;
    }
    if (code) {
      run.fontType = 'Monospace';
    }
    inlines.push(run);
    buffer = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextTwo = text.slice(i, i + 2);

    if (nextTwo === '**') {
      pushBuffer();
      bold = !bold;
      i += 1;
      continue;
    }
    if (char === '*' && text[i + 1] !== '*') {
      pushBuffer();
      italic = !italic;
      continue;
    }
    if (char === '`') {
      pushBuffer();
      code = !code;
      continue;
    }
    if (char === '[') {
      const closingBracket = text.indexOf(']', i + 1);
      if (closingBracket !== -1 && text[closingBracket + 1] === '(') {
        const closingParen = text.indexOf(')', closingBracket + 2);
        if (closingParen !== -1) {
          pushBuffer();
          const label = text.slice(i + 1, closingBracket);
          const url = text.slice(closingBracket + 2, closingParen);
          inlines.push({
            type: 'TextRun',
            text: label,
            wrap: true,
            color: 'Accent',
            selectAction: {
              type: 'Action.OpenUrl',
              url: safe(url)
            }
          });
          i = closingParen;
          continue;
        }
      }
    }

    buffer += char;
  }

  pushBuffer();
  return inlines.length ? inlines : [{ type: 'TextRun', text: '', wrap: true }];
};

const buildAdaptiveTableElement = (tableModel, hasPreviousElements) => {
  if (!tableModel || !tableModel.rows || !tableModel.rows.length) {
    return null;
  }
  const columns = Array.from({ length: tableModel.columnCount }, () => ({ width: 1 }));
  const rows = tableModel.rows.map((cells, rowIndex) => {
    return {
      type: 'TableRow',
      cells: Array.from({ length: tableModel.columnCount }, (_, columnIndex) => {
        const cellContent = cells[columnIndex] || '';
        const cell = { type: 'TableCell' };
        const formatted = prettify(cellContent);
        if (formatted) {
          let inlines = buildRichTextInlines(formatted);
          if (rowIndex === 0) {
            inlines = inlines.map(inline => ({
              ...inline,
              weight: inline.weight || 'Bolder'
            }));
          }
          cell.items = [{ type: 'RichTextBlock', inlines }];
        }
        return cell;
      })
    };
  });
  const tableElement = { type: 'Table', columns, rows };
  if (hasPreviousElements) {
    tableElement.spacing = 'Small';
  }
  return tableElement;
};

const buildTableModel = rawRows => {
  if (!Array.isArray(rawRows) || !rawRows.length) {
    return null;
  }

  const sanitizeRow = row => {
    if (typeof row !== 'string') {
      return null;
    }
    const trimmed = row.trim();
    if (!trimmed.length) {
      return null;
    }
    if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(trimmed)) {
      return null;
    }
    return trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.replace(/\\\|/g, '|').trim());
  };

  const rows = rawRows
    .map(sanitizeRow)
    .filter(Array.isArray);

  if (!rows.length) {
    return null;
  }

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!columnCount) {
    return null;
  }

  const normalizedRows = rows.map(row => {
    if (row.length === columnCount) {
      return row;
    }
    return row.concat(Array(columnCount - row.length).fill(''));
  });

  return { columnCount, rows: normalizedRows };
};

const splitTextByTables = text => {
  if (!text) return null;
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const segments = [];
  let currentTextLines = [];
  let currentTableRows = [];
  let rowLines = [];
  let insideTable = false;
  let foundTable = false;

  const pushTextSegment = () => {
    if (!currentTextLines.length) return;
    const combined = currentTextLines.join('\n');
    if (combined.trim()) {
      segments.push({ type: 'text', value: combined });
    }
    currentTextLines = [];
  };

  const finalizeRow = () => {
    if (!rowLines.length) return;
    currentTableRows.push(rowLines.join('\n'));
    rowLines = [];
  };

  const pushTableSegment = () => {
    if (!currentTableRows.length) {
      insideTable = false;
      return;
    }
    const model = buildTableModel(currentTableRows);
    if (model) {
      segments.push({ type: 'table', value: model });
      foundTable = true;
    } else {
      currentTextLines.push(...currentTableRows);
    }
    currentTableRows = [];
    insideTable = false;
  };

  lines.forEach(line => {
    const normalizedLine = line.replace(/\u00A0/g, ' ');
    const trimmed = normalizedLine.trim();
    const startsWithPipe = trimmed.startsWith('|');
    if (insideTable) {
      if (!rowLines.length && !startsWithPipe) {
        if (!trimmed.length) {
          return;
        }
        pushTableSegment();
        currentTextLines.push(normalizedLine);
        return;
      }
      rowLines.push(normalizedLine);
      if (trimmed.endsWith('|')) {
        finalizeRow();
      }
      return;
    }
    if (startsWithPipe) {
      pushTextSegment();
      insideTable = true;
      rowLines.push(normalizedLine);
      if (trimmed.endsWith('|')) {
        finalizeRow();
      }
    } else {
      currentTextLines.push(normalizedLine);
    }
  });

  if (rowLines.length) {
    finalizeRow();
  }
  if (insideTable) {
    pushTableSegment();
  }
  pushTextSegment();

  if (!foundTable) {
    return null;
  }
  return segments;
};

// Соединяет части комментария, если короткая вырезка оборвана на полпути через Jira-ссылку
const healSplitCommentChunks = (headChunk = '', tailChunk = '') => {
  if (!headChunk || !tailChunk) {
    return { headChunk, tailChunk };
  }
  let patchedHead = headChunk;
  let patchedTail = tailChunk;
  let iterations = 0;
  const tryStitch = () => {
    const lastOpenBracket = patchedHead.lastIndexOf('[');
    if (lastOpenBracket === -1) {
      return false;
    }
    const fragment = patchedHead.slice(lastOpenBracket);
    if (!fragment || fragment.includes(']')) {
      return false;
    }
    if (!/\[(https?:\/\/|mailto:|~|#[^\s]*|[^\]|]+\|)/i.test(fragment)) {
      return false;
    }
    const closingIndex = patchedTail.indexOf(']');
    if (closingIndex === -1) {
      return false;
    }
    const borrowed = patchedTail.slice(0, closingIndex + 1);
    patchedHead += borrowed;
    patchedTail = patchedTail.slice(closingIndex + 1);
    let transferLength = 0;
    while (transferLength < patchedTail.length) {
      const char = patchedTail[transferLength];
      if (char === '\n' || char === '\r') {
        break;
      }
      if (!/[\s.,!?;:)/]/.test(char)) {
        break;
      }
      transferLength += 1;
    }
    if (transferLength) {
      patchedHead += patchedTail.slice(0, transferLength);
      patchedTail = patchedTail.slice(transferLength);
    }
    return true;
  };
  while (iterations < 3 && tryStitch()) {
    iterations += 1;
  }
  return { headChunk: patchedHead, tailChunk: patchedTail };
};

// Преобразует текст из Jira wiki/HTML в Markdown-compatible формат для Teams Adaptive Cards.
const prettify = input => {
  if (!input) return '';

  // Удалить HTML-теги
  let result = input.replace(/<[^>]*>/g, '');

  // Преобразовать Jira wiki в Markdown
  // Маркеры списков: *, **, - и т.д. -> Unicode bullets (● для 1-го уровня, ⚬ для 2-го) с восемью пробелами для вложенности
  result = result.replace(/(^|\n)([ \t]*)([-*]+)(\s+)/g, (match, prefix, indent, marker) => {
    if (!marker) {
      return match;
    }
    const firstChar = marker[0];
    if (firstChar !== '*' && firstChar !== '-') {
      return match;
    }
    const depth = firstChar === '*' ? marker.length : 1;
    if (depth === 1) {
      return `${prefix}${indent}● `;
    }
    const indentSpaces = ' '.repeat(8);
    return `${prefix}${indent}${indentSpaces}⚬ `;
  });
  // Жирный текст: *text* -> **text** (игнорируем одиночные * перед пробелом)
  result = result.replace(/\*(\S[^*]*\S)\*/g, (match, boldText) => `**${boldText}**`);
  // Курсив: _text_ -> *text* (но избегать в URL)
  // Сначала временно заменить URL
  const urlPlaceholder = '###URL_PLACEHOLDER###';
  const urls = [];
  result = result.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    urls.push(match);
    return urlPlaceholder;
  });
  result = result.replace(/_([^_]+)_/g, (match, italicText) => `*${italicText}*`);
  // Восстановить URL
  urls.forEach(url => {
    result = result.replace(urlPlaceholder, url);
  });

  // Код: {{text}} -> `text`
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, inlineCode) => '`' + inlineCode + '`');
  // Ссылки: [text|url] -> [text](url)
  result = result.replace(/\[([^\|]+)\|([^\]]+)\]/g, (match, label, url) => `[${label}](${url})`);
  // Ссылки вида [https://...] — весь текст внутри [] превращаем в ссылку на базовый URL без параметров
  result = result.replace(/\[(https?:\/\/[^\]\s]+)\]/g, (match, rawUrl) => {
    const baseUrl = stripUrlParams(rawUrl) || rawUrl;
    const displayText = decodeUriComponentSafe(baseUrl);
    return `[${displayText}](${rawUrl})`;
  });
  // Одинарные # в начале строки часто используются как маркеры списков — приводим к "- "
  result = result.replace(/(^|\n)\s*#(?!#)\s+/g, (match, prefix) => `${prefix}- `);
  // Заголовки: h1. text -> # text
  result = result.replace(/^h(\d+)\.\s*(.+)$/gm, (match, level, text) => '#'.repeat(parseInt(level)) + ' ' + text);
  // Изображения: !image.png|alt! -> ![alt](image.png)
  result = result.replace(/!([^|!]+)(\|([^!]+))?!/g, (match, path, _withAlt, altText) => `![${altText || ''}](${path})`);
  // Блоки кода: {code:lang} ... {code} -> ```lang ... ```
  result = result.replace(/\{code(?::(\w+))?\}([\s\S]*?)\{code\}/g, (match, lang, code) => {
    return '```' + (lang || '') + '\n' + code.trim() + '\n```';
  });
  // Упоминания пользователей: [~username] -> @username
  result = result.replace(/\[~([^\]]+)\]/g, (match, username) => `@${username}`);
  // Удалить доменную часть в упоминаниях вида @user@domain -> @user, не затрагивая обычные email
  result = result.replace(/(^|[\s(>\-])@([A-Za-z0-9._-]+)@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (match, prefix, username) => `${prefix}@${username}`);
  // Email: [mailto:email] -> email
  result = result.replace(/\[mailto:([^\]]+)\]/g, (match, email) => email);
  // Jira жирный текст в виде {**}text{**}
  result = result.replace(/\{\*\*\}([\s\S]*?)\{\*\*\}/g, (match, inner) => `**${inner.trim()}**`);
  result = result.replace(/\{\*\*\}/g, '**');
  // Убрать лишние ** вокруг изображений
  result = result.replace(/\*\*(\!\[[^\]]*\]\([^\)]+\))\*\*/g, (match, imageMarkdown) => imageMarkdown);

  // Нормализовать переводы строк и убрать избыточные пробелы
  result = result
    .replace(/\r\n?/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Удалить кавычки вокруг текста
  result = result.replace(/^"|"$/g, '');

  return result;
};

// Делит текст на последовательность обычных сегментов и блоков кода {code[:lang]}...{code}
const splitContentByCodeBlocks = (input, initialLanguage = null) => {
  if (!input || typeof input !== 'string') {
    return { segments: [], danglingLanguage: initialLanguage };
  }
  const tokenRegex = /\{code(?::([^}]+))?\}/gi;
  const segments = [];
  let mode = initialLanguage ? 'code' : 'text';
  let activeLanguage = initialLanguage || null;
  let lastIndex = 0;
  let match;
  const pushSegment = (type, text) => {
    if (!text) return;
    segments.push({ type, language: type === 'code' ? activeLanguage : null, value: text });
  };
  while ((match = tokenRegex.exec(input)) !== null) {
    const chunk = input.slice(lastIndex, match.index);
    if (chunk) {
      pushSegment(mode === 'code' ? 'code' : 'text', chunk);
    }
    const hasLang = Boolean(match[1]);
    if (hasLang || mode === 'text') {
      mode = 'code';
      activeLanguage = match[1]?.trim() || null;
    } else {
      mode = 'text';
      activeLanguage = null;
    }
    lastIndex = match.index + match[0].length;
  }
  const tail = input.slice(lastIndex);
  if (tail) {
    pushSegment(mode === 'code' ? 'code' : 'text', tail);
  }
  return { segments, danglingLanguage: mode === 'code' ? activeLanguage : null };
};

const formatErrorPreview = (value, limit = 400) => {
  if (value === null || value === undefined) {
    return '<empty>';
  }
  const str = String(value).replace(/\s+/g, ' ').trim();
  if (!str.length) return '<whitespace>';
  if (str.length <= limit) return str;
  return str.slice(0, limit) + '…';
};

const raiseFormattingError = (stage, error, rawText) => {
  const message = error && error.message ? error.message : String(error);
  throw new Error(`[${stage}] ${message}. Raw excerpt: ${formatErrorPreview(rawText)}`);
};

const containsMarkdownTable = paragraph => {
  if (!paragraph) return false;
  const lines = paragraph.split(/\r?\n/);
  let tableLines = 0;
  lines.forEach(line => {
    const trimmed = line.replace(/\u00A0/g, ' ').trim();
    if (trimmed.startsWith('|') && trimmed.indexOf('|', 1) !== -1) {
      tableLines++;
    }
  });
  return tableLines >= 2;
};

// Определяет, напоминает ли параграф многострочный блок кода (JSON/GraphQL/HTTP и т.п.)
const looksLikeCodeParagraph = paragraph => {
  if (!paragraph) return false;
  if (containsMarkdownTable(paragraph)) {
    return false;
  }
  const normalized = paragraph
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n').filter(line => line.trim().length);
  if (lines.length < 2) {
    return false;
  }
  let codeLines = 0;
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^\{color/i.test(trimmed) || /\{color\}$/i.test(trimmed)) {
      return;
    }
    if (/^[{}\[\]()]/.test(trimmed)) {
      codeLines++;
      return;
    }
    if (/^\s{2,}/.test(line) || /^\t+/.test(line)) {
      codeLines++;
      return;
    }
    if (/[:=]/.test(trimmed) && /[A-Za-z0-9"']/.test(trimmed)) {
      codeLines++;
      return;
    }
    if (/^".+":/.test(trimmed)) {
      codeLines++;
      return;
    }
    if (trimmed.includes('->') || trimmed.includes('=>')) {
      codeLines++;
      return;
    }
    if (/^\w+\s*\(.*\)\s*\{?/.test(trimmed)) {
      codeLines++;
      return;
    }
    if (/^(GET|POST|PUT|DELETE|PATCH)\s+/i.test(trimmed)) {
      codeLines++;
      return;
    }
    if (/^###URL/.test(trimmed)) {
      codeLines++;
      return;
    }
  });
  if (codeLines / lines.length >= 0.6) {
    return true;
  }
  const braceCount = (normalized.match(/[{}\[\]]/g) || []).length;
  if (braceCount >= 4 && lines.length >= 3) {
    return true;
  }
  const jsonPairs = (normalized.match(/"[^"\n]+"\s*:/g) || []).length;
  if (jsonPairs >= 3) {
    return true;
  }
  const sqlKeywords = normalized.match(/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|JOIN|WITH|CREATE|ALTER|DROP|TRUNCATE|DESCRIBE|EXPLAIN|SHOW|OPTIMIZE|ATTACH|DETACH|GRANT|REVOKE|EXISTS|USE|SET|FORMAT|ENGINE|MATERIALIZED|CLUSTER)\b/gi) || [];
  if (sqlKeywords.length >= 4) {
    return true;
  }
  if (sqlKeywords.length >= 2 && lines.length >= 3) {
    return true;
  }
  return false;
};

// Пытается определить язык блока кода для подсказки в CodeBlock
const inferCodeLanguage = snippet => {
  const trimmed = (snippet || '').trim();
  if (!trimmed) return null;
  if (/^\s*\{[\s\S]*\}/.test(trimmed) && /"[^"\n]+"\s*:/.test(trimmed)) {
    return 'json';
  }
  if (/(?:\bquery\b|\bmutation\b|\bsubscription\b)/i.test(trimmed)) {
    return 'graphql';
  }
  if (/^\s*(server|agent|employee)\s*\{/i.test(trimmed) && !/"[^"\n]+"\s*:/.test(trimmed)) {
    return 'graphql';
  }
  if (/^\s*(GET|POST|PUT|DELETE|PATCH)\s+/i.test(trimmed)) {
    return 'http';
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(trimmed)) {
    return 'sql';
  }
  if (/^\s*(CREATE|ALTER|DROP|TRUNCATE|DESCRIBE|EXPLAIN|SHOW|OPTIMIZE|ATTACH|DETACH|GRANT|REVOKE|EXISTS|USE)\b/i.test(trimmed)) {
    return 'sql';
  }
  if (/(?:\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bCREATE\b|\bALTER\b|\bDROP\b|\bTRUNCATE\b|\bDESCRIBE\b|\bEXPLAIN\b|\bSHOW\b|\bOPTIMIZE\b)/i.test(trimmed)
    && /(\bFROM\b|\bWHERE\b|\bJOIN\b|\bVALUES\b|\bSET\b|\bTABLE\b|\bVIEW\b|\bENGINE\b|\bFORMAT\b|\bDATABASE\b|\bCLUSTER\b|\bSETTINGS\b)/i.test(trimmed)) {
    return 'sql';
  }
  if (/ENGINE\s*=/i.test(trimmed) || /FORMAT\s+JSON/i.test(trimmed) || /SETTINGS\s+/i.test(trimmed)) {
    return 'sql';
  }
  if (/function\s+|=>/.test(trimmed)) {
    return 'javascript';
  }
  return null;
};

// Делит текстовый сегмент на параграфы и автоматически помечает кодоподобные блоки
const splitTextSegmentByHeuristics = text => {
  if (!text) return [];
  const sanitized = text.replace(/\u00A0/g, ' ');
  const normalized = sanitized.replace(/\r\n?/g, '\n');
  const withQuoteBreaks = normalized.replace(/\s*\{quote\}\s*/gi, '\n\n');
  const sqlBreakPattern = /([^\n])\n(\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|DESCRIBE|EXPLAIN|SHOW|OPTIMIZE|ATTACH|DETACH|GRANT|REVOKE|EXISTS|WITH|USE)\b)/gi;
  const withSqlBreaks = withQuoteBreaks.replace(sqlBreakPattern, (match, before, statement) => `${before}\n\n${statement}`);
  const paragraphs = withSqlBreaks.split(/\n{2,}/);
  const result = [];
  paragraphs.forEach(paragraph => {
    if (!paragraph || !paragraph.trim()) {
      return;
    }
    if (looksLikeCodeParagraph(paragraph)) {
      result.push({ type: 'code', value: paragraph });
    } else {
      const tableAwareSegments = splitTextByTables(paragraph);
      if (tableAwareSegments) {
        tableAwareSegments.forEach(segment => {
          if (segment.type === 'table') {
            result.push({ type: 'table', value: segment.value });
          } else if (segment.type === 'text' && segment.value.trim()) {
            result.push({ type: 'text', value: segment.value });
          }
        });
      } else {
        result.push({ type: 'text', value: paragraph });
      }
    }
  });
  return result;
};

// Преобразует сегменты текста/кода в элементы Adaptive Card (RichTextBlock и CodeBlock)
const buildAdaptiveContentElements = (input, initialLanguage = null) => {
  let splitResult;
  try {
    splitResult = splitContentByCodeBlocks(input, initialLanguage);
  } catch (error) {
    raiseFormattingError('splitContentByCodeBlocks', error, input);
  }
  const { segments, danglingLanguage } = splitResult;
  const elements = [];
  segments.forEach(segment => {
    if (segment.type === 'code') {
      const snippet = typeof segment.value === 'string'
        ? segment.value.replace(/\s+$/g, '')
        : segment.value;
      if (!snippet) {
        return;
      }
      const codeElement = {
        type: 'CodeBlock',
        codeSnippet: snippet
      };
      if (segment.language) {
        codeElement.language = segment.language;
      }
      if (elements.length) codeElement.spacing = 'Small';
      elements.push(codeElement);
    } else {
      let textPieces;
      try {
        textPieces = splitTextSegmentByHeuristics(segment.value);
      } catch (error) {
        raiseFormattingError('splitTextSegmentByHeuristics', error, segment.value);
      }
      const queue = textPieces.length ? textPieces : [{ type: 'text', value: segment.value }];
      queue.forEach(piece => {
        if (piece.type === 'code') {
          const snippet = typeof piece.value === 'string'
            ? piece.value.replace(/\u00A0/g, ' ').replace(/^\s*\n+/, '').replace(/\s+$/g, '')
            : piece.value;
          if (!snippet) return;
          const codeElement = {
            type: 'CodeBlock',
            codeSnippet: snippet
          };
          const detectedLanguage = inferCodeLanguage(snippet);
          if (detectedLanguage) {
            codeElement.language = detectedLanguage;
          }
          if (elements.length) codeElement.spacing = 'Small';
          elements.push(codeElement);
        } else if (piece.type === 'table') {
          const tableElement = buildAdaptiveTableElement(piece.value, elements.length);
          if (tableElement) {
            elements.push(tableElement);
          }
        } else {
          const formatted = prettify(piece.value);
          const trimmedText = formatted ? formatted.trim() : '';
          if (trimmedText && trimmedText !== '.') {
            const textElement = {
              type: 'RichTextBlock',
              inlines: buildRichTextInlines(formatted)
            };
            if (elements.length) textElement.spacing = 'Small';
            elements.push(textElement);
          }
        }
      });
    }
  });
  if (!elements.length) {
    elements.push({
      type: 'RichTextBlock',
      inlines: [{ type: 'TextRun', text: '-', wrap: true }]
    });
  }
  return { elements, danglingLanguage };
};

//  Извлекает общие данные из bundle и input, включая URL вебхука, базовый URL Jira, список email-адресов, уникальный ID отправки, время отправки и стартовое время для замера длительности.
const getCommonData = (bundle, input) => {
  const webhookUrl = bundle.authData.incoming_webhook_url;
  if (!webhookUrl) {
    throw new Error("URL вебхука не указан. Заполните поле и повторите попытку.");
  }
  const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
  if (!jiraBaseUrl) {
    throw new Error('В настойках подключения не указан jiraBaseUrl. Заполните поле и повторите попытку.');
  }
  const targetEmails = (input.target_emails || "").split(",").map(e => e.trim()).filter(Boolean);
  const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sendTime = new Date().toISOString();
  const start = Date.now();
  return { webhookUrl, jiraBaseUrl, targetEmails, sendUid, sendTime, start };
};

// Формирует URL задачи, контекстный URL (если есть), тип задачи, ключ проекта, флаги для эпика и проекта PRK на основе входных данных.
const getIssueData = (input, jiraBaseUrl) => {
  const issueUrl = input.issue_toUrl ? safe(input.issue_toUrl) : `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;
  const contextUrl = input.context_issue_key ? `${jiraBaseUrl}/browse/${safe(input.context_issue_key)}` : null;
  const issueType = input.issue_type?.toLowerCase() || "";
  const projectKey = (input.issue_key?.split("-")[0] || "").toUpperCase();
  const isEpic = issueType === "epic";
  const isPRK = projectKey === "PRK";
  return { issueUrl, contextUrl, issueType, projectKey, isEpic, isPRK };
};

// Создает блок контекста для карточки, если есть контекстная задача, с ссылкой на эпик или родительскую задачу в зависимости от типа.
const buildContextBlock = (input, contextUrl, issueType) => {
  if (!input.context_issue_key || !input.context_issue_summary) return null;
  const label = issueType === "subtask" ? "Родительская задача: " : "Эпик: ";
  return {
    type: "RichTextBlock",
    inlines: highlightMentionsInInlines([
      { type: "TextRun", text: label, weight: "Bolder" },
      {
        type: "TextRun",
        text: `[${safe(input.context_issue_key)}] ${safe(input.context_issue_summary)}`,
        color: "Accent",
        selectAction: { type: "Action.OpenUrl", url: contextUrl }
      }
    ])
  };
};

// Определяет текст бейджа и заголовок кнопки открытия задачи на основе типа задачи и типа блока, включая статусы для комментариев, изменений статуса и новых задач.
const getBadgeAndButton = (issueType, blockType, input) => {
  let badgeText = "";
  let openButtonTitle = "Открыть задачу";
  switch (issueType) {
    case "epic":
      if (blockType === 'comment') badgeText = "Новый комментарий в Epic";
      else if (blockType === 'status') badgeText = "Изменение статуса в Epic";
      else if (blockType === 'assignee') badgeText = "Новый Epic, где ты — Исполнитель";
      openButtonTitle = "Открыть Epic";
      break;
    case "subtask":
      if (blockType === 'comment') badgeText = "Новый комментарий в подзадаче";
      else if (blockType === 'status') badgeText = "Изменение статуса в подзадаче";
      else if (blockType === 'assignee') badgeText = "Новая подзадача, где ты — Исполнитель";
      else if (blockType === 'nested') badgeText = "Новая подзадача";
      openButtonTitle = "Открыть подзадачу";
      break;
    default:
      if (blockType === 'comment') badgeText = "Новый комментарий в задаче";
      else if (blockType === 'status') badgeText = "Изменение статуса в задаче";
      else if (blockType === 'assignee') badgeText = "Новая задача, где ты — Исполнитель";
      else if (blockType === 'nested') badgeText = "Новая задача";
      else if (blockType === 'project_issue') badgeText = "Новая задача в проекте";
      openButtonTitle = "Открыть задачу";
  }
  if (blockType === 'specific_comment') {
    badgeText = "Комментарий от А.Бочкин";
    openButtonTitle = "Открыть задачу";
  }
  return { badgeText, openButtonTitle };
};

// Собирает массив фактов (ключ-значение) для карточки, включая роли (автор, исполнитель, менеджеры) и даты, в зависимости от типа блока и флагов эпика/PRK.
const buildRoleFacts = (input, isEpic, isPRK, blockType) => {
  const facts = [];
  if (blockType === 'specific_comment') {
    facts.push({ title: "Проект:", value: safe(input.issue_project_name) });
    facts.push({ title: "Тип задачи:", value: safe(input.issue_type_name) });
    facts.push({ title: "Исполнитель:", value: safe(input.assignee) });
    facts.push({ title: "Автор задачи:", value: safe(input.reporter) });
  } else if (blockType === 'comment') {
    if (isEpic && isPRK) {
      const val1 = safe(input.issue_responsible_implementer);
      if (val1 && val1 !== "-") facts.push({ title: "Менеджер внедрений:", value: val1 });
      const val2 = safe(input.issue_responsible_sales);
      if (val2 && val2 !== "-") facts.push({ title: "Менеджер по продажам:", value: val2 });
      const val3 = safe(input.issue_responsible_analytic);
      if (val3 && val3 !== "-") facts.push({ title: "Аналитик:", value: val3 });
      const val4 = safe(input.issue_responsible_tsupporter);
      if (val4 && val4 !== "-") facts.push({ title: "Специалист ТП:", value: val4 });
    } else if (isEpic) {
      const val1 = safe(input.assignee);
      if (val1 && val1 !== "-") facts.push({ title: "Исполнитель:", value: val1 });
      const val2 = safe(input.reporter);
      if (val2 && val2 !== "-") facts.push({ title: "Автор:", value: val2 });
    } else {
      const val1 = safe(input.reporter);
      if (val1 && val1 !== "-") facts.push({ title: "Автор:", value: val1 });
      const val2 = safe(input.assignee);
      if (val2 && val2 !== "-") facts.push({ title: "Исполнитель:", value: val2 });
    }
  } else if (blockType === 'status') {
    if (isEpic && isPRK) {
      const val1 = safe(input.issue_responsible_implementer);
      if (val1 && val1 !== "-") facts.push({ title: "Менеджер внедрений:", value: val1 });
      const val2 = safe(input.issue_responsible_sales);
      if (val2 && val2 !== "-") facts.push({ title: "Менеджер по продажам:", value: val2 });
      const val3 = safe(input.issue_responsible_analytic);
      if (val3 && val3 !== "-") facts.push({ title: "Аналитик:", value: val3 });
      const val4 = safe(input.issue_responsible_tsupporter);
      if (val4 && val4 !== "-") facts.push({ title: "Специалист ТП:", value: val4 });
    } else if (isEpic) {
      const val1 = safe(input.assignee);
      if (val1 && val1 !== "-") facts.push({ title: "Исполнитель:", value: val1 });
      const val2 = safe(input.reporter);
      if (val2 && val2 !== "-") facts.push({ title: "Автор:", value: val2 });
    } else {
      const val1 = safe(input.reporter);
      if (val1 && val1 !== "-") facts.push({ title: "Автор:", value: val1 });
      const val2 = safe(input.assignee);
      if (val2 && val2 !== "-") facts.push({ title: "Исполнитель:", value: val2 });
    }
  } else if (blockType === 'assignee') {
    if (isEpic && isPRK) {
      const val1 = safe(input.issue_responsible_implementer);
      if (val1 && val1 !== "-") facts.push({ title: "Менеджер внедрений:", value: val1 });
      const val2 = safe(input.issue_responsible_sales);
      if (val2 && val2 !== "-") facts.push({ title: "Менеджер по продажам:", value: val2 });
      const val3 = safe(input.issue_responsible_analytic);
      if (val3 && val3 !== "-") facts.push({ title: "Аналитик:", value: val3 });
      const val4 = safe(input.issue_responsible_tsupporter);
      if (val4 && val4 !== "-") facts.push({ title: "Специалист ТП:", value: val4 });
    } else {
      const val1 = safe(input.reporter);
      if (val1 && val1 !== "-") facts.push({ title: "Автор:", value: val1 });
      const val2 = safe(input.created_at);
      if (val2 && val2 !== "-") facts.push({ title: "Дата регистрации:", value: val2 });
      const val3 = safe(input.due_date);
      if (val3 && val3 !== "-") facts.push({ title: "Дата исполнения:", value: val3 });
    }
  } else if (blockType === 'nested' || blockType === 'project_issue') {
    const projectName = safe(input.project_name || input.issue_project_name);
    if (blockType === 'project_issue' && projectName && projectName !== "-") {
      facts.push({ title: "Проект:", value: projectName });
    }
    if (blockType === 'project_issue') {
      const issueTypeName = safe(input.issue_type_name || input.issue_type);
      if (issueTypeName && issueTypeName !== "-") {
        facts.push({ title: "Тип:", value: issueTypeName });
      }
    }
    const val1 = safe(input.reporter);
    if (val1 && val1 !== "-") facts.push({ title: "Автор:", value: val1 });
    const val2 = safe(input.assignee);
    if (val2 && val2 !== "-") facts.push({ title: "Исполнитель:", value: val2 });
  }
  return facts;
};

// Строит тело адаптивной карточки, включая общий заголовок, контейнер с бейджем, специфические части для типа блока (комментарий, статус, назначение, вложенная задача), контекстный блок и набор фактов.
const buildCardBody = (blockType, input, badgeText, contextBlock, roleFacts, issueUrl, targetEmails) => {
  const commonHeader = {
    type: "TextBlock",
    text: "powered by Proceset",
    size: "Small",
    horizontalAlignment: "Right",
    isSubtle: true,
    spacing: "None"
  };

  const badgeContainer = {
    type: "Container",
    items: [
      {
        type: "Badge",
        text: badgeText,
        size: "ExtraLarge",
        style: blockType === 'comment'
          ? "Accent"
          : blockType === 'status'
            ? "Accent"
            : blockType === 'assignee'
              ? "Attention"
              : blockType === 'specific_comment'
                ? "Warning"
                : blockType === 'project_issue'
                  ? "Warning"
                  : "Good",
        icon: blockType === 'comment' ? "CommentAdd" : blockType === 'status' ? "ArrowSync" : "PersonSquare"
      },
      {
        type: "TextBlock",
        text: `**[${safe(input.issue_key)}]** ${safe(input.issue_summary)}`,
        wrap: true,
        weight: "Bolder",
        size: "Medium",
        spacing: "Small"
      }
    ],
    style: blockType === 'specific_comment' ? "warning" : "accent",
    showBorder: true,
    roundedCorners: true,
    spacing: "Medium"
  };

  let specificParts = [];

  if (blockType === 'specific_comment') {
    specificParts = [
      {
        type: "TextBlock",
        text: `**${safe(input.comment_author)}** пишет:`,
        wrap: true,
        spacing: "Small"
      },
      {
        type: "Container",
        items: [
          {
            type: "RichTextBlock",
            inlines: highlightMentionsInInlines([
              { type: "TextRun", text: `${safe(input.comment_body)}`, wrap: true }
            ])
          }
        ],
        style: "emphasis",
        spacing: "None"
      }
    ];
  } else if (blockType === 'comment') {
    const separatedRaw = input.separated_comment_part || '';
    const hasSeparatedPart = separatedRaw.trim() !== '';
    if (hasSeparatedPart) {
      const stitchedChunks = healSplitCommentChunks(input.original_comment || '', separatedRaw);
      const shortContent = buildAdaptiveContentElements(stitchedChunks.headChunk || '');
      const hasLongRemainder = stitchedChunks.tailChunk && stitchedChunks.tailChunk.trim() !== '';
      if (hasLongRemainder) {
        const longContent = buildAdaptiveContentElements(stitchedChunks.tailChunk, shortContent.danglingLanguage);
        specificParts = [
          {
            type: "TextBlock",
            text: `**${safe(input.comment_author)}** пишет:`,
            wrap: true,
            spacing: "Small"
          },
          ...shortContent.elements,
          {
            type: "ActionSet",
            id: "showMore",
            actions: [
              {
                type: "Action.ToggleVisibility",
                title: "Показать полностью",
                targetElements: ["fullComment", "showMore", "showLess"],
                mode: "secondary"
              }
            ]
          },
          {
            type: "ActionSet",
            id: "showLess",
            isVisible: false,
            actions: [
              {
                type: "Action.ToggleVisibility",
                title: "Скрыть",
                targetElements: ["fullComment", "showMore", "showLess"]
              }
            ]
          },
          {
            type: "Container",
            id: "fullComment",
            isVisible: false,
            style: "emphasis",
            spacing: "None",
            items: longContent.elements
          }
        ];
      } else {
        specificParts = [
          {
            type: "TextBlock",
            text: `**${safe(input.comment_author)}** пишет:`,
            wrap: true,
            spacing: "Small"
          },
          ...shortContent.elements
        ];
      }
    } else {
      const fullContent = buildAdaptiveContentElements(input.comment_body || '');
      specificParts = [
        {
          type: "TextBlock",
          text: `**${safe(input.comment_author)}** пишет:`,
          wrap: true,
          spacing: "Small"
        },
        {
          type: "Container",
          items: fullContent.elements,
          style: "emphasis",
          spacing: "None"
        }
      ];
    }
  } else if (blockType === 'status') {
    specificParts = [
      {
        type: "TextBlock",
        text: `**${safe(input.created_by)}** сменил(а) статус:`,
        wrap: true,
        spacing: "Small"
      },
      {
        type: "Container",
        items: [
          {
            type: "RichTextBlock",
            inlines: highlightMentionsInInlines([
              {
                type: "TextRun",
                text: `${safe(input.from_status)} `,
                wrap: true
              },
              {
                type: "TextRun",
                text: ` → ${safe(input.to_status)}`,
                wrap: true,
                weight: "Bolder",
                size: "Medium"
              }
            ])
          }
        ],
        style: "emphasis",
        spacing: "None"
      }
    ];
  } else if (blockType === 'assignee') {
    let descriptionParts = [];
    if (input.separated_description_part && input.separated_description_part.trim() !== '') {
      descriptionParts = [
        {
          type: "TextBlock",
          text: "**Описание:**",
          wrap: true,
          spacing: "Small"
        },
        {
          type: "TextBlock",
          text: safe(input.original_description),
          wrap: true,
          spacing: "None"
        },
        {
          type: "ActionSet",
          id: "showMoreDesc",
          actions: [
            {
              type: "Action.ToggleVisibility",
              title: "Показать полностью",
              targetElements: ["fullDescription", "showMoreDesc", "showLessDesc"],
              mode: "secondary"
            }
          ]
        },
        {
          type: "ActionSet",
          id: "showLessDesc",
          isVisible: false,
          actions: [
            {
              type: "Action.ToggleVisibility",
              title: "Скрыть",
              targetElements: ["fullDescription", "showMoreDesc", "showLessDesc"]
            }
          ]
        },
        {
          type: "Container",
          id: "fullDescription",
          isVisible: false,
          style: "emphasis",
          spacing: "None",
          items: [
            {
              type: "TextBlock",
              text: prettify(input.separated_description_part),
              wrap: true
            }
          ]
        }
      ];
    } else {
      descriptionParts = [
        {
          type: "TextBlock",
          text: "**Описание:**",
          wrap: true,
          spacing: "Small"
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: `${prettify(input.issue_description)}`,
              wrap: true
            }
          ],
          style: "emphasis",
          spacing: "None"
        }
      ];
    }
    specificParts = [
      {
        type: "TextBlock",
        text: `**Инициатор:** ${safe(input.created_by)}`,
        wrap: true,
        spacing: "Small"
      },
      ...descriptionParts
    ];
  } else if (blockType === 'nested' || blockType === 'project_issue') {
    const descriptionExpanded = blockType === 'project_issue';
    let descriptionParts = [];
    if (input.separated_description_part && input.separated_description_part.trim() !== '') {
      const showMoreAction = {
        type: "ActionSet",
        id: "showMoreDesc",
        actions: [
          {
            type: "Action.ToggleVisibility",
            title: "Показать полностью",
            targetElements: ["fullDescription", "showMoreDesc", "showLessDesc"],
            mode: "secondary"
          }
        ]
      };
      if (descriptionExpanded) {
        showMoreAction.isVisible = false;
      }
      const showLessAction = {
        type: "ActionSet",
        id: "showLessDesc",
        actions: [
          {
            type: "Action.ToggleVisibility",
            title: "Скрыть",
            targetElements: ["fullDescription", "showMoreDesc", "showLessDesc"]
          }
        ]
      };
      if (!descriptionExpanded) {
        showLessAction.isVisible = false;
      }
      const fullDescriptionContainer = {
        type: "Container",
        id: "fullDescription",
        style: "emphasis",
        spacing: "None",
        items: [
          {
            type: "TextBlock",
            text: prettify(input.separated_description_part),
            wrap: true
          }
        ]
      };
      if (!descriptionExpanded) {
        fullDescriptionContainer.isVisible = false;
      }
      descriptionParts = [
        {
          type: "TextBlock",
          text: "**Описание задачи:**",
          wrap: true,
          spacing: "Small"
        },
        {
          type: "TextBlock",
          text: safe(input.original_description),
          wrap: true,
          spacing: "None"
        },
        showMoreAction,
        showLessAction,
        fullDescriptionContainer
      ];
    } else {
      descriptionParts = [
        {
          type: "TextBlock",
          text: "**Описание задачи:**",
          wrap: true,
          spacing: "Small"
        },
        {
          type: "Container",
          items: [
            {
              type: "RichTextBlock",
              inlines: highlightMentionsInInlines([
                {
                  type: "TextRun",
                  text: `${prettify(input.issue_description)}`
                }
              ])
            }
          ],
          style: "emphasis",
          spacing: "None"
        }
      ];
    }
    specificParts = [
      {
        type: "TextBlock",
        text: `**Инициатор:** ${safe(input.created_by)}`,
        wrap: true,
        spacing: "Small"
      },
      ...descriptionParts
    ];
  }

  return [
    commonHeader,
    badgeContainer,
    ...specificParts,
    ...(contextBlock ? [contextBlock] : []),
    {
      type: "FactSet",
      facts: roleFacts,
      spacing: "Medium"
    }
  ];
};

// Отправляет адаптивную карточку через HTTP-запрос к вебхуку Teams, обрабатывая ошибки и возвращая ответ.
const sendCard = (service, webhookUrl, card, sendUid) => {
  let response;
  try {
    response = service.request({
      url: webhookUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-request-id": sendUid
      },
      jsonBody: { payload: JSON.stringify(card) }
    });
  } catch (e) {
    throw new Error("Ошибка при выполнении запроса: " + e.message);
  }
  const respBody = new TextDecoder().decode(response.response || new TextEncoder().encode(""));
  if (response.status < 200 || response.status >= 300)
    throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);
  return response;
};

// Формирует выходной объект с результатом отправки, статусом, временем, длительностью, получателями, endpoint, уникальным ID отправки и UUID адаптивной карточки.
const buildOutput = (response, sendTime, duration, targetEmails, webhookUrl, sendUid, cardUuid) => {
  return {
    output: [[
      response?.status >= 200 && response?.status < 300
        ? "Карточка успешно отправлена"
        : "Карточка не отправлена",
      String(response?.status) ?? null,
      sendTime ?? null,
      duration ?? null,
      Array.isArray(targetEmails) ? targetEmails.join(", ") : null,
      webhookUrl ? webhookUrl.slice(0, 50) + "..." : null,
      sendUid ?? null,
      cardUuid ?? null
    ]],
    output_variables: [
      { name: "message", type: "String" },
      { name: "status", type: "String" },
      { name: "send_time", type: "DateTime" },
      { name: "duration_ms", type: "Double" },
      { name: "recipients", type: "String" },
      { name: "flow_endpoint", type: "String" },
      { name: "send_uid", type: "String" },
      { name: "card_uuid", type: "String" }
    ],
    state: undefined,
    hasNext: false
  };
};

// Выполняет системный блок уведомления, строя и отправляя карточку с заданным стилем, текстами и фактами, возвращая результат.
const executeSystemBlock = (service, style, badgeText, mainText, greetingText, bodyText, facts, actionTitle, bundle, listBlock) => {
  const input = bundle.inputData;
  const webhookUrl = bundle.authData.incoming_webhook_url;
  const targetEmails = (input.target_emails || "").split(",").map(e => e.trim()).filter(Boolean);
  const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sendTime = new Date().toISOString();
  const start = Date.now();
  const cardUuid = input.card_uuid;

  const card = {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "powered by Proceset",
        size: "Small",
        horizontalAlignment: "Right",
        isSubtle: true,
        spacing: "None"
      },
      {
        type: "Container",
        style: style,
        showBorder: true,
        roundedCorners: true,
        spacing: "Medium",
        items: [
          {
            type: "Badge",
            text: badgeText,
            size: "ExtraLarge",
            style: style === "accent" ? "Good" : "Attention",
            icon: style === "accent" ? "MegaphoneLoud" : "Warning",
            horizontalAlignment: "Center"
          },
          {
            type: "TextBlock",
            text: mainText,
            wrap: true,
            weight: "Bolder",
            size: "Medium",
            spacing: "Small",
            horizontalAlignment: "Center"
          }
        ]
      },
      {
        type: "TextBlock",
        text: greetingText,
        wrap: true,
        spacing: "Large",
        horizontalAlignment: "Center"
      },
      {
        type: "TextBlock",
        text: bodyText,
        wrap: true
      },
      ...((() => {
        if (!listBlock) {
          return [];
        }
        const sections = Array.isArray(listBlock) ? listBlock : [listBlock];
        return sections
          .map(section => ({
            title: typeof section?.title === "string" ? section.title : "",
            items: Array.isArray(section?.items) ? section.items.filter(Boolean) : [],
            bullets: section && Object.prototype.hasOwnProperty.call(section, "bullets") ? section.bullets !== false : true,
            spacing: typeof section?.spacing === "string" ? section.spacing : null
          }))
          .filter(section => section.items.length)
          .flatMap(section => {
            const titleBlock = section.title
              ? [{
                type: "TextBlock",
                text: section.title,
                wrap: true,
                weight: "Bolder",
                spacing: "Medium"
              }]
              : [];
            const resolvedSpacing = section.spacing || "Small";
            return [
              ...titleBlock,
              {
                type: "Container",
                spacing: resolvedSpacing,
                items: section.items.map(item => ({
                  type: "TextBlock",
                  text: section.bullets ? `• ${item}` : item,
                  wrap: true,
                  spacing: "None"
                }))
              }
            ];
          });
      })()),
      {
        type: "FactSet",
        facts: facts
      },
      ...(actionTitle ? [{
        type: "ActionSet",
        actions: [
          {
            type: "Action.OpenUrl",
            title: actionTitle,
            style: "positive",
            url: safe(input.dashboard_url),
            iconUrl: "icon:Link"
          }
        ],
        horizontalAlignment: "Right",
        spacing: "ExtraLarge"
      }] : [])
    ],
    data: { targetEmails, card_uuid: input.card_uuid, send_uid: sendUid }
  };

  const response = sendCard(service, webhookUrl, card, sendUid);
  const duration = Date.now() - start;
  return buildOutput(response, sendTime, duration, targetEmails, webhookUrl, sendUid, cardUuid);
};

// Выполняет блок Jira-уведомления, собирая данные, строя карточку и отправляя её, возвращая результат с замерами производительности.
const executeJiraBlock = (service, blockType, bundle) => {
  const input = bundle.inputData;
  const common = getCommonData(bundle, input);
  const issueData = getIssueData(input, common.jiraBaseUrl);
  const contextBlock = buildContextBlock(input, issueData.contextUrl, issueData.issueType);
  const { badgeText, openButtonTitle } = getBadgeAndButton(issueData.issueType, blockType, input);
  const roleFacts = buildRoleFacts(input, issueData.isEpic, issueData.isPRK, blockType);
  const cardBody = buildCardBody(blockType, input, badgeText, contextBlock, roleFacts, issueData.issueUrl, common.targetEmails);
  const cardUuid = input.card_uuid;
  const card = {
    type: "AdaptiveCard",
    version: "1.5",
    body: cardBody,
    actions: [
      {
        type: "Action.OpenUrl",
        title: openButtonTitle,
        url: safe(issueData.issueUrl),
        style: "positive",
        ...(blockType === 'assignee' || blockType === 'nested' ? { iconUrl: "icon:Link" } : {})
      }
    ],
    data: { targetEmails: common.targetEmails, card_uuid: input.card_uuid, send_uid: common.sendUid }
  };
  const response = sendCard(service, common.webhookUrl, card, common.sendUid);
  const duration = Date.now() - common.start;
  return buildOutput(response, common.sendTime, duration, common.targetEmails, common.webhookUrl, common.sendUid, cardUuid);
};

// Выполняет блок уведомления об уволенном сотруднике с незакрытыми задачами, строя и отправляя карточку с деталями задач, возвращая результат.
const executeFiredEmployeeBlock = (service, bundle) => {
  const input = bundle.inputData;
  const webhookUrl = bundle.authData.incoming_webhook_url;
  if (!webhookUrl) {
    throw new Error("URL вебхука не указан. Заполните поле и повторите попытку.");
  }
  const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
  if (!jiraBaseUrl) {
    throw new Error('В настойках подключения не указан jiraBaseUrl. Заполните поле и повторите попытку.');
  }
  const targetEmails = (input.target_emails || "").split(",").map(e => e.trim()).filter(Boolean);
  const projectsData = (input.projects_breakdown || "").split(",").map(s => {
    const [name, count] = s.trim().split(":");
    return { name: name?.trim(), count: parseInt(count?.trim()) || 0 };
  }).filter(p => p.name && p.count > 0);

  // Генерация donut chart data
  const chartData = projectsData.map(p => ({
    legend: p.name,
    value: p.count
  }));
  const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sendTime = new Date().toISOString();
  const start = Date.now();
  const cardUuid = input.card_uuid;

  const card = {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "powered by Proceset",
        size: "Small",
        horizontalAlignment: "Right",
        isSubtle: true,
        spacing: "None"
      },
      {
        type: "Container",
        style: "attention",
        showBorder: true,
        roundedCorners: true,
        spacing: "Medium",
        items: [
          {
            type: "Badge",
            text: "Незакрытые задачи у неактивных пользователей",
            size: "ExtraLarge",
            style: "Attention",
            icon: "Warning"
          },
          {
            type: "TextBlock",
            text: "Обнаружены незакрытые задачи, закрепленные за неактивными пользователями.",
            wrap: true,
            weight: "Bolder",
            size: "Medium",
            spacing: "Small"
          }
        ]
      },
      {
        type: "FactSet",
        facts: [
          {
            title: "Всего незакрытых задач:",
            value: safe(input.total_open_issues)
          }
        ],
        spacing: "Medium"
      },
      ...(projectsData.length > 0 ? [
        {
          type: "TextBlock",
          text: "Распределение по проектам:",
          weight: "Bolder",
          spacing: "Small"
        },
        {
          type: "Chart.Donut",
          title: "Распределение по проектам",
          colorset: "diverging",
          data: chartData
        }
      ] : [])
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "Открыть список в Jira",
        url: `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(safe(input.jql_filter_url))}`,
        iconUrl: "icon:Link",
        style: "positive"
      }
    ],
    data: { targetEmails, card_uuid: input.card_uuid, send_uid: sendUid }
  };

  const response = sendCard(service, webhookUrl, card, sendUid);
  const duration = Date.now() - start;
  return buildOutput(response, sendTime, duration, targetEmails, webhookUrl, sendUid, cardUuid);
};

// Преобразует строковое поле card_names в массив (ожидается строка с названиями только через "; ", при этом сохраняется поддержка JSON-массивов).
const extractCardNames = (raw) => {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      // Fallback to manual splitting if JSON.parse fails
    }
  }
  const normalized = trimmed.replace(/^\[|\]$/g, "");
  const segments = normalized
    .split(/;\s*/)
    .map(name => name.replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
  return segments;
};

// Выполняет блок запроса обратной связи, отправляя интерактивную карточку с формой оценки.
const executeFeedbackBlock = (service, bundle) => {
  const input = bundle.inputData;
  const webhookUrl = bundle.authData.incoming_webhook_url;
  const targetEmails = (input.target_emails || "").split(",").map(e => e.trim()).filter(Boolean);
  const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sendTime = new Date().toISOString();
  const start = Date.now();
  const cardUuid = input.card_uuid;

  const card = {
    type: "AdaptiveCard",
    "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    id: cardUuid,
    body: [
      {
        type: "TextBlock",
        text: "powered by Proceset",
        size: "Small",
        horizontalAlignment: "Right",
        isSubtle: true,
        spacing: "None"
      },
      {
        type: "Container",
        style: "accent",
        showBorder: true,
        roundedCorners: true,
        spacing: "Medium",
        items: [
          {
            type: "Badge",
            text: "Системное уведомление",
            size: "ExtraLarge",
            style: "Good",
            icon: "Feed",
            horizontalAlignment: "Center"
          },
          {
            type: "TextBlock",
            text: "Оцените систему уведомлений JIRA → Teams",
            wrap: true,
            weight: "Bolder",
            size: "Medium",
            spacing: "Small",
            horizontalAlignment: "Center"
          }
        ]
      },
      {
        type: "Input.Rating",
        label: "Ваша оценка",
        id: "feedbackMark",
        value: 0,
        style: "star"
      },
      {
        type: "TextBlock",
        text: "Развернутая обратная связь (необязательно)",
        wrap: true,
        spacing: "Medium"
      },
      {
        type: "Input.Text",
        id: "feedbackText",
        placeholder: "Введите свою идею, предложение или замечание",
        isMultiline: true
      }
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Отправить",
        style: "positive",
        data: {
          action: "send_feedback"
        }
      }
    ],
    data: { targetEmails, card_uuid: cardUuid, send_uid: sendUid }
  };

  const response = sendCard(service, webhookUrl, card, sendUid);
  const duration = Date.now() - start;
  return buildOutput(response, sendTime, duration, targetEmails, webhookUrl, sendUid, cardUuid);
};

app = {
  schema: 2,
  version: '1.7.2',
  label: 'Jira → Teams Уведомления',
  description: 'Уведомления о событиях Jira в Microsoft Teams. Автоматически адаптируется под тип задачи (эпик, задача, подзадача) и роль получателя',
  blocks: {
    NewComment: {
      label: "Новый комментарий",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_type", label: "Тип задачи", type: "text", hint: "issue_type", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "comment_author", label: "Автор комментария", type: "text", hint: "comment_author", required: true },
        { key: "comment_body", label: "Текст комментария", type: "text", hint: "comment_body", required: true },
        { key: "original_comment", label: "Короткий комментарий", type: "text", hint: "original_comment", required: true },
        { key: "separated_comment_part", label: "Отделенная часть комментария", type: "text", hint: "separated_comment_part" },
        { key: "context_issue_key", label: "Ключ контекстной задачи", type: "text", hint: "context_issue_key (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "context_issue_summary", label: "Название контекстной задачи", type: "text", hint: "context_issue_summary (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "assignee", label: "Исполнитель задачи", type: "text", hint: "assignee" },
        { key: "issue_responsible_implementer", label: "Ответственный за внедрение", type: "text", hint: "issue_responsible_implementer" },
        { key: "issue_responsible_sales", label: "Ответственный за продажи", type: "text", hint: "issue_responsible_sales" },
        { key: "issue_responsible_analytic", label: "Ответственный аналитик", type: "text", hint: "issue_responsible_analytic" },
        { key: "issue_responsible_tsupporter", label: "Ответственный специалист ТП", type: "text", hint: "issue_responsible_tsupporter" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeJiraBlock(service, 'comment', bundle)
    },
    StatusChange: {
      label: "Изменение статуса",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_type", label: "Тип задачи", type: "text", hint: "issue_type", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "from_status", label: "Статус до изменения", type: "text", hint: "from_status", required: true },
        { key: "to_status", label: "Статус после изменения", type: "text", hint: "to_status", required: true },
        { key: "created_by", label: "Инициатор изменения", type: "text", hint: "created_by", required: true },
        { key: "context_issue_key", label: "Ключ контекстной задачи", type: "text", hint: "context_issue_key (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "context_issue_summary", label: "Название контекстной задачи", type: "text", hint: "context_issue_summary (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "assignee", label: "Исполнитель задачи", type: "text", hint: "assignee" },
        { key: "issue_responsible_implementer", label: "Ответственный за внедрение", type: "text", hint: "issue_responsible_implementer" },
        { key: "issue_responsible_sales", label: "Ответственный за продажи", type: "text", hint: "issue_responsible_sales" },
        { key: "issue_responsible_analytic", label: "Ответственный аналитик", type: "text", hint: "issue_responsible_analytic" },
        { key: "issue_responsible_tsupporter", label: "Ответственный специалист ТП", type: "text", hint: "issue_responsible_tsupporter" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeJiraBlock(service, 'status', bundle)
    },
    NewIssueAssignee: {
      label: "Новая задача где ты — Исполнитель",
      description: "Отправляет адаптивную карточку в Teams с событием \"Новая задача JIRA, где ты — Исполнитель\", автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_type", label: "Тип задачи", type: "text", hint: "issue_type", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "issue_description", label: "Описание задачи", type: "text", hint: "issue_description", required: true },
        { key: "original_description", label: "Короткое описание", type: "text", hint: "original_description", required: true },
        { key: "separated_description_part", label: "Отделенная часть описания", type: "text", hint: "separated_description_part" },
        { key: "context_issue_key", label: "Ключ контекстной задачи", type: "text", hint: "context_issue_key (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "context_issue_summary", label: "Название контекстной задачи", type: "text", hint: "context_issue_summary (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "created_by", label: "Создатель задачи", type: "text", hint: "created_by", required: true },
        { key: "due_date", label: "Дата исполнения", type: "text", hint: "due_date" },
        { key: "issue_responsible_implementer", label: "Ответственный за внедрение", type: "text", hint: "issue_responsible_implementer" },
        { key: "issue_responsible_sales", label: "Ответственный за продажи", type: "text", hint: "issue_responsible_sales" },
        { key: "issue_responsible_analytic", label: "Ответственный аналитик", type: "text", hint: "issue_responsible_analytic" },
        { key: "issue_responsible_tsupporter", label: "Ответственный специалист ТП", type: "text", hint: "issue_responsible_tsupporter" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails (E-mail адреса через запятую)", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],
      executePagination: (service, bundle) => executeJiraBlock(service, 'assignee', bundle)
    },
    NewNestedIssue: {
      label: "Новая вложенная задача/подзадача",
      description: "Отправляет адаптивную карточку в Teams для новых задач и подзадач (исключая эпики, которые обрабатываются отдельным блоком)",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_type", label: "Тип задачи", type: "text", hint: "issue_type", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "issue_description", label: "Описание задачи", type: "text", hint: "issue_description", required: true },
        { key: "original_description", label: "Короткое описание", type: "text", hint: "original_description", required: true },
        { key: "separated_description_part", label: "Отделенная часть описания", type: "text", hint: "separated_description_part" },
        { key: "context_issue_key", label: "Ключ контекстной задачи", type: "text", hint: "context_issue_key (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "context_issue_summary", label: "Название контекстной задачи", type: "text", hint: "context_issue_summary (если задача - то ссылка на эпик, если подзадача, то ссылка на родителя)" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "created_by", label: "Создатель задачи", type: "text", hint: "created_by", required: true },
        { key: "assignee", label: "Исполнитель задачи", type: "text", hint: "assignee" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeJiraBlock(service, 'nested', bundle)
    },
    NewProjectIssue: {
      label: "Новая задача в проекте",
      description: "Отправляет адаптивную карточку в Teams при создании новой задачи внутри проекта (с поддержкой отображения эпика и скрывающегося описания)",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_type", label: "Тип задачи", type: "text", hint: "issue_type", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "issue_description", label: "Описание задачи", type: "text", hint: "issue_description", required: true },
        { key: "original_description", label: "Короткое описание", type: "text", hint: "original_description", required: true },
        { key: "separated_description_part", label: "Отделенная часть описания", type: "text", hint: "separated_description_part" },
        { key: "context_issue_key", label: "Ключ эпика", type: "text", hint: "context_issue_key (если есть связь с эпиком)" },
        { key: "context_issue_summary", label: "Название эпика", type: "text", hint: "context_issue_summary" },
        { key: "project_name", label: "Название проекта", type: "text", hint: "project_name" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "created_by", label: "Инициатор", type: "text", hint: "created_by", required: true },
        { key: "assignee", label: "Исполнитель задачи", type: "text", hint: "assignee" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeJiraBlock(service, 'project_issue', bundle)
    },
    NewCardType: {
      label: "Добавление типа уведомления (Системное)",
      description: "Отправляет адаптивную карточку в Teams при добавлении нового типа уведомления в системе Jira → Teams.",
      inputFields: [
        { key: "employee_name", label: "Имя сотрудника", hint: "employee_name", type: "text", required: true },
        { key: "card_name_ru", label: "Наименование типа уведомления", hint: 'card_name_ru', type: "text", required: true },
        { key: "created_at", label: "Дата добавления", hint: "created_at", type: "text", required: true },
        { key: "dashboard_url", label: "Ссылка на дашборд", hint: "dashboard_url", type: "text", required: true },
        { key: "target_emails", label: "Список получателей (через запятую)", hint: "target_emails", type: "text", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeSystemBlock(
        service,
        "accent",
        "Системное уведомление",
        "**Добавлен новый тип уведомления**",
        `Приветствуем, ${safe(bundle.inputData.employee_name)}!`,
        "Спешим сообщить, что в системе уведомлений Jira → Teams стал доступен новый тип уведомлений. Ты можешь с ним подробно ознакомиться ниже:",
        [
          { title: "Тип:", value: `**${safe(bundle.inputData.card_name_ru)}**` },
          { title: "Дата добавления:", value: safe(bundle.inputData.created_at) }
        ],
        "Перейти в отчет",
        bundle,
        null
      )
    },
    RemoveCardType: {
      label: "Удаление типа уведомления (Системное)",
      description: "Отправляет адаптивную карточку в Teams при удалении типа уведомления в системе Jira → Teams.",
      inputFields: [
        { key: "employee_name", label: "Имя сотрудника", hint: "employee_name", type: "text", required: true },
        { key: "card_name_ru", label: "Наименование типа уведомления", hint: 'card_name_ru', type: "text", required: true },
        { key: "deleted_at", label: "Дата удаления", hint: "deleted_at", type: "text", required: true },
        { key: "dashboard_url", label: "Ссылка на дашборд", hint: "dashboard_url", type: "text", required: true },
        { key: "target_emails", label: "Список получателей (через запятую)", hint: "target_emails", type: "text", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeSystemBlock(
        service,
        "attention",
        "Системное уведомление",
        "**Тип уведомления был удалён**",
        `Приветствуем, ${safe(bundle.inputData.employee_name)}!`,
        "Сообщаем, что один из типов уведомлений в системе Jira → Teams был удалён и больше не доступен для использования.",
        [
          { title: "Удалённый тип:", value: `**${safe(bundle.inputData.card_name_ru)}**` },
          { title: "Дата удаления:", value: safe(bundle.inputData.deleted_at) }
        ],
        null,
        bundle,
        null
      )
    },
    FiredEmployeeOpenIssues: {
      label: "Незакрытые задачи с неактивными пользователями",
      description: "Отправляет адаптивную карточку в Teams при обнаружении незакрытых задач с наличием в них неактивных пользователей.",
      inputFields: [
        { key: "total_open_issues", label: "Всего незакрытых задач", type: "text", hint: "total_open_issues", required: true },
        { key: "projects_breakdown", label: "Распределение по проектам", type: "text", hint: "projects_breakdown (данные в формате Project:Count, Project2:Count2 через запятую)", required: true },
        { key: "issue_list", label: "Список незакрытых задач", type: "text", hint: "issue_list (данные через запятую)", required: true },
        { key: "jql_filter_url", label: "Ссылка на JQL фильтр в Jira", type: "text", hint: "jql_filter_url", required: true },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails (E-mail адреса через запятую)", required: true }
      ],

      executePagination: (service, bundle) => executeFiredEmployeeBlock(service, bundle)
    },
    CommentFromABochkin: {
      label: "Новый комментарий от А.Бочкина",
      description: "Отправляет адаптивную карточку в Teams при комментарии от А.Бочкин",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи", type: "text", hint: "issue_key", required: true },
        { key: "issue_summary", label: "Название задачи", type: "text", hint: "issue_summary", required: true },
        { key: "issue_project_name", label: "Название проекта", type: "text", hint: "issue_project_name", required: true },
        { key: "issue_type_name", label: "Название типа задачи", type: "text", hint: "issue_type_name", required: true },
        { key: "comment_author", label: "Автор комментария", type: "text", hint: "comment_author", required: true },
        { key: "comment_body", label: "Текст комментария", type: "text", hint: "comment_body", required: true },
        { key: "assignee", label: "Исполнитель задачи", type: "text", hint: "assignee" },
        { key: "reporter", label: "Автор задачи", type: "text", hint: "reporter" },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => executeJiraBlock(service, 'specific_comment', bundle)
    },
    GlobalSubscriptionActivation: {
      label: "Подписка (глобальная, типовая): активация (Системное)",
      description: "Карточка о системном или самостоятельном подключении пользователя к глобальной подписке и выбранным типам уведомлений.",
      inputFields: [
        { key: "employee_name", label: "Имя сотрудника", type: "text", hint: "employee_name", required: true },
        { key: "card_names", label: "Типы уведомлений", type: "text", hint: "card_names (строка с названиями через '; ')", required: false },
        { key: "dashboard_url", label: "Ссылка на дашборд", type: "text", hint: "dashboard_url", required: true },
        { key: "email", label: "E-mail пользователя", type: "text", hint: "email", required: true },
        { key: "started_at", label: "Дата подключения", type: "text", hint: "started_at", required: true },
        { key: "change_source", label: "Кто инициировал изменение", type: "text", hint: "change_source (admin или user)", required: false },
        { key: "change_scope", label: "Что изменилось", type: "text", hint: "change_scope (global, types, both)", required: false },
        { key: "notifications_from_bot", label: "Уведомления от ботов (1/0)", type: "text", hint: "notifications_from_bot", required: false },
        { key: "project_to_add", label: "Проект (добавление)", type: "text", hint: "project_to_add", required: false },
        { key: "issues_to_add", label: "Задачи (добавление)", type: "text", hint: "issues_to_add (типы через ';' или ',')", required: false },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const changeSource = (input.change_source || "admin").toLowerCase();
        const isAdminChange = changeSource !== "user";
        const notificationsFromBotFlag = parseBinaryToggle(input.notifications_from_bot);
        const hasBotToggle = notificationsFromBotFlag !== null;
        const defaultScope = isAdminChange ? "both" : "types";
        const scopeRaw = (input.change_scope || (hasBotToggle ? "bots" : defaultScope)).toLowerCase();
        const allowedScopes = new Set(["global", "types", "both", "bots"]);
        const changeScope = allowedScopes.has(scopeRaw) ? scopeRaw : (hasBotToggle ? "bots" : defaultScope);
        const includeTypeList = changeScope === "types" || changeScope === "both" || changeScope === "bots";
        const rawCardNames = extractCardNames(input.card_names).map(name => safe(name));
        const cardNamesArray = includeTypeList ? rawCardNames : [];
        const primaryNotificationName = rawCardNames[0] || safe(input.event_type_name || input.subscription_name || "уведомлению");
        const startedAtValue = safe(input.started_at || input.start_time || input.activated_at);
        const botActorLabel = isAdminChange ? "Мы" : "Ты";
        const botScopeBodyText = buildNotificationsFromBotMessage(
          notificationsFromBotFlag,
          cardNamesArray,
          primaryNotificationName,
          botActorLabel,
          true
        );
        const botNotificationsNote = buildNotificationsFromBotNote(
          notificationsFromBotFlag,
          rawCardNames,
          primaryNotificationName,
          botActorLabel
        );
        bundle.inputData.target_emails = input.email; // Установить targetEmails как email пользователя
        const activationCopy = (() => {
          if (isAdminChange) {
            if (changeScope === "bots" && botScopeBodyText) {
              return {
                style: "accent",
                badgeText: "Системное уведомление",
                mainText: "**Тебя подключили к уведомлениям от автоматизированных почтовых ящиков Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: botScopeBodyText,
                includeList: cardNamesArray.length > 0
              };
            }
            return {
              style: "accent",
              badgeText: "Системное уведомление",
              mainText: "**Тебя подключили к системе уведомлений Jira → Teams**",
              greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
              bodyText: "Мы подключили тебя к глобальной подписке на уведомления и активировали следующие типы уведомлений:",
              includeList: cardNamesArray.length > 0
            };
          }
          switch (changeScope) {
            case "global":
              return {
                style: "accent",
                badgeText: "Системное уведомление",
                mainText: "**Ты включил глобальную подписку Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно подключил глобальную подписку на уведомления Jira → Teams.",
                includeList: false
              };
            case "types":
              return {
                style: "accent",
                badgeText: "Системное уведомление",
                mainText: "**Ты активировал типы уведомлений Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно активировал следующие типы уведомлений:",
                includeList: cardNamesArray.length > 0
              };
            case "bots":
              return {
                style: "accent",
                badgeText: "Системное уведомление",
                mainText: "**Ты изменил уведомления от автоматизированных почтовых ящиков Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: botScopeBodyText || "Ты обновил настройки уведомлений от автоматизированных почтовых ящиков Jira → Teams.",
                includeList: cardNamesArray.length > 0
              };
            case "both":
            default:
              return {
                style: "accent",
                badgeText: "Системное уведомление",
                mainText: "**Ты активировал систему уведомлений Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно подключил глобальную подписку на уведомления и активировал следующие типы уведомлений:",
                includeList: cardNamesArray.length > 0
              };
          }
        })();
        const parameterizedData = collectParameterizedEntries(input);
        const parameterLines = buildParameterizedLines(parameterizedData.entries, parameterizedData.mode);
        if (changeScope !== "bots") {
          switch (parameterizedData.mode) {
            case "addition":
              activationCopy.bodyText = `Ты добавил следующие **параметры** к уведомлению **${primaryNotificationName}**:`;
              break;
            case "removal":
              activationCopy.bodyText = `Ты убрал следующие **параметры** к уведомлению **${primaryNotificationName}**:`;
              break;
            case "initial":
            default:
              break;
          }
        }
        const isBotsOnlyScope = changeScope === "bots";
        const canShowRawNames = rawCardNames.length && (!isBotsOnlyScope || rawCardNames.length > 1);
        const shouldShowSelectedList = activationCopy.includeList && cardNamesArray.length && (!isBotsOnlyScope || cardNamesArray.length > 1);
        const listSections = [];
        if (parameterizedData.mode === "initial" && canShowRawNames) {
          listSections.push({ title: "", items: rawCardNames.map(name => `*${name}*`), bullets: false });
        } else if (shouldShowSelectedList && parameterizedData.mode === "none") {
          listSections.push({ title: "", items: cardNamesArray });
        }
        if (botNotificationsNote && changeScope !== "bots") {
          listSections.push({ title: "", items: [botNotificationsNote], bullets: false, spacing: "Medium" });
        }
        if (parameterLines.length) {
          listSections.push({ title: "", items: parameterLines, bullets: false, spacing: "Default" });
        }
        return executeSystemBlock(
          service,
          activationCopy.style,
          activationCopy.badgeText,
          activationCopy.mainText,
          activationCopy.greetingText,
          activationCopy.bodyText,
          [
            { title: "Дата подключения:", value: startedAtValue }
          ],
          "Перейти в отчёт",
          bundle,
          listSections.length ? listSections : null
        );
      }
    },
    GlobalSubscriptionDeactivation: {
      label: "Подписка (глобальная, типовая): деактивация (Системное)",
      description: "Карточка о системном или самостоятельном отключении пользователя от глобальной подписки и типов уведомлений.",
      inputFields: [
        { key: "employee_name", label: "Имя сотрудника", type: "text", hint: "employee_name", required: true },
        { key: "card_names", label: "Типы уведомлений", type: "text", hint: "card_names (строка с названиями через '; ')", required: false },
        { key: "dashboard_url", label: "Ссылка на дашборд", type: "text", hint: "dashboard_url", required: true },
        { key: "email", label: "E-mail пользователя", type: "text", hint: "email", required: true },
        { key: "deactivated_at", label: "Дата отключения", type: "text", hint: "deactivated_at", required: true },
        { key: "change_source", label: "Кто инициировал изменение", type: "text", hint: "change_source (admin или user)", required: false },
        { key: "change_scope", label: "Что изменилось", type: "text", hint: "change_scope (global, types, both)", required: false },
        { key: "notifications_from_bot", label: "Уведомления от ботов (1/0)", type: "text", hint: "notifications_from_bot", required: false },
        { key: "project_to_delete", label: "Проект (удаление)", type: "text", hint: "project_to_delete", required: false },
        { key: "issues_to_delete", label: "Задачи (удаление)", type: "text", hint: "issues_to_delete (типы через ';' или ',')", required: false },
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const changeSource = (input.change_source || "admin").toLowerCase();
        const isAdminChange = changeSource !== "user";
        const notificationsFromBotFlag = parseBinaryToggle(input.notifications_from_bot);
        const hasBotToggle = notificationsFromBotFlag !== null;
        const defaultScope = isAdminChange ? "both" : "types";
        const scopeRaw = (input.change_scope || (hasBotToggle ? "bots" : defaultScope)).toLowerCase();
        const allowedScopes = new Set(["global", "types", "both", "bots"]);
        const changeScope = allowedScopes.has(scopeRaw) ? scopeRaw : (hasBotToggle ? "bots" : defaultScope);
        const includeTypeList = changeScope === "types" || changeScope === "both" || changeScope === "bots";
        const rawCardNames = extractCardNames(input.card_names).map(name => safe(name));
        const cardNamesArray = includeTypeList ? rawCardNames : [];
        const primaryNotificationName = rawCardNames[0] || safe(input.event_type_name || input.subscription_name || "уведомлению");
        const deactivatedAtValue = safe(input.deactivated_at || input.start_time || input.disabled_at);
        const botActorLabel = isAdminChange ? "Мы" : "Ты";
        const botScopeBodyText = buildNotificationsFromBotMessage(
          notificationsFromBotFlag,
          cardNamesArray,
          primaryNotificationName,
          botActorLabel,
          true
        );
        const botNotificationsNote = buildNotificationsFromBotNote(
          notificationsFromBotFlag,
          rawCardNames,
          primaryNotificationName,
          botActorLabel
        );
        bundle.inputData.target_emails = input.email; // Установить targetEmails как email пользователя
        const deactivationCopy = (() => {
          if (isAdminChange) {
            if (changeScope === "bots" && botScopeBodyText) {
              return {
                style: "attention",
                badgeText: "Системное уведомление",
                mainText: "**Тебя отключили от уведомлений автоматизированных почтовых ящиков Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: botScopeBodyText,
                includeList: cardNamesArray.length > 0
              };
            }
            return {
              style: "attention",
              badgeText: "Системное уведомление",
              mainText: "**Тебя отключили от системы уведомлений Jira → Teams**",
              greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
              bodyText: "Мы отключили тебя от глобальной подписки на уведомления и деактивировали следующие типы уведомлений:",
              includeList: cardNamesArray.length > 0
            };
          }
          switch (changeScope) {
            case "global":
              return {
                style: "attention",
                badgeText: "Системное уведомление",
                mainText: "**Ты отключил глобальную подписку Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно отключил глобальную подписку на уведомления Jira → Teams.",
                includeList: false
              };
            case "types":
              return {
                style: "attention",
                badgeText: "Системное уведомление",
                mainText: "**Ты отключил типы уведомлений Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно отключил следующие типы уведомлений:",
                includeList: cardNamesArray.length > 0
              };
            case "bots":
              return {
                style: "attention",
                badgeText: "Системное уведомление",
                mainText: "**Ты изменил уведомления от автоматизированных почтовых ящиков Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: botScopeBodyText || "Ты обновил настройки уведомлений от автоматизированных почтовых ящиков Jira → Teams.",
                includeList: cardNamesArray.length > 0
              };
            case "both":
            default:
              return {
                style: "attention",
                badgeText: "Системное уведомление",
                mainText: "**Ты отключил систему уведомлений Jira → Teams**",
                greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
                bodyText: "Ты самостоятельно отключил глобальную подписку на уведомления и деактивировал следующие типы уведомлений:",
                includeList: cardNamesArray.length > 0
              };
          }
        })();
        const parameterizedData = collectParameterizedEntries(input);
        const parameterLines = buildParameterizedLines(parameterizedData.entries, parameterizedData.mode);
        if (changeScope !== "bots") {
          if (parameterizedData.mode === "removal") {
            deactivationCopy.bodyText = `Ты убрал следующие **параметры** к уведомлению **${primaryNotificationName}**`;
          } else if (parameterizedData.mode === "addition") {
            deactivationCopy.bodyText = `Ты добавил следующие **параметры** к уведомлению **${primaryNotificationName}**`;
          }
        }
        const isBotsOnlyScope = changeScope === "bots";
        const canShowRawNames = rawCardNames.length && (!isBotsOnlyScope || rawCardNames.length > 1);
        const shouldShowSelectedList = deactivationCopy.includeList && cardNamesArray.length && (!isBotsOnlyScope || cardNamesArray.length > 1);
        const listSections = [];
        if (parameterizedData.mode === "initial" && canShowRawNames) {
          listSections.push({ title: "", items: rawCardNames.map(name => `*${name}*`), bullets: false });
        } else if (shouldShowSelectedList && parameterizedData.mode === "none") {
          listSections.push({ title: "", items: cardNamesArray });
        }
        if (botNotificationsNote && changeScope !== "bots") {
          listSections.push({ title: "", items: [botNotificationsNote], bullets: false, spacing: "Medium" });
        }
        if (parameterLines.length) {
          listSections.push({ title: "", items: parameterLines, bullets: false, spacing: "Default" });
        }
        return executeSystemBlock(
          service,
          deactivationCopy.style,
          deactivationCopy.badgeText,
          deactivationCopy.mainText,
          deactivationCopy.greetingText,
          deactivationCopy.bodyText,
          [
            { title: "Дата отключения:", value: deactivatedAtValue }
          ],
          null,
          bundle,
          listSections.length ? listSections : null
        );
      }
    },
    RequestFeedback: {
      label: "Запрос обратной связи",
      description: "Отправляет интерактивную адаптивную карточку с формой для оценки системы уведомлений JIRA → Teams",
      inputFields: [
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true },
        { key: "target_emails", label: "Получатели уведомления", type: "text", hint: "target_emails", required: true }
      ],

      executePagination: (service, bundle) => executeFeedbackBlock(service, bundle)
    }
  },
  connections: {
    TeamsIncomingWebhookConnect: {
      label: "Подключение к Microsoft Teams (Incoming Webhook)",
      description: "Позволяет указать URL вебхука Microsoft Teams для отправки адаптивных карточек",
      inputFields: [
        {
          key: "incoming_webhook_url",
          type: "password",
          label: "Входящий веб-перехватчик Teams Power Automate",
          hint: "incoming_webhook_url",
          required: true
        },
        {
          key: "jira_base_url",
          label: "Базовый URL Jira",
          type: "text",
          placeholder: "https://example.jira.domain.name.com",
          hint: "jira_base_url",
          required: true
        },
        {
          key: "authorize_button",
          type: "button",
          label: "Проверить подключение",
          typeOptions: {
            saveFields: (service, bundle) => {
              const url = bundle.authData.incoming_webhook_url;
              const testPayload = {
                text: "Тестовое сообщение от Proceset. Подключение успешно."
              };

              const response = service.request({
                url: url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                jsonBody: testPayload
              });

              if (response.status >= 200 && response.status < 300) {
                return { connect_status: 200 };
              } else {
                throw new Error("Не удалось отправить тестовое сообщение. Проверьте URL вебхука.");
              }
            },
            message: (service, bundle) => {
              if (bundle.authData.connect_status === 200) {
                return "Успешно подключено к Microsoft Teams!";
              }
              throw new Error("Ошибка при проверке подключения.");
            }
          }
        },
        {
          key: "un_authorize_button",
          type: "button",
          label: "Удалить подключение",
          typeOptions: {
            saveFields: () => ({
              incoming_webhook_url: null,
              jira_base_url: "",
              connect_status: null
            }),
            message: () => "Подключение удалено."
          }
        }
      ],
      execute: (service, bundle) => ({
        webhookUrl: bundle.authData.incoming_webhook_url,
        jiraBaseUrl: bundle.authData.jira_base_url
      })
    }
  }
}