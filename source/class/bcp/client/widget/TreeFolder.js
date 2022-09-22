qx.Class.define("bcp.client.widget.TreeFolder",
{
  extend: qx.ui.tree.core.AbstractTreeItem,

  properties:
  {
    appearance:
    {
      refine: true,
      init: "tree-folder-sig"
    }
  },

  members:
  {
    // overridden
    _addWidgets()
    {
      this.addSpacer();
      this.addOpenButton();
      this.addIcon();
      this.addLabel();
    }
  }
});
