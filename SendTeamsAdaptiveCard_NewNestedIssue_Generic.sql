-- SQL для ветки скриптов эпика у задачи
WITH
  
  -- Собираем массив с наблюдателями для родительской задачи
  arrayMap(watcher -> JSONExtractString(watcher, 'emailAddress'), JSONExtractArrayRaw(JSONExtractRaw(${a19.response}, 'watchers'))) AS epic_watchers,
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_name = toUUID('78f6bce4-4751-464f-8481-fb28c87698bc')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем наблюдателей из эпика/родительской задачи, автора новой задачи, и ответственных из кастомных полей эпика
  -- НЕ включаем исполнителя новой задачи (он получит персональное уведомление)
  -- Кастомные поля приходят из предыдущих блоков через переменные
  arrayFlatten([
  if(isNotNull(epic_watchers), arrayMap(watcher -> lower(watcher), epic_watchers), []), 
  if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
  [lower(jc.issue_reporter)],
  if(${a17.fields.Менеджер Продаж.emailAddress} != '', [lower(${a17.fields.Менеджер Продаж.emailAddress})], []),
  if(${a17.fields.Аналитик.emailAddress} != '', [lower(${a17.fields.Аналитик.emailAddress})], []),
  if(${a17.fields.Специалист ТП.emailAddress} != '', [lower(${a17.fields.Специалист ТП.emailAddress})], []),
  if(${a17.fields.Менеджер внедрений.emailAddress} != '', [lower(${a17.fields.Менеджер внедрений.emailAddress})], [])
  ]) AS combined_watchers_list,
  -- Фильтруем получателей уведомлений:
  --     > исключаем создателя задачи (автора события)
  --     > исключаем исполнителя новой задачи (получит персональное уведомление)
  --     > исключаем пустые email
  --     > включаем только тех, кто подписан на уведомления
  --     > включаем ответственных из кастомных полей эпика/родительской задачи
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
  
SELECT
  jc. * EXCEPT(created_at, changelog_items, issue_description),
  if(jc.issue_description='', 'Описание отсутствует', jc.issue_description) as issue_description,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  ${a17.key} as parent_key,
  ${a17.fields.summary} as parent_summary,
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails
FROM jira_changelog AS jc

LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
GROUP BY ALL



-- SQL для ветки скриптов родительской задачи у подзадачи
WITH
  
  -- Собираем массив с наблюдателями для родительской задачи
  arrayMap(watcher -> JSONExtractString(watcher, 'emailAddress'), JSONExtractArrayRaw(JSONExtractRaw(${a26.response}, 'watchers'))) AS parent_watchers,
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
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
  
  -- Объединяем наблюдателей из эпика/родительской задачи, автора новой задачи, и ответственных из кастомных полей эпика
  -- НЕ включаем исполнителя новой задачи (он получит персональное уведомление)
  -- Кастомные поля приходят из предыдущих блоков через переменные
  arrayFlatten([
  if(isNotNull(parent_watchers), arrayMap(watcher -> lower(watcher), parent_watchers), []), 
  if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
  [lower(jc.issue_reporter)],
  [lower(jc.issue_assignee)]
  ]) AS combined_watchers_list,
  -- Фильтруем получателей уведомлений:
  --     > исключаем создателя задачи (автора события)
  --     > исключаем исполнителя новой задачи (получит персональное уведомление)
  --     > исключаем пустые email
  --     > включаем только тех, кто подписан на уведомления
  --     > включаем ответственных из кастомных полей эпика/родительской задачи
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
  
SELECT
  jc. * EXCEPT(created_at, changelog_items, issue_description),
  if(jc.issue_description='', 'Описание отсутствует', jc.issue_description) as issue_description,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  ${a25.key} as parent_key,
  ${a25.fields.summary} as parent_summary,
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails
FROM jira_changelog AS jc

LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
GROUP BY ALL