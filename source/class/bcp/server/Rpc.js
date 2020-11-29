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
    const           jayson = require("jayson");

    this.base(arguments);

    this.info("Rpc: starting");

    server = jayson.server(
      {
        getClientList : this._getClientList.bind(this)
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
    _getClientList(args, callback)
    {
      callback(
        null,
        JSON.parse(require("fs").readFileSync("clientlist.json")));
    }
  }
});
