qx.Mixin.define("bcp.client.MClientMgmt",
{
  members :
  {
    /**
     * Create the client list page
     *
     * @param tabView {qx.ui.tabview.TabView}
     *   The tabview in which to add the page being created
     */
    _createClientListTab(tabView)
    {
      let             page;
      let             tm;
      let             table;
      let             tcm;
      let             hBox;
      let             butNewClient;
      let             data;
      let             custom;
      let             behavior;
      let             client;

      page = new qx.ui.tabview.Page("Clients");
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      tm = new qx.ui.table.model.Simple();
      tm.setColumns(
        [
          "Family",
          "Phone",
          "Email",
          "Ethnicity",
          "Verified",
          "# in family",
          "# seniors",
          "# adults",
          "# children",
          "# male",
          "# female",
          "# ?gender",
          "# veteran",
          "Income source",
          "Income amount",
          "Pet types",
          "Delivery address",
          "Appt day",
          "Appt time"
        ],
        [
          "family_name",
          "phone",
          "email",
          "ethnicity",
          "verified",
          "count_in_family",
          "count_senior",
          "count_adult",
          "count_child",
          "count_sex_male",
          "count_sex_female",
          "count_sex_other",
          "count_veteran",
          "income_source",
          "income_amount",
          "pet_types",
          "address_default",
          "appt_day_default",
          "appt_time_default"
        ]);

      // TODO
      if (false)
      {
        data = bcp.client.MClientMgmt.DATA;
        tm.setDataAsMapArray(data);
      }
      else
      {
        client = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
        client.sendRequest("getClientList", [])
          .then(
            (result) =>
            {
              tm.setDataAsMapArray(result);
            })
          .catch(
            (e) =>
            {
              console.error("getClientList:", e);
            });
      }

      // Prepare to use the Resize column model, for better column widths
      custom =
        {
          tableColumnModel : (obj) => new qx.ui.table.columnmodel.Resize(obj)
        };

      table = new qx.ui.table.Table(tm, custom).set(
        {
          statusBarVisible : false,
          minHeight        : 100,
          height           : 100
        });
      page.add(table, { flex : 1 });

      tcm = table.getTableColumnModel();

      // Specify column widths
      behavior = tcm.getBehavior();
      behavior.setMinWidth(tm.getColumnIndexById("family_name"), 150);
      behavior.setMaxWidth(tm.getColumnIndexById("family_name"), 300);
      behavior.setWidth(tm.getColumnIndexById("family_name"), "1*");
      behavior.setWidth(tm.getColumnIndexById("phone"), 100);
      behavior.setWidth(tm.getColumnIndexById("email"), 100);
      behavior.setWidth(tm.getColumnIndexById("ethnicity"), 80);
      behavior.setWidth(tm.getColumnIndexById("verified"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_in_family"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_senior"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_adult"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_child"), 80);
      behavior.setWidth(tm.getColumnIndexById("count_sex_male"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_sex_female"), 60);
      behavior.setWidth(tm.getColumnIndexById("count_sex_other"), 70);
      behavior.setWidth(tm.getColumnIndexById("count_veteran"), 70);
      behavior.setWidth(tm.getColumnIndexById("income_source"), 100);
      behavior.setWidth(tm.getColumnIndexById("income_amount"), 100);
      behavior.setWidth(tm.getColumnIndexById("pet_types"), 100);
      behavior.setWidth(tm.getColumnIndexById("address_default"), 100);
      behavior.setWidth(tm.getColumnIndexById("appt_day_default"), 60);
      behavior.setWidth(tm.getColumnIndexById("appt_time_default"), 60);

      // Allow sorting for appointment viewing
      tm.setSortMethods(
        tm.getColumnIndexById("appt_day_default"),
        (a, b) =>
        {
          let             index;

          // Start with appointment day
          index = tm.getColumnIndexById("appt_day_default");

          if (a[index] !== null && b[index] === null)
          {
            return -1;
          }

          if (a[index] === null && b[index] !== null)
          {
            return 1;
          }

          if (a[index] < b[index])
          {
            return -1;
          }

          if (a[index] > b[index])
          {
            return 1;
          }

          // Appointment days were the same. Try appointment time
          index = tm.getColumnIndexById("appt_time_default");

          if (a[index] !== null && b[index] === null)
          {
            return -1;
          }

          if (a[index] === null && b[index] !== null)
          {
            return 1;
          }

          if (a[index] < b[index])
          {
            return -1;
          }

          if (a[index] > b[index])
          {
            return 1;
          }

          // Both were the same. They sort equally. Sort by family name
          index = tm.getColumnIndexById("family_name");
          return (a[index] < b[index] ? -1 : (a[index] > b[index] ? 1 : 0));
        });

//      tcm.setDataCellRenderer(4, new qx.ui.table.cellrenderer.Boolean());

      // Create an hbox for the buttons at the bottom. Force some
      // space above it
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      hBox.set(
        {
          marginTop : 20
        });
      page.add(hBox);

      butNewClient = new qx.ui.form.Button("New Client");
      hBox.add(butNewClient);

      butNewClient.addListener(
        "execute",
        () =>
        {
          this._buildClientForm()
            .then(
              (result) =>
              {
                qxl.dialog.Dialog
                  .alert(qx.util.Serializer.toJson(result));
              });
        },
        this);
    },

    /**
     * Build the New/Edit Client form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildClientForm()
    {
      let             form;
      let             formData;
      const           caption = "Client Information";
      
      formData =
        {
          family_name:
          {
            type       : "TextField",
            label      : "Family Name",
            value      : "",
            validation :
            {
              required   : true
            }
          },
          phone :
          {
            type       : "TextField",
            label      : "Phone",
            value      : ""
          },
          email :
          {
            type       : "TextField",
            label      : "Email",
            value      : ""
          },
          ethnicity :
          {
            type       : "TextField",
            label      : "Email",
            value      : ""
          },
          count_in_family :
          {
            type      : "spinner",
            label     : "# of family members",
            value     : 1,
            min       : 1,
            step      : 1
          },
          count_senior :
          {
            type      : "spinner",
            label     : "# of seniors (age 65+)",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_adult :
          {
            type      : "spinner",
            label     : "# of adults (age 18-64)",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_child :
          {
            type      : "spinner",
            label     : "# of children (age 0-17)",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_sex_male :
          {
            type      : "spinner",
            label     : "# of males",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_sex_female :
          {
            type      : "spinner",
            label     : "# of females",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_sex_other :
          {
            type      : "spinner",
            label     : "# of other genders",
            value     : 0,
            min       : 0,
            step      : 1
          },
          count_veteran :
          {
            type      : "spinner",
            label     : "# of veterans",
            value     : 0,
            min       : 0,
            step      : 1
          },
          income_source :
          {
            type       : "TextField",
            label      : "Income source",
            value      : ""
          },
          income_amount :
          {
            type       : "TextField",
            label      : "Income amount",
            value      : ""
          },
          pet_types :
          {
            type       : "TextField",
            label      : "Pet types",
            value      : ""
          },
          address_default :
          {
            type       : "TextArea",
            label      : "Default delivery address",
            lines      : 3,
            value      : ""
          },
          appt_day_default :
          {
            type      : "spinner",
            label     : "Default day of distribution",
            min       : 1,
            max       : 7,
            step      : 1,
            value     : 1
          },
          appt_time_default :
          {
            type       : "TextField",
            label      : "Default appointment time",
            value      : ""
          },
          verified :
          {
            type       : "Checkbox",
            label      : "Verified",
            value      : true
          }
        };

      form = qxl.dialog.Dialog.form("", formData)
        .set(
          {
            width            : 600,
            labelColumnWidth : 300,
            caption          : caption
          });

      // KLUDGES...
      form._formContainer.getChildren()[0]
        .getLayout()
        .setColumnWidth(0, form.getLabelColumnWidth());
      // ...KLUDGES

      return form.promise();
    }
  }
});
