export default {
  name: "default",

  units: "inches",
  trimWidth: "6.625",
  trimHeight: "10.1875",
  safeMarginTop: "0.25",
  safeMarginBottom: "0.25",
  safeMarginLeft: "0.25",
  safeMarginRight: "0.25",
  bleedMargin: "0.125",
  headerMarginTopBottom: "0.5",
  headerMarginLeftRight: "0.5",

  panelsGutterSize: "0.15",
  panelsLineWidth: "0.025",

  lineWidthThin: "0.004",
  lineWidthThick: "0.008",
  borderMarkMaxLength: "0.085",
  headerTextHeight: "0.12",
  headerLineSpacing: "1.4",
  headerPaddingBottom: "0.21",
  headerPaddingLeft: "0.21",

  renderBackgroundColor: "#ffffff",
  renderLineColor: "#a4dded",
  renderLineWeight: "1",
  renderPanelLineColor: "#000000",
  renderPanelGuidesColor: "#BD00BD",
  renderHeaderTextWeight: "normal",
  renderDrawBackground: true,
  renderDrawHeader: true,
  renderDrawBleed: true,
  renderDrawTrim: true,
  renderDrawSafe: true,
  renderDrawMarks: true,
  renderDrawCropMarks: true,
  renderDrawPanelGuides: false,
  renderDrawPanels: true,

  panelGrid: {
    type: "vgroup",
    sizePercentage: 100,
    children: [],
  },

  headerText: {
    type: "header",
    children: [
      {
        type: "line",
        children: [
          {
            type: "text",
            value: "TITLE:",
            children: [],
          },
          {
            type: "space",
            length: 0.5,
            children: [],
          },
          {
            type: "underline",
            length: "14",
            children: [],
          },
          {
            type: "space",
            length: 0.5,
            children: [],
          },
          {
            type: "text",
            value: "ISSUE #:",
            children: [],
          },
          {
            type: "space",
            length: 0.5,
            children: [],
          },
          {
            type: "underline",
            length: 4,
            children: [],
          },
          {
            type: "space",
            length: 0.5,
            children: [],
          },
          {
            type: "text",
            value: "PAGE #:",
            children: [],
          },
          {
            type: "space",
            length: 0.5,
            children: [],
          },
          {
            type: "underline",
            length: 4,
            children: [],
          },
        ],
      },
    ],
  },

  layoutPageSpread: "single",
  layoutPpi: "300",
  layoutTemplateType: "page",
  layoutPagePaperSize: "header",
  layoutPageScaling: "keep",
  layoutThumbnailsRows: "3",
  layoutThumbnailsColumns: "3",
  layoutThumbnailsPaperSize: "a4",
};
