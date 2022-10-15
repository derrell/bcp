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

/**
 * @asset(script/signature_pad.umd.js)
 */
qx.Class.define("bcp.client.Signature",
{
  type      : "singleton",
  extend    : qx.ui.container.Composite,
  include   : [ qx.ui.form.MForm ],
  implement : [ qx.ui.form.IForm, qx.ui.form.IField ],

  /**
   * @ignore SignaturePad
   */
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
        height        : 180,
        canvasHeight  : 180,
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
            let             canvasWrapper = canvas.getContentElement();
            let             htmlCanvas = canvasWrapper.getCanvas();

            // Retain access to the canvas element
            this._canvas = htmlCanvas;

            // Obtain the HTML canvas element, and attach SignaturePad to it
            this._signaturePad = new SignaturePad(htmlCanvas);

            // Update our value property after each stroke completes
            this._signaturePad.addEventListener(
              "endStroke",
              (e) =>
              {
                this.setValue(this._signaturePad.toDataURL());
              });

            this.addListener(
              "resize",
              () =>
              {
                let             ratio;

                // When zoomed out to less than 100%, for some very
                // strange reason, some browsers report
                // devicePixelRatio as less than 1 and only part of
                // the canvas is cleared then.
                ratio =  Math.max(window.devicePixelRatio || 1, 1);

                // This part causes the canvas to be cleared
                htmlCanvas.width = htmlCanvas.offsetWidth * ratio;
                htmlCanvas.height = htmlCanvas.offsetHeight * ratio;
                htmlCanvas.getContext("2d").scale(ratio, ratio);

                // SignaturePad does not listen for canvas changes, so
                // after the canvas is automatically cleared by the
                // browser, SignaturePad#isEmpty might still return
                // false, even though the canvas looks empty, because
                // the internal data of this library wasn't cleared.
                // To make sure that the state of this library is
                // consistent with visual state of the canvas, you
                // have to clear it manually.
                this._signaturePad.clear();
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
    _canvas       : null,
    _signaturePad : null,

    clear : function()
    {
      if (this._signaturePad)
      {
        this._signaturePad.clear();
      }
    },

    getCanvas : function()
    {
      return this._canvas;
    }
  }
});
