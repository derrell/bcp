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
qx.Class.define("bcp.client.Signature",
{
  extend     : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  construct()
  {
    let             border;
    let             canvas;
    let             dynLoader;

    // Establish a layout for this container
    this.base(arguments, new qx.ui.layout.VBox());

    border = new qx.ui.decoration.Decorator();
    border.set(
      {
        width : 2,
        style : "solid",
        color : "black",
        radius : 20
      });

    // Create a canvas for the signature pad
    canvas = new qx.ui.embed.Canvas();
    canvas.set(
      {
        backgroundColor: "#cccccc",
        height        : 400,
        canvasHeight  : 400,
//        canvasWidth   : 200,
        syncDimension : true,
        decorator     : border
      });
 
    this.add(canvas);

    // To update signature_pad, from top-level:
    // `npm i --save signature_pad`, then
    // `cp node_modules/signature_pad/dist/signature_pad.umd.js source/resource/script/`
    dynLoader = new qx.util.DynamicScriptLoader(
      [
        "resource/script/signature_pad.umd.js"
      ]);

    dynLoader.addListenerOnce(
      "ready",
      (e) =>
      {
        const prepSignaturePad =
          () =>
          {
            // Obtain the HTML canvas element, and attach SignaturePad to it
            canvas = canvas.getContentElement().getCanvas();
            this._signaturePad = new SignaturePad(canvas);

            // Update our value property after each stroke completes
            this._signaturePad.addEventListener(
              "endStroke",
              (e) =>
              {
                this.setValue(this._signaturePad.toDataURL());
              });
          };

        // Resolve a race condition. We don't know whether the script
        // loader will complete first, or the rendering of the canvas
        // element. Handle both the case where we can proceed
        // immediately (the canvas element has already been rendered),
        // or the case where we need to wait for the canvas element to
        // be rendered.
        if (canvas.getContentElement())
        {
          prepSignaturePad();
        }
        else
        {
          canvas.addListenerOnce("appear", () => prepSignaturePad());
        }
      });

    dynLoader.addListener(
      "failed", (e) => console.log("failed to load signature_pad"));

    dynLoader.start();

  },

  properties :
  {
    value :
    {
      init      : null,
      nullable  : true,
      check     : "String",
      event     : "changeValue"
    }
  },

  members :
  {
    _signaturePad : null
  }
});
