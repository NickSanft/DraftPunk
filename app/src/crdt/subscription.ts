import type { Stroke } from '../types/canvas';
import { yToStroke, type YStrokes } from './document';

export type StrokeListener = (strokes: readonly Stroke[]) => void;

export class StrokeSubscription {
  private cache: Stroke[] = [];
  private readonly listeners = new Set<StrokeListener>();
  private readonly observerFn: () => void;

  constructor(private readonly yStrokes: YStrokes) {
    this.rebuild();
    this.observerFn = () => {
      this.rebuild();
      this.notify();
    };
    this.yStrokes.observe(this.observerFn);
  }

  getStrokes(): readonly Stroke[] {
    return this.cache;
  }

  subscribe(listener: StrokeListener): () => void {
    this.listeners.add(listener);
    listener(this.cache);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.yStrokes.unobserve(this.observerFn);
    this.listeners.clear();
  }

  private rebuild(): void {
    this.cache = this.yStrokes.toArray().map(yToStroke);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.cache);
    }
  }
}
