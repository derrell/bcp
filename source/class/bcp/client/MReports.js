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
qx.Mixin.define("bcp.client.MReports",
{
  members :
  {
    /**
     * Create the reports page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createReportsTab(tabView)
    {
      let             page;

      page = new qx.ui.tabview.Page("Reports");
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);
    }
  }
});
