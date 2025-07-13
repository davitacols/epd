export class PerformanceMonitor {
  private timers = new Map<string, number>();
  private metrics = new Map<string, number[]>();

  start(label: string): void {
    this.timers.set(label, Date.now());
  }

  end(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;
    
    const duration = Date.now() - start;
    this.timers.delete(label);
    
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
    
    return duration;
  }

  getReport(): Record<string, { avg: number; total: number; count: number }> {
    const report: Record<string, { avg: number; total: number; count: number }> = {};
    
    for (const [label, times] of this.metrics) {
      const total = times.reduce((sum, time) => sum + time, 0);
      report[label] = {
        avg: total / times.length,
        total,
        count: times.length
      };
    }
    
    return report;
  }

  logReport(): void {
    const report = this.getReport();
    console.log('\n⚡ Performance Report:');
    
    for (const [label, stats] of Object.entries(report)) {
      console.log(`  ${label}: ${stats.avg.toFixed(0)}ms avg (${stats.total}ms total, ${stats.count} calls)`);
    }
  }
}

export const monitor = new PerformanceMonitor();