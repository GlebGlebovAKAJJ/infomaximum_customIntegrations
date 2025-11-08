-- ! SQL for subtask
WITH
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Назначен исполнителем")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('3112016b-4517-46ac-8573-ddfe670da4b4')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.*,

  -- Описание: если пустое — подставляем заглушку
  if(jc.issue_description = '', 'Описание отсутствует', jc.issue_description) as issue_description,

  -- Дата события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Срок исполнения с остатком дней
  concat(
    formatDateTime(jc.issue_due_date, '%d.%m.%y'),
    ' (через ',
    date_diff('dd', today(), jc.issue_due_date),
    ' дн.)'
  ) as issue_due_date,

  -- Краткие имена участников (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Информация о родительской задаче / эпике
  ${a19.key} as parent_key,
  ${a19.fields.summary} as parent_summary,

  -- Целевой получатель: исполнитель задачи (если активен и не совпадает с инициатором/автором)
  CASE 
    WHEN lower(jc.issue_assignee) != lower(jc.created_by) 
         AND lower(jc.issue_assignee) != lower(jc.issue_reporter) 
         AND lower(jc.issue_assignee) != '' 
         AND lower(jc.issue_assignee) IS NOT NULL 
         AND lower(jc.issue_assignee) IN valid_recipients 
    THEN lower(jc.issue_assignee) 
    ELSE '' 
  END AS target_emails

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

--! SQL для issue
WITH
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Назначен исполнителем")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('3112016b-4517-46ac-8573-ddfe670da4b4')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.*,

  -- Проверяем наличие описания, при его отсутствии подставляем текст-заглушку
  if(jc.issue_description = '', 'Описание отсутствует', jc.issue_description) as issue_description,

  -- Форматируем дату создания события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Формируем срок выполнения с указанием количества оставшихся дней
  concat(
    formatDateTime(jc.issue_due_date, '%d.%m.%y'),
    ' (через ',
    date_diff('dd', today(), jc.issue_due_date),
    ' дн.)'
  ) as issue_due_date,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,

  -- Добавляем информацию о родительской задаче или эпике
  ${a11.key} as parent_key,
  ${a11.fields.summary} as parent_summary,

  -- Определяем целевого получателя уведомления:
  --   если исполнитель задачи активен в системе уведомлений и не совпадает с инициатором события или автором задачи,
  --   то он становится получателем уведомления
  CASE 
    WHEN lower(jc.issue_assignee) != lower(jc.created_by) 
         AND lower(jc.issue_assignee) != lower(jc.issue_reporter) 
         AND lower(jc.issue_assignee) != '' 
         AND lower(jc.issue_assignee) IS NOT NULL 
         AND lower(jc.issue_assignee) IN valid_recipients 
    THEN lower(jc.issue_assignee) 
    ELSE '' 
  END AS target_emails

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

--! SQL для эпиков
WITH
  
  -- Разрешённые email-адреса:
  --   активная глобальная подписка,
  --   подписка на конкретное событие ("Назначен исполнителем")
  (
    SELECT
      lower(email)
    FROM teams_notification_subscriptions
    WHERE
      is_active = 1
      AND event_type_id = toUUID('3112016b-4517-46ac-8573-ddfe670da4b4')
    INTERSECT
    SELECT
      lower(email_address)
    FROM teams_notification_recipients
    WHERE
      is_active = 1
  ) AS valid_recipients
  
-- Формируем итоговый набор данных для отправки уведомления
SELECT
  jc.* EXCEPT(created_at, changelog_items, issue_description),

  -- Проверяем наличие описания, при его отсутствии подставляем текст-заглушку
  if(jc.issue_description = '', 'Описание отсутствует', jc.issue_description) as issue_description,

  -- Форматируем дату создания события
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,

  -- Формируем срок выполнения с указанием количества оставшихся дней
  concat(
    formatDateTime(jc.issue_due_date, '%d.%m.%y'),
    ' (через ',
    date_diff('dd', today(), jc.issue_due_date),
    ' дн.)'
  ) as issue_due_date,

  -- Преобразуем ФИО участников в краткую форму (до двух слов)
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(implementer.name, '')), 1, 2), ' ') AS issue_responsible_implementer,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(sales.name, '')), 1, 2), ' ') AS issue_responsible_sales,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(tsupporter.name, '')), 1, 2), ' ') AS issue_responsible_tsupporter,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(analytic.name, '')), 1, 2), ' ') AS issue_responsible_analytic,

  -- Формируем строку со списком адресатов уведомления:
  --   в список включаются все ответственные по кастомным ролям эпика,
  --   а также исполнитель задачи, если он подписан на уведомления
  arrayStringConcat(
    arrayFilter(
      responsible ->
        responsible != ''
        AND responsible IS NOT NULL
        AND lower(responsible) IN valid_recipients,
      [
        lower(jc.issue_assignee),
        lower(jc.issue_responsible_implementer),
        lower(jc.issue_responsible_tsupporter),
        lower(jc.issue_responsible_sales),
        lower(jc.issue_responsible_analytic)
      ]
    ),
    ', '
  ) AS target_emails

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