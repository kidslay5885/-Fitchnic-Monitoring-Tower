/**
 * In-memory job store for v0 runtime.
 * In production, replace with a database (SQLite + Prisma, PostgreSQL, etc.)
 */
import type { Job } from "./types";

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function setJob(job: Job): void {
  jobs.set(job.id, job);
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
