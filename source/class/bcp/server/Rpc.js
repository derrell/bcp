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
        getClientList          : this._getClientList.bind(this),
        getAppointmentDefaults : this._getAppointmentDefaults.bind(this)
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
            "count_in_family",
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
          "FROM Client;"
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
      });
    },

    /**
     * Retrieve the appointment default times
     *
     * @param args {Array}
     *   There are no arguments to this method. The array is unused.
     *
     * @param callback {Function}
     *   @signature(err, result)
     */
    _getAppointmentDefaults(args, callback)
    {
      // TODO: move prepared statements to constructor
      return this._db.prepare(
        [
          "SELECT family_name, appt_day_default, appt_time_default",
          "  FROM Client",
          "  WHERE appt_time_default IS NOT NULL",
          "  ORDER BY appt_day_default, appt_time_default, family_name;"
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
      });
    }
  }
});
