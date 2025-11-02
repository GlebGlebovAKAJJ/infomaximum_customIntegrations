-- SQL для subtask
WITH

 -- Парсим changelog_items, чтобы получить информацию о переходе статусов
  arrayElement(changelog_items, 1) as first_json_from_array,
  arrayElement(changelog_items, 2) as second_json_from_array,
  if(
  JSON_VALUE(first_json_from_array, '$.field') = 'resolution', JSON_VALUE(first_json_from_array, '$.toString'), null) as resolution,
  
  -- Собираем массив с наблюдателями для родительской задачи
  arrayMap(watcher -> JSONExtractString(watcher, 'emailAddress'), JSONExtractArrayRaw(JSONExtractRaw(${a23.response}, 'watchers'))) AS parent_watchers,
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
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
  
  -- Объединяем наблюдателей из задачи, а также эпика, автора и исполнителя самой задачи
  arrayFlatten([
  if(isNotNull(parent_watchers), arrayMap(watcher -> lower(watcher), parent_watchers), []), 
  if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
  [lower(jc.issue_assignee)],
  [lower(jc.issue_reporter)]
  ]) AS combined_watchers_list, 
  -- Фильтруем только нужных адресатов:
  --     > не автор задачи
  --     > не создатель задачи
  --     > не пустой
  --     > наличие подписки на систему уведомлений + конкретное событие
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
  
SELECT
  jc. * EXCEPT(created_at,changelog_items),
  if(max(length(changelog_items)) > 1, JSON_VALUE(second_json_from_array, '$.fromString'), JSON_VALUE(first_json_from_array, '$.fromString')) as from_status,
  if(isNotNull(resolution), concat(JSON_VALUE(second_json_from_array, '$.toString'), ' (', resolution, ')'), JSON_VALUE(first_json_from_array, '$.toString')) as to_status,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  ${a22.key} as parent_key,
  ${a22.fields.summary} as parent_summary,
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

-- SQL для issue
WITH

 -- Парсим changelog_items, чтобы получить информацию о переходе статусов
  arrayElement(changelog_items, 1) as first_json_from_array,
  arrayElement(changelog_items, 2) as second_json_from_array,
  if(
  JSON_VALUE(first_json_from_array, '$.field') = 'resolution', JSON_VALUE(first_json_from_array, '$.toString'), null) as resolution,
  
  -- Собираем массив с наблюдателями для родительской задачи
  arrayMap(watcher -> JSONExtractString(watcher, 'emailAddress'), JSONExtractArrayRaw(JSONExtractRaw(${a13.response}, 'watchers'))) AS epic_watchers,
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_name = toUUID('4f68c704-d400-48f0-afbf-e6ee0a46372a')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients,
  
  -- Объединяем наблюдателей из задачи, а также эпика, автора и исполнителя самой задачи
  arrayFlatten([
  if(isNotNull(epic_watchers), arrayMap(watcher -> lower(watcher), epic_watchers), []), 
  if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
  [lower(jc.issue_assignee)],
  [lower(jc.issue_reporter)],
  [lower(jc.issue_responsible_sales)],
  [lower(jc.issue_responsible_analytic)],
  [lower(jc.issue_responsible_tsupporter)],
  [lower(jc.issue_responsible_implementer)]
  ]) AS combined_watchers_list,
  -- Фильтруем только нужных адресатов:
  --     > не автор задачи
  --     > не создатель задачи
  --     > не пустой
  --     > наличие подписки на систему уведомлений + конкретное событие
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
  
SELECT
  jc. * EXCEPT(created_at,changelog_items),
  if(max(length(changelog_items)) > 1, JSON_VALUE(second_json_from_array, '$.fromString'), JSON_VALUE(first_json_from_array, '$.fromString')) as from_status,
  if(isNotNull(resolution), concat(JSON_VALUE(second_json_from_array, '$.toString'), ' (', resolution, ')'), JSON_VALUE(first_json_from_array, '$.toString')) as to_status,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  ${a11.key} as parent_key,
  ${a11.fields.summary} as parent_summary,
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


-- SQL для Epic
WITH

 -- Парсим changelog_items, чтобы получить информацию о переходе статусов
  arrayElement(changelog_items, 1) as first_json_from_array,
  arrayElement(changelog_items, 2) as second_json_from_array,
  if(
  JSON_VALUE(first_json_from_array, '$.field') = 'resolution', JSON_VALUE(first_json_from_array, '$.toString'), null) as resolution,
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
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
  
  -- Объединяем наблюдателей из задачи, а также эпика, автора и исполнителя самой задачи
  arrayFlatten([
  if(isNotNull(jc.issue_watchers), arrayMap(watcher -> lower(watcher), jc.issue_watchers), []),
  [lower(jc.issue_assignee)],
  [lower(jc.issue_reporter)],
  [lower(jc.issue_responsible_sales)],
  [lower(jc.issue_responsible_analytic)],
  [lower(jc.issue_responsible_tsupporter)],
  [lower(jc.issue_responsible_implementer)]
  ]) AS epic_participants,
  -- Фильтруем только нужных адресатов:
  --     > не инициатор события
  --     > не пустой
  --     > наличие подписки на систему уведомлений + конкретное событие
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
  
SELECT

  jc. * EXCEPT(created_at,changelog_items),
  if(max(length(changelog_items)) > 1, JSON_VALUE(second_json_from_array, '$.fromString'), JSON_VALUE(first_json_from_array, '$.fromString')) as from_status,
  if(isNotNull(resolution), concat(JSON_VALUE(second_json_from_array, '$.toString'), ' (', resolution, ')'), JSON_VALUE(first_json_from_array, '$.toString')) as to_status,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
    arrayStringConcat(arraySlice(splitByChar(' ', ifNull(implementer.name, '')), 1, 2), ' ') AS issue_responsible_implementer,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(sales.name, '')), 1, 2), ' ') AS issue_responsible_sales,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(tsupporter.name, '')), 1, 2), ' ') AS issue_responsible_tsupporter,  
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(analytic.name, '')), 1, 2), ' ') AS issue_responsible_analytic,
  arrayStringConcat(targetEmailsArray, ', ') AS target_emails
  
FROM jira_changelog AS jc

LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by
LEFT JOIN jira_groups_and_users AS implementer ON implementer.email = jc.issue_responsible_implementer
LEFT JOIN jira_groups_and_users AS sales ON sales.email = jc.issue_responsible_sales
LEFT JOIN jira_groups_and_users AS tsupporter ON tsupporter.email = jc.issue_responsible_tsupporter
LEFT JOIN jira_groups_and_users AS analytic ON analytic.email = jc.issue_responsible_analytic

WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
GROUP BY ALL