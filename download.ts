import dotenv from 'dotenv';

import { request } from 'gaxios';
import fs from 'fs-extra';

interface FigmaFileResponse {
  name: string;
  role: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: DocumentNode;
  components: Map<string, ComponentNode>;
  schemaVersion: 0;
}

// function getGrids(stylesArtboard) {
//   // empty "grids obj" wheree we will store all colors
//   const grids = {};
//   // get "grids" artboard
//   const gridsAtrboard = stylesArtboard.filter((item) => {
//     return item.name === "grids";
//   })[0].children;

//   gridsAtrboard.map((item) => {
//     const gridObj = {
//       [item.name]: {
//         count: {
//           value: item.layoutGrids[0].count,
//           type: "grids",
//         },
//         gutter: {
//           value: `${item.layoutGrids[0].gutterSize}px`,
//           type: "grids",
//         },
//         offset: {
//           value: `${item.layoutGrids[0].offset}px`,
//           type: "grids",
//         },
//         width: {
//           value: `${item.absoluteBoundingBox.width}px`,
//           type: "grids",
//         },
//       },
//     };

//     Object.assign(grids, gridObj);
//   });

//   return grids;
// }

// function getSpacers(stylesArtboard) {
//   // empty "spacers obj" wheree we will store all colors
//   const spacers = {};
//   // get "spacers" artboard
//   const spacersAtrboard = stylesArtboard.filter((item) => {
//     return item.name === "spacers";
//   })[0].children;

//   spacersAtrboard.map((item) => {
//     const spacerObj = {
//       [item.name]: {
//         value: `${item.absoluteBoundingBox.height}px`,
//         type: "spacers",
//       },
//     };

//     Object.assign(spacers, spacerObj);
//   });

//   return spacers;
// }

// function getFontStyles(stylesArtboard) {
//   // empty "spacers obj" wheree we will store all colors
//   const fontStyles = {};
//   // get "spacers" artboard
//   const fontStylesAtrboard = stylesArtboard.filter((item) => {
//     return item.name === "typography";
//   })[0].children;

//   fontStylesAtrboard.map((fontItem, i) => {
//     if (fontItem.children) {
//       let subFonts = {};

//       // get all sub fonts
//       fontItem.children.map((subFontItem) => {
//         let subFontObj = {
//           [subFontItem.name]: {
//             family: {
//               value: `${subFontItem.style.fontFamily}`,
//               type: "typography",
//             },
//             size: {
//               value: `${subFontItem.style.fontSize}px`,
//               type: "typography",
//             },
//             weight: {
//               value: subFontItem.style.fontWeight,
//               type: "typography",
//             },
//             lineheight: {
//               value: `${subFontItem.style.lineHeightPercent}%`,
//               type: "typography",
//             },
//             spacing: {
//               value:
//                 subFontItem.style.letterSpacing !== 0
//                   ? `${subFontItem.style.letterSpacing}px`
//                   : "normal",
//               type: "typography",
//             },
//           },
//         };
//         // merge multiple subfonts objects into one
//         Object.assign(subFonts, subFontObj);
//       });

//       //
//       let fontObj = {
//         [fontItem.name]: subFonts,
//       };

//       Object.assign(fontStyles, fontObj);
//     } else {
//       let fontObj = {
//         [fontItem.name]: {
//           family: {
//             value: `${fontItem.style.fontFamily}, ${fontItem.style.fontPostScriptName}`,
//             type: "typography",
//           },
//           size: {
//             value: fontItem.style.fontSize,
//             type: "typography",
//           },
//           weight: {
//             value: fontItem.style.fontWeight,
//             type: "typography",
//           },
//           lineheight: {
//             value: `${fontItem.style.lineHeightPercent}%`,
//             type: "typography",
//           },
//           spacing: {
//             value:
//               fontItem.style.letterSpacing !== 0
//                 ? `${fontItem.style.letterSpacing}px`
//                 : "normal",
//             type: "typography",
//           },
//         },
//       };

//       Object.assign(fontStyles, fontObj);
//     }
//   });

//   return fontStyles;
// }

const download = (figmaApiKey: string, figmaId: string) =>
  request<FigmaFileResponse>({
    url: `https://api.figma.com/v1/files/${figmaId}`,
    headers: {
      'X-Figma-Token': figmaApiKey,
    },
  });

const getScenes = (data: FigmaFileResponse) => {
  const [page] = data.document.children.filter(
    (item) => item.name === 'styles',
  );
  return page.children;
};

const rbaObj = (color: RGBA, section: 'r' | 'g' | 'b') => color[section] * 255;

const getPalette = (scenes: readonly SceneNode[]) => {
  const [paletteFrame] = scenes.filter((item) => item.name === 'palette');
  const frameChildren = (paletteFrame as FrameNode).children;

  return frameChildren
    .filter((c): c is RectangleNode => c.type === 'RECTANGLE')
    .reduce(
      (previousValue, currentValue) => {
        const fill = (currentValue.fills as Paint[])[0] as SolidPaint;
        const color = fill.color as RGBA;
        return {
          color: {
            ...previousValue.color,
            [currentValue.name]: {
              value: `rgba(${rbaObj(color, 'r')}, ${rbaObj(
                color,
                'g',
              )}, ${rbaObj(color, 'b')}, ${color.a})`,
            },
          },
        };
      },
      {
        color: {},
      },
    );
};

const getGrids = (scenes: readonly SceneNode[]) => {
  const [gridFrame] = scenes.filter((item) => item.name === 'grids');
  const frameChildren = (gridFrame as FrameNode).children;

  console.log(frameChildren);

  return frameChildren
    .filter((c): c is FrameNode => c.type === 'FRAME')
    .reduce(
      (previousValue, currentValue) => {
        const layoutGrid = currentValue.layoutGrids[0] as RowsColsLayoutGrid;
        return {
          grid: {
            ...previousValue.grid,
            [currentValue.name]: {
              count: {
                value: layoutGrid.count,
              },
              gutter: {
                value: `${layoutGrid.gutterSize}px`,
              },
              offset: {
                value: `${layoutGrid.offset}px`,
              },
              width: {
                value: `${(currentValue as any).absoluteBoundingBox.width}px`,
              },
            },
          },
        };
      },
      {
        grid: {},
      },
    );
};

const generateTokens = async (figmaApiKey: string, figmaId: string) => {
  const downloadResult = await download(figmaApiKey, figmaId);
  const scenes = getScenes(downloadResult.data);

  const colors = getPalette(scenes);
  const grids = getGrids(scenes);

  // Object.assign(baseTokeensJSON.token.spacers, getSpacers(stylesArtboard));
  // Object.assign(baseTokeensJSON.token.fonts, getFontStyles(stylesArtboard));

  await fs.writeJson('./properties/colors.json', colors);
  await fs.writeJson('./properties/grids.json', grids);
};

dotenv.config();

generateTokens(
  process.env.FIGMA_API_KEY || '',
  process.env.FIGMA_ID || '',
).then(() => {
  console.log('done');
});
