qx.Class.define("bcp.client.Calendar",
{
  extend : qx.ui.container.Composite,

  construct(bDefaultsOnly)
  {
    let             tree;
    let             resizeBehavior;
    let             dm;

    // Establish a layout for this container
    this.base(arguments, new qx.ui.layout.VBox());

    // We want to use some of the high-level node operation convenience
    // methods rather than manually digging into the TreeVirtual helper
    // classes.  Include the mixin that provides them.
    qx.Class.include(qx.ui.treevirtual.TreeVirtual,
                     qx.ui.treevirtual.MNode);

    this._tree = tree = new qx.ui.treevirtual.TreeVirtual(
        [
          "Default Appointment Time",
          "# assigned"
        ]);
    tree.set(
      {
        width                      : 400,
        statusBarVisible           : false,
        useTreeLines               : false
      });
    this.add(tree);

//    tree.setUseTreeLines(false);
    tree.setAlwaysShowOpenCloseSymbol(false);
    
    // Obtain the resize behavior object to manipulate
    resizeBehavior = tree.getTableColumnModel().getBehavior();

    // Ensure that the tree column remains sufficiently wide
    resizeBehavior.set(0, { width: "1*", minWidth: 180, maxWidth: 200  });

    // Get the tree data model
    this._dm = dm = tree.getDataModel();

/*
    var te1 = dm.addBranch(null, "Desktop", true);
    tree.nodeSetLabelStyle(te1,
                           "background-color: red; " +
                           "color: white;" +
                           "font-weight: bold;");
*/

    this.addListener("appear", this._onAppear, this);
  },

  members :
  {
    // The treevirtual object
    _tree : null,

    // Tree's data model
    _dm : null,

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

      client = new qx.io.jsonrpc.Client(new qx.io.transport.Xhr("/rpc"));
      client.sendRequest("getAppointmentDefaults", [])
        .then(
          (result) =>
          {
            let             day;
            let             dayNode;
            let             time;
            let             timeNode;
            let             numNodes;
            let             nodes = {};
            let             dayNum;
            let             timestamp;
            let             formatted;
            const           fifteenMin = (1000 * 60 * 15);

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

            // Add the result data to the tree
            result.forEach(
              (entry) =>
              {
                // Get the node for this time slot
                try
                {
                  timeNode =
                    nodes[entry.appt_day_default][entry.appt_time_default];
                }
                catch(e)
                {
                  dialog.Alert(
                    "Invalid data in database: " +
                      "appointment day '" + entry.appt_day_default + "'" +
                      ", appointment time '" + entry.appt_time_default + "'");
                  return;
                }

                // Add the family name to the current time branch
                dm.addLeaf(timeNode, entry.family_name);
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
                dm.setColumnData(
                  timeNode,
                  1,
                  "" + tree.nodeGet(timeNode).children.length);
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
