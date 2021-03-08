REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  number_style,
  number_remaining,
  query
)
 VALUES
(
  'Distribution appointments with name',
  'Schedule of appointments for a specified distribution, including family name',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'Time',
  '$remaining',
  'Day',
  '
   SELECT
       f.appt_day as Day,
       f.appt_time AS Time,
       c.family_name || CASE c.verified WHEN 1 THEN "&check;" ELSE "" END
          AS "Family name",
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(pet_types, "") AS Pets,
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f, Client c
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
       AND c.family_name = f.family_name
     ORDER BY Day, Time, "Family name";
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  number_style,
  number_remaining,
  query
)
 VALUES
(
  'Distribution appointments with phone',
  'Schedule of appointments for a specified distribution, including family name and phone number',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'Time',
  '$remaining',
  'Day',
  '
   SELECT
       f.appt_day as Day,
       f.appt_time AS Time,
       c.family_name || CASE c.verified WHEN 1 THEN "&check;" ELSE "" END
          AS "Family name",
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(pet_types, "") AS Pets,
       COALESCE(phone, "") AS Phone,
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f, Client c
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
       AND c.family_name = f.family_name
     ORDER BY Day, Time, "Family name";
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  number_style,
  number_remaining,
  query
)
 VALUES
(
  'Distribution appointments',
  'Schedule of appointments for a specified distribution, without family name',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'Time',
  '$remaining',
  'Day',
  '
   SELECT
       f.appt_day as Day,
       f.appt_time AS Time,
       CASE c.verified WHEN 1 THEN "&check;" ELSE "" END AS V,
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(pet_types, "") AS Pets,
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f, Client c
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
       AND c.family_name = f.family_name
     ORDER BY Day, Time, c.family_name;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distribution ethnicity report',
  'Show ethnicity breakdown for a specific distribution',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'Ethnicity',
  '
   SELECT
       c.ethnicity AS Ethnicity,
       (COALESCE((SUM(count_senior) + SUM(count_adult) + SUM(count_child)), 0))
         AS Count
     FROM Client c, Fulfillment f
     WHERE f.fulfilled
       AND f.distribution = $distribution
       AND c.family_name = f.family_name
     GROUP BY c.ethnicity;'
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distribution total attendance',
  'Counts of single distribution fulfilled clients by category (age, sex, veteran)',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  '',
  '
   SELECT
       COALESCE((SUM(count_senior) + SUM(count_adult) + SUM(count_child)), 0)
         AS "Total",
       COALESCE(SUM(count_senior), 0) AS Senior,
       COALESCE(SUM(count_adult), 0) AS Adult,
       COALESCE(SUM(count_child), 0) AS Child,
       COALESCE(SUM(count_sex_male), 0) AS Male,
       COALESCE(SUM(count_sex_female), 0) AS Female,
       COALESCE(SUM(count_sex_other), 0) AS Other,
       COALESCE(SUM(count_veteran), 0) AS Veteran,
       COUNT(*) AS Families
     FROM Fulfillment f, Client c
     WHERE f.fulfilled
       AND f.distribution = $distribution
       AND c.family_name = f.family_name;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distribution unfulfilled',
  'Appointments and deliveries that were scheduled but are yet unfulfilled',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  '',
  '
   SELECT
       c.family_name as "Family name",
       c.count_senior + c.count_adult + c.count_child AS "Family size",
        COALESCE(pet_types, "") AS Pets
      FROM Fulfillment f, Client c
      WHERE f.distribution = $distribution
        AND f.fulfilled = 0
        AND c.family_name = f.family_name
      ORDER BY "Family name";
   '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Yearly unique families attended',
  'Total unique families attended during year (with breakdown)',
  0,
  '{
     "$year" :
     {
       "type"       : "TextField",
       "label"      : "Year",
       "validation" :
        {
          "required"  : true
        }
     }
   }',
  '$year',
  '',
  '
    SELECT
        COALESCE(SUM(Total), 0) AS Total,
        COALESCE(SUM(Senior), 0) AS Senior,
        COALESCE(SUM(Adult), 0) AS Adult,
        COALESCE(SUM(Child), 0) AS Child,
        COALESCE(SUM(Male), 0) AS Male,
        COALESCE(SUM(Female), 0) AS Female,
        COALESCE(SUM(Other), 0) AS Other,
        COALESCE(SUM(Veteran), 0) AS Veteran
      FROM
       (SELECT DISTINCT
          c.family_name AS "Family name",
          (c.count_senior + c.count_adult + c.count_child) AS Total,
          c.count_senior AS Senior,
          c.count_adult AS Adult,
          c.count_child AS Child,
          c.count_sex_male AS Male,
          c.count_sex_female AS Female,
          c.count_sex_other AS Other,
          c.count_veteran AS Veteran
        FROM Fulfillment f, Client c
        WHERE f.distribution >= $year
          AND f.distribution < ($year + 1)
          AND f.fulfilled
          AND c.family_name = f.family_name);
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Yearly total attendance',
  'Total attendance during year (with breakdown)',
  0,
  '{
     "$year" :
     {
       "type" : "TextField",
       "label" : "Year",
       "validation" :
        {
          "required"  : true
        }
     }
   }',
  '$year',
  '',
  '
    SELECT
        COALESCE(SUM(Total), 0) AS Total,
        COALESCE(SUM(Senior), 0) AS Senior,
        COALESCE(SUM(Adult), 0) AS Adult,
        COALESCE(SUM(Child), 0) AS Child,
        COALESCE(SUM(Male), 0) AS Male,
        COALESCE(SUM(Female), 0) AS Female,
        COALESCE(SUM(Other), 0) AS Other,
        COALESCE(SUM(Veteran), 0) AS Veteran
      FROM
       (SELECT
          c.family_name AS "Family name",
          (c.count_senior + c.count_adult + c.count_child) AS Total,
          c.count_senior AS Senior,
          c.count_adult AS Adult,
          c.count_child AS Child,
          c.count_sex_male AS Male,
          c.count_sex_female AS Female,
          c.count_sex_other AS Other,
          c.count_veteran AS Veteran
        FROM Fulfillment f, Client c
        WHERE f.distribution >= $year
          AND f.distribution < ($year + 1)
          AND f.fulfilled
          AND c.family_name = f.family_name);
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distribution large/small meals required',
  'Number of meals for solo (1), small (2-3) and large (4+) families',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'day',
  '
    SELECT day, size, SUM(count) AS count FROM
      (SELECT appt_day AS day, "c-Large" AS size, COUNT(*) AS count
         FROM Fulfillment f, Client c
         WHERE f.distribution = $distribution
           AND c.family_name = f.family_name
           AND (c.count_senior + c.count_adult + c.count_child >= 4)
         GROUP BY appt_day
       UNION ALL
       SELECT appt_day AS day, "b-Small" AS size, COUNT(*) AS count
         FROM Fulfillment f, Client c
         WHERE f.distribution = $distribution
           AND c.family_name = f.family_name
           AND (    c.count_senior + c.count_adult + c.count_child <= 3
                AND c.count_senior + c.count_adult + c.count_child >= 2)
         GROUP BY appt_day
       UNION ALL
       SELECT appt_day AS day, "a-Single" AS size, COUNT(*) AS count
         FROM Fulfillment f, Client c
         WHERE f.distribution = $distribution
           AND c.family_name = f.family_name
           AND (c.count_senior + c.count_adult + c.count_child = 1)
         GROUP BY appt_day)
     GROUP BY day, size
     ORDER BY day, size
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distributions fullfilled for a family',
  'Total attendance during year (with breakdown)',
  0,
  '{
     "$family_name" :
     {
       "type" : "SelectBox",
       "label" : "Family name"
     }
   }',
  '$family_name',
  '',
  '
    SELECT
        distribution
      FROM Fulfillment f
        WHERE f.family_name = $family_name
          AND f.fulfilled;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Yearly appointments missed',
  'List of all families who missed appointments during the year',
  0,
  '{
     "$year" :
     {
       "type" : "TextField",
       "label" : "Year",
       "validation" :
        {
          "required"  : true
        }
     }
   }',
  '$year',
  'family_name',
  '
    SELECT
        family_name, distribution
      FROM Fulfillment f
        WHERE f.distribution >= $year
          AND f.distribution < ($year + 1)
          AND NOT f.fulfilled
        ORDER BY family_name, distribution;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  separate_by,
  query
)
 VALUES
