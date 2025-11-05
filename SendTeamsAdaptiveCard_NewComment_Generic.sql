--! SQL for Epic
WITH 

  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Новый комментарий")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('2e6fcae6-bc07-43f8-92cc-3a8dd779643c')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,

  -- Объединяем всех потенциальных участников уведомления:
  --   автора задачи,
  --   исполнителя,
  --   наблюдателей,
  --   ответственных из кастомных полей (менеджер продаж, аналитик, специалист ТП, менеджер внедрений)
  arrayFlatten([
    [lower(jc.issue_reporter)],
    [lower(jc.issue_assignee)],
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_responsible_sales)],
    [lower(jc.issue_responsible_analytic)],
    [lower(jc.issue_responsible_tsupporter)],
    [lower(jc.issue_responsible_implementer)]
  ]) AS epic_participants,

  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков на событие "Новый комментарий"
  arrayDistinct(
    arrayFilter(
      email -> (
        email != lower(jc.created_by)
        AND email != ''
        AND email IS NOT NULL
        AND email IN valid_recipients
      ),
      epic_participants
    )
  ) AS targetEmailsArray
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at),

  -- Форматируем дату создания комментария
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(implementer.name, '')), 1, 2), ' ') AS issue_responsible_implementer,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(sales.name, '')), 1, 2), ' ') AS issue_responsible_sales,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(tsupporter.name, '')), 1, 2), ' ') AS issue_responsible_tsupporter,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(analytic.name, '')), 1, 2), ' ') AS issue_responsible_analytic,

  -- Формируем строку со списком адресатов уведомления
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails

FROM jira_changelog AS jc

-- Присоединяем справочник пользователей Jira для отображения имён
LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by
LEFT JOIN jira_groups_and_users AS implementer ON implementer.email = jc.issue_responsible_implementer
LEFT JOIN jira_groups_and_users AS sales ON sales.email = jc.issue_responsible_sales
LEFT JOIN jira_groups_and_users AS tsupporter ON tsupporter.email = jc.issue_responsible_tsupporter
LEFT JOIN jira_groups_and_users AS analytic ON analytic.email = jc.issue_responsible_analytic

-- Ограничиваем выборку конкретным событием
WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
-- Группировка по всем полям для устранения дубликатов
GROUP BY ALL

--! SQL for issue
WITH

  -- Собираем массив наблюдателей для родительской задачи или эпика (через ответ REST API)
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a36.response}, 'watchers'))
  ) AS epic_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Новый комментарий")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('2e6fcae6-bc07-43f8-92cc-3a8dd779643c')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех потенциальных участников уведомления:
  --   наблюдателей задачи и её эпика (родителя),
  --   автора задачи,
  --   исполнителя задачи
  arrayFlatten([
    if(isNotNull(epic_watchers), arrayMap(watcher -> lower(watcher), epic_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_assignee)],
    [lower(jc.issue_reporter)]
  ]) AS combined_watchers_list,

  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков на событие "Новый комментарий"
  arrayDistinct(
    arrayFilter(
      email -> (
        email != lower(jc.created_by)
        AND email != ''
        AND email IS NOT NULL
        AND email IN valid_recipients
      ),
      combined_watchers_list
    )
  ) AS targetEmailsArray
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at),

  -- Форматируем дату создания комментария
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Информация о родительской задаче или эпике
  ${a35.key} as parent_key,
  ${a35.fields.summary} as parent_summary,

  -- Формируем строку со списком адресатов уведомления
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails

FROM jira_changelog AS jc

-- Присоединяем справочник пользователей Jira для отображения имён
LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

-- Ограничиваем выборку конкретным событием
WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
-- Группировка по всем полям для устранения дубликатов
GROUP BY ALL

--!  SQL for subtask
WITH

  -- Собираем массив наблюдателей для родительской задачи (через ответ REST API)
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a33.response}, 'watchers'))
  ) AS parent_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Новый комментарий")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('2e6fcae6-bc07-43f8-92cc-3a8dd779643c')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,

  -- Объединяем всех потенциальных участников уведомления:
  --   наблюдателей подзадачи и её родительской задачи,
  --   автора подзадачи,
  --   исполнителя подзадачи
  arrayFlatten([
    if(isNotNull(parent_watchers), arrayMap(watcher -> lower(watcher), parent_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_assignee), lower(jc.issue_reporter)]
  ]) AS combined_watchers_list,

  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков на событие "Новый комментарий"
  arrayDistinct(
    arrayFilter(
      email -> (
        email != lower(jc.created_by)
        AND email != ''
        AND email IS NOT NULL
        AND email IN valid_recipients
      ),
      combined_watchers_list
    )
  ) AS targetEmailsArray
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at),

  -- Форматируем дату создания комментария
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Информация о родительской задаче
  ${a32.key} as parent_key,
  ${a32.fields.summary} as parent_summary,

  -- Формируем строку со списком адресатов уведомления
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails

FROM jira_changelog AS jc

-- Присоединяем справочник пользователей Jira для отображения имён
LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

-- Ограничиваем выборку конкретным событием
WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
-- Группировка по всем полям для устранения дубликатов
GROUP BY ALL