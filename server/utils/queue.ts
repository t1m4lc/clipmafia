/**
 * In-memory job queue for processing videos.
 * In production, replace with a proper queue system (BullMQ, etc.)
 */
interface QueueJob {
  jobId: string;
  videoId: string;
  userId: string;
  subtitleSettings?: any;
  addedAt: Date;
  status: "pending" | "running" | "done" | "error";
}

class JobQueue {
  private queue: QueueJob[] = [];
  private processing: boolean = false;
  private concurrency: number = 1;

  /**
   * Add a job to the queue.
   */
  async add(job: Omit<QueueJob, "addedAt" | "status">): Promise<void> {
    this.queue.push({
      ...job,
      addedAt: new Date(),
      status: "pending",
    });

    // Auto-process if not already running
    if (!this.processing) {
      this.processNext();
    }
  }

  /**
   * Process the next job in the queue.
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;

    const nextJob = this.queue.find((j) => j.status === "pending");
    if (!nextJob) return;

    this.processing = true;
    nextJob.status = "running";

    try {
      // Dynamically import the processing function to avoid circular dependencies
      const { processVideoJob } = await import("../api/process/run.post");
      await processVideoJob(
        nextJob.jobId,
        nextJob.videoId,
        nextJob.userId,
        nextJob.subtitleSettings,
      );
      nextJob.status = "done";
    } catch (error) {
      console.error(`Queue job ${nextJob.jobId} failed:`, error);
      nextJob.status = "error";
    } finally {
      this.processing = false;
      // Process next job
      this.processNext();
    }
  }

  /**
   * Get queue status.
   */
  getStatus(): { pending: number; running: number; completed: number } {
    return {
      pending: this.queue.filter((j) => j.status === "pending").length,
      running: this.queue.filter((j) => j.status === "running").length,
      completed: this.queue.filter((j) => j.status === "done").length,
    };
  }
}

// Singleton instance
export const jobQueue = new JobQueue();

/**
 * Update job status in the database.
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus | undefined,
  progress: number | undefined,
  extra?: Record<string, any>,
): Promise<void> {
  const supabase = useSupabaseAdmin();

  const updateData: any = {
    updated_at: new Date().toISOString(),
    ...extra,
  };

  if (status) {
    updateData.status = status;
  }
  if (progress !== undefined) {
    updateData.progress = progress;
  }

  if (status === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) {
    console.error(`Failed to update job ${jobId}:`, error);
  }
}