(
  'Faulty client data',
  'Show all families where sum by age does not equal sum by sex',
  0,
  '',
  '',
  '
   SELECT family_name
     FROM Client
     WHERE count_senior + count_adult + count_child <>
             count_sex_male + count_sex_female + count_sex_other
     ORDER BY family_name;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Distribution families per day',
  'Number of meals needed for a distribution, per day',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  '',
  '
    SELECT appt_day AS Day, COUNT(*) as Count
      FROM Fulfillment
      WHERE distribution = $distribution
      GROUP BY appt_day;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  query
)
 VALUES
(
  'Missing RSVP',
  'Families that have a default appointment but have not RSVPed for a distribution',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  '',
  '
    SELECT
        family_name AS `Family Name`,
        appt_day_default AS `Default Day`,
        appt_time_default AS `Default time`
      FROM Client
      WHERE appt_time_default IS NOT NULL
        AND length(appt_time_default) > 0
        AND family_name NOT IN
          (SELECT family_name
            FROM Fulfillment
            WHERE distribution = $distribution)
     ORDER BY family_name, appt_day_default, appt_time_default;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  number_style,
  number_remaining,
  query
)
 VALUES
(
  'Default appointments: all, by day & time',
  'All default appointments, sorted in order of appointment day and time',
  1,
  '',
  '',
  'Time',
  '',
  '',
  '
   SELECT
       c.appt_day_default as Day,
       c.appt_time_default AS Time,
       c.family_name as "Family name",
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(c.pet_types, "") AS Pets,
       COALESCE(c.phone, "") AS Phone,
       COALESCE(c.notes_default, "") AS Notes
     FROM Client c
     WHERE appt_time_default IS NOT NULL
        AND length(appt_time_default) > 0
     ORDER BY Day, Time, "Family name";
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  number_style,
  number_remaining,
  query
)
 VALUES
