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
  pre_query,
  query
)
 VALUES
(
  'Distribution appointments perishables',
  'Schedule of appointments for a specified distribution, with perishables',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Distribution Date"
     }
   }',
  '$distribution',
  '_separatorWithTime',
  '$remaining',
  'Day',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       ci.id AS _id,
       f.appt_day as Day,
       f.appt_time AS Time,
       "Day " || f.appt_day || " (" ||
         CASE f.appt_day
           WHEN 1 THEN
             (SELECT day_1_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 2 THEN
             (SELECT day_2_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 3 THEN
             (SELECT day_3_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 4 THEN
             (SELECT day_4_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 5 THEN
             (SELECT day_5_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 6 THEN
             (SELECT day_6_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 7 THEN
             (SELECT day_7_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
         END ||
         ") at " || f.appt_time AS _separatorWithTime,
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
       COALESCE(perishables, "") AS Perishables,
       (SELECT
          COALESCE(max_income_text, "See Taryn")
          FROM UsdaMaxIncome
          WHERE family_size = c.count_senior + c.count_adult + c.count_child
          ) AS USDA,
       CASE c.usda_eligible
         WHEN "yes" THEN "Yes"
         WHEN "no" THEN "No"
         ELSE ""
       END AS "USDA Eligible",
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f
     LEFT JOIN Client c
       ON c.family_name = f.family_name
     LEFT JOIN ClientId ci
       ON ci.family_name = c.family_name
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
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
  pre_query,
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
  '_separatorWithTime',
  '$remaining',
  'Day',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       ci.id AS _id,
       f.appt_day as Day,
       f.appt_time AS Time,
       "Day " || f.appt_day || " (" ||
         CASE f.appt_day
           WHEN 1 THEN
             (SELECT day_1_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 2 THEN
             (SELECT day_2_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 3 THEN
             (SELECT day_3_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 4 THEN
             (SELECT day_4_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 5 THEN
             (SELECT day_5_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 6 THEN
             (SELECT day_5_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 7 THEN
             (SELECT day_6_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
         END ||
         ") at " || f.appt_time AS _separatorWithTime,
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
       (SELECT
          COALESCE(max_income_text, "See Taryn")
          FROM UsdaMaxIncome
          WHERE family_size = c.count_senior + c.count_adult + c.count_child
          ) AS USDA,
       CASE c.usda_eligible
         WHEN "yes" THEN "Yes"
         WHEN "no" THEN "No"
         ELSE ""
       END AS "USDA Eligible",
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f
     LEFT JOIN Client c
       ON c.family_name = f.family_name
     LEFT JOIN ClientId ci
       ON ci.family_name = c.family_name
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
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
  pre_query,
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
  '_separatorWithTime',
  '$remaining',
  'Day',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       ci.id AS _id,
       f.appt_day as Day,
       f.appt_time AS Time,
       "Day " || f.appt_day || " (" ||
         CASE f.appt_day
           WHEN 1 THEN
             (SELECT day_1_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 2 THEN
             (SELECT day_2_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 3 THEN
             (SELECT day_3_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 4 THEN
             (SELECT day_4_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 5 THEN
             (SELECT day_5_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 6 THEN
             (SELECT day_6_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 7 THEN
             (SELECT day_7_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
         END ||
         ") at " || f.appt_time AS _separatorWithTime,
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
       (SELECT
          COALESCE(max_income_text, "See Taryn")
          FROM UsdaMaxIncome
          WHERE family_size = c.count_senior + c.count_adult + c.count_child
          ) AS USDA,
       CASE c.usda_eligible
         WHEN "yes" THEN "Yes"
         WHEN "no" THEN "No"
         ELSE ""
       END AS "USDA Eligible",
       COALESCE(notes, "") AS Notes
     FROM Fulfillment f
     LEFT JOIN Client c
       ON c.family_name = f.family_name
     LEFT JOIN ClientId ci
       ON ci.family_name = c.family_name
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
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
  pre_query,
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
  '_separatorWithTime',
  '$remaining',
  'Day',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       ci.id as _id,
       f.appt_day as Day,
       f.appt_time AS Time,
       "Day " || f.appt_day || " (" ||
         CASE f.appt_day
           WHEN 1 THEN
             (SELECT day_1_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 2 THEN
             (SELECT day_2_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 3 THEN
             (SELECT day_3_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 4 THEN
             (SELECT day_4_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 5 THEN
             (SELECT day_5_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 6 THEN
             (SELECT day_6_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
           WHEN 7 THEN
             (SELECT day_7_date
                FROM DistributionPeriod
                WHERE start_date = $distribution)
         END ||
         ") at " || f.appt_time AS _separatorWithTime,
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
     FROM Fulfillment f
     LEFT JOIN Client c
       ON c.family_name = f.family_name
     LEFT JOIN ClientId ci
       ON ci.family_name = c.family_name
     WHERE f.distribution = $distribution
       AND length(COALESCE(f.appt_time, "")) > 0
     ORDER BY Day, Time, c.family_name;
  '
);

-- REPLACE INTO Report
-- (
--   name,
--   description,
--   landscape,
--   input_fields,
--   subtitle_field,
--   separate_by,
--   number_style,
--   number_remaining,
--   pre_query,
--   query
-- )
--  VALUES
-- (
--   'Distribution appointments for USDA',
--   'Schedule of appointments for a specified distribution, for USDA',
--   1,
--   '{
--      "$distribution" :
--      {
--        "type"  : "SelectBox",
--        "label" : "Distribution Date"
--      }
--    }',
--   '$distribution',
--   '_separatorWithTime',
--   '',
--   'Day',
--   '
--    INSERT INTO StoredProc_UpdateAge
--        (birthday, asOf, family_name, member_name)
--      SELECT
--          date_of_birth, $distribution, family_name, member_name
--        FROM FamilyMember;
--   ',
--   '
--    SELECT
--        f.appt_day as Day,
--        f.appt_time AS Time,
--        "Day " || f.appt_day || " (" ||
--          CASE f.appt_day
--            WHEN 1 THEN
--              (SELECT day_1_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 2 THEN
--              (SELECT day_2_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 3 THEN
--              (SELECT day_3_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 4 THEN
--              (SELECT day_4_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 5 THEN
--              (SELECT day_5_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 6 THEN
--              (SELECT day_6_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--            WHEN 7 THEN
--              (SELECT day_7_date
--                 FROM DistributionPeriod
--                 WHERE start_date = $distribution)
--          END ||
--          ") at " || f.appt_time AS _separatorWithTime,
--        c.family_name || CASE c.verified WHEN 1 THEN "&check;" ELSE "" END
--           AS "Family name",
--        c.count_senior AS "65+",
--        c.count_adult AS "18-64",
--        c.count_child AS "0-17",
--        (c.count_senior + c.count_adult + c.count_child) AS "Total",
--        (SELECT
--           COALESCE(max_income_text, "See Taryn")
--           FROM UsdaMaxIncome
--           WHERE family_size = c.count_senior + c.count_adult + c.count_child
--           ) AS "USDA$",
--        CASE c.usda_eligible
--          WHEN "yes" THEN "Yes"
--          WHEN "no" THEN "No"
--          ELSE ""
--        END AS "USDA",
--        "" AS "Board&nbsp;Member&nbsp;Signature"
--      FROM Fulfillment f
--      LEFT JOIN Client c
--        ON c.family_name = f.family_name
--      LEFT JOIN ClientId ci
--        ON ci.family_name = c.family_name
--      WHERE f.distribution = $distribution
--        AND length(COALESCE(f.appt_time, "")) > 0
--      ORDER BY Day, Time, "Family name";
--   '
-- );


REPLACE INTO Report
(
  name,
  description,
  landscape,
  input_fields,
  subtitle_field,
  separate_by,
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
  query
)
 VALUES
(
  'Distribution total attendance - detail',
  'Detail of counts of single distribution fulfilled clients by category (age, sex, veteran)',
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       c.family_name as "Family name",
       COALESCE((SUM(count_senior) + SUM(count_adult) + SUM(count_child)), 0)
         AS "Total",
       COALESCE(SUM(count_senior), 0) AS Senior,
       COALESCE(SUM(count_adult), 0) AS Adult,
       COALESCE(SUM(count_child), 0) AS Child,
       COALESCE(SUM(count_sex_male), 0) AS Male,
       COALESCE(SUM(count_sex_female), 0) AS Female,
       COALESCE(SUM(count_sex_other), 0) AS Other,
       COALESCE(SUM(count_veteran), 0) AS Veteran
     FROM Fulfillment f, Client c
     WHERE f.fulfilled
       AND f.distribution = $distribution
       AND c.family_name = f.family_name
     GROUP BY c.family_name;
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $year || ''-12-31 23:59'', family_name, member_name
       FROM FamilyMember;
  ',
  '
    SELECT
        COUNT(*) AS Families,
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $year || ''-12-31 23:59'', family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
  query
)
 VALUES
(
  'Yearly total attendance - detail',
  'Detail of total attendance during year (with breakdown)',
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $year || "-12-31 23:59", family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       "Family name",
       COALESCE(COUNT(*), 0) AS "Distributions",
       COALESCE(SUM(Total), 0) AS "Total",
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
         AND c.family_name = f.family_name)
     GROUP BY "Family name";
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
  'Yearly family members by ethnicity',
  'Ethnicity breakdown of unique family members during year',
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
        ethnicity AS Ethnicity,
        count(*) AS Count
      FROM
        (SELECT DISTINCT
             fm.member_name AS member_name,
             c.family_name AS family_name,
             c.ethnicity AS ethnicity
           FROM Client c, Fulfillment f, FamilyMember fm
           WHERE f.fulfilled
             AND c.family_name = f.family_name
             AND f.distribution >= $year
             AND f.distribution < ($year + 1)
             AND fm.family_name = c.family_name
           ORDER by c.family_name, fm.member_name)
      GROUP BY ethnicity;
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, $distribution, family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, ''2021-12-31'', family_name, member_name
       FROM FamilyMember;
  ',
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
  pre_query,
  query
)
 VALUES
(
  'Default appointments: all, by day & time',
  'All default appointments, sorted in order of appointment day and time',
  1,
  '',
  '',
  '_separatorWithTime',
  '',
  '',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth,
         (SELECT MAX(start_date) FROM DistributionPeriod),
         family_name,
         member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       c.appt_day_default as Day,
       c.appt_time_default AS Time,
       "#" || ci.id AS "Client ID",
       c.family_name as "Family name",
       "Day " || c.appt_day_default || " at " || c.appt_time_default AS _separatorWithTime,
       (c.count_senior + c.count_adult + c.count_child) ||
         CASE
           WHEN c.count_senior + c.count_adult + c.count_child >= 4
             THEN " (Large)"
           WHEN c.count_senior + c.count_adult + c.count_child = 1
             THEN " (Single)"
           ELSE " (Small)"
         END AS "Family size",
       (SELECT
          COALESCE(max_income_text, "See Taryn")
          FROM UsdaMaxIncome
          WHERE family_size = c.count_senior + c.count_adult + c.count_child
          ) AS USDA,
       CASE c.usda_eligible
         WHEN "yes" THEN "Yes"
         WHEN "no" THEN "No"
         ELSE ""
       END AS "USDA Eligible",
       COALESCE(c.pet_types, "") AS Pets,
       COALESCE(c.phone, "") AS Phone,
       COALESCE(c.notes_default, "") AS Notes
     FROM Client c
     LEFT JOIN ClientId ci
       ON ci.family_name = c.family_name
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
  pre_query,
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
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth,
         (SELECT MAX(start_date) FROM DistributionPeriod),
         family_name,
         member_name
       FROM FamilyMember;
  ',
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
  'Missing birthdates: all',
  'Show all families without entered birthdates',
  0,
  '',
  '',
  '
   SELECT family_name AS `Family Name`
     FROM Client
     WHERE `Family Name` NOT IN
       (SELECT DISTINCT family_name FROM FamilyMember)
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
  'Missing birthdates: distributed 2021',
  'Show families who participated 2021, without entered birthdates',
  0,
  '',
  '',
  '
   SELECT family_name AS `Family Name`
     FROM Client
     WHERE
           `Family Name` IN
             (SELECT family_name
                FROM Fulfillment
                WHERE distribution LIKE ''2021%'')
       AND `Family Name` NOT IN
             (SELECT DISTINCT family_name
                FROM FamilyMember)
     ORDER BY `Family Name`;
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
  pre_query,
  query
)
 VALUES
(
  'Family members, by age',
  'All family members, sorted by age ',
  0,
  '',
  '',
  '',
  '',
  '',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth, datetime(), family_name, member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       member_name AS Name,
       family_name AS Family,
       age AS Age,
       date_of_birth AS Birthday,
       gender AS Gender,
       CASE is_veteran WHEN 0 THEN "N" ELSE "Y" END AS Veteran
     FROM FamilyMember
     ORDER BY date_of_birth DESC;
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
  pre_query,
  query
)
 VALUES
(
  'Distribution USDA signatures',
  'USDA signatures provided during a distribution, for following distribution',
  1,
  '{
     "$distribution" :
     {
       "type"  : "SelectBox",
       "label" : "Closing Distribution Date"
     }
   }',
  '$distribution',
  '',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth,
         (SELECT MAX(start_date) FROM DistributionPeriod),
         family_name,
         member_name
       FROM FamilyMember;
  ',
  '
   SELECT DISTINCT
       c.family_name AS "Family name",
       c.count_senior + c.count_adult + c.count_child AS "Family size",
       c.count_senior AS Seniors,
       c.count_adult AS Adults,
       c.count_child AS Children,
       (SELECT
          COALESCE(max_income_text, "See Taryn")
          FROM UsdaMaxIncome
          WHERE family_size = c.count_senior + c.count_adult + c.count_child
          ) AS "Income does not exceed",
       COALESCE(
         f.usda_eligible_signature,
         -- X image to request board member signature
         "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAA3XAAAN1wFCKJt4AAAAB3RJTUUH5gIDDhEZWZAIawAAAJpJREFUSMfNl80OgCAMg9u9/zvjxYvGABtd6i4kyPqZyX4ETMZ7HR97answYnGgAwoAiN2DSug7rGPxXAXll7ASPtVi1kEBnQmewLd8eSpQ9ZEJZV+UotClo6P4bqX7wNNCUNVUpElJj6LCkNYKd1v8dagtl8uSTpYCYimZliZhaYuWQcAy+liGvQ7oFB7C5pHKnGiGdv8W5e0C2k4tIsqHIKsAAAAASUVORK5CYII="
         ) AS Signature,
       f.usda_signature_hash AS "Security Hash"
     FROM Client c
     LEFT JOIN Fulfillment f
       ON f.family_name = c.family_name
     LEFT JOIN UsdaEligibleNextDistro uend
       ON uend.family_name = c.family_name
     WHERE (uend.distribution = $distribution
            AND uend.usda_eligible_next_distro = "yes")
        OR (f.distribution = $distribution
            AND f.usda_eligible_signature IS NOT NULL
            AND length(f.usda_eligible_signature) > 0)
     ORDER BY c.family_name;
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
  pre_query,
  query
)
 VALUES
(
  'USDA eligibility overrides, next distro',
  'Currently configured overrides to next distribution''s USDA eligibility',
  1,
  '',
  '_asOf',
  '',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth,
         (SELECT MAX(start_date) FROM DistributionPeriod),
         family_name,
         member_name
       FROM FamilyMember;
  ',
  '
   SELECT
       c.family_name AS "Family name",
       CASE c.usda_eligible_next_distro
         WHEN "yes" THEN "Yes"
         WHEN "no"  THEN "No"
         ELSE ""
       END AS "Override eligibility with",
       c.count_senior + c.count_adult + c.count_child AS "Family size",
       c.count_senior AS Seniors,
       c.count_adult AS Adults,
       c.count_child AS Children,
       "As of " || datetime("now", "localtime") AS _asOf
     FROM Client c
     WHERE c.usda_eligible_next_distro IS NOT NULL
     ORDER BY c.family_name;
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
  pre_query,
  query
)
 VALUES
(
  'Recent family/child attendees',
  'Children who attended within most recent three distributions',
  0,
  '',
  '',
  'Family name',
  '',
  '',
  '
   INSERT INTO StoredProc_UpdateAge
       (birthday, asOf, family_name, member_name)
     SELECT
         date_of_birth,
         (SELECT MAX(start_date) FROM DistributionPeriod),
         family_name,
         member_name
       FROM FamilyMember;
  ',
  'SELECT
       family_name AS "Family name",
       member_name AS "Child name",
       CASE gender
         WHEN "M" THEN "Male"
         WHEN "F" THEN "Female"
         ELSE "Other"
       END AS Gender,
       age AS Age
     FROM FamilyMember
     WHERE
       age < 18
       AND family_name IN
         (SELECT DISTINCT family_name
            FROM Fulfillment
            WHERE distribution IN
              (SELECT start_date
                 FROM DistributionPeriod
                 ORDER BY start_date
                 DESC LIMIT 3))
     ORDER BY family_name, age;
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
  pre_query,
  query
)
 VALUES
(
  'Recent family/veteran attendees',
  'Veterans who attended within most recent three distributions',
  0,
  '',
  '',
  'Family name',
  '',
  '',
  '',
  'SELECT
       family_name AS "Family name",
       member_name AS "Child name",
       CASE gender
         WHEN "M" THEN "Male"
         WHEN "F" THEN "Female"
         ELSE "Other"
       END AS Gender
     FROM FamilyMember
     WHERE
       is_veteran
       AND family_name IN
         (SELECT DISTINCT family_name
            FROM Fulfillment
            WHERE distribution IN
              (SELECT start_date
                 FROM DistributionPeriod
                 ORDER BY start_date
                 DESC LIMIT 3))
     ORDER BY family_name;
  '
);
