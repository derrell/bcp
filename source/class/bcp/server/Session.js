qx.Class.define("bcp.server.Session",
{
  extend : qx.core.Object,

 /**
   * Create a session.
   *
   * @param app {Express}
   *   The Express app object
   */
  construct(app, bSecure)
  {
    let             sessions = require("client-sessions");

    this.base(arguments);

    this.info("Session: starting");

    app.use(
      sessions(
        {
          cookieName     : "bcp",
          requestKey     : "bcpSession",
          secret         : bcp.server.Session.__makeSecret(),
          duration       : bcp.server.Session.DURATION,
          activeDuration : bcp.server.Session.DURATION,
          cookie         :
          {
            secure         : bSecure,
            ephemeral      : true,
            httpOnly       : true
          }
        }));
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