(
  'Default appointments: all, by family name',
  'All default appointments, sorted in order of family name',
  1,
  '',
  '',
  '',
  '',
  '',
  '
   SELECT
       c.family_name as "Family name",
       c.appt_day_default as Day,
       c.appt_time_default AS Time,
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(c.pet_types, "") AS Pets,
       COALESCE(c.phone, "") AS Phone,
       COALESCE(c.notes_default, "") AS Notes
     FROM Client c
     WHERE appt_time_default IS NOT NULL
        AND length(appt_time_default) > 0
     ORDER BY "Family name", Day, Time;
  '
);

REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  separate_by,
  query
)
 VALUES
(
  'Default appointments: missing',
  'Show all families which do not have a default appointment',
  1,
  '',
  '',
  '
   SELECT
       family_name AS `Family Name`,
       COALESCE(phone, "") AS Phone,
       COALESCE(email, "") AS Email
     FROM Client
     WHERE length(COALESCE(appt_time_default, '''')) = 0
     ORDER BY `Family Name`;
  '
);

-
---
--- Query for a family name, all items, and exclusions and notes for
--- those items.
-
--- SELECT
---     c.family_name AS family_name,
---     gi.item AS item,
---     gi.perishable AS perishable,
---     CASE
---       WHEN cgp.exclude IS NULL THEN 1
---       ELSE NOT cgp.exclude
---     END AS wanted,
---     cgp.notes AS notes
---   FROM Client c
---   CROSS JOIN  GroceryItem gi
---   LEFT JOIN ClientGroceryPreference cgp
---     ON cgp.family_name = c.family_name AND cgp.grocery_item = gi.item
---    WHERE c.family_name = 'Abdelnasseh, Mikail';

