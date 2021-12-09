/*
 * Billerica Community Pantry
 *
 * Copyright:
 *   2021 Derrell Lipman
 *
 * License:
 *   MIT: https://opensource.org/licenses/MIT
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */
qx.Mixin.define("bcp.client.MUsdaSignature",
{
  members :
  {
    _tabLabelUsdaSignature : null,


    /**
     * Create the USDA Signature page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createUsdaSignatureTab(tabView)
    {
      let             page;
      let             button;
      let             command;

      // Generate the label for this tab
      this._tabLabelUsdaSignature = this.underlineChar("USDA Signature", 5);

      page = new qx.ui.tabview.Page(this._tabLabelUsdaSignature);
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      button = page.getChildControl("button");
      button.setRich(true);

      command = new qx.ui.command.Command("Alt+S");
      command.addListener("execute", () => tabView.setSelection( [ page ] ));

    },

    /**
     * Build the USDA Signature form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildUsdaSignatureForm(clientInfo, distribution)
    {
      let             p;
      let             col;
      let             form;
      let             formData;
      const           caption = "USDA Signature";
      const           _this = this;
      
      // Ensure there's a map we can dereference for default values
      clientInfo = clientInfo || {};

      formData =
        {
          family_name:
          {
            type       : "TextField",
            label      : "Family Name",
            value      : clientInfo.family_name || "",
            validation :
            {
              required   : true
            },
            properties :
            {
              tabIndex   : 1
            }
          }
        };

      form = new qxl.dialog.Form(
      {
        caption                   : caption,
        message                   : caption,
        context                   : this
      });

      form.set(
        {
          labelColumnWidth : 150,
          formData         : formData,
        });
      form._okButton.set(
        {
          label   : "Save"
        });
      form.show();


      // Focus the first field upon appear
      form.addListener(
        "appear",
        () =>
        {
          form._formElements["family_name"].focus();
        },
        this);

      p = form.promise();

      p.then(
        (formValues) =>
        {
          let             familyMembers;

          // Cancelled?
          if (! formValues)
          {
            // Yup. Nothing to do
            return;
          }


          this.rpc("saveUsdaSignature", [ formValues ])
            .then(
              (result) =>
              {
                console.log(`saveUsdaSignature result: ${result}`);

                // A result means something failed.
                if (result)
                {
                  qxl.dialog.Dialog.error(result);
                  return;
                }
              })
            .catch(
              (e) =>
              {
                qxl.dialog.Dialog.error(`Error saving changes: ${e}`);
              });
        });
    }
  }
});
