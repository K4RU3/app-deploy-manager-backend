import os from 'os';
import { execa } from 'execa';
import db from '../config/db.js';
import type { SystemStats, SystemEvent } from '../models/system.js';

export class SystemService {
  async getStats(): Promise<SystemStats> {
    // CPU usage
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0] || 0; // Fallback to 0 if undefined
    const cpuUsage = Math.min(100, (loadAvg / cpus.length) * 100);

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    // Disk usage (using df -h /)
    let diskUsage = 0;
    try {
      const { stdout } = await execa('df', ['-h', '/']);
      const lines = stdout.trim().split('\n');
      if (lines.length > 1 && lines[1]) {
        const parts = lines[1].split(/\s+/);
        const percentageStr = parts[4]?.replace('%', '') || '0';
        diskUsage = parseFloat(percentageStr);
      }
    } catch (error) {
      console.error('Failed to get disk usage:', error);
    }

    return {
      cpu: Math.round(cpuUsage * 10) / 10,
      memory: Math.round(memoryUsage * 10) / 10,
      disk: Math.round(diskUsage * 10) / 10,
    };
  }

  async getEvents(): Promise<SystemEvent[]> {
    const events: SystemEvent[] = [];

    // 1. Get deployments
    const deployments = db.prepare(`
      SELECT dh.id, dh.timestamp, dh.result, s.name 
      FROM deploy_history dh
      JOIN services s ON dh.serviceId = s.id
      ORDER BY dh.timestamp DESC 
      LIMIT 10
    `).all() as any[];

    for (const dep of deployments) {
      events.push({
        id: dep.id,
        type: 'deployment',
        message: `Deployment of ${dep.name} ${dep.result}`,
        timestamp: dep.timestamp,
      });
    }

    // 2. Get backups
    const backups = db.prepare(`
      SELECT bh.id, bh.createdAt as timestamp, s.name 
      FROM backup_history bh
      JOIN services s ON bh.serviceId = s.id
      ORDER BY bh.createdAt DESC 
      LIMIT 10
    `).all() as any[];

    for (const backup of backups) {
      events.push({
        id: backup.id,
        type: 'backup',
        message: `Backup created for ${backup.name}`,
        timestamp: backup.timestamp,
      });
    }

    // Sort by timestamp descending
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }
}

export const systemService = new SystemService();
