--! SQL для subtask
WITH

  -- Парсим changelog_items, чтобы получить информацию о переходе статусов в виде JSON
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='status',
      changelog_items), 
      1) as status_change_json,
      
  -- Парсим changelog_items, чтобы получить информацию о наличии решения в виде JSON    
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='resolution',
      changelog_items), 
      1) as resolution_json,
      
  -- Если был совершен переход в статус "Закрыто", вытягиваем из JSON значение для поле "Решение", в противном случае null       
  if(
    JSON_VALUE(status_change_json, '$.toString')='Закрыто', 
    JSON_VALUE(resolution_json, '$.toString'), 
    null) as resolution,
    
  -- Вытягиваем из JSON значение предыдущего статуса      
    JSON_VALUE(status_change_json, '$.fromString') as from_status,
    
  -- Вытягиваем из JSON значение актуального статуса и соединяем с полем "Решение", если статус = Закрыто       
    if(
      isNotNull(resolution),
      concat(JSON_VALUE(status_change_json, '$.toString'), ' (', resolution, ')'),
      JSON_VALUE(status_change_json, '$.toString')
  ) as to_status,
  
  -- Собираем массив наблюдателей для родительской задачи
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a2.response}, 'watchers'))
  ) AS parent_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Изменение статуса")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('4f68c704-d400-48f0-afbf-e6ee0a46372a')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех потенциальных участников уведомления:
  --   наблюдателей подзадачи и её родителя,
  --   автора и исполнителя задачи,
  --   автора и исполнителя, полученных из родительской задачи
  arrayFlatten([
    if(isNotNull(parent_watchers), arrayMap(watcher -> lower(watcher), parent_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_assignee)],
    [lower(jc.issue_reporter)],
    [lower(${a22.fields.reporter.emailAddress})],
    [lower(${a22.fields.assignee.emailAddress})]
  ]) AS combined_watchers_list,

  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков на конкретное событие
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
  jc.* EXCEPT(created_at, changelog_items),

  -- Определяем исходный и целевой статусы перехода
  from_status,
  to_status,

  -- Форматируем дату создания события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Добавляем информацию о родительской задаче
  ${a22.key} as parent_key,
  ${a22.fields.summary} as parent_summary,

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
  
-- Группируем все поля для устранения дубликатов
GROUP BY ALL

--! SQL для issue
WITH

  -- Парсим changelog_items, чтобы получить информацию о переходе статусов в виде JSON
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='status',
      changelog_items), 
      1) as status_change_json,
      
  -- Парсим changelog_items, чтобы получить информацию о наличии решения в виде JSON    
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='resolution',
      changelog_items), 
      1) as resolution_json,
      
  -- Если был совершен переход в статус "Закрыто", вытягиваем из JSON значение для поле "Решение", в противном случае null       
  if(
    JSON_VALUE(status_change_json, '$.toString')='Закрыто', 
    JSON_VALUE(resolution_json, '$.toString'), 
    null) as resolution,
    
  -- Вытягиваем из JSON значение предыдущего статуса      
    JSON_VALUE(status_change_json, '$.fromString') as from_status,
    
  -- Вытягиваем из JSON значение актуального статуса и соединяем с полем "Решение", если статус = Закрыто       
    if(
      isNotNull(resolution),
      concat(JSON_VALUE(status_change_json, '$.toString'), ' (', resolution, ')'),
      JSON_VALUE(status_change_json, '$.toString')
  ) as to_status,
  
  -- Собираем массив с наблюдателями для эпика (через ответ REST API)
  arrayMap(
    watcher -> JSONExtractString(watcher, 'emailAddress'),
    JSONExtractArrayRaw(JSONExtractRaw(${a3.response}, 'watchers'))
  ) AS epic_watchers,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Изменение статуса")
  (
    SELECT lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('4f68c704-d400-48f0-afbf-e6ee0a46372a')
    INTERSECT
    SELECT lower(email_address)
    FROM teams_notification_recipients
    WHERE is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех возможных участников события:
  --   наблюдатели задачи и эпика,
  --   автор и исполнитель,
  --   ответственные из кастомных полей,
  --   автор и исполнитель, переданные из блока a11
  arrayFlatten([
    if(isNotNull(epic_watchers), arrayMap(watcher -> lower(watcher), epic_watchers), []),
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_assignee)],
    [lower(jc.issue_reporter)],
    [lower(${a11.fields.Менеджер Продаж.emailAddress})],
    [lower(${a11.fields.Аналитик.emailAddress})],
    [lower(${a11.fields.Специалист ТП.emailAddress})],
    [lower(${a11.fields.Менеджер внедрений.emailAddress})],
    [lower(${a11.fields.reporter.emailAddress})],
    [lower(${a11.fields.assignee.emailAddress})]
  ]) AS combined_watchers_list,
  
  -- Фильтруем итоговый массив получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые или NULL email,
  --   включаем только активных подписчиков
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
  jc.* EXCEPT(created_at, changelog_items),

  -- Определяем исходный и целевой статусы
  from_status,
  to_status,

  -- Форматирование даты события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Преобразование ФИО участников в краткую форму
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Информация о родительской задаче или эпике
  ${a11.key} as parent_key,
  ${a11.fields.summary} as parent_summary,

  -- Объединённый список адресатов уведомления
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails

