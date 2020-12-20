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
qx.Mixin.define("bcp.client.MDeliveryDay",
{
  members :
  {
    /**
     * Create the delivery day page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createDeliveryDayTab(tabView)
    {
      let             page;
      let             vBox;
      let             button;
      let             command;
      let             formData;

      page = new qx.ui.tabview.Page(this._tabLabel);
      page.setLayout(new qx.ui.layout.HBox(12));
      tabView.add(page);

      button = page.getChildControl("button");
      button.setLabel(this.underlineChar("Delivery Day"));
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+D");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      
    }
  }
});
