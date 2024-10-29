export default {
  name: "2x2",
  presetFormatVersion: "1.0.0",
  panelGrid: {
    type: "vgroup",
    sizePercentage: 100,
    children: [
      {
        type: "hgroup",
        sizePercentage: 50,
        children: [
          {
            type: "panel",
            sizePercentage: 50,
            children: [],
          },
          {
            type: "panel",
            sizePercentage: 50,
            children: [],
          },
        ],
      },
      {
        type: "hgroup",
        sizePercentage: 50,
        children: [
          {
            type: "panel",
            sizePercentage: 50,
            children: [],
          },
          {
            type: "panel",
            sizePercentage: 50,
            children: [],
          },
        ],
      },
    ],
  },
};
