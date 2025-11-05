--! SQL для issue
WITH
  
  -- Собираем массив наблюдателей для эпика (через ответ REST API)
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a19.response}, 'watchers'))
  ) AS epic_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Новая вложенная задача/подзадача")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('78f6bce4-4751-464f-8481-fb28c87698bc')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех потенциальных участников уведомления:
  --   наблюдателей эпика,
  --   автора новой задачи,
  --   ответственных из кастомных полей эпика (менеджер продаж, аналитик, специалист ТП, менеджер внедрений)
  --   не включаем исполнителя новой задачи, так как он получит уведомление через событие "Новая задача, где ты - Исполнитель"
  arrayFlatten([
    if(isNotNull(epic_watchers), arrayMap(watcher -> lower(watcher), epic_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_reporter)],
    if(${a17.fields.Менеджер Продаж.emailAddress} != '', [lower(${a17.fields.Менеджер Продаж.emailAddress})], []),
    if(${a17.fields.Аналитик.emailAddress} != '', [lower(${a17.fields.Аналитик.emailAddress})], []),
    if(${a17.fields.Специалист ТП.emailAddress} != '', [lower(${a17.fields.Специалист ТП.emailAddress})], []),
    if(${a17.fields.Менеджер внедрений.emailAddress} != '', [lower(${a17.fields.Менеджер внедрений.emailAddress})], [])
  ]) AS combined_watchers_list,
  
  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем исполнителя новой задачи (issue_assignee),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков
  arrayDistinct(
    arrayFilter(
      email -> (
        email != lower(jc.created_by)
        AND email != lower(jc.issue_assignee)
        AND email != ''
        AND email IS NOT NULL
        AND email IN valid_recipients
      ),
      combined_watchers_list
    )
  ) AS targetEmailsArray
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at, changelog_items, issue_description),

  -- Проверяем наличие описания, при его отсутствии подставляем текст-заглушку
  if(jc.issue_description = '', 'Описание отсутствует', jc.issue_description) as issue_description,

  -- Форматируем дату создания задачи
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Добавляем информацию о родительской задаче или эпике
  ${a17.key} as parent_key,
  ${a17.fields.summary} as parent_summary,

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



--! SQL для subtask
WITH
  
  -- Собираем массив наблюдателей для родительской задачи (через ответ REST API)
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a26.response}, 'watchers'))
  ) AS parent_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Назначен исполнителем")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('78f6bce4-4751-464f-8481-fb28c87698bc')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех потенциальных участников уведомления:
  --   наблюдателей родительской задачи,
  --   автора новой задачи,
  --   исполнителя (для контекста родительской задачи)
  arrayFlatten([
    if(isNotNull(parent_watchers), arrayMap(watcher -> lower(watcher), parent_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_reporter)],
    [lower(jc.issue_assignee)]
  ]) AS combined_watchers_list,
  
  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем исполнителя задачи (issue_assignee),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков
  arrayDistinct(
    arrayFilter(
      email -> (
        email != lower(jc.created_by)
        AND email != lower(jc.issue_assignee)
        AND email != ''
        AND email IS NOT NULL
        AND email IN valid_recipients
      ),
      combined_watchers_list
    )
  ) AS targetEmailsArray
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at, changelog_items, issue_description),

  -- Проверяем наличие описания, при его отсутствии подставляем текст-заглушку
  if(jc.issue_description = '', 'Описание отсутствует', jc.issue_description) as issue_description,

  -- Форматируем дату создания события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Добавляем информацию о родительской задаче или эпике
  ${a25.key} as parent_key,
  ${a25.fields.summary} as parent_summary,

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