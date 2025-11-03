WITH
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
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
  
SELECT
  jc. * EXCEPT(created_at, changelog_items, issue_description),
  if(jc.issue_description='', 'Описание отсутствует', jc.issue_description) as issue_description,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  ${a11.key} as parent_key,
  ${a11.fields.summary} as parent_summary,
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

LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
GROUP BY ALL

-- SQL для эпиков
WITH
  
  -- Разрешённые email-адреса: активная глобальная подписка, подписка на конкретное событие
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
  
SELECT
  jc. * EXCEPT(created_at, changelog_items, issue_description),
  if(jc.issue_description='', 'Описание отсутствует', jc.issue_description) as issue_description,
  formatDateTime(jc.created_at, '%d.%m.%y %H:%i') as created_at,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(creator.name, '')), 1, 2), ' ') AS creator_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(reporter.name, '')), 1, 2), ' ') AS reporter_name,
  arrayStringConcat(arraySlice(splitByChar(' ', ifNull(assignee.name, '')), 1, 2), ' ') AS assignee_name,
  arrayStringConcat(
    arrayFilter(responsible -> responsible != '' AND responsible IS NOT NULL AND lower(responsible) IN valid_recipients, 
      [
      lower(jc.issue_assignee), 
      lower(jc.issue_responsible_implementer),
      lower(jc.issue_responsible_tsupporter), 
      lower(jc.issue_responsible_sales),
      lower(jc.issue_responsible_analytic)
      ]
    ), ', '
  ) AS target_emails
FROM jira_changelog AS jc

LEFT JOIN jira_groups_and_users AS reporter ON reporter.email = jc.issue_reporter
LEFT JOIN jira_groups_and_users AS assignee ON assignee.email = jc.issue_assignee
LEFT JOIN jira_groups_and_users AS creator ON creator.email = jc.created_by

WHERE
      jc.issue_key = ${a1.case_id}
  AND jc.issue_event_type_name = ${a1.event_name}
  AND jc.created_at = ${a1.event_time}
  
GROUP BY ALL