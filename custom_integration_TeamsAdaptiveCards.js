app = {
  schema: 2,
  version: '0.0.7',
  label: 'TeamsAdaptiveCards',
  description: 'Позволяет отправлять уведомления о новых событиях Jira в Teams с применением адаптивных карточек, используя Copilot Agent',
  blocks: {
    SendTeamsAdaptiveCard_NewComment_Generic: {
      label: "Новый комментарий (Универсальный)",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "issue_key", type: "text", required: true },
        { key: "issue_summary", label: "issue_summary", type: "text", required: true },
        { key: "issue_url", label: "issue_url", type: "text", required: true },
        { key: "issue_type", label: "issue_type", type: "text", required: true },
        { key: "issue_type_name", label: "issue_type_name", type: "text", required: true },
        { key: "comment_author", label: "creator_name", type: "text", required: true },
        { key: "comment_body", label: "comment_body", type: "text", required: true },
        { key: "comment_created", label: "created_at", type: "text" },
        { key: "epic_key", label: "epic_key", type: "text" },
        { key: "epic_summary", label: "epic_summary", type: "text" },
        { key: "parent_key", label: "parent_key", type: "text" },
        { key: "parent_summary", label: "parent_summary", type: "text" },
        { key: "reporter", label: "reporter_name", type: "text" },
        { key: "assignee", label: "assignee_name", type: "text" },
        { key: "issue_responsible_implementer", label: "issue_responsible_implementer", type: "text" },
        { key: "issue_responsible_sales", label: "issue_responsible_sales", type: "text" },
        { key: "issue_responsible_analytic", label: "issue_responsible_analytic", type: "text" },
        { key: "issue_responsible_tsupporter", label: "issue_responsible_tsupporter", type: "text" },
        { key: "target_emails", label: "target_emails", type: "text", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");

        const webhookUrl = bundle.authData.incoming_webhook_url;
        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);

        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const sendTime = new Date().toISOString();
        const start = Date.now();

        const issueUrl = input.issue_url || `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;
        const epicUrl = input.epic_key ? `${jiraBaseUrl}/browse/${safe(input.epic_key)}` : null;
        const parentUrl = input.parent_key ? `${jiraBaseUrl}/browse/${safe(input.parent_key)}` : null;

        // 🔹 Определяем тип задачи и проект
        const issueType = input.issue_type?.toLowerCase() || "";
        const projectKey = (input.issue_key?.split("-")[0] || "").toUpperCase();
        const isEpic = issueType === "epic";
        const isPRK = projectKey === "PRK";

        // 🔹 Заголовок бейджа и контекстный блок
        let badgeText = "";
        let contextBlock = null;
        let openButtonTitle = "Открыть задачу";

        switch (issueType) {
          case "epic":
            badgeText = "Новый комментарий в Epic";
            openButtonTitle = "Открыть Epic";
            break;
          case "subtask":
            badgeText = "Новый комментарий в подзадаче";
            openButtonTitle = "Открыть подзадачу";
            if (input.parent_key && input.parent_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Родительская задача: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.parent_key)}] ${safe(input.parent_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: parentUrl }
                  }
                ]
              };
            }
            break;
          default:
            badgeText = "Новый комментарий в задаче";
            openButtonTitle = "Открыть задачу";
            if (input.epic_key && input.epic_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Эпик: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.epic_key)}] ${safe(input.epic_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: epicUrl }
                  }
                ]
              };
            }
        }

        // 🔹 Формируем секцию ролей (разные для PRK-эпиков и остальных)
        let roleFacts = [];

        if (isEpic && isPRK) {
          // Эпик проекта PRK → показываем расширенные роли
          roleFacts = [
            { title: "Менеджер внедрений:", value: safe(input.issue_responsible_implementer) },
            { title: "Менеджер по продажам:", value: safe(input.issue_responsible_sales) },
            { title: "Аналитик:", value: safe(input.issue_responsible_analytic) },
            { title: "Специалист ТП:", value: safe(input.issue_responsible_tsupporter) },
            { title: "Дата комментария:", value: safe(input.comment_created) }
          ].filter(f => f.value && f.value !== "-");
        } else if (isEpic) {
          // Эпик другого проекта → стандартные поля
          roleFacts = [
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Дата комментария:", value: safe(input.comment_created) }
          ];
        } else {
          // Обычные задачи / подзадачи
          roleFacts = [
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Дата комментария:", value: safe(input.comment_created) }
          ];
        }

        // 🔹 Формируем тело карточки
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
              items: [
                { type: "Badge", text: badgeText, size: "Large", style: "Accent", icon: "CommentAdd" },
                {
                  type: "TextBlock",
                  text: `**[${safe(input.issue_key)}]** ${safe(input.issue_summary)}`,
                  wrap: true,
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Small"
                }
              ],
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
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
            },
            ...(contextBlock ? [contextBlock] : []),
            {
              type: "FactSet",
              facts: roleFacts,
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: openButtonTitle,
              url: safe(issueUrl),
              style: "positive"
            }
          ],
          data: { targetEmails }
        };

        // 🔹 Отправка карточки
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

        const duration = Date.now() - start;
        const respBody = new TextDecoder().decode(response.response || new TextEncoder().encode(""));

        if (response.status < 200 || response.status >= 300)
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);

        // 🔹 Возврат результатов
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
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_NewComment: {
      label: "Новый комментарий",
      description: "Отправляет адаптивную карточку в Teams с событием \"Новый комментарий в задаче JIRA\"",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи (issue_key)", type: "text", required: true },
        { key: "issue_summary", label: "Название задачи (issue_summary)", type: "text", required: true },
        { key: "issue_url", label: "URL задачи (issue_key)", type: "text", required: true },
        { key: "comment_author", label: "Автор комментария (created_by_emailAdress)", type: "text", required: true },
        { key: "comment_body", label: "Текст комментария (comment_body)", type: "text", required: true },
        { key: "comment_created", label: "Дата публикации (created_at)", type: "text" },
        { key: "epic_summary", label: "Название эпика (epic_summary)", type: "text" },
        { key: "epic_url", label: "URL эпика (epic_link)", type: "text" },
        { key: "reporter", label: "Автор задачи (issue_reporter)", type: "text" },
        { key: "assignee", label: "Исполнитель (issue_assignee)", type: "text" },
        { key: "target_emails", label: "Получатели карточки (targetEmails)", type: "text", hint: "E-mail адреса через запятую", required: true }
      ],

      executePagination: (service, bundle) => {
        const webhookUrl = bundle.authData.incoming_webhook_url;
        if (!webhookUrl) {
          throw new Error("URL вебхука не указан. Заполните поле и повторите попытку.");
        }
        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        if (!jiraBaseUrl) {
          throw new Error('В настойках подключения не указан jiraBaseUrl. Заполните поле и повторите попытку.')
        }
        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");
        const input = bundle.inputData;
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);
        const sendTime = new Date().toISOString();
        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const issueUrl =
          input.issue_url &&
            input.issue_url.trim() !== "" &&
            (input.issue_url.startsWith("http://") || input.issue_url.startsWith("https://"))
            ? input.issue_url
            : `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;

        const epicUrl =
          input.epic_url &&
            input.epic_url.trim() !== "" &&
            (input.epic_url.startsWith("http://") || input.epic_url.startsWith("https://"))
            ? input.epic_url
            : `${jiraBaseUrl}/browse/${safe(input.epic_summary)}`;

        const card = {
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            {
              type: "TextBlock",
              text: "powered by IM LLC",
              size: "Small",
              horizontalAlignment: "Right",
              isSubtle: true,
              spacing: "None"
            },
            {
              type: "Container",
              items: [
                {
                  type: "Badge",
                  text: "Новый комментарий в",
                  size: "Large",
                  style: "Accent",
                  icon: "CommentAdd"
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
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
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
                    {
                      type: "TextRun",
                      text: `${safe(input.comment_body)}`,
                      wrap: true
                    }
                  ]
                }
              ],
              style: "emphasis",
              spacing: "None"
            },
            {
              type: "RichTextBlock",
              inlines: [
                {
                  type: "TextRun",
                  text: "Ссылка на Epic: ",
                  weight: "Bolder"
                },
                {
                  type: "TextRun",
                  text: `${safe(input.epic_summary)}`,
                  color: "Accent",
                  selectAction: {
                    type: "Action.OpenUrl",
                    url: `${safe(epicUrl)}`
                  }
                }
              ],
              spacing: "Medium"
            },
            {
              type: "FactSet",
              facts: [
                {
                  title: "Автор задачи:",
                  value: `${safe(input.reporter)}`
                },
                {
                  title: "Исполнитель:",
                  value: `${safe(input.assignee)}`
                },
                {
                  title: "Дата комментария:",
                  value: `${safe(input.comment_created)}`
                }
              ],
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Открыть задачу",
              url: safe(issueUrl),
              style: "positive",
              iconUrl: "icon:Link"
            }
          ],
          data: {
            targetEmails
          },
        };

        let response;
        const start = Date.now();
        const stringifiedCard = JSON.stringify(card);
        try {
          response = service.request({
            url: webhookUrl,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-ms-client-request-id": sendUid
            },
            jsonBody: { payload: stringifiedCard }
          });
        } catch (e) {
          throw new Error("Ошибка при выполнении запроса: " + e.message);
        }
        const duration = Date.now() - start;

        if (!response.response && response.status === 202) {
          response.response = new TextEncoder().encode("OK");
        }

        const respBody = new TextDecoder().decode(response.response);
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);
        }
        return {
          output: [[
            response?.status >= 200 && response?.status < 300 ? "Карточка успешно отправлена" : "Карточка не отправлена",
            String(response?.status) ?? null,
            sendTime ?? null,
            duration ?? null,
            Array.isArray(targetEmails) ? targetEmails.join(", ") : null,
            webhookUrl ? webhookUrl.slice(0, 50) + "..." : null,
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_IssueStatusChanged: {
      label: "Изменение статуса в задаче",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "issue_key", type: "text", required: true },
        { key: "issue_summary", label: "issue_summary", type: "text", required: true },
        { key: "issue_url", label: "issue_url", type: "text", required: true },
        { key: "issue_type", label: "issue_type", type: "text", required: true },
        { key: "issue_type_name", label: "issue_type_name", type: "text", required: true },
        { key: "from_status", label: "from_status", type: "text", required: true },
        { key: "to_status", label: "to_status", type: "text", required: true },
        { key: "created_by", label: "created_by", type: "text", required: true },
        { key: "epic_key", label: "epic_key", type: "text" },
        { key: "epic_summary", label: "epic_summary", type: "text" },
        { key: "parent_key", label: "parent_key", type: "text" },
        { key: "parent_summary", label: "parent_summary", type: "text" },
        { key: "reporter", label: "reporter_name", type: "text" },
        { key: "assignee", label: "assignee_name", type: "text" },
        { key: "issue_responsible_implementer", label: "issue_responsible_implementer", type: "text" },
        { key: "issue_responsible_sales", label: "issue_responsible_sales", type: "text" },
        { key: "issue_responsible_analytic", label: "issue_responsible_analytic", type: "text" },
        { key: "issue_responsible_tsupporter", label: "issue_responsible_tsupporter", type: "text" },
        { key: "created_at", label: "created_at", type: "text" },
        { key: "target_emails", label: "target_emails", type: "text", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");

        const webhookUrl = bundle.authData.incoming_webhook_url;
        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);

        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const sendTime = new Date().toISOString();
        const start = Date.now();

        const issueUrl = input.issue_url || `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;
        const epicUrl = input.epic_key ? `${jiraBaseUrl}/browse/${safe(input.epic_key)}` : null;
        const parentUrl = input.parent_key ? `${jiraBaseUrl}/browse/${safe(input.parent_key)}` : null;

        // 🔹 Определяем тип задачи и проект
        const issueType = input.issue_type?.toLowerCase() || "";
        const projectKey = (input.issue_key?.split("-")[0] || "").toUpperCase();
        const isEpic = issueType === "epic";
        const isPRK = projectKey === "PRK";

        // 🔹 Заголовок бейджа и контекстный блок
        let badgeText = "";
        let contextBlock = null;
        let openButtonTitle = "Открыть задачу";

        switch (issueType) {
          case "epic":
            badgeText = `Изменение статуса в Epic: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть Epic";
            break;
          case "subtask":
            badgeText = `Изменение статуса в подзадаче: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть подзадачу";
            if (input.parent_key && input.parent_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Родительская задача: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.parent_key)}] ${safe(input.parent_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: parentUrl }
                  }
                ]
              };
            }
            break;
          default:
            badgeText = `Изменение статуса в задаче: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть задачу";
            if (input.epic_key && input.epic_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Эпик: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.epic_key)}] ${safe(input.epic_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: epicUrl }
                  }
                ]
              };
            }
        }

        // 🔹 Формируем секцию ролей (разные для PRK-эпиков и остальных)
        let roleFacts = [];

        if (isEpic && isPRK) {
          // Эпик проекта PRK → показываем расширенные роли
          roleFacts = [
            { title: "Менеджер внедрений:", value: safe(input.issue_responsible_implementer) },
            { title: "Менеджер по продажам:", value: safe(input.issue_responsible_sales) },
            { title: "Аналитик:", value: safe(input.issue_responsible_analytic) },
            { title: "Специалист ТП:", value: safe(input.issue_responsible_tsupporter) },
            { title: "Инициатор:", value: safe(input.created_by) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ].filter(f => f.value && f.value !== "-");
        } else if (isEpic) {
          // Эпик другого проекта → стандартные поля
          roleFacts = [
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Инициатор:", value: safe(input.created_by) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ];
        } else {
          // Обычные задачи / подзадачи
          roleFacts = [
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Инициатор:", value: safe(input.created_by) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ];
        }

        // 🔹 Формируем тело карточки
        const card = {
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            {
              type: "TextBlock",
              text: "powered by IM LLC",
              size: "Small",
              horizontalAlignment: "Right",
              isSubtle: true,
              spacing: "None"
            },
            {
              type: "Container",
              items: [
                { type: "Badge", text: badgeText, size: "Large", style: "Accent", icon: "ArrowSync" },
                {
                  type: "TextBlock",
                  text: `**[${safe(input.issue_key)}]** ${safe(input.issue_summary)}`,
                  wrap: true,
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Small"
                }
              ],
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
            ...(contextBlock ? [contextBlock] : []),
            {
              type: "FactSet",
              facts: roleFacts,
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: openButtonTitle,
              url: safe(issueUrl),
              style: "positive"
            }
          ],
          data: { targetEmails }
        };

        // 🔹 Отправка карточки
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

        const duration = Date.now() - start;
        const respBody = new TextDecoder().decode(response.response || new TextEncoder().encode(""));

        if (response.status < 200 || response.status >= 300)
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);

        // 🔹 Возврат результатов
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
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_IssueStatusChanged_Generic: {
      label: "Изменение статуса в задаче (Универсальный)",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "issue_key", type: "text", required: true },
        { key: "issue_summary", label: "issue_summary", type: "text", required: true },
        { key: "issue_url", label: "issue_url", type: "text", required: true },
        { key: "issue_type", label: "issue_type", type: "text", required: true },
        { key: "issue_type_name", label: "issue_type_name", type: "text", required: true },
        { key: "from_status", label: "from_status", type: "text", required: true },
        { key: "to_status", label: "to_status", type: "text", required: true },
        { key: "created_by", label: "created_by", type: "text", required: true },
        { key: "epic_key", label: "epic_key", type: "text" },
        { key: "epic_summary", label: "epic_summary", type: "text" },
        { key: "parent_key", label: "parent_key", type: "text" },
        { key: "parent_summary", label: "parent_summary", type: "text" },
        { key: "reporter", label: "reporter_name", type: "text" },
        { key: "assignee", label: "assignee_name", type: "text" },
        { key: "issue_responsible_implementer", label: "issue_responsible_implementer", type: "text" },
        { key: "issue_responsible_sales", label: "issue_responsible_sales", type: "text" },
        { key: "issue_responsible_analytic", label: "issue_responsible_analytic", type: "text" },
        { key: "issue_responsible_tsupporter", label: "issue_responsible_tsupporter", type: "text" },
        { key: "created_at", label: "created_at", type: "text" },
        { key: "target_emails", label: "target_emails", type: "text", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");

        const webhookUrl = bundle.authData.incoming_webhook_url;
        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);

        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const sendTime = new Date().toISOString();
        const start = Date.now();

        const issueUrl = input.issue_url || `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;
        const epicUrl = input.epic_key ? `${jiraBaseUrl}/browse/${safe(input.epic_key)}` : null;
        const parentUrl = input.parent_key ? `${jiraBaseUrl}/browse/${safe(input.parent_key)}` : null;

        // 🔹 Определяем тип задачи и проект
        const issueType = input.issue_type?.toLowerCase() || "";
        const projectKey = (input.issue_key?.split("-")[0] || "").toUpperCase();
        const isEpic = issueType === "epic";
        const isPRK = projectKey === "PRK";

        // 🔹 Заголовок бейджа и контекстный блок
        let badgeText = "";
        let contextBlock = null;
        let openButtonTitle = "Открыть задачу";

        switch (issueType) {
          case "epic":
            badgeText = `Изменение статуса в Epic: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть Epic";
            break;
          case "subtask":
            badgeText = `Изменение статуса в подзадаче: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть подзадачу";
            if (input.parent_key && input.parent_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Родительская задача: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.parent_key)}] ${safe(input.parent_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: parentUrl }
                  }
                ]
              };
            }
            break;
          default:
            badgeText = `Изменение статуса в задаче: ${safe(input.from_status)} → ${safe(input.to_status)}`;
            openButtonTitle = "Открыть задачу";
            if (input.epic_key && input.epic_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Эпик: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.epic_key)}] ${safe(input.epic_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: epicUrl }
                  }
                ]
              };
            }
        }

        // 🔹 Формируем секцию ролей (разные для PRK-эпиков и остальных)
        let roleFacts = [];

        if (isEpic && isPRK) {
          // Эпик проекта PRK → показываем расширенные роли
          roleFacts = [
            { title: "Менеджер внедрений:", value: safe(input.issue_responsible_implementer) },
            { title: "Менеджер по продажам:", value: safe(input.issue_responsible_sales) },
            { title: "Аналитик:", value: safe(input.issue_responsible_analytic) },
            { title: "Специалист ТП:", value: safe(input.issue_responsible_tsupporter) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ].filter(f => f.value && f.value !== "-");
        } else if (isEpic) {
          // Эпик другого проекта → стандартные поля
          roleFacts = [
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ];
        } else {
          // Обычные задачи / подзадачи
          roleFacts = [
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Дата изменения:", value: safe(input.created_at) }
          ];
        }

        // 🔹 Формируем тело карточки
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
              items: [
                { type: "Badge", text: badgeText, size: "Large", style: "Accent", icon: "ArrowSync" },
                {
                  type: "TextBlock",
                  text: `**[${safe(input.issue_key)}]** ${safe(input.issue_summary)}`,
                  wrap: true,
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Small"
                }
              ],
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
            {
              type: "TextBlock",
              text: `**Инициатор:** ${safe(input.created_by)}`,
              wrap: true,
              spacing: "Small"
            },
            ...(contextBlock ? [contextBlock] : []),
            {
              type: "FactSet",
              facts: roleFacts,
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: openButtonTitle,
              url: safe(issueUrl),
              style: "positive"
            }
          ],
          data: { targetEmails }
        };

        // 🔹 Отправка карточки
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

        const duration = Date.now() - start;
        const respBody = new TextDecoder().decode(response.response || new TextEncoder().encode(""));

        if (response.status < 200 || response.status >= 300)
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);

        // 🔹 Возврат результатов
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
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_NewIssueWhereYouAreAssignee: {
      label: "Новая задача, где ты — Исполнитель",
      description: "Отправляет адаптивную карточку в Teams с событием \"Новая задача JIRA, где ты — Исполнитель\"",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи (issue_key)", type: "text", required: true },
        { key: "issue_summary", label: "Название задачи (issue_summary)", type: "text", required: true },
        { key: "issue_url", label: "URL задачи (issue_key)", type: "text", required: true },
        { key: "issue_description", label: "Описание задачи (issue_description)", type: "text", required: true },
        { key: "epic_summary", label: "Название эпика (epic_summary)", type: "text" },
        { key: "epic_link", label: "URL эпика (epic_link)", type: "text" },
        { key: "reporter", label: "Автор задачи (issue_reporter)", type: "text" },
        { key: "created_at", label: "Дата изменения (created_at)", type: "text" },
        { key: "due_date", label: "Дата исполнения (due_date)", type: "text" },
        { key: "target_emails", label: "Получатели карточки (targetEmails)", type: "text", hint: "E-mail адреса через запятую", required: true }
      ],
      executePagination: (service, bundle) => {
        const webhookUrl = bundle.authData.incoming_webhook_url;
        if (!webhookUrl) {
          throw new Error("URL вебхука не указан. Заполните поле и повторите попытку.");
        }

        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        if (!jiraBaseUrl) {
          throw new Error('В настойках подключения не указан jiraBaseUrl. Заполните поле и повторите попытку.')
        }

        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");
        const input = bundle.inputData;
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);
        const sendTime = new Date().toISOString();
        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const issueUrl =
          input.issue_url &&
            input.issue_url.trim() !== "" &&
            (input.issue_url.startsWith("http://") || input.issue_url.startsWith("https://"))
            ? input.issue_url
            : `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;

        const epicUrl =
          input.epic_url &&
            input.epic_url.trim() !== "" &&
            (input.epic_url.startsWith("http://") || input.epic_url.startsWith("https://"))
            ? input.epic_url
            : `${jiraBaseUrl}/browse/${safe(input.epic_link)}`;

        const card = {
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            {
              type: "TextBlock",
              text: "powered by IM LLC",
              size: "Small",
              horizontalAlignment: "Right",
              isSubtle: true,
              spacing: "None"
            },
            {
              type: "Container",
              items: [
                {
                  type: "Badge",
                  text: "Новая задача, где ты — Исполнитель",
                  size: "Large",
                  style: "Attention",
                  icon: "PersonSquare"
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
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
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
                  type: "TextBlock",
                  text: `${safe(input.issue_description)}`,
                  wrap: true
                }
              ],
              style: "emphasis",
              spacing: "None"
            },
            {
              type: "TextBlock",
              text: `**Дата исполнения:** ${safe(input.due_date)}`,
              wrap: true,
              weight: "Bolder",
              spacing: "Medium"
            },
            {
              type: "RichTextBlock",
              inlines: [
                { type: "TextRun", text: "Ссылка на Epic: ", weight: "Bolder" },
                {
                  type: "TextRun",
                  text: `${safe(input.epic_summary)}`,
                  color: "Accent",
                  selectAction: {
                    type: "Action.OpenUrl",
                    url: `${safe(epicUrl)}`
                  }
                }
              ],
              spacing: "Medium"
            },
            {
              type: "FactSet",
              facts: [
                { title: "Автор:", value: `${safe(input.reporter)}` },
                { title: "Дата регистрации:", value: `${safe(input.created_at)}` }
              ],
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Открыть задачу",
              url: safe(issueUrl),
              style: "positive",
              iconUrl: "icon:Link"
            }
          ],
          data: { targetEmails }
        };

        let response;
        const start = Date.now();
        const stringifiedCard = JSON.stringify(card);
        try {
          response = service.request({
            url: webhookUrl,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-ms-client-request-id": sendUid
            },
            jsonBody: { payload: stringifiedCard }
          });
        } catch (e) {
          throw new Error("Ошибка при выполнении запроса: " + e.message);
        }
        const duration = Date.now() - start;

        if (!response.response && response.status === 202) {
          response.response = new TextEncoder().encode("OK");
        }

        const respBody = new TextDecoder().decode(response.response);
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);
        }
        return {
          output: [[
            response?.status >= 200 && response?.status < 300 ? "Карточка успешно отправлена" : "Карточка не отправлена",
            String(response?.status) ?? null,
            sendTime ?? null,
            duration ?? null,
            Array.isArray(targetEmails) ? targetEmails.join(", ") : null,
            webhookUrl ? webhookUrl.slice(0, 50) + "..." : null,
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_NewIssueInTheEpic: {
      label: "Новая задача в эпике",
      description: "Отправляет адаптивную карточку в Teams с событием \"Новая задача JIRA в эпике\"",
      inputFields: [
        { key: "issue_key", label: "Ключ задачи (issue_key)", type: "text", required: true },
        { key: "issue_summary", label: "Название задачи (issue_summary)", type: "text", required: true },
        { key: "issue_url", label: "URL задачи (issue_key)", type: "text", required: true },
        { key: "issue_description", label: "Описание задачи (issue_description)", type: "text", required: true },
        { key: "epic_summary", label: "Название эпика (epic_summary)", type: "text" },
        { key: "epic_link", label: "URL эпика (epic_link)", type: "text" },
        { key: "reporter", label: "Автор задачи (issue_reporter)", type: "text" },
        { key: "assignee", label: "Исполнитель задачи (issue_assignee)", type: "text" },
        { key: "created_at", label: "Дата регистрации (created_at)", type: "text" },
        { key: "target_emails", label: "Получатели карточки (targetEmails)", type: "text", hint: "E-mail адреса через запятую", required: true }
      ],
      executePagination: (service, bundle) => {
        const webhookUrl = bundle.authData.incoming_webhook_url;
        if (!webhookUrl) {
          throw new Error("URL вебхука не указан. Заполните поле и повторите попытку.");
        }

        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        if (!jiraBaseUrl) {
          throw new Error('В настойках подключения не указан jiraBaseUrl. Заполните поле и повторите попытку.')
        }

        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");
        const input = bundle.inputData;
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);
        const sendTime = new Date().toISOString();
        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const issueUrl =
          input.issue_url &&
            input.issue_url.trim() !== "" &&
            (input.issue_url.startsWith("http://") || input.issue_url.startsWith("https://"))
            ? input.issue_url
            : `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;

        const epicUrl =
          input.epic_url &&
            input.epic_url.trim() !== "" &&
            (input.epic_url.startsWith("http://") || input.epic_url.startsWith("https://"))
            ? input.epic_url
            : `${jiraBaseUrl}/browse/${safe(input.epic_link)}`;

        const card = {
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            {
              type: "TextBlock",
              text: "powered by IM LLC",
              size: "Small",
              horizontalAlignment: "Right",
              isSubtle: true,
              spacing: "None"
            },
            {
              type: "Container",
              items: [
                {
                  type: "Badge",
                  text: "Новая задача в эпике",
                  size: "Large",
                  style: "Good",
                  icon: "PersonSquare"
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
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
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
                      text: `${safe(input.issue_description)}`
                    }
                  ]
                }
              ],
              style: "emphasis",
              spacing: "None"
            },
            {
              type: "RichTextBlock",
              inlines: [
                { type: "TextRun", text: "Ссылка на Epic: ", weight: "Bolder" },
                {
                  type: "TextRun",
                  text: `${safe(input.epic_summary)}`,
                  color: "Accent",
                  selectAction: {
                    type: "Action.OpenUrl",
                    url: `${safe(epicUrl)}`
                  }
                }
              ],
              spacing: "Medium"
            },
            {
              type: "FactSet",
              facts: [
                { title: "Автор:", value: `${safe(input.reporter)}` },
                { title: "Исполнитель:", value: `${safe(input.assignee)}` },
                { title: "Дата регистрации:", value: `${safe(input.created_at)}` }
              ],
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Открыть задачу",
              url: safe(issueUrl),
              style: "positive",
              iconUrl: "icon:Link"
            }
          ],
          data: {
            targetEmails
          },
        };

        let response;
        const start = Date.now();
        const stringifiedCard = JSON.stringify(card);
        try {
          response = service.request({
            url: webhookUrl,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-ms-client-request-id": sendUid
            },
            jsonBody: { payload: stringifiedCard }
          });
        } catch (e) {
          throw new Error("Ошибка при выполнении запроса: " + e.message);
        }
        const duration = Date.now() - start;

        if (!response.response && response.status === 202) {
          response.response = new TextEncoder().encode("OK");
        }

        const respBody = new TextDecoder().decode(response.response);
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);
        }
        return {
          output: [[
            response?.status >= 200 && response?.status < 300 ? "Карточка успешно отправлена" : "Карточка не отправлена",
            String(response?.status) ?? null,
            sendTime ?? null,
            duration ?? null,
            Array.isArray(targetEmails) ? targetEmails.join(", ") : null,
            webhookUrl ? webhookUrl.slice(0, 50) + "..." : null,
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
    SendTeamsAdaptiveCard_NewIssueInTheEpic_Generic: {
      label: "Новая задача\подзадача в эпике\родителе (Универсальный)",
      description: "Отправляет адаптивную карточку в Teams, автоматически определяя тип сущности Jira",
      inputFields: [
        { key: "issue_key", label: "issue_key", type: "text", required: true },
        { key: "issue_summary", label: "issue_summary", type: "text", required: true },
        { key: "issue_url", label: "issue_url", type: "text", required: true },
        { key: "issue_type", label: "issue_type", type: "text", required: true },
        { key: "issue_type_name", label: "issue_type_name", type: "text", required: true },
        { key: "issue_description", label: "issue_description", type: "text", required: true },
        { key: "epic_key", label: "epic_key", type: "text" },
        { key: "epic_summary", label: "epic_summary", type: "text" },
        { key: "parent_key", label: "parent_key", type: "text" },
        { key: "parent_summary", label: "parent_summary", type: "text" },
        { key: "reporter", label: "reporter_name", type: "text" },
        { key: "assignee", label: "assignee_name", type: "text" },
        { key: "issue_responsible_implementer", label: "issue_responsible_implementer", type: "text" },
        { key: "issue_responsible_sales", label: "issue_responsible_sales", type: "text" },
        { key: "issue_responsible_analytic", label: "issue_responsible_analytic", type: "text" },
        { key: "issue_responsible_tsupporter", label: "issue_responsible_tsupporter", type: "text" },
        { key: "created_at", label: "created_at", type: "text" },
        { key: "target_emails", label: "target_emails", type: "text", required: true }
      ],

      executePagination: (service, bundle) => {
        const input = bundle.inputData;
        const safe = s => (s ? String(s).replace(/[\r\n]+/g, " ").replace(/\"/g, "'") : "-");

        const webhookUrl = bundle.authData.incoming_webhook_url;
        const jiraBaseUrl = (bundle.authData.jira_base_url || "").replace(/\/$/, "");
        const targetEmails = (input.target_emails || "")
          .split(",").map(e => e.trim()).filter(Boolean);

        const sendUid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const sendTime = new Date().toISOString();
        const start = Date.now();

        const issueUrl = input.issue_url || `${jiraBaseUrl}/browse/${safe(input.issue_key)}`;
        const epicUrl = input.epic_key ? `${jiraBaseUrl}/browse/${safe(input.epic_key)}` : null;
        const parentUrl = input.parent_key ? `${jiraBaseUrl}/browse/${safe(input.parent_key)}` : null;

        // 🔹 Определяем тип задачи и проект
        const issueType = input.issue_type?.toLowerCase() || "";
        const projectKey = (input.issue_key?.split("-")[0] || "").toUpperCase();
        const isEpic = issueType === "epic";
        const isPRK = projectKey === "PRK";

        // 🔹 Заголовок бейджа и контекстный блок
        let badgeText = "";
        let contextBlock = null;
        let openButtonTitle = "Открыть задачу";

        switch (issueType) {
          case "epic":
            badgeText = "Новая задача в эпике";
            openButtonTitle = "Открыть Epic";
            break;
          case "subtask":
            badgeText = "Новая подзадача";
            openButtonTitle = "Открыть подзадачу";
            if (input.parent_key && input.parent_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Родительская задача: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.parent_key)}] ${safe(input.parent_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: parentUrl }
                  }
                ]
              };
            }
            break;
          default:
            badgeText = "Новая задача";
            openButtonTitle = "Открыть задачу";
            if (input.epic_key && input.epic_summary) {
              contextBlock = {
                type: "RichTextBlock",
                inlines: [
                  { type: "TextRun", text: "Эпик: ", weight: "Bolder" },
                  {
                    type: "TextRun",
                    text: `[${safe(input.epic_key)}] ${safe(input.epic_summary)}`,
                    color: "Accent",
                    selectAction: { type: "Action.OpenUrl", url: epicUrl }
                  }
                ]
              };
            }
        }

        // 🔹 Формируем секцию ролей (разные для PRK-эпиков и остальных)
        let roleFacts = [];

        if (isEpic && isPRK) {
          // Эпик проекта PRK → показываем расширенные роли
          roleFacts = [
            { title: "Менеджер внедрений:", value: safe(input.issue_responsible_implementer) },
            { title: "Менеджер по продажам:", value: safe(input.issue_responsible_sales) },
            { title: "Аналитик:", value: safe(input.issue_responsible_analytic) },
            { title: "Специалист ТП:", value: safe(input.issue_responsible_tsupporter) },
            { title: "Дата регистрации:", value: safe(input.created_at) }
          ].filter(f => f.value && f.value !== "-");
        } else if (isEpic) {
          // Эпик другого проекта → стандартные поля
          roleFacts = [
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Дата регистрации:", value: safe(input.created_at) }
          ];
        } else {
          // Обычные задачи / подзадачи
          roleFacts = [
            { title: "Автор:", value: safe(input.reporter) },
            { title: "Исполнитель:", value: safe(input.assignee) },
            { title: "Дата регистрации:", value: safe(input.created_at) }
          ];
        }

        // 🔹 Формируем тело карточки
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
              items: [
                { type: "Badge", text: badgeText, size: "Large", style: "Good", icon: "PersonSquare" },
                {
                  type: "TextBlock",
                  text: `**[${safe(input.issue_key)}]** ${safe(input.issue_summary)}`,
                  wrap: true,
                  weight: "Bolder",
                  size: "Medium",
                  spacing: "Small"
                }
              ],
              style: "accent",
              showBorder: true,
              roundedCorners: true,
              spacing: "Medium"
            },
            {
              type: "TextBlock",
              text: `**Инициатор:** ${safe(input.reporter)}`,
              wrap: true,
              spacing: "Small"
            },
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
                      text: `${safe(input.issue_description)}`
                    }
                  ]
                }
              ],
              style: "emphasis",
              spacing: "None"
            },
            ...(contextBlock ? [contextBlock] : []),
            {
              type: "FactSet",
              facts: roleFacts,
              spacing: "Medium"
            }
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: openButtonTitle,
              url: safe(issueUrl),
              style: "positive",
              iconUrl: "icon:Link"
            }
          ],
          data: { targetEmails }
        };

        // 🔹 Отправка карточки
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

        const duration = Date.now() - start;
        const respBody = new TextDecoder().decode(response.response || new TextEncoder().encode(""));

        if (response.status < 200 || response.status >= 300)
          throw new Error(`Ошибка отправки карточки: ${response.status} ${respBody || ""}`);

        // 🔹 Возврат результатов
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
            sendUid ?? null
          ]],
          output_variables: [
            { name: "message", type: "String" },
            { name: "status", type: "String" },
            { name: "send_time", type: "DateTime" },
            { name: "duration_ms", type: "Double" },
            { name: "recipients", type: "String" },
            { name: "flow_endpoint", type: "String" },
            { name: "send_uid", type: "String" }
          ],
          state: undefined,
          hasNext: false
        };
      }
    },
  },
  connections: {
    TeamsIncomingWebhookConnect: {
      label: "Подключение к Microsoft Teams (Incoming Webhook)",
      description: "Позволяет указать URL вебхука Microsoft Teams для отправки адаптивных карточек",
      inputFields: [
        {
          key: "incoming_webhook_url",
          type: "password",
          label: "Входящий вэб-перехватчик Teams Power AU Flow",
          //placeholder: "https://<tenant-id>.db.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/...",
          hint: "HTTP URL берется из блока-триггера \"When a Teams webhook request is received\" в рамках созданного потока Teams Power Automate",
          required: true
        },
        {
          key: "jira_base_url",
          label: "Базовый URL Jira (пример: https://jira.company.com)",
          type: "text",
          placeholder: "https://example.jira.domain.name.com",
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