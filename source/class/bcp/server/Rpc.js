qx.Class.define("bcp.server.Rpc",
{
  extend : qx.core.Object,

  /**
   * Create the login and logout routes
   *
   * @param app {Express}
   *   The Express app object
   */
  construct(app)
  {
    let             server;
    const           sqlite3 = require("sqlite3");
    const           { open } = require("sqlite");
    const           jayson = require("jayson");

    this.base(arguments);

    this.info("Rpc: starting");

    server = jayson.server(
      {
        getClientList       : this._getClientList.bind(this),
        saveClient          : this._saveClient.bind(this),
        getAppointments     : this._getAppointments.bind(this),
        getDistributionList : this._getDistributionList.bind(this)
      });

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
        });

    app.use(
      "/rpc",
      (req, res, next) =>
      {
        console.log("Got RPC request: body=", req.body);
        server.middleware()(req, res, next);
      });
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
      ClientAlreadyExists : -32000
    }
  },

  members :
  {
    /** The database handle */
    _db : null,

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
     *     true if this is an edit; false to insert a new family
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
              error.code = this.constructor.Error.ClientAlreadyExists;
              break;
            }

            // Return error as result, not as error
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
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getAppointments(args, callback)
    {
      let             p;
      let             results = {};
      let             distribution = args.length > 0 ? args[0] : null;

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
                "SELECT start_date",
                "  FROM DistributionPeriod",
                "  ORDER BY start_date DESC;"
              ].join(" "));
          })
        .then(stmt => stmt.all({}))
        .then(result => (results.distributionStarts = result))

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
                (results.distributionStarts.length > 0
                 ? results.distributionStarts[0].start_date
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
          "    start_date",
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
    }
  }
});
