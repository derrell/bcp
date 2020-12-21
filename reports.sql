INSERT INTO Report
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
  'SELECT family_name AS `Family Name`, COALESCE(phone, "") AS Phone, COALESCE(email, "") AS Email FROM Client WHERE length(COALESCE(appt_time_default, '''')) = 0 ORDER BY `Family Name`;'
);


INSERT INTO Report
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
  'SELECT family_name FROM Client WHERE count_senior + count_adult + count_child <> count_sex_male + count_sex_female + count_sex_other ORDER BY family_name;'
);

INSERT INTO Report
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
  'Ethnicity monthly report',
  'Show ethnicity breakdown for a specific distribution',
  0,
  '{ "$distribution" : { "type" : "SelectBox", "label" : "Distribution Date"} }',
  '$distribution',
  'Ethnicity',
  'SELECT c.ethnicity AS Ethnicity, COUNT(*) AS Count FROM Client c, Fulfillment f WHERE f.fulfilled AND f.distribution = $distribution AND c.family_name = f.family_name GROUP BY c.ethnicity;'
);

INSERT INTO Report
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
  'Total number of attendees',
  'Counts of fulfilled clients by category (age, sex, veteran)',
  1,
  '{ "$distribution" : { "type" : "SelectBox", "label" : "Distribution Date" } }',
  '$distribution',
  '',
  'SELECT (SUM(count_senior) + SUM(count_adult) + SUM(count_child)) AS "Total", SUM(count_senior) AS Senior, SUM(count_adult) AS Adult, SUM(count_child) AS Child, SUM(count_sex_male) AS Male, SUM(count_sex_female) AS Female, SUM(count_sex_other) AS Other, SUM(count_veteran) AS Veteran FROM Fulfillment f, Client c WHERE f.fulfilled AND f.distribution = $distribution AND c.family_name = f.family_name;'
);

INSERT INTO Report
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
  '{ "$distribution" : { "type" : "SelectBox", "label" : "Distribution Date" } }',
  '$distribution',
  'Time',
  'SELECT f.appt_day as Day, f.appt_time AS Time, c.family_name as "Family name", c.count_senior + c.count_adult + c.count_child AS "Family size", COALESCE(pet_types, "") AS Pets FROM Fulfillment f, Client c WHERE f.distribution = $distribution AND length(COALESCE(f.appt_time, "")) > 0 AND f.method = "Pick-up" AND c.family_name = f.family_name ORDER BY Day, Time, "Family name";'
);

INSERT INTO Report
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
  'Distribution deliveries',
  'Required deliveries for a specified distribution',
  0,
  '{ "$distribution" : { "type" : "SelectBox", "label" : "Distribution Date" } }',
  '$distribution',
  '',
  'SELECT c.family_name as "Family name", f.delivery_address AS delivery_address, c.count_senior + c.count_adult + c.count_child AS "Family size", COALESCE(pet_types, "") AS Pets FROM Fulfillment f, Client c WHERE f.distribution = $distribution AND f.method = "Delivery" AND c.family_name = f.family_name ORDER BY "Family name";'
);

INSERT INTO Report
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
  'Distributions unfulfilled',
  'Appointments and deliveries that were scheduled but are yet unfulfilled',
  0,
  '{ "$distribution" : { "type" : "SelectBox", "label" : "Distribution Date" } }',
  '$distribution',
  '',
  'SELECT c.family_name as "Family name", f.method AS "Fulfillment method", COALESCE(f.delivery_address, "") AS "Delivery address", c.count_senior + c.count_adult + c.count_child AS "Family size", COALESCE(pet_types, "") AS Pets FROM Fulfillment f, Client c WHERE f.distribution = $distribution AND f.fulfilled = 0 AND c.family_name = f.family_name ORDER BY "Fulfillment method" DESC, "Family name";'
);
