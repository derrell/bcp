/**
 * @asset(bcp/client/*)
 * @asset(dialog/*)
 */
qx.Class.define("bcp.client.Client",
{
  extend  : qx.application.Standalone,
  include :
  [
    bcp.client.MAppointments,
    bcp.client.MClientMgmt,
    bcp.client.MReports
  ],

  members :
  {
    main()
    {
      let             mainContainer;
      let             logo;
      let             header;
      let             font;
      let             label;
      let             butLogin;
      let             butLogout;
      let             tabView;


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
      tabView = new qx.ui.tabview.TabView();
      mainContainer.add(tabView, { flex : 1 });

      // Create each of the tabview pages
      this._createAppointmentsTab(tabView);
      this._createClientListTab(tabView);
      this._createReportsTab(tabView);
    }
  }
});
