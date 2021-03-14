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
     *
     * @ignore(require)
     * @ignore(process)
     * @ignore(process.cwd)
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
          alive        :
          {
            handler             : (args, callback) => { callback(null, null); },
            permission_level    : 0,
          },

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

          deleteClient        :
          {
            handler             : this._deleteClient.bind(this),
            permission_level    : 60
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

          deleteFulfillment     :
          {
            handler             : this._deleteFulfillment.bind(this),
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
          },

          saveMotd           :
          {
            handler             : this._saveMotd.bind(this),
            permission_level    : 70
          },

          getGroceryList       :
          {
            handler             : this._getGroceryList.bind(this),
            permission_level    : 50
          },

          saveGroceryItem          :
          {
            handler             : this._saveGroceryItem.bind(this),
            permission_level    : 50
          },

          deleteGroceryItem        :
          {
            handler             : this._deleteGroceryItem.bind(this),
            permission_level    : 50
          },

          getGroceryCategoryList   :
          {
            handler             : this._getGroceryCategoryList.bind(this),
            permission_level    : 50
          },

          saveGroceryCategory     :
          {
            handler            : this._saveGroceryCategory.bind(this),
            permission_level   : 50
          },

          renameGroceryCategory     :
          {
            handler            : this._renameGroceryCategory.bind(this),
            permission_level   : 50
          },

          deleteGroceryCategory     :
          {
            handler            : this._deleteGroceryCategory.bind(this),
            permission_level   : 50
          },

          getClientGrocerySelections :
          {
            handler            : this._getClientGrocerySelections.bind(this),
            permission_level   : 50
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

            return this._db.prepare(
              [
                "PRAGMA foreign_keys = ON;"
              ].join(" "))
              .then(
                (stmt) =>
                {
                  return stmt.all({});
                });
          })
        .then(
          () =>
          {
            this.fireDataEvent("dbReady", this._db);
          });

      app.use(
        "/rpc",
        (req, res, next) =>
        {
          const           { username, permissionLevel } = req.session;

          console.log(`${username} issued RPC request: body=`,
                      JSON.stringify(req.body, null, "  "));

          // Notifying WebSocket module user is active
          bcp.server.WebSocket.getInstance().userActive(req.session);

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

          // SAVE IT AS FIRST STEP IN RPC. It may change due to other
          // RPC calls.
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
            "count_child12",
            "count_sex_male",
            "count_sex_female",
            "count_sex_other",
            "count_veteran",
            "notes_default",
            "food_preferences",
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
      let             addlArgs = {};
      let             prepare;
      const           clientInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        prepare = this._db.prepare(
          [
            "UPDATE Client",
            "  SET ",
            "    family_name = $family_name,",
            "    phone = $phone,",
            "    email = $email,",
            "    ethnicity = $ethnicity,",
            "    count_senior = $count_senior,",
            "    count_adult = $count_adult,",
            "    count_child = $count_child,",
            "    count_child12 = $count_child12,",
            "    count_sex_male = $count_sex_male,",
            "    count_sex_female = $count_sex_female,",
            "    count_sex_other = $count_sex_other,",
            "    count_veteran = $count_veteran,",
            "    notes_default = $notes_default,",
            "    food_preferences = $food_preferences,",
            "    income_source = $income_source,",
            "    income_amount = $income_amount,",
            "    pet_types = $pet_types,",
            "    address_default = $address_default,",
            "    appt_day_default = $appt_day_default,",
            "    appt_time_default = $appt_time_default,",
            "    verified = $verified",
            "  WHERE family_name = $family_name_update;",
          ].join(" "));

        addlArgs =
          {
            $family_name_update : clientInfo.family_name_update
          };
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
            "    count_child12,",
            "    count_sex_male,",
            "    count_sex_female,",
            "    count_sex_other,",
            "    count_veteran,",
            "    notes_default,",
            "    food_preferences,",
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
            "    $count_child12,",
            "    $count_sex_male,",
            "    $count_sex_female,",
            "    $count_sex_other,",
            "    $count_veteran,",
            "    $notes_default,",
            "    $food_preferences,",
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
          Object.assign(
            {
              $family_name        : clientInfo.family_name,
              $phone              : clientInfo.phone,
              $email              : clientInfo.email,
              $ethnicity          : clientInfo.ethnicity,
              $count_senior       : clientInfo.count_senior,
              $count_adult        : clientInfo.count_adult,
              $count_child        : clientInfo.count_child,
              $count_child12      : clientInfo.count_child12,
              $count_sex_male     : clientInfo.count_sex_male,
              $count_sex_female   : clientInfo.count_sex_female,
              $count_sex_other    : clientInfo.count_sex_other,
              $count_veteran      : clientInfo.count_veteran,
              $notes_default      : clientInfo.notes_default,
              $food_preferences   : clientInfo.food_preferences,
              $income_source      : clientInfo.income_source,
              $income_amount      : clientInfo.income_amount,
              $pet_types          : clientInfo.pet_types,
              $address_default    : clientInfo.address_default,
              $appt_day_default   : clientInfo.appt_day_default,
              $appt_time_default  : clientInfo.appt_time_default,
              $verified           : clientInfo.verified
            },
            addlArgs)))

        .then(
          function (result)
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit Client did not find a row to modify");
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
     * Delete a client.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing at least the member `family_name` which
     *     references a string indicating the client to delete
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _deleteClient(args, callback)
    {
      let             p;
      let             prepare;
      const           clientInfo = args[0];

      // TODO: move prepared statements to constructor
      prepare = this._db.prepare(
        [
          "DELETE FROM Client",
          "  WHERE family_name = $family_name;"
        ].join(" "));

      // This will delete the Client record and any Fulfillment
      // records that reference that client.
      p = prepare
        .then(stmt => stmt.run(
          {
            $family_name        : clientInfo.family_name
          }))

        // Let 'em know it succeeded
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in deleteClient`, e);
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
                "  FROM Fulfillment f",
                "  WHERE f.family_name = $family_name",
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
     * Delete a fulfillment.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing (at least) `distribution` and `family_name`
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _deleteFulfillment(args, callback)
    {
      let             p;
      let             prepare;
      let             day = null;
      let             time = null;
      const           fulfillmentInfo = args[0];

      // This is a new entry
      prepare = this._db.prepare(
        [
          "DELETE FROM Fulfillment",
          "  WHERE distribution = $distribution",
          "    AND family_name = $family_name;"
        ].join(" "));

      // TODO: move prepared statements to constructor
      p = prepare
        .then(stmt => stmt.run(
          {
            $distribution      : fulfillmentInfo.distribution,
            $family_name       : fulfillmentInfo.family_name
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

            console.warn(`Error in deleteFulfillment`, e);
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
              throw new Error(
                "Edit Distribution did not find a row to modify");
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
          () => this._db.prepare(
            [
              "SELECT",
              [
                "name",
                "description",
                "input_fields",
                "subtitle_field",
                "separate_by",
                "landscape",
                "number_style",
                "number_remaining"
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
          () => this._db.prepare(
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
            console.warn("Error in updateFulfilled", e);
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
    },

    /**
     * Save a new Message Of The Day
     *
     * @param args {Array}
     *   args[0] {motd}
     *     The new message
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveMotd(args, callback)
    {
      const           motd = args[0].motd.trim();

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>
          {
            // First, retrieve the most recent distribution start date
            return this._db.prepare(
              [
                "REPLACE INTO KeyValueStore",
                "    (key, value)",
                "  VALUES",
                "    ('motd', $message);"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all(
              {
                $message : motd
              });
          })
        .then(
          (result) =>
          {
            // Give 'em what they came for
            callback(null, null);
          })
        .then(
          () =>
          {
            // If non-zero length, send the new MOTD to everyone
            if (motd.length > 0)
            {
              bcp.server.WebSocket.getInstance().sendToAll(
                {
                  messageType : "motd",
                  data        : args[0].motd
                });
            }
          })
        .catch((e) =>
          {
            console.warn("Error in saveMotd", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Retrieve the full grocery list
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getGroceryList(args, callback)
    {
      // TODO: move prepared statements to constructor
      return this._db.prepare(
        [
          "SELECT",
          "    gi.item AS item,",
          "    gi.perishable AS perishable,",
          "    gi.dist_aisle AS dist_aisle,",
          "    gi.dist_unit AS dist_unit,",
          "    gi.dist_side AS dist_side,",
          "    gi.dist_shelf AS dist_shelf,",
          "    gi.on_hand AS on_hand,",
          "    gi.order_contact AS order_contact,",
          "    COALESCE(gi.category, 0) AS category,",
          "    CASE gi.category ",
          "      WHEN 0 THEN '*** Not yet categorized ***'",
          "      ELSE gc.name",
          "    END AS category_name",
          "FROM GroceryItem gi",
          "LEFT JOIN GroceryCategory gc",
          "  ON gc.id = category",
          "ORDER BY gi.item"
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
            console.warn("Error in getGroceryList", e);
            callback( { message : e.toString() } );
          });
    },

    /**
     * Save a new or updated grocery item. When updating, the record is
     * replaced in its entirety.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing complete data for a grocery item record
     *
     *   args[1] {Boolean}
     *     true if this is a new entry; false if it is an edit
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveGroceryItem(args, callback)
    {
      let             p;
      let             addlArgs = {};
      let             prepare;
      const           itemInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        prepare = this._db.prepare(
          [
            "UPDATE GroceryItem",
            "  SET ",
            "    item = $item,",
            "    perishable = $perishable,",
            "    dist_aisle = $dist_aisle,",
            "    dist_unit = $dist_unit,",
            "    dist_side = $dist_side,",
            "    dist_shelf = $dist_shelf,",
            "    category = $category,",
            "    on_hand = $on_hand,",
            "    order_contact = $order_contact",
            "  WHERE item = $item_update;",
          ].join(" "));

        addlArgs =
          {
            $item_update : itemInfo.item_update
          };
      }
      else
      {
        // This is a new entry
        prepare = this._db.prepare(
          [
            "INSERT INTO GroceryItem",
            "  (",
            "    item,",
            "    perishable,",
            "    dist_aisle,",
            "    dist_unit,",
            "    dist_side,",
            "    dist_shelf,",
            "    category,",
            "    on_hand,",
            "    order_contact",
            "  )",
            "  VALUES",
            "  (",
            "    $item,",
            "    $perishable,",
            "    $dist_aisle,",
            "    $dist_unit,",
            "    $dist_side,",
            "    $dist_shelf,",
            "    $category,",
            "    $on_hand,",
            "    $order_contact",
            "  );"
          ].join(" "));
      }

      // TODO: move prepared statements to constructor
      p = prepare
        .then(stmt => stmt.run(
          Object.assign(
            {
              $item             : itemInfo.item,
              $perishable       : itemInfo.perishable,
              $dist_aisle       : itemInfo.dist_aisle,
              $dist_unit        : itemInfo.dist_unit,
              $dist_side        : itemInfo.dist_side,
              $dist_shelf       : itemInfo.dist_shelf,
              $category         : itemInfo.category,
              $on_hand          : itemInfo.on_hand,
              $order_contact    : itemInfo.order_contact
            },
            addlArgs)))

        .then(
          function (result)
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit GroceryItem did not find a row to modify");
            }

            return result;
          })

        // Give 'em what they came for!
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveGroceryItem`, e);

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
     * Delete a grocery item.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing at least the member `item` which
     *     references a string indicating the grocery item to delete
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _deleteGroceryItem(args, callback)
    {
      let             p;
      let             prepare;
      const           itemInfo = args[0];

      // TODO: move prepared statements to constructor
      prepare = this._db.prepare(
        [
          "DELETE FROM GroceryItem",
          "  WHERE item = $item;"
        ].join(" "));

      // This will delete the GroceryItem record and any
      // ClientGroceryPreference records that reference that item.
      p = prepare
        .then(stmt => stmt.run(
          {
            $item        : itemInfo.item
          }))

        // Let 'em know it succeeded
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in deleteGroceryItem`, e);
            callback(error);
          });

      return p;
    },

    /**
     * Get the grocery category list
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getGroceryCategoryList(args, callback)
    {
      let             p;
      let             prepare;

      // TODO: move prepared statements to constructor
      prepare = this._db.prepare(
        [
          "SELECT",
          "    id,",
          "    parent,",
          "    name",
          "  FROM GroceryCategory",
          "  ORDER BY id;"
        ].join(" "));

      p = prepare
        .then(stmt => stmt.all({}))

        // Let 'em know it succeeded
        .then((result) => callback(null, result))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in getGroceryCategoryList`, e);
            callback(error);
          });

      return p;
    },

    /**
     * Save a new or updated grocery category. When updating, the
     * record is replaced in its entirety.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     The map containing complete data for a category record
     *
     *   args[1] {Boolean}
     *     true if this is a new entry; false if it is an edit
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _saveGroceryCategory(args, callback)
    {
      let             p;
      let             prepare;
      let             addlArgs = {};
      const           categoryInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        prepare = this._db.prepare(
          [
            "UPDATE GroceryCategory",
            "  SET ",
            "    parent = $parent,",
            "    name = $name",
            "  WHERE id = $id;"
          ].join(" "));

        addlArgs = { $id : categoryInfo.id };
      }
      else
      {
        // This is a new entry
        prepare = this._db.prepare(
          [
            "INSERT INTO GroceryCategory",
            "  (",
            "    parent,",
            "    name",
            "  )",
            "  VALUES",
            "  (",
            "    $parent,",
            "    $name",
            "  );"
          ].join(" "));
      }

      // TODO: move prepared statements to constructor
      return prepare
        .then(stmt => stmt.run(
          Object.assign(
            {
              $id     : categoryInfo.id,
              $parent : categoryInfo.parent,
              $name   : categoryInfo.name
            },
            addlArgs)))

        .then(
          function (result)
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error(
                "Edit Grocery Category did not find a row to modify");
            }

            return result.lastID;
          })

        // Give 'em what they came for!
        .then((result) => callback(null, result))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveGroceryCategory`, e);
            callback(error);
          });
    },

    /**
     * Rename a grocery category.
     *
     * @param args {Array}
     *   args[0] {Map}
     *     A map containing the members `id` and `newName`
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _renameGroceryCategory(args, callback)
    {
      let             p;
      let             prepare;
      const           categoryInfo = args[0];
      const           bNew = args[1];

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "UPDATE GroceryCategory",
                "  SET ",
                "    name = $newName",
                "  WHERE id = $id;"
              ].join(" "));
          })
        .then(stmt => stmt.run(
          {
            $id      : categoryInfo.id,
            $newName : categoryInfo.newName
          }))

        // Give 'em what they came for!
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in renameGroceryCategory`, e);
            callback(error);
          });
    },

    /**
     * Delete a grocery category.
     *
     * @param args {Array} args[0] {Map}
     *     The map containing at least the member `id` which
     *     indicates which grocery category to delete
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _deleteGroceryCategory(args, callback)
    {
      let             p;
      let             prepare;
      const           categoryInfo = args[0];

      // TODO: move prepared statements to constructor
      prepare = this._db.prepare(
        [
          "DELETE FROM GroceryCategory",
          "  WHERE id = $id;"
        ].join(" "));

      // This will delete the GroceryCategory record. Additionally,
      // any GroceryItem records that reference that category will
      // have their category set to null..

      p = prepare
        .then(stmt => stmt.run( { $id : categoryInfo.id }))

        // Let 'em know it succeeded
        .then((result) => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in deleteGroceryCategory`, e);
            callback(error);
          });

      return p;
    },

    /**
     * Get a client's grocery list, and the full list of categories
     *
     * @param args {Array}
     *   args[0] {Map}
     *     A map containing the member `family_name` if ths is for an existing
     *     client; or null or an empty map if this is for a to-be-created
     *     family
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getClientGrocerySelections(args, callback)
    {
      let             results = {};
      const           info = args[0] || {};

      return Promise.resolve()
        // Retrieve the grocery cateogry list
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT",
                "    id,",
                "    parent,",
                "    name",
                "  FROM GroceryCategory",
                "  ORDER BY id;"
              ].join(" "));
          })
        .then(stmt => stmt.all({}))
        .then(
          (result) =>
          {
            results.categories = result;
          })
        .catch(
          (e) =>
          {
            let             error = { message : e.toString() };

            console.warn(
              "Error getting grocery categories " +
                "in getClientGrocerySelections", e);
            throw e;            // rethrow
          })

        // Retrieve, for a family name, all items, and exclusions and
        // notes for those items.
        .then(
          () =>
          {
            // TODO: move prepared statements to constructor
            return this._db.prepare(
              [
                "SELECT",
                "    c.family_name AS family_name,",
                "    gi.item AS item,",
                "    gi.category AS category,",
                "    gi.perishable AS perishable,",
                "    CASE",
                "      WHEN cgp.exclude IS NULL THEN 1",
                "      ELSE NOT cgp.exclude",
                "    END AS wanted,",
                "    cgp.notes AS notes",
                "  FROM Client c",
                "  CROSS JOIN  GroceryItem gi",
                "  LEFT JOIN ClientGroceryPreference cgp",
                "    ON     cgp.family_name = c.family_name",
                "       AND cgp.grocery_item = gi.item",
                "   WHERE c.family_name = $family_name;"
              ].join(" "));
          })
        .then(stmt => stmt.all(
          {
            $family_name : info.family_name
          }))
        .then(
          (result) =>
          {
            results.items = result;
          })

          // Let 'em know it succeeded
        .then((result) => callback(null, results))

        .catch(
          (e) =>
          {
            let             error = { message : e.toString() };

            console.warn(
              "Error getting grocery selections " +
                "in getClientGrocerySelections", e);
            callback(error);
          });
    }
  }
});
