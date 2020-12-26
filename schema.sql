--
-- Compare with mdb-to-sqlite.sh. Latest is likely there
--

CREATE TABLE User
(
  username          VARCHAR PRIMARY KEY NOT NULL,
  password          VARCHAR,
  permission_level  INTEGER DEFAULT 0
);

CREATE TABLE Client
(
  family_name       VARCHAR PRIMARY KEY NOT NULL,
  phone             VARCHAR,
  email             VARCHAR,
  ethnicity         VARCHAR,
  count_senior      INTEGER DEFAULT 0,  -- number of family members 65+
  count_adult       INTEGER DEFAULT 0,  -- number of family members 18-64
  count_child       INTEGER DEFAULT 0,  -- number of family members 0-17
  count_sex_male    INTEGER DEFAULT 0,
  count_sex_female  INTEGER DEFAULT 0,
  count_sex_other   INTEGER DEFAULT 0,
  count_veteran     INTEGER DEFAULT 0,
  income_source     VARCHAR,
  income_amount     REAL,
  pet_types         VARCHAR,
  address_default   VARCHAR, -- default address for delivery
  appt_day_default  INTEGER, -- default appt day, 0-relative to Distr start
  appt_time_default VARCHAR, -- default appt time HH:MM,
  verified          BOOLEAN DEFAULT FALSE,
  archived          BOOLEAN DEFAULT FALSE,
  UNIQUE (family_name COLLATE NOCASE)
);

CREATE TABLE Fulfillment
(
  distribution      VARCHAR REFERENCES DistributionPeriod
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  family_name       VARCHAR REFERENCES Client
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  appt_day          INTEGER,    -- 0-relative to distribution
  appt_time         VARCHAR,    -- %H:%M; null if fullfilled w/out appointment
  fulfilled         BOOLEAN DEFAULT FALSE,  -- has been picked up or delivered
  fulfillment_time  VARCHAR,                -- %Y-%m-%d %H:%M:%S
  notes             VARCHAR,
  PRIMARY KEY (distribution, family_name)
);

CREATE INDEX Fulfillment_appt_idx
  ON Fulfillment(distribution, appt_day, appt_time);


CREATE TABLE DistributionPeriod
(
  start_date        VARCHAR PRIMARY KEY,    -- %Y-%m-%d

  -- This might later change to a separate table of appointment
  -- start/end per day, if we need more than one week.
  day_1_first_appt  VARCHAR,    -- %H:%M
  day_1_last_appt   VARCHAR,
  day_2_first_appt  VARCHAR,
  day_2_last_appt   VARCHAR,
  day_3_first_appt  VARCHAR,
  day_3_last_appt   VARCHAR,
  day_4_first_appt  VARCHAR,
  day_4_last_appt   VARCHAR,
  day_5_first_appt  VARCHAR,
  day_5_last_appt   VARCHAR,
  day_6_first_appt  VARCHAR,
  day_6_last_appt   VARCHAR,
  day_7_first_appt  VARCHAR,
  day_7_last_appt   VARCHAR
);


CREATE TABLE Report
(
  name              VARCHAR PRIMARY KEY NOT NULL,
  description       VARCHAR NOT NULL,
  query             VARCHAR NOT NULL,
  input_fields      VARCHAR,
  subtitle_field    VARCHAR,
  separate_by       VARCHAR,
  landscape         BOOLEAN DEFAULT 0,
  UNIQUE (name COLLATE NOCASE)
);
