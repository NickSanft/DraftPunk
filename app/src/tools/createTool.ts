import { EraserTool } from './EraserTool';
import { PenTool } from './PenTool';
import type { Tool, ToolType } from './Tool';

export function createTool(type: ToolType, userId: string): Tool {
  switch (type) {
    case 'pen':
      return new PenTool(userId);
    case 'eraser':
      return new EraserTool();
  }
}
