qx.Class.define("bcp.server.Session",
{
  type   : "singleton",
  extend : qx.core.Object,

  members :
  {
    _session : null,

    /**
     * Create a session.
     *
     * @param app {Express}
     *   The Express app object
     *
     * @ignore(require)
     */
    init(app, bSecure)
    {
      let             SQLiteStore;
      const           connect = require("connect");
      const           connectSQLite3 = require("connect-sqlite3");
      const           session = require("express-session");

      this.info("Session: starting");

      // Create the session
      SQLiteStore = connectSQLite3(session);
      this._session =
        session(
          {
            name              : "bcp",
            store             : new SQLiteStore(),
            cookie            :
            {
              secure : bSecure,
              maxAge : this.constructor.DURATION
            },
            requestKey        : "bcpSession",
            saveUninitialized : false,
            secret            : bcp.server.Session.__makeSecret(),
            resave            : false,
            unset             : "destroy"
          });

      app.use(this._session);
    },

    getSession()
    {
      return this._session;
    }
  },

  statics :
  {
    /** The duration of a session */
    DURATION : 1000 * 60 * 60 * 24,

    /**
     * Create a "secret" string composed of random characters from a
     * 62-character alphabet. The secret will be between 30 and 49 characters
     * long plus an appended timestamp (milliseconds since the epoch).
     */
    __makeSecret()
    {
      let             secret = [];
      let             r = Math.floor(Math.random() * 20);
      let             i;

      for (i = r + 30; i >= 0; i--)
      {
        r = Math.floor(Math.random() * 62);
        secret.push(
          ("abcdefghijklmnopqrstuvwxyz" +
           "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
           "1234567890")[r]);
      }

      return secret.join("") + (new Date()).getTime();
    }
  }
});
