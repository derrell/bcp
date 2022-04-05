/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2022 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
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
      AlreadyExists    : -32000,
      NoFamilyMembers  : -32001
    },

    /** Whether a transaction is in progress */
    _bTransactionInProgress : false,

    /** Queue of waiting transactions (promises) */
    _transactionQueue       : []
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

          getFamilyMembers    :
          {
            handler             : this._getFamilyMembers.bind(this),
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
            permission_level    : 50
          },

          updateFulfilled    :
          {
            handler             : this._updateFulfilled.bind(this),
            permission_level    : 50
          },

          getUsdaSignature   :
          {
            handler             : this._getUsdaSignature.bind(this),
            permission_level    : 40
          },

          updateUsdaSignature   :
          {
            handler             : this._updateUsdaSignature.bind(this),
            permission_level    : 40
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
     * Begin an exclusive transaction by preventing collaborating requests
     * from issuing their queries until they're given permission.
     *
     * @return {Promise}
     *   Resolves with `true` when the transaction may begin
     */
    _beginTransaction()
    {
      // If there's no transaction in progress...
      if (! this.constructor._bTransactionInProgress)
      {
        // ... then we'll let them proceed. Set the flag to indicate
        // they're in a transaction.
        this.constructor._bTransactionInProgress = true;

        // Indicate they can proceed
        return true;
      }

      // There's a transaction in progress. Create a promise and store
      // its resolve function on the transaction queue. When the
      // current transaction ends, we'll pull the first resolve
      // function from the queue and call it.
      return new Promise(
        (resolve, reject) =>
        {
          this.constructor._transactionQueue.push(resolve);
        });
    },

    /**
     * End the transaction, allowing the next waiter in the transaction queue
     * to proceed.
     */
    _endTransaction()
    {
      let             resolver;

      // The transaction has ended. Note that.
      this.constructor._bTransactionInProgress = false;

      // If there are any transaction requests in the queue...
      if (this.constructor._transactionQueue.length > 0)
      {
        // ... then there's now a transaction in progress
        this.constructor._bTransactionInProgress = true;

        // Pull that request's resolve function off the queue
        resolver = this.constructor._transactionQueue.pop();

        // Call it, to resolve the promise, allowing the requester to proceed.
        resolver(true);
      }
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
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
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
                "notes_default",
                "perishables_default",
                "income_source",
                "income_amount",
                "usda_eligible",
                "usda_eligible_next_distro",
                "pet_types",
                "address_default",
                "appt_day_default",
                "appt_time_default"
              ].join(", "),
              "FROM Client",
              "ORDER BY family_name"
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
            callback(null, result);
          })

        .catch((e) =>
          {
            console.warn("Error in getClientList", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
    },

    /**
     * Retrieve the list of family members for a client
     *
     * @param args {Array}
     *   args[0] {String}
     *     The client name whose family members are requested
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getFamilyMembers(args, callback)
    {
      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
            [
              "SELECT",
              [
                "member_name",
                "date_of_birth",
                "gender",
                "is_veteran"
              ].join(", "),
              "FROM FamilyMember",
              "WHERE family_name = $family_name",
              "ORDER BY date_of_birth, member_name"
            ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all(
              {
                $family_name : args[0]
              });
          })
        .then(
          (result) =>
          {
            // Convert 0/1 value for is_veteran to boolean
            result.forEach(
              (memberInfo) =>
              {
                memberInfo.is_veteran = memberInfo.is_veteran == 0 ? false : true;
              });
            callback(null, result);
          })

        .catch((e) =>
          {
            console.warn("Error in getFamilyMembers", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
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
      const           familyMembers = args[1];
      const           bNew = args[2];

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
            "    count_sex_male = $count_sex_male,",
            "    count_sex_female = $count_sex_female,",
            "    count_sex_other = $count_sex_other,",
            "    count_veteran = $count_veteran,",
            "    notes_default = $notes_default,",
            "    perishables_default = $perishables_default,",
            "    income_source = $income_source,",
            "    income_amount = $income_amount,",
            "    usda_eligible = $usda_eligible,",
            "    usda_eligible_next_distro = $usda_eligible_next_distro,",
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
            "    count_sex_male,",
            "    count_sex_female,",
            "    count_sex_other,",
            "    count_veteran,",
            "    notes_default,",
            "    perishables_default,",
            "    income_source,",
            "    income_amount,",
            "    usda_eligible,",
            "    usda_eligible_next_distro,",
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
            "    $notes_default,",
            "    $perishables_default,",
            "    $income_source,",
            "    $income_amount,",
            "    $usda_eligible,",
            "    $usda_eligible_next_distro,",
            "    $pet_types,",
            "    $address_default,",
            "    $appt_day_default,",
            "    $appt_time_default,",
            "    $verified",
            "  );"
          ].join(" "));
      }

      // TODO: move prepared statements to constructor
      p = Promise.resolve()
        // Begin a transaction
        .then(() => this._beginTransaction())

        // Insert or update this client
        .then(() => prepare)
        .then(stmt => stmt.run(
          Object.assign(
            {
              $family_name               : clientInfo.family_name,
              $phone                     : clientInfo.phone,
              $email                     : clientInfo.email,
              $ethnicity                 : clientInfo.ethnicity,
              $count_senior              : clientInfo.count_senior,
              $count_adult               : clientInfo.count_adult,
              $count_child               : clientInfo.count_child,
              $count_sex_male            : clientInfo.count_sex_male,
              $count_sex_female          : clientInfo.count_sex_female,
              $count_sex_other           : clientInfo.count_sex_other,
              $count_veteran             : clientInfo.count_veteran,
              $notes_default             : clientInfo.notes_default,
              $perishables_default       : clientInfo.perishables_default,
              $income_source             : clientInfo.income_source,
              $income_amount             : clientInfo.income_amount,
              $usda_eligible             : clientInfo.usda_eligible,
              $usda_eligible_next_distro : clientInfo.usda_eligible_next_distro,
              $pet_types                 : clientInfo.pet_types,
              $address_default           : clientInfo.address_default,
              $appt_day_default          : clientInfo.appt_day_default,
              $appt_time_default         : clientInfo.appt_time_default,
              $verified                  : clientInfo.verified
            },
            addlArgs)))

        .then(
          (result) =>
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit did not find a row to modify");
            }

            return result;
          })

        // Delete all family member records for this client
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "DELETE FROM FamilyMember",
                "  WHERE family_name = $family_name;"
              ].join(" "));
          })
        .then(
          (stmt) => stmt.run(
            {
              $family_name         : clientInfo.family_name,
            }))

        // Insert each provided family member
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "INSERT INTO FamilyMember",
                "    (",
                "      family_name,",
                "      member_name,",
                "      date_of_birth,",
                "      gender,",
                "      is_veteran",
                "    )",
                "  VALUES",
                "    (",
                "      $family_name,",
                "      $member_name,",
                "      $date_of_birth,",
                "      $gender,",
                "      $is_veteran",
                "    );"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            let             promises = [];

            familyMembers.forEach(
              (member) =>
              {
                promises.push(
                  stmt.run(
                    {
                      $family_name         : clientInfo.family_name,
                      $member_name         : member.name,
                      $date_of_birth       : member.dob,
                      $gender              : member.gender,
                      $is_veteran          : member.veteran ? 1 : 0
                    }));
              });

            return Promise.all(promises);
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
          })

        .finally(() => this._endTransaction());

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
      const           clientInfo = args[0];

      // This will delete the Client record and any Fulfillment
      // records that reference that client.
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "DELETE FROM Client",
                "  WHERE family_name = $family_name;"
              ].join(" "));
          })
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
          })

        .finally(() => this._endTransaction());

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
        .then(() => this._beginTransaction())

        // Ensure this family has birthdates entered
        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT COUNT(*) AS count",
                "  FROM FamilyMember",
                "  WHERE family_name = $family_name;"
              ].join(" "));
          })
        .then(stmt => stmt.all( { $family_name : familyName } ))
        .then(
          (result) =>
          {
            // If we weren't given a family name, continue on
            if (! familyName)
            {
              return;
            }

            // It's an error to be retrieving appointments if family
            // member birthdates have not been entered
            console.log("getAppointments: family member count=" + result[0].count);
            if (result[0].count < 1)
            {
              throw new Error(`Family member info has not been entered for ${familyName}`);
            }
          })

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT",
                "    family_name,",
                "    appt_day_default,",
                "    appt_time_default,",
                "    usda_eligible,",
                "    usda_eligible_next_distro",
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
                "    f.perishables AS perishables,",
                "    f.fulfilled AS fulfilled,",
                "    (SELECT",
                "       COALESCE(max_income_text, 'See Taryn')",
                "       FROM UsdaMaxIncome",
                "       WHERE family_size = ",
                "          (SELECT COUNT(*) ",
                "            FROM FamilyMember fam ",
                "            WHERE fam.family_name = $family_name)",
                "        ) AS usda_amount",
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
        .catch(
          (e) =>
          {
            let             error = { message : e.toString() };

            console.warn("Error in getAppointments", e);

            if (error.message.includes("Family member info has not been entered"))
            {
              error.code = this.constructor.Error.NoFamilyMembers;
            }

            callback(error);
          })

        .finally(() => this._endTransaction());

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
      let             day = null;
      let             time = null;
      const           fulfillmentInfo = args[0];

      // If there's an appointment...
      if (fulfillmentInfo.appointments)
      {
        day = fulfillmentInfo.appointments.day;
        time = fulfillmentInfo.appointments.time;
      }

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "INSERT INTO Fulfillment",
                "  (",
                "    distribution,",
                "    family_name,",
                "    appt_day,",
                "    appt_time,",
                "    notes,",
                "    perishables,",
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
                "    $perishables,",
                "    $fulfilled,",
                "    $fulfillment_time",
                "  )",
                "  ON CONFLICT(distribution, family_name)",
                "    DO UPDATE SET ",
                "      appt_day = $appt_day,",
                "      appt_time = $appt_time,",
                "      notes = $notes,",
                "      perishables = $perishables,",
                "      fulfilled = $fulfilled,",
                "      fulfillment_time = $fulfillment_time;"
              ].join(" "));
          })
        .then(stmt => stmt.run(
          {
            $distribution      : fulfillmentInfo.distribution,
            $family_name       : fulfillmentInfo.family_name,
            $appt_day          : day,
            $appt_time         : time,
            $notes             : fulfillmentInfo.notes,
            $perishables       : fulfillmentInfo.perishables,
            $fulfilled         : fulfillmentInfo.fulfilled,
            $fulfillment_time  : fulfillmentInfo.fulfillment_time
          }))

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "UPDATE Client",
                "  SET usda_eligible = $usda_eligible,",
                "      usda_eligible_next_distro = $usda_eligible_next_distro",
                "  WHERE family_name = $family_name;"
              ].join(" "));
          })
        .then(stmt => stmt.run(
          {
            $family_name               : fulfillmentInfo.family_name,
            $usda_eligible             : fulfillmentInfo.usda_eligible,
            $usda_eligible_next_distro : fulfillmentInfo.usda_eligible_next_distro
          }))

        // Give 'em what they came for!
        .then(() => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in saveFulfillment`, e);
            callback(error);
          })

        .finally(() => this._endTransaction());

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
      let             day = null;
      let             time = null;
      const           fulfillmentInfo = args[0];

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "DELETE FROM Fulfillment",
                "  WHERE distribution = $distribution",
                "    AND family_name = $family_name;"
              ].join(" "));
          })

        .then(stmt => stmt.run(
          {
            $distribution      : fulfillmentInfo.distribution,
            $family_name       : fulfillmentInfo.family_name
          }))

        // Give 'em what they came for!
        .then(() => callback(null, null))
        .catch((e) =>
          {
            let             error = { message : e.toString() };

            console.warn(`Error in deleteFulfillment`, e);
            callback(error);
          })

        .finally(() => this._endTransaction());
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
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT ",
                "    start_date,",
                "    day_1_date,",
                "    day_1_first_appt,",
                "    day_1_last_appt,",
                "    day_2_date,",
                "    day_2_first_appt,",
                "    day_2_last_appt,",
                "    day_3_date,",
                "    day_3_first_appt,",
                "    day_3_last_appt,",
                "    day_4_date,",
                "    day_4_first_appt,",
                "    day_4_last_appt,",
                "    day_5_date,",
                "    day_5_first_appt,",
                "    day_5_last_appt,",
                "    day_6_date,",
                "    day_6_first_appt,",
                "    day_6_last_appt,",
                "    day_7_date,",
                "    day_7_first_appt,",
                "    day_7_last_appt",
                "  FROM DistributionPeriod",
                "  ORDER BY start_date DESC;"
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
            callback(null, result);
          })

        .catch((e) =>
          {
            console.warn("Error in getDistributionList", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
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
      let             preparedInsertOrUpdate;
      let             prepareUsda = null;
      let             prepareUsdaClearNextDistro = null;
      let             priorDistribution = null;
      const           distroInfo = args[0];
      const           bNew = args[1];

      if (! bNew)
      {
        preparedInsertOrUpdate = this._db.prepare(
          [
            "UPDATE DistributionPeriod",
            "  SET ",
            "    day_1_date = $day_1_date,",
            "    day_2_date = $day_2_date,",
            "    day_3_date = $day_3_date,",
            "    day_4_date = $day_4_date,",
            "    day_5_date = $day_5_date,",
            "    day_6_date = $day_6_date,",
            "    day_7_date = $day_7_date,",
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
        preparedInsertOrUpdate = this._db.prepare(
          [
            "INSERT INTO DistributionPeriod",
            "  (",
            "    start_date,",
            "    day_1_date,",
            "    day_2_date,",
            "    day_3_date,",
            "    day_4_date,",
            "    day_5_date,",
            "    day_6_date,",
            "    day_7_date,",
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
            "    $day_1_date,",
            "    $day_2_date,",
            "    $day_3_date,",
            "    $day_4_date,",
            "    $day_5_date,",
            "    $day_6_date,",
            "    $day_7_date,",
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

        prepareUsda = this._db.prepare(
          [
            "UPDATE Client AS c",
            "  SET usda_eligible=",
            "    (CASE",
            "       WHEN c.usda_eligible_next_distro IS NOT NULL",
            "         THEN c.usda_eligible_next_distro",
            "       WHEN f.usda_eligible_signature IS NOT NULL",
            "            AND length(f.usda_eligible_signature) > 0",
            "         THEN 'yes' ",
            "       ELSE 'no'",
            "     END)",
            "  FROM Fulfillment AS f",
            "  WHERE",
            "   c.usda_eligible_next_distro IS NOT NULL",
            "   OR",
            "   (    f.distribution = $distribution",
            "    AND f.family_name = c.family_name",
            "    AND (f.fulfilled OR f.usda_eligible_signature IS NOT NULL));"
          ].join(""));

        prepareUsdaClearNextDistro = this._db.prepare(
          [
            "UPDATE Client",
            "  SET usda_eligible_next_distro = NULL;"
          ].join(""));
      }

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

        // If we're creating a new distribution period, find out the
        // prior distribution start date
        .then(
          () =>
          {
            if (prepareUsda)    // only non-null if creating new distribution
            {
              return this._db .prepare(
                "SELECT MAX(start_date) AS distro FROM DistributionPeriod");
            }
            else
            {
              return this._db.prepare(
                "SELECT NULL AS distro;");
            }
          })

        .then(
          (stmt) =>
          {
            return stmt.all({});
          })

        .then(
          (result) =>
          {
            if (result.length > 0)
            {
              priorDistribution = result[0].distro;
            }
          })

        .then(
          () =>
          {
            return preparedInsertOrUpdate;
          })

        .then(stmt => stmt.run(
          {
            $start_date       : distroInfo.start_date,
            $day_1_date       : distroInfo.day_1_date || '',
            $day_2_date       : distroInfo.day_2_date || '',
            $day_3_date       : distroInfo.day_3_date || '',
            $day_4_date       : distroInfo.day_4_date || '',
            $day_5_date       : distroInfo.day_5_date || '',
            $day_6_date       : distroInfo.day_6_date || '',
            $day_7_date       : distroInfo.day_7_date || '',
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
          (result) =>
          {
            // Ensure that a request to edit actually edited something
            if (! bNew && result.changes != 1)
            {
              throw new Error("Edit did not find a row to modify");
            }

            return null;
          })

        // Update the usda_eligible field of the client for the
        // upcoming distribution, if this is a new distribution being
        // created
        .then(
          () =>
          {
            // prepareUsda is only non-null for a new distribution creation.
            // priorDistribution is non-null except creating 1st distribution.
            if (prepareUsda && priorDistribution)
            {
              console.log("Updating USDA eligibility");
              return prepareUsda
                .then((stmt) => stmt.run(
                  {
                    $distribution : priorDistribution
                  }));
            }

            return null;
          })

        .then(
          () =>
          {
            // prepareUsdaClearNextDistro is only non-null for a new
            // distribution creation.
            if (prepareUsdaClearNextDistro)
            {
              console.log("Clearing USDA next-distro overrides");
              return prepareUsdaClearNextDistro
                .then((stmt) => stmt.run({}));
            }

            return null;
          })

        // Give 'em what they came for!
        .then(() => callback(null, null))

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
          })

        .finally(() => this._endTransaction());
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
        .then(() => this._beginTransaction())

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
          })

        .finally(() => this._endTransaction());
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
      let             query;
      let             preQuery;
      let             queryArgs;

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        // Begin a transaction
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            return this._db.prepare(
              [
                "SELECT ",
                "    query,",
                "    pre_query",
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
            query = result[0].query;
            preQuery = result[0].pre_query;

            // If no pre-query is defined...
            if (! result[0].pre_query)
            {
              // ... then (of course), don't try to run it
              return null;
            }

            // prepare pre-query
            return this._db.prepare(result[0].pre_query);
          })
        .then(
          (stmt) =>
          {
            let             key;

            // If there was no pre-query, we have nothing to do here
            if (! stmt)
            {
              return null;
            }

            queryArgs = Object.assign({}, args[0]);

            // Delete keys that don't begin with '$'
            // Delete keys that aren't in pre-query
            for (key in queryArgs)
            {
              if (! key.startsWith("$") || ! preQuery.includes(key))
              {
                delete queryArgs[key];
              }
            }

            // run pre-query
            return stmt.run(queryArgs);
          })
        .then(
          (result) =>
          {
            // prepare the report query
            return this._db.prepare(query);
          })
        .then(
          (stmt) =>
          {
            let             key;

            queryArgs = Object.assign({}, args[0]);

            // Delete keys that don't begin with '$'
            // Delete keys that aren't in query
            for (key in queryArgs)
            {
              if (! key.startsWith("$") || ! query.includes(key))
              {
                delete queryArgs[key];
              }
            }

            // run the report query
            return stmt.all(queryArgs);
          })
        .then(
          (result) =>
          {
            let             url;
            let             filename = "";
            const           path =
              qx.core.Environment.select(
                "bcp.target",
                {
                  "build"  : "reports",
                  "source" : `${process.cwd()}/reports`
                });

            // If they want an on-screen report, we don't have to process the result
            switch(args[0].reportType)
            {
            case "onscreen" :
              return result;

            case "csv" :
              return Promise.resolve()
                .then(
                  () =>
                  {
                    const           fsPromises = require("fs").promises;

                    return fsPromises.mkdir(
                      path,
                      {
                        recursive : true,
                        mode      : 0o700
                      });
                  })
                .then(
                  () =>
                  {
                    let             header;
                    let             csvWriter;
                    let             now = new Date();
                    const           createCsvWriter = require("csv-writer").createObjectCsvWriter;

                    // If there were results...
                    if (result.length > 0)
                    {
                      // ... then create the list of headings.
                      // csvWriter expects an id, found in each
                      // record, and a title used in the heading. We
                      // use the same value for both
                      header = [];
                      Object.keys(result[0]).forEach(
                        (key) =>
                        {
                          header.push(
                            {
                              id    : key,
                              title : key
                            });
                        });

                      // Build the csv file name from the requested
                      // report name and the current timestamp.
                      filename =
                        args[0].name +
                        "-" +
                        now.getFullYear() +
                        ("0" + (now.getMonth() + 1)).substr(-2) +
                        ("0" + now.getDate()).substr(-2) +
                        ("0" + now.getHours()).substr(-2) +
                        ("0" + now.getMinutes()).substr(-2) +
                        ("0" + now.getSeconds()).substr(-2) +
                        ("00" + now.getMilliseconds()).substr(-3) +
                        ".csv";

                      // Write the CSV file
                      csvWriter = createCsvWriter(
                        {
                          path   : path + "/" + filename,
                          header : header
                        });
                      csvWriter.writeRecords(result);
                    }
                  })
                .then(
                  () =>
                  {
                    // Return the filename if there were records;
                    // empty string otherwise
                    return filename;
                  });

            default :
              throw new Error("Unknown report type: " + args[0].reportType);
            }
          })
        .then(
          (result) =>
          {
            callback(null, result);
          })

        .catch((e) =>
          {
            console.warn("Error in generateReport", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
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
        .then(() => this._beginTransaction())

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
            return results.distribution;
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
                "    cid.id AS id,",
                "    f.appt_day AS appt_day,",
                "    f.appt_time AS appt_time,",
                "    CASE f.appt_day",
                "      WHEN 1 THEN dp.day_1_date",
                "      WHEN 2 THEN dp.day_2_date",
                "      WHEN 3 THEN dp.day_3_date",
                "      WHEN 4 THEN dp.day_4_date",
                "      WHEN 5 THEN dp.day_5_date",
                "      WHEN 6 THEN dp.day_6_date",
                "      WHEN 7 THEN dp.day_7_date",
                "    END AS appt_date,",
                "    f.notes AS notes,",
                "    f.perishables AS perishables,",
                "    f.fulfilled AS fulfilled,",
                "    c.count_senior + c.count_adult + c.count_child ",
                "      AS family_size,",
                "    c.pet_types AS pet_types",
                "  FROM",
                "    Fulfillment f,",
                "    Client c,",
                "    DistributionPeriod dp,",
                "    ClientId cid",
                "  WHERE f.distribution = $distribution",
                "    AND dp.start_date = $distribution",
                "    AND c.family_name = f.family_name",
                "    AND cid.family_name = f.family_name",
                "    AND f.appt_day IS NOT NULL",
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
          })

        .finally(() => this._endTransaction());
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
        .then(() => this._beginTransaction())

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
          })

        .finally(() => this._endTransaction());
    },

    /**
     * Get USDA eligibility data, including signatures
     *
     * @param args {Array}
     *   There are no arguments to this method
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getUsdaSignature(args, callback)
    {
      let             results = {};

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

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
            return results.distribution;
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
                "    cid.id AS id,",
                "    f.appt_day AS appt_day,",
                "    f.appt_time AS appt_time,",
                "    CASE f.appt_day",
                "      WHEN 1 THEN dp.day_1_date",
                "      WHEN 2 THEN dp.day_2_date",
                "      WHEN 3 THEN dp.day_3_date",
                "      WHEN 4 THEN dp.day_4_date",
                "      WHEN 5 THEN dp.day_5_date",
                "      WHEN 6 THEN dp.day_6_date",
                "      WHEN 7 THEN dp.day_7_date",
                "    END AS appt_date,",
                "    f.notes AS notes,",
                "    f.perishables AS perishables,",
                "    f.fulfilled AS fulfilled,",
                "    (SELECT",
                "       COALESCE(max_income_text, 'See Taryn')",
                "       FROM UsdaMaxIncome",
                "       WHERE family_size = ",
                "          (SELECT COUNT(*) ",
                "            FROM FamilyMember fam ",
                "            WHERE fam.family_name = f.family_name)",
                "       ) AS usda_amount,",
                "    f.usda_eligible_signature AS usda_eligible_signature,",
                "    (SELECT COUNT(*) ",
                "       FROM FamilyMember fam ",
                "       WHERE fam.family_name = f.family_name)",
                "      AS family_size_count,",
                "    CASE",
                "      WHEN (SELECT COUNT(*) ",
                "              FROM FamilyMember fam ",
                "              WHERE fam.family_name = f.family_name) >= 4",
                "        THEN 'Large'",
                "      WHEN (SELECT COUNT(*) ",
                "              FROM FamilyMember fam ",
                "              WHERE fam.family_name = f.family_name) = 1",
                "        THEN 'Single'",
                "      ELSE 'Small'",
                "    END AS 'family_size_text',",
                "    c.pet_types AS pet_types,",
                "    c.verified AS verified,",
                "    c.usda_eligible_next_distro AS usda_eligible_next_distro",
                "  FROM",
                "    Fulfillment f,",
                "    Client c,",
                "    DistributionPeriod dp,",
                "    ClientId cid",
                "  WHERE f.distribution = $distribution",
                "    AND dp.start_date = $distribution",
                "    AND c.family_name = f.family_name",
                "    AND cid.family_name = f.family_name",
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
            console.warn("Error in getUsdaSignature", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
    },

    /**
     * Update (or remove) a USDA Signature
     *
     * @param args {Array}
     *   args[0] {distribution}
     *     The start date of the distribution period
     *
     *   args[1] {family_name}
     *     The name of the family whose fulfillment status is to be updated
     *
     *   args[2] {signature}
     *     The signature indicating eligibility, or null or "" to indicate
     *     not eligible
     *
     *   args[3] (signatureStatement)
     *     The statement agreed to by the signature, or "" to indicate
     *     not eligible
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _updateUsdaSignature(args, callback)
    {
      let             signatureHash = "";
      let
      [
        distribution,
        familyName,
        signature,
        sigStatement
      ] = args;

      // TODO: move prepared statements to constructor
      return Promise.resolve()
        .then(() => this._beginTransaction())

        .then(
          () =>
          {
            const           crypto = require("crypto");

            // If there's a non-null, non-zero-length signature,
            // combine the signature statement and signature into a
            // single string (joined by a newline), and hash that
            // string.
            if (signature)
            {
              signatureHash =
                crypto
                .createHash("sha256")
                .update(sigStatement + "\n" + signature + "\n")
                .digest("hex")
                .match(/.{1,8}/g)
                .join(" ");
            }
          })
        .then(
          () =>
          {
            // First, retrieve the most recent distribution start date
            return this._db.prepare(
              [
                "UPDATE Fulfillment",
                "  SET ",
                "    usda_eligible_signature = $usda_eligible_signature,",
                "    usda_signature_statement = $usda_signature_statement,",
                "    usda_signature_hash = $usda_signature_hash",
                "  WHERE distribution = $distribution",
                "    AND family_name = $family_name;"
              ].join(" "));
          })
        .then(
          (stmt) =>
          {
            return stmt.all(
              {
                $distribution             : distribution,
                $family_name              : familyName,
                $usda_eligible_signature  : signature,
                $usda_signature_statement : sigStatement,
                $usda_signature_hash      : signatureHash
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
            console.warn("Error in updateUsdaSignature", e);
            callback( { message : e.toString() } );
          })

        .finally(() => this._endTransaction());
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
        .then(() => this._beginTransaction())

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
          })

        .finally(() => this._endTransaction());
    }
  }
});