FROM jira_changelog AS jc

-- Присоединяем таблицу пользователей Jira для отображения имён
LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

-- Ограничиваем выборку конкретным событием
WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
-- Группировка по всем полям для исключения дубликатов
GROUP BY ALL


--! SQL для Epic
WITH

  -- Парсим changelog_items, чтобы получить информацию о переходе статусов в виде JSON
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='status',
      changelog_items), 
      1) as status_change_json,
      
  -- Парсим changelog_items, чтобы получить информацию о наличии решения в виде JSON    
  arrayElement(
    arrayFilter(
      json -> JSON_VALUE(json, '$.field')='resolution',
      changelog_items), 
      1) as resolution_json,
      
  -- Если был совершен переход в статус "Закрыто", вытягиваем из JSON значение для поле "Решение", в противном случае null       
  if(
    JSON_VALUE(status_change_json, '$.toString')='Закрыто', 
    JSON_VALUE(resolution_json, '$.toString'), 
    null) as resolution,
    
  -- Вытягиваем из JSON значение предыдущего статуса      
    JSON_VALUE(status_change_json, '$.fromString') as from_status,
    
  -- Вытягиваем из JSON значение актуального статуса и соединяем с полем "Решение", если статус = Закрыто       
    if(
      isNotNull(resolution),
      concat(JSON_VALUE(status_change_json, '$.toString'), ' (', resolution, ')'),
      JSON_VALUE(status_change_json, '$.toString')
  ) as to_status,
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Изменение статуса")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('4f68c704-d400-48f0-afbf-e6ee0a46372a')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем всех участников эпика:
  --   наблюдателей,
  --   автора и исполнителя,
  --   ответственных из кастомных полей
  arrayFlatten([
    if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
    [lower(jc.issue_assignee)],
    [lower(jc.issue_reporter)],
    [lower(jc.issue_responsible_sales)],
    [lower(jc.issue_responsible_analytic)],
    [lower(jc.issue_responsible_tsupporter)],
    [lower(jc.issue_responsible_implementer)]
  ]) AS epic_participants,

  -- Фильтруем итоговый список получателей:
  --   исключаем инициатора события (created_by),
  --   исключаем пустые и NULL значения,
  --   оставляем только активных подписчиков на конкретное событие
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
  jc.* EXCEPT(created_at, changelog_items),

  -- Определяем исходный и целевой статусы перехода
  from_status,
  to_status,

  -- Форматируем дату создания события
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