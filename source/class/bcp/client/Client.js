/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

/**
 * @asset(bcp/client/*)
 */
qx.Class.define("bcp.client.Client",
{
  extend  : qx.application.Standalone,
  include :
  [
    bcp.client.MClientMgmt,
    bcp.client.MFulfillment,
    bcp.client.MDistribution,
    bcp.client.MReports
  ],

  statics :
  {
    RpcError : bcp.server.Rpc.Error
  },

  members :
  {
    _tabView  : null,

    main()
    {
      let             mainContainer;
      let             logo;
      let             header;
      let             font;
      let             label;
      let             butLogin;
      let             butLogout;


      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug"))
      {
        qx.log.appender.Native = qx.log.appender.Native;
        qx.log.appender.Console = qx.log.appender.Console;
      }

      // Create the main container that covers the whole page
      mainContainer = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.getRoot().add(mainContainer, { edge : 2 });

      //
      // Build the header
      //

      // Create the header hbox
      header = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      mainContainer.add(header);

      // Add the logo, scaling it to a reasonable size
      logo = new qx.ui.basic.Image("bcp/client/logo.png");
      logo.set(
        {
          width        : 80,
          height       : 80,
          scale        : true,
          allowShrinkX : true,
          allowShrinkY : true
        });
      header.add(logo);

      // Center the title
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      label = new qx.ui.basic.Label(
        "Billerica Community Pantry<br>Management Console");
      label.set(
        {
          paddingTop : 20,
          font       : "header",
          rich       : true,
          textAlign  : "center"
        });
      header.add(label);

      // Right-justify the buttons
      header.add(new qx.ui.core.Spacer(), { flex : 1 });

      butLogout = new qx.ui.form.Button("Logout");
      butLogout.set(
        {
          maxHeight : 28,
          marginTop : 10
        });
      header.add(butLogout);

      //
      // Build the main view
      //

      // Create a tabview for the remainder of the page
      this._tabView = new qx.ui.tabview.TabView();
      mainContainer.add(this._tabView, { flex : 1 });

      // Make sure all of our local form elements are registered
      bcp.client.RegisterFormElements.register();

      // Create each of the tabview pages
      this._createClientListTab(this._tabView);
      this._createFulfillmentTab(this._tabView);
      this._createDistributionTab(this._tabView);
      this._createReportsTab(this._tabView);
    },

    close : function()
    {
      this.base(arguments);

      // If the report window is open...
      if (this._reportWin)
      {
        // ... then close it
        this._reportWin.close();
        this._reportWin = null;
      }
    },

    /**
     * Convert the given text to an HTML span with font-weight: bold
     *
     * @param s {String}
     *   The string to be bolded
     */
    bold : function bold(s)
    {
      return (
        [
          "<span style='font-weight: bold;'>",
          s,
          "</span>"
        ].join(""));
    }
  }
});
