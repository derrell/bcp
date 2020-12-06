qx.Class.define("bcp.client.Calendar",
{
  extend     : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct()
  {
    // Establish a layout for this container
    this.base(arguments, new qx.ui.layout.VBox());

    // We want to use some of the high-level node operation convenience
    // methods rather than manually digging into the TreeVirtual helper
    // classes.  Include the mixin that provides them.
    qx.Class.include(qx.ui.treevirtual.TreeVirtual,
                     qx.ui.treevirtual.MNode);

    // Create the tree in default state
    this._buildAppointmentTree();

    this.addListener("appear", this._onAppear, this);
  },

  properties :
  {
    value :
    {
      init     : null,
      nullable : true,
      check    : "String",
      event    : "changeValue"
    },

    showScheduled :
    {
      init     : false,
      nullable : false,
      check    : "Boolean",
      apply    : "_applyShowScheduled"
    }
  },

  members :
  {
    // The treevirtual object
    _tree : null,

    // Tree's data model
    _dm : null,

    // property apply
    _applyShowScheduled(value, old)
    {
      this._buildAppointmentTree(value);
    },

    _buildAppointmentTree(bShowScheduledToo = false)
    {
      let             tree;
      let             resizeBehavior;
      let             dm;
      let             fields;

      // If there's an existing tree...
      if (this._tree)
      {
        // ... then remove it
        this.remove(this._tree);
        this._tree.dispose();
        this._tree = null;
      }

      // By default only time tree and default assignment counts are
      // present
      fields =
        [
          bShowScheduledToo ? "Appointment Time" : "Default Time",
          "# default"
        ];

      // If requested, show the number scheduled, too
      if (bShowScheduledToo)
      {
        fields.push("# scheduled");
      }
      
      // Create the new tree
      this._tree = tree = new qx.ui.treevirtual.TreeVirtual(fields);
      tree.set(
        {
          width                      : 400,
          statusBarVisible           : false,
          useTreeLines               : false
        });
      this.add(tree);

      // No need to show open/close symbols on empty branches
      tree.setAlwaysShowOpenCloseSymbol(false);

      // Obtain the resize behavior object to manipulate
      resizeBehavior = tree.getTableColumnModel().getBehavior();

      // Ensure that the tree column remains sufficiently wide
      resizeBehavior.set(0, { width: 140  });

      // The other one or two columns can have a set width too
      for (let i = 1; i < fields.length; i++)
      {
        resizeBehavior.set(i, { width : 100 });
      }

      // Get the tree data model
      this._dm = dm = tree.getDataModel();

/*
      var te1 = dm.addBranch(null, "Desktop", true);
      tree.nodeSetLabelStyle(te1,
                             "background-color: red; " +
                             "color: white;" +
                             "font-weight: bold;");
*/      

      // Handle tap to edit an existing client
      tree.addListener(
        "cellTap",
        (e) =>
        {
console.log(`Tap on node ${e.getRow()}: ${JSON.stringify(tree.nodeGet(e.getRow()))}`);
          tree.getSelectionModel().resetSelection();
        });

    },

    _formatTime(timestamp)
    {
      return (
        ("0" + timestamp.getHours()).substr(-2) +
          ":" +
          ("0" + timestamp.getMinutes()).substr(-2));
    },

    _onAppear()
    {
      let             client;
      const           tree = this._tree;
      const           dm = this._dm;
      const           bShowScheduledToo = this.getShowScheduled();

      client = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      client.sendRequest("getAppointments", [ bShowScheduledToo ])
        .then(
          (result) =>
          {
            let         day;
            let         dayNode;
            let         time;
            let         timeNode;
            let         numNodes;
            let         nodes = {};
            let         dayNum;
            let         numDefaults;
            let         timestamp;
            let         formatted;
            const       fifteenMin = (1000 * 60 * 15);
            const       appointmentDefaults = result.appointmentDefaults;
            const       distributionStarts = result.distributionStarts;
            const       appointmentsScheduled = result.appointmentsScheduled;

            // Clear out any prior tree data
            dm.prune(0);

            for (dayNum = 1; dayNum <= 7; dayNum++)
            {
              // Add this day node to the root
              dayNode = dm.addBranch(null, "Day " + dayNum);

              // Day nodes default to opened
              tree.nodeSetOpened(dayNode, true);

              // Create the map of times for this day
              nodes[dayNum] = {};

              // Add each possible time for this day
              for (timestamp = new Date("2020-01-01T08:00"),
                     numNodes = 0;
                   numNodes < 4 * 14; // 4x per hour, many hours
                   timestamp = new Date(timestamp.getTime() + fifteenMin),
                     numNodes++)
              {
                // Get the formatted time for this timestamp
                formatted = this._formatTime(timestamp);

                // Create the node for this time
                timeNode = dm.addBranch(dayNode, formatted);

                // Save it for adding entries from returned data
                nodes[dayNum][formatted] = timeNode;
              }
            }

            // Prepare to track number of default appointments per timeslot
            numDefaults =
              {
                1 : {},
                2 : {},
                3 : {},
                4 : {},
                5 : {},
                6 : {},
                7 : {}
              };

            // Add the appointment defaults data to the tree
            appointmentDefaults.forEach(
              (entry) =>
              {
                let             day = entry.appt_day_default;
                let             time = entry.appt_time_default;

                // Get the node for this time slot
                try
                {
                  timeNode =
                    nodes[entry.appt_day_default][entry.appt_time_default];
                }
                catch(e)
                {
                  qxl.dialog.Alert(
                    "Invalid data in database: " +
                      "appointment day '" + day + "'" +
                      ", appointment time '" + time + "'");
                  return;
                }

                // Keep track of number of default appointments per timeslot
                numDefaults[day][time] =
                  numDefaults[day][time] ? numDefaults[day][time] + 1 : 1;

                // Add the family name to the current time branch if
                // we're not showing scheduled appointments too
                if (! bShowScheduledToo)
                {
                  dm.addLeaf(timeNode, entry.family_name);
                }
              });

            // Update the number of appointments for each time slot
            for (dayNum = 1; dayNum <= 7; dayNum++)
            {
              for (timestamp = new Date("2020-01-01T08:00"),
                     numNodes = 0;
                   numNodes < 4 * 14; // 4x per hour, many hours
                   timestamp = new Date(timestamp.getTime() + fifteenMin),
                     numNodes++)
              {
                // Retrieve the time node
                timeNode = nodes[dayNum][formatted];

                // Get the formatted time for this timestamp
                formatted = this._formatTime(timestamp);

                // Show the number of default appointments for each timeslot
                dm.setColumnData(
                  timeNode,
                  1,
                  "" + (numDefaults[dayNum][formatted] || 0));

                // If we're showing scheduled apointments too, add the
                // number for each timeslot
                if (bShowScheduledToo)
                {
                  dm.setColumnData(
                    timeNode,
                    2,
                    "" + tree.nodeGet(timeNode).children.length);
                }
              }
            }

            // Use the just-provided data
            dm.setData();
          })
        .catch(
          (e) =>
          {
            console.error("getAppointmentDefaults:", e);
          });
    }
  }
});
