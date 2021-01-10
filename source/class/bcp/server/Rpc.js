qx.Class.define("bcp.server.Rpc",
{
  type   : "singleton",
  extend : qx.core.Object,

  events :
  {
    dbReady : "qx.event.type.Data"
  },

  statics :
  {
    Error :
    {
      // Standard errors handled by Jayson itself
      ParseError       : -32700,
      InvalidRequest   : -32600,
      MethodNotFound   : -32601,
      InvalidParams    : -32602,
      InternalError    : -32603,

      // Application-specific errors (-32000.. -32099)
      AlreadyExists    : -32000
    }
  },

  members :
  {
    /** The database handle */
    _db   : null,

    /** Temporary storage of the request object of a call */
    _req  : null,

    /**
     * Create the login and logout routes
     *
     * @param app {Express}
     *   The Express app object
     */
    init(app)
    {
      let             entry;
      let             server;
      let             requests;
      let             serverEntries = {};
      const           sqlite3 = require("sqlite3");
      const           { open } = require("sqlite");
      const           jayson = require("jayson");

      this.info("Rpc: starting");

      // Each of the available requests
      requests =
        {
          whoAmI       :
          {
            handler             : this._whoAmI.bind(this),
            permission_level    : 0
          },

          getClientList       :
          {
            handler             : this._getClientList.bind(this),
            permission_level    : 50
          },

          saveClient          :
          {
            handler             : this._saveClient.bind(this),
            permission_level    : 50
          },

          getAppointments     :
          {
            handler             : this._getAppointments.bind(this),
            permission_level    : 50
          },

          saveFulfillment     :
          {
            handler             : this._saveFulfillment.bind(this),
            permission_level    : 50
          },

          getDistributionList :
          {
            handler             : this._getDistributionList.bind(this),
            permission_level    : 50
          },

          saveDistribution    :
          {
            handler             : this._saveDistribution.bind(this),
            permission_level    : 50
          },

          getReportList       :
          {
            handler             : this._getReportList.bind(this),
            permission_level    : 50
          },

          generateReport      :
          {
            handler             : this._generateReport.bind(this),
            permission_level    : 50
          },

          getDeliveryDay      :
          {
            handler             : this._getDeliveryDay.bind(this),
            permission_level    : 20
          },

          updateFulfilled    :
          {
            handler             : this._updateFulfilled.bind(this),
            permission_level    : 20
          },

          sendChat           :
          {
            handler             : this._sendChat.bind(this),
            permission_level    : 30
          }
        };

      // Create the rpcName:handler map needed for jayson.server()
      for (entry in requests)
      {
        serverEntries[entry] = requests[entry].handler;
      }

      // Create the JSON-RPC server
      server = jayson.server(serverEntries);

      // Open the database
      open(
        {
          filename : `${process.cwd()}/pantry.db`,
          driver   : sqlite3.Database
        })
        .then(
          (db) =>
          {
            this._db = db;
            this.fireDataEvent("dbReady", db);
          });

      app.use(
        "/rpc",
        (req, res, next) =>
        {
          const           { username, permissionLevel } = req.session;

          console.log(`Got RPC request from ${username}: body=`, req.body);

          // Ensure basic components of the request are available
          if (! req.body ||
              ! req.body.method ||
              typeof req.session.permissionLevel != "number")
          {
            res.status(401).send("Authentication failed");
          }

          // Look at the method and ensure this user is allowed to access it
          if (! requests[req.body.method] ||
              typeof requests[req.body.method].permission_level != "number" ||
              requests[req.body.method].permission_level > permissionLevel)
          {
            // They're not allowed access. Redirect them to a
            // non-existent method
            console.log(
              `User ${username} does not have permission ` +
                `for method ${req.body.method} ` +
                `(requires ${requests[req.body.method].permission_level}; ` +
                `user has ${permissionLevel}`);
            req.body.method = "MethodDoesNotExist";
          }

          // Save req locally so it's accessible in RPC.
          // SAVE IT AS FIRST STEP IN RPC. It may change due to other RPC calls.
          this._req = req;

          server.middleware()(req, res, next);
        });
    },

    /**
     * Get the database handle
     *
     * @return {Promise}
     *   If the database handle is available, the promise is
     *   immediately resolved with that handle. Otherwise, it is
     *   resolved when the database is available.
     */
    getDB()
    {
      return new Promise(
        (resolve, reject) =>
        {
          // If the database handle is already available...
          if (this._db)
          {
            // ... then just give it to 'em.
            resolve(this._db);
          }

          // Otherwise, await it
          this.addListener(
            "dbReady",
            (e) =>
            {
              resolve(this._db);
            });
        });
    },

    /**
     * Return the logged-in user and permissions
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _whoAmI(args, callback)
    {
      callback(
        null,
        {
          username        : this._req.session.username,
          permissionLevel : this._req.session.permissionLevel
        });
    },

    /**
     * Retrieve the full client list
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getClientList(args, callback)
    {
      // TODO: move prepared statements to constructor
      return this._db.prepare(
        [
          "SELECT",
          [
            "family_name",
            "phone",
            "email",
            "ethnicity",
            "verified",
            "count_senior",
            "count_adult",
            "count_child",
            "count_sex_male",
            "count_sex_female",
            "count_sex_other",
            "count_veteran",
            "income_source",
            "income_amount",
            "pet_types",
            "address_default",
            "appt_day_default",
            "appt_time_default"
          ].join(", "),
          "FROM Client",
          "ORDER BY family_name"
        ].join(" "))
        .then(
          (stmt) =>
          {
            return stmt.all({});
          })
        .then(
          (result) =>
          {
            callback(null, result);
          })
        .catch((e) =>
          {
            console.warn("Error in getClientList", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Save a new or updated client. When updating the record is replaced in
     * its entirety.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing complete data for a client record
     *
     *   args[1] {Boolean}
     *     true if this is a new entry; false if it is an edit
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveClient(args, callback)
    {
      let             p;
      let             prepare;
      const           clientInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        prepare = this._db.prepare(
          [
            "UPDATE Client",
            "  SET ",
            "    phone = $phone,",
            "    email = $email,",
            "    ethnicity = $ethnicity,",
            "    count_senior = $count_senior,",
            "    count_adult = $count_adult,",
            "    count_child = $count_child,",
            "    count_sex_male = $count_sex_male,",
            "    count_sex_female = $count_sex_female,",
            "    count_sex_other = $count_sex_other,",
            "    count_veteran = $count_veteran,",
            "    income_source = $income_source,",
            "    income_amount = $income_amount,",
            "    pet_types = $pet_types,",
            "    address_default = $address_default,",
            "    appt_day_default = $appt_day_default,",
            "    appt_time_default = $appt_time_default,",
            "    verified = $verified",
            "  WHERE family_name = $family_name;",
          ].join(" "));
      }
      else
      {
        // This is a new entry
        prepare = this._db.prepare(
          [
            "INSERT INTO Client",
            "  (",
            "    family_name,",
            "    phone,",
            "    email,",
            "    ethnicity,",
            "    count_senior,",
            "    count_adult,",
            "    count_child,",
            "    count_sex_male,",
            "    count_sex_female,",
            "    count_sex_other,",
            "    count_veteran,",
            "    income_source,",
            "    income_amount,",
            "    pet_types,",
            "    address_default,",
            "    appt_day_default,",
            "    appt_time_default,",
            "    verified",
            "  )",
            "  VALUES",
            "  (",
            "    $family_name,",
            "    $phone,",
            "    $email,",
            "    $ethnicity,",
            "    $count_senior,",
            "    $count_adult,",
            "    $count_child,",
            "    $count_sex_male,",
            "    $count_sex_female,",
            "    $count_sex_other,",
            "    $count_veteran,",
            "    $income_source,",
            "    $income_amount,",
            "    $pet_types,",
            "    $address_default,",
            "    $appt_day_default,",
            "    $appt_time_default,",
            "    $verified",
            "  );"
          ].join(" "));
      }

      // TODO: move prepared statements to constructor
      p = prepare
        .then(stmt => stmt.run(
          {
            $family_name       : clientInfo.family_name,
            $phone             : clientInfo.phone,
            $email             : clientInfo.email,
            $ethnicity         : clientInfo.ethnicity,
            $count_senior      : clientInfo.count_senior,
            $count_adult       : clientInfo.count_adult,
            $count_child       : clientInfo.count_child,
            $count_sex_male    : clientInfo.count_sex_male,
            $count_sex_female  : clientInfo.count_sex_female,
            $count_sex_other   : clientInfo.count_sex_other,
            $count_veteran     : clientInfo.count_veteran,
            $income_source     : clientInfo.income_source,
            $income_amount     : clientInfo.income_amount,
            $pet_types         : clientInfo.pet_types,
            $address_default   : clientInfo.address_default,
            $appt_day_default  : clientInfo.appt_day_default,
            $appt_time_default : clientInfo.appt_time_default,
            $verified          : clientInfo.verified
          }))

        .then(
          function (result)
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit did not find a row to modify");
            }

            return result;
          })

        // Give 'em what they came for!
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveClient`, e);

            // Is the error one we expect? If so, specify an error code.
            // Otherwise, it will default to InternalError
            switch(e.code)
            {
            case "SQLITE_CONSTRAINT" :
              error.code = this.constructor.Error.AlreadyExists;
              break;
            }

            callback(error);
          });

      return p;
    },

    /**
     * Retrieve the appointment default times, the list of
     * distribution start times, and if so specified, also the
     * scheduled appointment times for a specific distribution.
     *
     * @param args {Array}
     *   args[0] {String|Boolean?}
     *     The distribution start date, if scheduled appointments are
     *     requested in addition to default appointments; elided for
     *     default appoinments only.
     *
     *     For when the distribution start date isn't known, but the most
     *     recent distribution is desired, this argument may also be `true` to
     *     so specify.
     *
     *     When falsy, scheduled appointments are not retrieved.
     *
     *   args[1] {String?}
     *     The family name. This argument is only used if args[0] is truthy.
     *     When used, it allows retrieving the fulfillment record for the
     *     given distribution and family.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getAppointments(args, callback)
    {
      let             p;
      let             results = {};
      let             distribution = args.length > 0 ? args[0] : null;
      let             familyName = args.length > 1 ? args[1] : null;

      // TODO: move prepared statements to constructor
      p = Promise.resolve()
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT family_name, appt_day_default, appt_time_default",
                "  FROM Client",
                "  WHERE appt_time_default IS NOT NULL",
                "    AND length(trim(appt_time_default)) > 0",
                "  ORDER BY appt_day_default, appt_time_default, family_name;"
              ].join(" "));
          })
        .then(stmt => stmt.all({}))
        .then(result => (results.appointmentDefaults = result))

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT ",
                "    start_date,",
                "    day_1_first_appt,",
                "    day_1_last_appt,",
                "    day_2_first_appt,",
                "    day_2_last_appt,",
                "    day_3_first_appt,",
                "    day_3_last_appt,",
                "    day_4_first_appt,",
                "    day_4_last_appt,",
                "    day_5_first_appt,",
                "    day_5_last_appt,",
                "    day_6_first_appt,",
                "    day_6_last_appt,",
                "    day_7_first_appt,",
                "    day_7_last_appt",
                "  FROM DistributionPeriod",
                "  ORDER BY start_date DESC;"
              ].join(" "));
          })
        .then(stmt => stmt.all({}))
        .then(result => (results.distributions = result))

        .then(
          () =>
          {
            // If distribution isn't requested, skip this query
            if (! distribution)
            {
              return null;
            }

            // If we're given `true`, select the most recent distribution
            if (typeof distribution == "boolean")
            {
              distribution =
                (results.distributions.length > 0
                 ? results.distributions[0].start_date
                 : distribution);
            }

            return this._db.prepare(
              [
                "SELECT family_name, appt_day, appt_time",
                "  FROM Fulfillment",
                "  WHERE distribution = $distribution",
                "    AND appt_time IS NOT NULL",
                "  ORDER BY appt_day, appt_time, family_name;"
              ].join(" "));
          })
        .then(stmt => stmt ? stmt.all({ $distribution : distribution }) : null)
        .then(result => (results.appointmentsScheduled = result))

        .then(
          () =>
          {
            if (! distribution || ! familyName)
            {
              return null;
            }

            return this._db.prepare(
              [
                "SELECT ",
                "    f.family_name AS family_name,",
                "    f.appt_day AS appt_day,",
                "    f.appt_time AS appt_time,",
                "    f.notes AS notes,",
                "    f.fulfilled AS fulfilled",
                "  FROM Fulfillment f,",
                "       Client c",
                "  WHERE f.family_name = $family_name",
                "    AND c.family_name = f.family_name",
                "    AND distribution = $distribution;"
              ].join(" "));
          })
        .then(stmt => stmt ? stmt.all(
          {
            $distribution : distribution,
            $family_name  : familyName
          }) : null)
        .then(result => (results.fulfillment = result))

        // Give 'em what they came for!
        .then(() => callback(null, results))
        .catch((e) =>
          {
            console.warn("Error in getAppointments", e);
            callback( { message : e.toString() } );
          });

      return p;
    },

    /**
     * Save a new or updated fulfillment. When updating the record is
     * replaced in its entirety.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing complete data for a fulfillment record
     *
     *   args[1] {Boolean}
     *     true if this is a new entry; false if it is an edit
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveFulfillment(args, callback)
    {
      let             p;
      let             prepare;
      let             day = null;
      let             time = null;
      const           fulfillmentInfo = args[0];

      // If there's an appointment...
      if (fulfillmentInfo.appointments)
      {
        day = fulfillmentInfo.appointments.day;
        time = fulfillmentInfo.appointments.time;
      }

      // This is a new entry
      prepare = this._db.prepare(
        [
          "INSERT OR REPLACE INTO Fulfillment",
          "  (",
          "    distribution,",
          "    family_name,",
          "    appt_day,",
          "    appt_time,",
          "    notes,",
          "    fulfilled,",
          "    fulfillment_time",
          "  )",
          "  VALUES",
          "  (",
          "    $distribution,",
          "    $family_name,",
          "    $appt_day,",
          "    $appt_time,",
          "    $notes,",
          "    $fulfilled,",
          "    $fulfillment_time",
          "  );"
        ].join(" "));

      // TODO: move prepared statements to constructor
      p = prepare
        .then(stmt => stmt.run(
          {
            $distribution      : fulfillmentInfo.distribution,
            $family_name       : fulfillmentInfo.family_name,
            $appt_day          : day,
            $appt_time         : time,
            $notes             : fulfillmentInfo.notes,
            $fulfilled         : fulfillmentInfo.fulfilled,
            $fulfillment_time  : fulfillmentInfo.fulfillment_time
          }))

        .then(
          function (result)
          {
            return result;
          })

        // Give 'em what they came for!
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveFulfillment`, e);
            callback(error);
          });

      return p;
    },

    /**
     * Retrieve the list of distribution start times and the first /
     * last appointment-per-day schedule
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getDistributionList(args, callback)
    {
      // TODO: move prepared statements to constructor
      return this._db.prepare(
        [
          "SELECT ",
          "    start_date,",
          "    day_1_first_appt,",
          "    day_1_last_appt,",
          "    day_2_first_appt,",
          "    day_2_last_appt,",
          "    day_3_first_appt,",
          "    day_3_last_appt,",
          "    day_4_first_appt,",
          "    day_4_last_appt,",
          "    day_5_first_appt,",
          "    day_5_last_appt,",
          "    day_6_first_appt,",
          "    day_6_last_appt,",
          "    day_7_first_appt,",
          "    day_7_last_appt",
          "  FROM DistributionPeriod",
          "  ORDER BY start_date DESC;"
        ].join(" "))
        .then(
          (stmt) =>
          {
            return stmt.all({});
          })
        .then(
          (result) =>
          {
            callback(null, result);
          })
        .catch((e) =>
          {
            console.warn("Error in getDistributionList", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Save a new or updated distribution. When updating the record is
     * replaced in its entirety.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing complete data for a distribution record
     *
     *   args[1] {Boolean}
     *     true if this is a new entry; false if it is an edit
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveDistribution(args, callback)
    {
      let             p;
      let             prepare;
      const           distroInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        prepare = this._db.prepare(
          [
            "UPDATE DistributionPeriod",
            "  SET ",
            "    day_1_first_appt = $day_1_first_appt,",
            "    day_2_first_appt = $day_2_first_appt,",
            "    day_3_first_appt = $day_3_first_appt,",
            "    day_4_first_appt = $day_4_first_appt,",
            "    day_5_first_appt = $day_5_first_appt,",
            "    day_6_first_appt = $day_6_first_appt,",
            "    day_7_first_appt = $day_7_first_appt,",
            "    day_1_last_appt = $day_1_last_appt,",
            "    day_2_last_appt = $day_2_last_appt,",
            "    day_3_last_appt = $day_3_last_appt,",
            "    day_4_last_appt = $day_4_last_appt,",
            "    day_5_last_appt = $day_5_last_appt,",
            "    day_6_last_appt = $day_6_last_appt,",
            "    day_7_last_appt = $day_7_last_appt",
            "  WHERE start_date = $start_date;",
          ].join(" "));
      }
      else
      {
        // This is a new entry
        prepare = this._db.prepare(
          [
            "INSERT INTO DistributionPeriod",
            "  (",
            "    start_date,",
            "    day_1_first_appt,",
            "    day_2_first_appt,",
            "    day_3_first_appt,",
            "    day_4_first_appt,",
            "    day_5_first_appt,",
            "    day_6_first_appt,",
            "    day_7_first_appt,",
            "    day_1_last_appt,",
            "    day_2_last_appt,",
            "    day_3_last_appt,",
            "    day_4_last_appt,",
            "    day_5_last_appt,",
            "    day_6_last_appt,",
            "    day_7_last_appt",
            "  )",
            "  VALUES",
            "  (",
            "    $start_date,",
            "    $day_1_first_appt,",
            "    $day_2_first_appt,",
            "    $day_3_first_appt,",
            "    $day_4_first_appt,",
            "    $day_5_first_appt,",
            "    $day_6_first_appt,",
            "    $day_7_first_appt,",
            "    $day_1_last_appt,",
            "    $day_2_last_appt,",
            "    $day_3_last_appt,",
            "    $day_4_last_appt,",
            "    $day_5_last_appt,",
            "    $day_6_last_appt,",
            "    $day_7_last_appt",
            "  );"
          ].join(" "));
      }

      // TODO: move prepared statements to constructor
      p = prepare
        .then(stmt => stmt.run(
          {
            $start_date : distroInfo.start_date,
            $day_1_first_appt : distroInfo.day_1_first_appt,
            $day_2_first_appt : distroInfo.day_2_first_appt,
            $day_3_first_appt : distroInfo.day_3_first_appt,
            $day_4_first_appt : distroInfo.day_4_first_appt,
            $day_5_first_appt : distroInfo.day_5_first_appt,
            $day_6_first_appt : distroInfo.day_6_first_appt,
            $day_7_first_appt : distroInfo.day_7_first_appt,
            $day_1_last_appt  : distroInfo.day_1_last_appt,
            $day_2_last_appt  : distroInfo.day_2_last_appt,
            $day_3_last_appt  : distroInfo.day_3_last_appt,
            $day_4_last_appt  : distroInfo.day_4_last_appt,
            $day_5_last_appt  : distroInfo.day_5_last_appt,
            $day_6_last_appt  : distroInfo.day_6_last_appt,
            $day_7_last_appt  : distroInfo.day_7_last_appt,
          }))

        .then(
          function (result)
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit did not find a row to modify");
            }

            return result;
          })

        // Give 'em what they came for!
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveDistribution`, e);

            // Is the error one we expect? If so, specify an error code.
            // Otherwise, it will default to InternalError
            switch(e.code)
            {
            case "SQLITE_CONSTRAINT" :
              error.code = this.constructor.Error.AlreadyExists;
              break;
            }

            callback(error);
          });

      return p;
    },

    /**
     * Retrieve the list of available reports
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getReportList(args, callback)
    {
      let             results = {};

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>this._db.prepare(
            [
              "SELECT",
              [
                "name",
                "description",
                "input_fields",
                "subtitle_field",
                "separate_by",
                "landscape"
              ].join(", "),
              "FROM Report",
              "ORDER BY name"
            ].join(" ")))
        .then(
          (stmt) =>
          {
            return stmt.all({});
          })
        .then(
          (result) =>
          {
            results.reports = result;
          })
        .then(
          () =>this._db.prepare(
            [
              "SELECT start_date",
              "  FROM DistributionPeriod",
              "  ORDER BY start_date DESC;"
            ].join(" ")))
        .then(
          (stmt) =>
          {
            return stmt.all({});
          })
        .then(
          (result) =>
          {
            results.distributions = result;

            callback(null, results);
          })
        .catch((e) =>
          {
            console.warn("Error in getReportList", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Generate a specified report
     *
     * @param args {Array}
     *   args[0] {name}
     *     The name of the report to be generated
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _generateReport(args, callback)
    {
      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT query",
                "  FROM Report",
                "  WHERE name = $name;"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all({ $name : args[0].name });
          })
        .then(
          (result) =>
          {
            return this._db.prepare(result[0].query);
          })
        .then(
          (stmt) =>
          {
            let             key;
            let             queryArgs = Object.assign({}, args[0]);

            // Delete keys that don't begin with '$'
            for (key in queryArgs)
            {
              if (! key.startsWith("$"))
              {
                delete queryArgs[key];
              }
            }

            return stmt.all(queryArgs);
          })
        .then(
          (result) =>
          {
            callback(null, result);
          })
        .catch((e) =>
          {
            console.warn("Error in getDistributionList", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Get delivery day data, for fulfillment check-off
     *
     * @param args {Array}
     *   There are no arguments to this method
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getDeliveryDay(args, callback)
    {
      let             results = {};

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>
          {
            // First, retrieve the most recent distribution start date
            return this._db.prepare(
              [
                "SELECT MAX(start_date) AS distribution",
                "  FROM DistributionPeriod;",
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all({});
          })
        .then(
          (result) =>
          {
            // If there was at least one distribution, save its start date
            if (result.length < 1)
            {
              return null;
            }

            results.distribution = result[0].distribution;
            return result.distribution;
          })
        .then(
          (distribution) =>
          {
            // If no distributions, there's nothing more to do
            if (distribution === null)
            {
              return null;
            }

            // Get all of the appointments for this most recent distribution
            return this._db.prepare(
              [
                "SELECT ",
                "    f.family_name AS family_name,",
                "    f.appt_day AS appt_day,",
                "    f.appt_time AS appt_time,",
                "    f.notes AS notes,",
                "    f.fulfilled AS fulfilled,",
                "    c.count_senior + c.count_adult + c.count_child ",
                "      AS family_size,",
                "    c.pet_types AS pet_types",
                "  FROM Fulfillment f, Client c",
                "  WHERE distribution = $distribution",
                "    AND c.family_name = f.family_name",
                "  ORDER BY appt_day, appt_time, family_name"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            // If no distributions, there's nothing more to do
            if (stmt === null)
            {
              return null;
            }

            return stmt.all( { $distribution : results.distribution } );
          })
        .then(
          (result) =>
          {
            // Save the appointments for this distribution
            results.appointments = result;

            // Give 'em what they came for
            callback(null, results);
          })
        .catch((e) =>
          {
            console.warn("Error in getDeliveryDay", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Update fulfillment status
     *
     * @param args {Array}
     *   args[0] {distribution}
     *     The start date of the distribution period
     *
     *   args[1] {family_name}
     *     The name of the family whose fulfillment status is to be updated
     *
     *   args[2] {bFulfilled}
     *     The new fulfillment status
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _updateFulfilled(args, callback)
    {
      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>
          {
            // First, retrieve the most recent distribution start date
            return this._db.prepare(
              [
                "UPDATE Fulfillment",
                "  SET fulfilled = $fulfilled",
                "  WHERE distribution = $distribution",
                "    AND family_name = $family_name;"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all(
              {
                $distribution : args[0],
                $family_name  : args[1],
                $fulfilled    : args[2] ? 1 : 0
              });
          })
        .then(
          (result) =>
          {
            // Give 'em what they came for
            callback(null, null);
          })
        .catch((e) =>
          {
            console.warn("Error in getDeliveryDay", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Send a chat message
     *
     * @param args {Array}
     *   args[0] {message}
     *     The chat message to send
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _sendChat(args, callback)
    {
      bcp.server.WebSocket.getInstance().sendToAll(
        {
          messageType : "message",
          data        :
          {
            from        : this._req.session.username,
            message     : args[0]
          }
        });
      callback(null, null);
    }
  }
});
