export type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (!this.events[event]) return;

    if (!callback) {
      delete this.events[event];
      return;
    }

    this.events[event] = this.events[event].filter(cb => cb !== callback);
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event handler for '${event}':`, error);
      }
    });
  }

  once(event: string, callback: EventCallback): void {
    const onceCallback = (...args: any[]) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}