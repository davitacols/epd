export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  summary(): void {
    const total = Date.now() - this.startTime;
    console.log(`\n⏱️ Performance Summary (${total}ms total):`);
    
    for (const [name, time] of this.checkpoints) {
      console.log(`   ${name}: ${time}ms`);
    }
  }
}