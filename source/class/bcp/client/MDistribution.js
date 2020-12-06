qx.Mixin.define("bcp.client.MDistribution",
{
  members :
  {
    /**
     * Create the distribution page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createDistributionTab(tabView)
    {
      let             page;

      page = new qx.ui.tabview.Page("Distributions");
      page.setLayout(new qx.ui.layout.HBox());
      tabView.add(page);
    }
  }
});
