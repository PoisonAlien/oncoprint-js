import { OncoprintVisualizer } from '../OncoprintVisualizer';

describe('OncoprintVisualizer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should create an instance', () => {
    const visualizer = new OncoprintVisualizer(container);
    expect(visualizer).toBeDefined();
  });

  it('should initialize with default config', () => {
    const visualizer = new OncoprintVisualizer(container);
    expect(visualizer).toBeInstanceOf(OncoprintVisualizer);
  });
});