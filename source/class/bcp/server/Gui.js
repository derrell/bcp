qx.Class.define("bcp.server.Gui",
{
  extend : qx.core.Object,

  /**
   * Serve the GUI
   *
   * @param app {Express}
   *   The Express app object
   */
  construct : function(app)
  {
    this.base(arguments);

    this.info("Gui: starting");
    
    // Create routes
    [
      this.__routeGui
    ].forEach(
      (f) =>
      {
        f.call(this, app);
      });
  },

  members :
  {
    /**
     * Provide the GUI
     *
     * @param app {Express}
     *   The Express app which should route here on /login
     */
    __routeGui : function(app)
    {
      let             express = require("express");
      const           path =
        qx.core.Environment.select(
          "bcp.target",
          {
            "build"  : "",
            "source" : `${process.cwd()}/output/source/`
          });

      this.debug(`Got request for GUI; using path ${path}`);

      [
        { route : "index.html",  path : `${path}index.html` },
        { route : "bcp.client",  path : `${path}bcp.client` },
        { route : "resource",    path : `${path}resource` },
        { route : "help",        path : `${path}help` },
        { route : "transpiled",  path : `${path}transpiled` },
        { route : "favicon.ico", path : `${path}favicon.ico` }
      ].forEach(
        (item) =>
        {
          this.debug(
            `Gui: create route for ${item.route} to ${item.path}`);
          app.use("/" + item.route, express.static(item.path));
        });

      app.get(
        "/",
        (req, res) =>
        {
          res.redirect("/index.html");
        });
    }
  }
});
