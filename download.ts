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

const getSpacers = (scenes: readonly SceneNode[]) => {
  const [gridFrame] = scenes.filter((item) => item.name === 'spacers');
  const frameChildren = (gridFrame as FrameNode).children;

  return frameChildren
    .filter((c): c is ComponentNode => c.type === 'COMPONENT')
    .reduce(
      (previousValue, currentValue) => {
        return {
          spacers: {
            ...previousValue.spacers,
            [currentValue.name]: {
              value: `${(currentValue as any).absoluteBoundingBox.height}px`,
            },
          },
        };
      },
      {
        spacers: {},
      },
    );
};

const generateTokens = async (figmaApiKey: string, figmaId: string) => {
  const downloadResult = await download(figmaApiKey, figmaId);
  const scenes = getScenes(downloadResult.data);

  const colors = getPalette(scenes);
  const grids = getGrids(scenes);
  const spacers = getSpacers(scenes);

  await fs.mkdir('./properties', { recursive: true });
  await fs.writeJson('./properties/colors.json', colors);
  await fs.writeJson('./properties/grids.json', grids);
  await fs.writeJson('./properties/spacers.json', spacers);
};

dotenv.config();

generateTokens(
  process.env.FIGMA_API_KEY || '',
  process.env.FIGMA_ID || '',
).then(() => {
  console.log('done');
});
