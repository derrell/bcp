/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2020-2022 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
qx.Mixin.define("bcp.client.MAdmin",
{
  members :
  {
    _tabLabelAdmin         : null,

    /**
     * Create the admin page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createAdminTab(tabView)
    {
      let             o;
      let             page;
      let             button;
      let             command;
      const           _this = this;

      // Generate the label for this tab
      this._tabLabelAdmin = this.underlineChar("Admin", 0);

      page = new qx.ui.tabview.Page(this._tabLabelAdmin);
      page.setLayout(new qx.ui.layout.Canvas());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+A");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

      o = new qx.ui.form.Button("Download Latest Database Backup");
      page.add(o, { left : 10, top : 10 });

      o.addListener(
        "execute",
        () =>
        {
          let             win;

          win = window.open(
            `/dbDownload`,
            "Latest Database Backup",
            "resizable=yes,scrollbars=yes,width=1000,height=600");
          setTimeout(() => win.close(), 500);
        });
    }
  }
});
