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
  'Distribution appointments',
  'Schedule of appointments for a specified distribution',
  0,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  'Time',
  '
   SELECT
       f.appt_day as Day,
       f.appt_time AS Time,
       c.family_name as "Family name",
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE WHEN c.count_senior + c.count_adult + c.count_child >= 4
           THEN " (Large)"
           ELSE " (Small)"
         END AS "Family size",
       COALESCE(pet_types, "") AS Pets
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
       COUNT(*) AS Count
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
       (SUM(count_senior) + SUM(count_adult) + SUM(count_child)) AS "Total",
       SUM(count_senior) AS Senior,
       SUM(count_adult) AS Adult,
       SUM(count_child) AS Child,
       SUM(count_sex_male) AS Male,
       SUM(count_sex_female) AS Female,
       SUM(count_sex_other) AS Other,
       SUM(count_veteran) AS Veteran
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
       COALESCE(f.delivery_address, "") AS "Delivery address",
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
        SUM(Total) AS Total,
        SUM(Senior) AS Senior,
        SUM(Adult) AS Adult,
        SUM(Child) AS Child,
        SUM(Male) AS Male,
        SUM(Female) AS Female,
        SUM(Other) AS Other,
        SUM(Veteran) AS Veteran
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
        SUM(Total) AS Total,
        SUM(Senior) AS Senior,
        SUM(Adult) AS Adult,
        SUM(Child) AS Child,
        SUM(Male) AS Male,
        SUM(Female) AS Female,
        SUM(Other) AS Other,
        SUM(Veteran) AS Veteran
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
  'Number of meals for small (1-3) and large (4+) families',
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
    SELECT "Large" as size, COUNT(*) AS count
      FROM Fulfillment f, Client c
      WHERE f.distribution = $distribution
        AND c.family_name = f.family_name
        AND (c.count_senior + c.count_adult + c.count_child >= 4)
    UNION ALL
    SELECT "Small" as size, COUNT(*) AS count
      FROM Fulfillment f, Client c
      WHERE f.distribution = $distribution
        AND c.family_name = f.family_name
        AND (c.count_senior + c.count_adult + c.count_child < 4)
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
  separate_by,
  query
)
 VALUES
(
  'Missing default appointments',
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

