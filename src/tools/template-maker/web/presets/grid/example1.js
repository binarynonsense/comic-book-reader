export default {
  name: "example 1",
  panelGrid: {
    type: "vgroup",
    sizePercentage: 100,
    children: [
      {
        type: "vgroup",
        sizePercentage: 50,
        children: [
          {
            type: "hgroup",
            sizePercentage: 75,
            children: [
              {
                type: "panel",
                sizePercentage: 33.333333333333336,
                children: [],
              },
              {
                type: "panel",
                sizePercentage: 33.333333333333336,
                children: [],
              },
              {
                type: "panel",
                sizePercentage: 33.333333333333336,
                children: [],
              },
            ],
          },
          {
            type: "panel",
            sizePercentage: "25",
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
            type: "vgroup",
            sizePercentage: 50,
            children: [
              {
                type: "panel",
                sizePercentage: "35",
                children: [],
              },
              {
                type: "panel",
                sizePercentage: 65,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
};
