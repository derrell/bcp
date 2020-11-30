qx.Mixin.define("bcp.client.MAppointments",
{
  members :
  {
    /**
     * Create the appointments page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createAppointmentsTab(tabView)
    {
      let             page;
      let             calendar;

      page = new qx.ui.tabview.Page("Appointments");
      page.setLayout(new qx.ui.layout.HBox());
      tabView.add(page);

      

      // Add the default appointment calendar
      calendar = new bcp.client.Calendar(true);
      calendar.set(
        {
          width : 300
        });
      page.add(calendar);
    }
  }
});
