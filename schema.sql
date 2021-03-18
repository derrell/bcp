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
  count_child12     INTEGER DEFAULT 0,
  count_sex_male    INTEGER DEFAULT 0,
  count_sex_female  INTEGER DEFAULT 0,
  count_sex_other   INTEGER DEFAULT 0,
  count_veteran     INTEGER DEFAULT 0,
  income_source     VARCHAR,
  income_amount     REAL,
  pet_types         VARCHAR,
  address_default   VARCHAR, -- default address for delivery
  appt_day_default  INTEGER, -- default appt day, 1-relative to Distr start
  appt_time_default VARCHAR, -- default appt time HH:MM,
  verified          BOOLEAN DEFAULT FALSE,
  archived          BOOLEAN DEFAULT FALSE,
  notes_default     VARCHAR NOT NULL DEFAULT '',
  food_preferences  VARCHAR NOT NULL DEFAULT '',
  UNIQUE (family_name COLLATE NOCASE)
);

-- Changes from original to derive the above table
--
-- ALTER TABLE Client ADD COLUMN notes_default VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN food_preferences VARCHAR NOT NULL DEFAULT '';
-- ALTER TABLE Client ADD COLUMN count_child12 INTEGER DEFAULT 0;


CREATE TABLE Fulfillment
(
  distribution      VARCHAR REFERENCES DistributionPeriod
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  family_name       VARCHAR REFERENCES Client
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  appt_day          INTEGER,    -- 1-relative to distribution
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
  number_style      VARCHAR,
  number_remaining  VARCHAR,
  columns           INTEGER DEFAULT 1,
  munge_function    VARCHAR,
  UNIQUE (name COLLATE NOCASE)
);


CREATE TABLE KeyValueStore
(
  key               VARCHAR PRIMARY KEY NOT NULL,
  value             VARCHAR
);


CREATE TABLE GroceryItem
(
  item              VARCHAR PRIMARY KEY NOT NULL,
  perishable        BOOLEAN NOT NULL DEFAULT 0,
  dist_aisle        INTEGER DEFAULT '',    -- A, B, ...
  dist_unit         INTEGER DEFAULT '',    -- 0=north 1-9=shelves 10=south
  dist_side         VARCHAR DEFAULT '',    -- L=left R=right
  dist_shelf        VARCHAR DEFAULT '',    -- a=top, b=second-from-top, etc.
  on_hand           VARCHAR,    -- "plenty", "reorder", "ignore"
  order_contact     VARCHAR,    -- who to contact for reorder
  category          INTEGER REFERENCES GroceryCategory
                            ON DELETE SET NULL,
  UNIQUE (item COLLATE NOCASE)
);

CREATE TABLE ClientGroceryPreference
(
  family_name       VARCHAR REFERENCES Client
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  grocery_item      INTEGER REFERENCES GroceryItem
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  exclude           BOOLEAN NOT NULL DEFAULT 0,
  notes             VARCHAR
);

CREATE TABLE GroceryCategory
(
  id                INTEGER PRIMARY KEY NOT NULL,
  parent            INTEGER REFERENCES GroceryCategory
                            ON DELETE CASCADE
                            ON UPDATE CASCADE,
  name              VARCHAR NOT NULL, -- e.g., "meat", "fish"
  UNIQUE (name COLLATE NOCASE)
);

INSERT OR IGNORE INTO GroceryCategory
    (id, parent, name)
  VALUES
    (0, NULL, 'Categories');

--
-- Not yet implemented...
--
-- CREATE TABLE GroceryItemDistributionMap
-- (
-- grocery_item      INTEGER REFERENCES GroceryItem
--                           ON DELETE CASCADE
--                           ON UPDATE CASCADE,
-- distribution      VARCHAR REFERENCES DistributionPeriod
--                           ON DELETE CASCADE
--                           ON UPDATE CASCADE
-- );

-- CREATE TABLE GroceryAttribute
-- (
--   attribute_name    VARCHAR PRIMARY KEY NOT NULL, --e.g., gluten-free
-- );

-- CREATE TABLE GroceryItemAttributeMap
-- (
--   grocery_item      INTEGER REFERENCES GroceryItem
--                             ON DELETE CASCADE
--                             ON UPDATE CASCADE,
--   attribute         VARCHAR REFERENCES GroceryAttribute,
--                             ON DELETE CASCADE,
--                             ON UPDATE CASCADE
-- );
