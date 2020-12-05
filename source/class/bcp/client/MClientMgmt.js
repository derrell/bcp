qx.Mixin.define("bcp.client.MClientMgmt",
{
  members :
  {
    /** The client table model */
    _tm : null,

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
      let             cellRenderer;

      page = new qx.ui.tabview.Page("Clients");
      page.setLayout(new qx.ui.layout.VBox());
      tabView.add(page);

      this._tm = tm = new qx.ui.table.model.Simple();
      tm.setColumns(
        [
          "Family",
          "Phone",
          "Email",
          "Ethnicity",
          "Verified",
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
              result = result.map(
                (entry) =>
                {
                  if (entry.verified === 1)
                  {
                    entry.verified = true;
                  }
                  else if (entry.verified === 0)
                  {
                    entry.verified = null;
                  }

                  return entry;
                });
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
          statusBarVisible       : false,
          showCellFocusIndicator : false,
          minHeight              : 100,
          height                 : 100
        });
      page.add(table, { flex : 1 });

      tcm = table.getTableColumnModel();

      // Specify column widths
      behavior = tcm.getBehavior();
      behavior.setWidth(tm.getColumnIndexById("family_name"), 180);
      behavior.setWidth(tm.getColumnIndexById("phone"), 100);
      behavior.setWidth(tm.getColumnIndexById("email"), 100);
      behavior.setWidth(tm.getColumnIndexById("ethnicity"), 80);
      behavior.setWidth(tm.getColumnIndexById("verified"), 60);
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

      // The 'verified' column shows a checkmark when client is verified
      cellRenderer = new qx.ui.table.cellrenderer.Boolean();
      cellRenderer.set(
        {
          iconTrue  : "qxl.dialog.icon.ok"
        });
      tcm.setDataCellRenderer(tm.getColumnIndexById("verified"), cellRenderer);

      // Create an hbox for the buttons at the bottom. Force some
      // space above it
      hBox = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      hBox.set(
        {
          marginTop : 20
        });
      page.add(hBox);

      // Handle tap to edit an existing client
      table.addListener(
        "cellTap",
        (e) =>
        {
          this._buildClientForm(tm.getDataAsMapArray()[e.getRow()]);
          table.getSelectionModel().resetSelection();
        });

      // Prepare to create a new client
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
        });
    },

    /**
     * Build the New/Edit Client form.
     *
     * @return {Promise}
     *   The returned promise resolves with the data from the forms submission
     */
    _buildClientForm(clientInfo)
    {
      let             form;
      let             formData;
      let             message;
      const           bNew = ! clientInfo;
      const           caption = "Client Detail";
      
      // Ensure there's a map we can dereference for default values
      clientInfo = clientInfo || {};

      message =
        bNew
        ? "<span style='font-weight: bold;'>New Client</span>"
        : "";

      formData =
        {
          family_name:
          {
            type       : "TextField",
            label      : "Family Name",
            enabled    : bNew,
            value      : clientInfo.family_name || "",
            validation :
            {
              required   : true
            }
          },
          address_default :
          {
            type       : "TextArea",
            label      : "Default delivery address",
            lines      : 3,
            value      : clientInfo.address_default || "",
            userdata   :
            {
              rowspan    : 2
            }
          },
          phone :
          {
            type       : "TextField",
            label      : "Phone",
            value      : clientInfo.phone || ""
          },
          email :
          {
            type       : "TextField",
            label      : "Email",
            value      : clientInfo.email || ""
          },
          ethnicity :
          {
            type       : "SelectBox",
            label      : "Ethnicity",
            value      : clientInfo.ethnicity || "Undeclared",
            options :
            [
              { label : "Undeclared",       value : "Undeclared" },
              { label : "African American", value : "African American" },
              { label : "Amer. Indian",     value : "Amer. Indian" },
              { label : "Asian",            value : "Asian" },
              { label : "Hispanic",         value : "Hispanic" },
              { label : "White",            value : "White" }
            ]
          },
          income_source :
          {
            type       : "TextField",
            label      : "Income source",
            value      : clientInfo.income_source || ""
          },
          income_amount :
          {
            type       : "TextField",
            label      : "Income amount",
            value      : clientInfo.income_amount || ""
          },
          pet_types :
          {
            type       : "TextField",
            label      : "Pet types",
            value      : clientInfo.pet_types || ""
          },
          verified :
          {
            type       : "Checkbox",
            label      : "Verified",
            value      : clientInfo.verified || false
          },
          count_senior :
          {
            type      : "spinner",
            label     : "# of seniors (age 65+)",
            value     : clientInfo.count_senior || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 0,
              column    : 2
            }
          },
          count_adult :
          {
            type      : "spinner",
            label     : "# of adults (age 18-64)",
            value     : clientInfo.count_adult || 0,
            min       : 0,
            step      : 1
          },
          count_child :
          {
            type      : "spinner",
            label     : "# of children (age 0-17)",
            value     : clientInfo.count_child || 0,
            min       : 0,
            step      : 1
          },
          count_sex_male :
          {
            type      : "spinner",
            label     : "# of males",
            value     : clientInfo.count_sex_male || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 4
            }
          },
          count_sex_female :
          {
            type      : "spinner",
            label     : "# of females",
            value     : clientInfo.count_sex_female || 0,
            min       : 0,
            step      : 1
          },
          count_sex_other :
          {
            type      : "spinner",
            label     : "# of other genders",
            value     : clientInfo.count_sex_other || 0,
            min       : 0,
            step      : 1
          },
          count_veteran :
          {
            type      : "spinner",
            label     : "# of veterans",
            value     : clientInfo.count_veteran || 0,
            min       : 0,
            step      : 1,
            userdata  :
            {
              row       : 8
            }
          },
          appt_day_default :
          {
            type      : "spinner",
            label     : "Default day of distribution",
            min       : 1,
            max       : 7,
            step      : 1,
            value     : clientInfo.appt_day_default || 1,
            userdata  :
            {
              row       : 0,
              column    : 4
            }
          },
          appt_time_default :
          {
            type       : "TextField",
            label      : "Default appointment time",
            value      : clientInfo.appt_time_default || ""
          }
        };

      form = new qxl.dialog.Form({
        caption                   : caption,
        message                   : message,
        setupFormRendererFunction : function(form) {
          var renderer = new qxl.dialog.MultiColumnFormRenderer(form);
          var layout = new qx.ui.layout.Grid();
          const col = renderer.column;

          layout.setSpacing(6);

          layout.setColumnMaxWidth(col(0), this.getLabelColumnWidth());
          layout.setColumnWidth(col(0), this.getLabelColumnWidth());
          layout.setColumnAlign(col(0), "right", "top");

          layout.setColumnFlex(col(1), 1);
          layout.setColumnAlign(col(1), "left", "top");

          layout.setColumnMaxWidth(col(2), this.getLabelColumnWidth());
          layout.setColumnWidth(col(2), this.getLabelColumnWidth());
          layout.setColumnAlign(col(2), "right", "top");

          layout.setColumnFlex(col(3), 1);
          layout.setColumnAlign(col(3), "left", "top");

          layout.setColumnMaxWidth(col(4), this.getLabelColumnWidth());
          layout.setColumnWidth(col(4), this.getLabelColumnWidth());
          layout.setColumnAlign(col(4), "right", "top");

          layout.setColumnFlex(col(5), 1);
          layout.setColumnAlign(col(5), "left", "top");

          renderer._setLayout(layout);
          return renderer;
        }
      });

      form.set(
        {
          labelColumnWidth : 150,
          formData         : formData,
        });
      form.show();

      return form.promise();
    }
  }
});
