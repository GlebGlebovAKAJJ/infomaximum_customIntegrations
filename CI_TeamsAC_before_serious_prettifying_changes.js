// Вспомогательные функции и константы

// Очищает строку от специальных символов (переносы строк и кавычки), заменяя их на безопасные альтернативы, или возвращает дефолтное значение, если вход пустой.
const safe = s => {
  if (!s) return "-";
  const str = String(s);
  if (!/[\r\n\"]/.test(str)) return str;
  return str.replace(/[\r\n]+/g, " ").replace(/\"/g, "'");
};

// Преобразует текст из Jira wiki/HTML в Markdown-compatible формат для Teams Adaptive Cards.
const prettify = input => {
  if (!input) return '';

  // Удалить HTML-теги
  let result = input.replace(/<[^>]*>/g, '');

  // Преобразовать Jira wiki в Markdown
  // Жирный текст: *text* -> **text**
  result = result.replace(/\*([^*]+)\*/g, '**$1**');
  // Курсив: _text_ -> *text* (но избегать в URL)
  // Сначала временно заменить URL
  const urlPlaceholder = '###URL_PLACEHOLDER###';
  const urls = [];
  result = result.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    urls.push(match);
    return urlPlaceholder;
  });
  result = result.replace(/_([^_]+)_/g, '*$1*');
  // Восстановить URL
  urls.forEach(url => {
    result = result.replace(urlPlaceholder, url);
  });

  // Код: {{text}} -> `text`
  result = result.replace(/\{\{([^}]+)\}\}/g, '`$1`');
  // Ссылки: [text|url] -> [text](url)
  result = result.replace(/\[([^\|]+)\|([^\]]+)\]/g, '[$1]($2)');
  // Заголовки: h1. text -> # text
  result = result.replace(/^h(\d+)\.\s*(.+)$/gm, (match, level, text) => '#'.repeat(parseInt(level)) + ' ' + text);
  // Изображения: !image.png|alt! -> ![alt](image.png)
  result = result.replace(/!([^|!]+)(\|([^!]+))?!/g, '![$3]($1)');
  // Блоки кода: {code:lang} ... {code} -> ```lang ... ```
  result = result.replace(/\{code(?::(\w+))?\}([\s\S]*?)\{code\}/g, (match, lang, code) => {
    return '```' + (lang || '') + '\n' + code.trim() + '\n```';
  });
  // Упоминания пользователей: [~username] -> @username
  result = result.replace(/\[~([^\]]+)\]/g, '@$1');
  // Email: [mailto:email] -> email
  result = result.replace(/\[mailto:([^\]]+)\]/g, '$1');

  // Очистить лишние пробелы
  result = result.replace(/\s+/g, ' ').trim();
  // Удалить кавычки вокруг текста
  result = result.replace(/^"|"$/g, '');

  return result;
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
    inlines: [
      { type: "TextRun", text: label, weight: "Bolder" },
      {
        type: "TextRun",
        text: `[${safe(input.context_issue_key)}] ${safe(input.context_issue_summary)}`,
        color: "Accent",
        selectAction: { type: "Action.OpenUrl", url: contextUrl }
      }
    ]
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
  } else if (blockType === 'nested') {
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
    text: "powered by IM LLC / Proceset",
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
        style: blockType === 'comment' ? "Accent" : blockType === 'status' ? "Accent" : blockType === 'assignee' ? "Attention" : blockType === 'specific_comment' ? "Warning" : "Good",
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
            inlines: [
              { type: "TextRun", text: `${safe(input.comment_body)}`, wrap: true }
            ]
          }
        ],
        style: "emphasis",
        spacing: "None"
      }
    ];
  } else if (blockType === 'comment') {
    if (input.separated_comment_part && input.separated_comment_part.trim() !== '') {
      specificParts = [
        {
          type: "TextBlock",
          text: `**${safe(input.comment_author)}** пишет:`,
          wrap: true,
          spacing: "Small"
        },
        {
          type: "TextBlock",
          text: safe(input.original_comment),
          wrap: true,
          spacing: "None"
        },
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
          items: [
            {
              type: "RichTextBlock",
              inlines: [
                {
                  type: "TextRun",
                  text: prettify(input.separated_comment_part),
                  wrap: true
                }
              ]
            }
          ]
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
        {
          type: "Container",
          items: [
            {
              type: "RichTextBlock",
              inlines: [
                { type: "TextRun", text: `${prettify(input.comment_body)}`, wrap: true }
              ]
            }
          ],
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
            inlines: [
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
            ]
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
  } else if (blockType === 'nested') {
    let descriptionParts = [];
    if (input.separated_description_part && input.separated_description_part.trim() !== '') {
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
          text: "**Описание задачи:**",
          wrap: true,
          spacing: "Small"
        },
        {
          type: "Container",
          items: [
            {
              type: "RichTextBlock",
              inlines: [
                {
                  type: "TextRun",
                  text: `${prettify(input.issue_description)}`
                }
              ]
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
        text: "powered by IM LLC / Proceset",
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
        wrap: true,
        isSubtle: true
      },
      ...(listBlock ? [
        {
          type: "Container",
          items: listBlock.items.map(item => ({
            type: "TextBlock",
            text: `• ${item}`,
            wrap: true,
            spacing: "None"
          }))
        }
      ] : []),
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
        text: "powered by IM LLC / Proceset",
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

app = {
  schema: 2,
  version: '1.5.0',
  label: 'Jira → Teams Уведомления',
  description: 'Интеллектуальные уведомления о событиях Jira в Microsoft Teams. Автоматически адаптируется под тип задачи (эпик, задача, подзадача) и роль получателя',
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
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const changeSource = (input.change_source || "admin").toLowerCase();
        const isAdminChange = changeSource !== "user";
        const scopeRaw = (input.change_scope || (isAdminChange ? "both" : "types")).toLowerCase();
        const allowedScopes = new Set(["global", "types", "both"]);
        const changeScope = allowedScopes.has(scopeRaw) ? scopeRaw : "both";
        const includeTypeList = changeScope === "types" || changeScope === "both";
        const cardNamesArray = includeTypeList ? extractCardNames(input.card_names).map(name => safe(name)) : [];
        bundle.inputData.target_emails = input.email; // Установить targetEmails как email пользователя
        const activationCopy = isAdminChange
          ? {
            style: "accent",
            badgeText: "Системное уведомление",
            mainText: "**Тебя подключили к системе уведомлений Jira → Teams**",
            greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
            bodyText: "Мы подключили тебя к глобальной подписке на уведомления и активировали следующие типы уведомлений:",
            includeList: cardNamesArray.length > 0
          }
          : (() => {
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
        return executeSystemBlock(
          service,
          activationCopy.style,
          activationCopy.badgeText,
          activationCopy.mainText,
          activationCopy.greetingText,
          activationCopy.bodyText,
          [
            { title: "Дата подключения:", value: safe(input.started_at) }
          ],
          "Перейти в отчёт",
          bundle,
          activationCopy.includeList ? { title: "", items: cardNamesArray } : null
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
        { key: "card_uuid", label: "UUID адаптивной карточки", type: "text", hint: "card_uuid", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const changeSource = (input.change_source || "admin").toLowerCase();
        const isAdminChange = changeSource !== "user";
        const scopeRaw = (input.change_scope || (isAdminChange ? "both" : "types")).toLowerCase();
        const allowedScopes = new Set(["global", "types", "both"]);
        const changeScope = allowedScopes.has(scopeRaw) ? scopeRaw : "both";
        const includeTypeList = changeScope === "types" || changeScope === "both";
        const cardNamesArray = includeTypeList ? extractCardNames(input.card_names).map(name => safe(name)) : [];
        bundle.inputData.target_emails = input.email; // Установить targetEmails как email пользователя
        const deactivationCopy = isAdminChange
          ? {
            style: "attention",
            badgeText: "Системное уведомление",
            mainText: "**Тебя отключили от системы уведомлений Jira → Teams**",
            greetingText: `Приветствуем, **${safe(input.employee_name)}**!`,
            bodyText: "Мы отключили тебя от глобальной подписки на уведомления и деактивировали следующие типы уведомлений:",
            includeList: cardNamesArray.length > 0
          }
          : (() => {
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
        return executeSystemBlock(
          service,
          deactivationCopy.style,
          deactivationCopy.badgeText,
          deactivationCopy.mainText,
          deactivationCopy.greetingText,
          deactivationCopy.bodyText,
          [
            { title: "Дата отключения:", value: safe(input.deactivated_at) }
          ],
          null,
          bundle,
          deactivationCopy.includeList ? { title: "", items: cardNamesArray } : null
        );
      }
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